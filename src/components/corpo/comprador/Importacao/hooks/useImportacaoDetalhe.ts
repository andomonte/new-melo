/**
 * Hook para gerenciar o estado do detalhe de uma importação
 * Busca dados da API, gerencia edição e salva alterações
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/components/services/api';
import type {
  ImportacaoCabecalho,
  ContratoCambio,
  FaturaImportacao,
  ImportacaoTab,
  ResumoCustos,
  ItemImportacao,
} from '../types/importacao';

export function useImportacaoDetalhe(importacaoId?: number) {
  const isNovo = !importacaoId;
  const [activeTab, setActiveTab] = useState<ImportacaoTab>('geral');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [cabecalho, setCabecalho] = useState<Partial<ImportacaoCabecalho>>({
    status: 'N',
  });
  const [contratos, setContratos] = useState<ContratoCambio[]>([]);
  const [faturas, setFaturas] = useState<FaturaImportacao[]>([]);
  const [resumoCustos, setResumoCustos] = useState<ResumoCustos | null>(null);

  const readOnly = cabecalho.status === 'E' || cabecalho.status === 'C';

  // Flag para auto-save após operações (autoAssociar, vincularPedidos)
  const [pendingSave, setPendingSave] = useState(false);

  // Buscar dados da API quando importacaoId muda
  const fetchData = useCallback(async () => {
    if (!importacaoId) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/api/importacao/${importacaoId}`);
      if (response.data?.success) {
        const d = response.data.data;

        // Separar contratos, entradas e itens do cabeçalho
        const { contratos: ctrs, entradas, itens, ...cab } = d;

        // Converter campos numéricos que vêm como string do PostgreSQL
        const numFields = [
          'taxa_dolar', 'total_mercadoria', 'frete', 'seguro', 'thc', 'total_cif',
          'pis', 'cofins', 'pis_cofins', 'ii', 'ipi', 'icms_st',
          'anuencia', 'siscomex', 'contrato_cambio',
          'despachante', 'freteorigem_total', 'infraero_porto',
          'carreteiro_eadi', 'carreteiro_melo', 'eadi',
          'peso_liquido', 'qtd_adicoes',
        ];
        for (const f of numFields) {
          if (cab[f] !== undefined && cab[f] !== null) {
            cab[f] = parseFloat(String(cab[f]));
          }
        }

        // Converter campos date que vêm como ISO timestamp para YYYY-MM-DD
        const dateFields = ['data_di', 'data_entrada_brasil'];
        for (const f of dateFields) {
          if (cab[f]) {
            cab[f] = String(cab[f]).slice(0, 10);
          }
        }

        setCabecalho(cab);

        // Contratos - converter numerics
        const contratosFormatados = (ctrs || []).map((c: any) => ({
          ...c,
          taxa_dolar: parseFloat(String(c.taxa_dolar || 0)),
          vl_merc_dolar: parseFloat(String(c.vl_merc_dolar || 0)),
          vl_reais: c.vl_reais ? parseFloat(String(c.vl_reais)) : undefined,
        }));
        setContratos(contratosFormatados);

        // Montar faturas a partir de entradas + itens
        const entradasArr = entradas || [];
        const itensArr = itens || [];
        const faturasFormatadas: FaturaImportacao[] = entradasArr.map((ent: any) => ({
          ...ent,
          itens: itensArr
            .filter((it: any) => it.id_fatura === ent.id)
            .map((it: any) => ({
              ...it,
              qtd: parseFloat(String(it.qtd || 0)),
              proforma_unit: parseFloat(String(it.proforma_unit || 0)),
              proforma_total: parseFloat(String(it.proforma_total || 0)),
              invoice_unit: parseFloat(String(it.invoice_unit || 0)),
              invoice_total: parseFloat(String(it.invoice_total || 0)),
              id_orc: it.id_orc ? parseInt(String(it.id_orc)) : undefined,
            })),
        }));
        setFaturas(faturasFormatadas);

        // Resumo de custos - calcular a partir dos dados carregados
        if (contratosFormatados.length > 0) {
          const totalUSD = contratosFormatados.reduce((s: number, c: ContratoCambio) => s + (c.vl_merc_dolar || 0), 0);
          const totalBRL = contratosFormatados.reduce((s: number, c: ContratoCambio) => s + ((c.vl_merc_dolar || 0) * (c.taxa_dolar || 0)), 0);
          const dolarMedio = totalUSD > 0 ? totalBRL / totalUSD : 0;

          const totalImpostos = (cab.pis || 0) + (cab.cofins || 0) + (cab.pis_cofins || 0) + (cab.ii || 0) + (cab.ipi || 0) + (cab.icms_st || 0);
          const totalDespesas = (cab.anuencia || 0) + (cab.siscomex || 0) + (cab.despachante || 0) +
            (cab.freteorigem_total || 0) + (cab.infraero_porto || 0) +
            (cab.carreteiro_eadi || 0) + (cab.carreteiro_melo || 0) + (cab.eadi || 0) +
            ((cab.contrato_cambio || 0) * (cab.taxa_dolar || 0));

          setResumoCustos({
            total_mercadoria_usd: cab.total_mercadoria || 0,
            total_cif_usd: cab.total_cif || 0,
            total_cif_brl: (cab.total_cif || 0) * (cab.taxa_dolar || 0),
            total_impostos_brl: totalImpostos,
            total_despesas_brl: totalDespesas,
            total_geral_brl: ((cab.total_cif || 0) * dolarMedio) + totalImpostos + totalDespesas,
            taxa_dolar_di: cab.taxa_dolar || 0,
            taxa_dolar_medio: dolarMedio,
            qtd_itens: itensArr.length,
            qtd_contratos: contratosFormatados.length,
          });
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar importação:', err);
      setError(err?.response?.data?.message || err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [importacaoId]);

  useEffect(() => {
    if (importacaoId) {
      setActiveTab('geral');
      fetchData();
    } else {
      // Reset para novo
      setCabecalho({ status: 'N' });
      setContratos([]);
      setFaturas([]);
      setResumoCustos(null);
    }
  }, [importacaoId, fetchData]);

  // Salvar alterações (PUT)
  const salvar = useCallback(async () => {
    if (!importacaoId) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        ...cabecalho,
        contratos: contratos.map((c) => ({
          contrato: c.contrato,
          data: c.data || null,
          taxa_dolar: c.taxa_dolar || 0,
          vl_merc_dolar: c.vl_merc_dolar || 0,
          vl_reais: c.vl_reais || ((c.vl_merc_dolar || 0) * (c.taxa_dolar || 0)),
          moeda: c.moeda || 'USD',
          id_titulo_pagar: c.id_titulo_pagar || null,
        })),
        faturas: faturas.map((f) => ({
          id: f.id,
          cod_credor: f.cod_credor,
          fornecedor_nome: f.fornecedor_nome || null,
          cod_cliente: f.cod_cliente || null,
          cod_comprador: f.cod_comprador || null,
          itens: (f.itens || []).map((item) => ({
            codprod: item.codprod || null,
            descricao: item.descricao || '',
            qtd: item.qtd || 0,
            proforma_unit: item.proforma_unit || 0,
            invoice_unit: item.invoice_unit || 0,
            ncm: item.ncm || null,
            unidade: item.unidade || null,
            numero_adicao: item.numero_adicao || null,
            id_orc: item.id_orc || null,
          })),
        })),
      };

      const response = await api.put(`/api/importacao/${importacaoId}`, payload);
      if (response.data?.success) {
        // Recarregar dados atualizados
        await fetchData();
        return true;
      } else {
        setError(response.data?.message || 'Erro ao salvar');
        return false;
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro ao salvar');
      return false;
    } finally {
      setSaving(false);
    }
  }, [importacaoId, cabecalho, contratos, faturas, fetchData]);

  // Auto-save: quando pendingSave é true e faturas atualiza, salvar automaticamente
  useEffect(() => {
    if (pendingSave && importacaoId) {
      setPendingSave(false);
      salvar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturas, pendingSave]);

  // Contratos
  const addContrato = (contrato: ContratoCambio) => {
    setContratos((prev) => [...prev, contrato]);
  };

  const removeContrato = (index: number) => {
    setContratos((prev) => prev.filter((_, i) => i !== index));
  };

  // Faturas
  const addFatura = (dados?: Partial<FaturaImportacao>) => {
    setFaturas((prev) => [
      ...prev,
      {
        id_importacao: importacaoId || 0,
        cod_credor: dados?.cod_credor || '',
        fornecedor_nome: dados?.fornecedor_nome,
        cod_cliente: dados?.cod_cliente,
        cod_comprador: dados?.cod_comprador,
        itens: [],
      },
    ]);
  };

  const removeFatura = (index: number) => {
    setFaturas((prev) => prev.filter((_, i) => i !== index));
  };

  // Itens
  const addItem = (faturaIndex: number, item: ItemImportacao) => {
    setFaturas((prev) => {
      const novas = [...prev];
      if (!novas[faturaIndex].itens) novas[faturaIndex].itens = [];
      novas[faturaIndex].itens!.push(item);
      return novas;
    });
  };

  const removeItem = (faturaIndex: number, itemIndex: number) => {
    setFaturas((prev) => {
      const novas = [...prev];
      novas[faturaIndex].itens = novas[faturaIndex].itens?.filter(
        (_, i) => i !== itemIndex
      );
      return novas;
    });
  };

  // Auto-associar itens de todas as faturas via endpoint inteligente
  const [autoAssociando, setAutoAssociando] = useState(false);
  const [autoAssociadoStats, setAutoAssociadoStats] = useState<{
    total: number; associados: number; por_ref: number; por_ref_com_marca?: number; por_aprendizado: number; por_similaridade: number;
  } | null>(null);

  const autoAssociar = useCallback(async () => {
    // Montar lista flat de todos os itens pendentes (sem codprod)
    const itensParaAssociar: { faturaIdx: number; itemIdx: number; index: number; descricao: string; ncm?: string }[] = [];
    let globalIdx = 0;

    faturas.forEach((fatura, faturaIdx) => {
      (fatura.itens || []).forEach((item, itemIdx) => {
        if (!item.codprod) {
          itensParaAssociar.push({
            faturaIdx,
            itemIdx,
            index: globalIdx,
            descricao: item.descricao || '',
            ncm: item.ncm,
          });
        }
        globalIdx++;
      });
    });

    if (itensParaAssociar.length === 0) {
      setError('Todos os itens já estão associados');
      return;
    }

    setAutoAssociando(true);
    setError('');
    setAutoAssociadoStats(null);

    try {
      const response = await api.post('/api/importacao/auto-associar', {
        itens: itensParaAssociar.map((i) => ({
          index: i.index,
          descricao: i.descricao,
          ncm: i.ncm,
        })),
      });

      if (response.data?.success) {
        const resultados = response.data.resultados || [];

        // Mapear resultados de volta para faturaIdx/itemIdx
        const indexMap = new Map(itensParaAssociar.map((i) => [i.index, i]));

        setFaturas((prev) => {
          const novas = prev.map((f) => ({ ...f, itens: [...(f.itens || [])] }));

          for (const resultado of resultados) {
            const mapeamento = indexMap.get(resultado.index);
            if (mapeamento) {
              const itens = novas[mapeamento.faturaIdx].itens!;
              itens[mapeamento.itemIdx] = {
                ...itens[mapeamento.itemIdx],
                codprod: resultado.codprod,
              };
            }
          }

          return novas;
        });

        // Auto-save: salvar no banco após a próxima atualização de faturas
        setPendingSave(true);

        setAutoAssociadoStats(response.data.stats);
      } else {
        setError(response.data?.message || 'Erro na auto-associação');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro na auto-associação');
    } finally {
      setAutoAssociando(false);
    }
  }, [faturas]);

  // Vincular itens (que já têm codprod) a pedidos de compra aprovados
  const [vinculandoPedidos, setVinculandoPedidos] = useState(false);
  const [vinculadoStats, setVinculadoStats] = useState<{
    total: number; vinculados: number;
  } | null>(null);

  const vincularPedidos = useCallback(async () => {
    // Para cada fatura, montar lista de itens que têm codprod mas não têm id_orc
    // Agrupa por faturaIdx (cada fatura tem seu fornecedor)
    const faturasPendentes: {
      faturaIdx: number;
      codCredor: string;
      fornecedorNome: string;
      itens: { codprod: string; faturaIdx: number; itemIdx: number; qtd: number }[];
    }[] = [];

    faturas.forEach((fatura, faturaIdx) => {
      const codCredor = fatura.cod_credor || '';
      const fornecedorNome = fatura.fornecedor_nome || '';

      // Precisa ter pelo menos cod_credor ou fornecedor_nome
      if (!codCredor && !fornecedorNome) return;

      const itensFatura: { codprod: string; faturaIdx: number; itemIdx: number; qtd: number }[] = [];
      (fatura.itens || []).forEach((item, itemIdx) => {
        if (item.codprod && !item.id_orc) {
          itensFatura.push({ codprod: item.codprod, faturaIdx, itemIdx, qtd: item.qtd || 0 });
        }
      });

      if (itensFatura.length > 0) {
        faturasPendentes.push({ faturaIdx, codCredor, fornecedorNome, itens: itensFatura });
      }
    });

    const totalItens = faturasPendentes.reduce((s, f) => s + f.itens.length, 0);
    if (totalItens === 0) {
      setError('Nenhum item elegível para vinculação (precisam ter código de produto e não ter pedido)');
      return;
    }

    setVinculandoPedidos(true);
    setError('');
    setVinculadoStats(null);

    try {
      let totalVinculados = 0;

      for (const faturaPendente of faturasPendentes) {
        const payload: any = { itens: faturaPendente.itens };

        // Passa cod_credor direto ou fornecedor_nome como fallback
        if (faturaPendente.codCredor) {
          payload.cod_credor = faturaPendente.codCredor;
        } else {
          payload.fornecedor_nome = faturaPendente.fornecedorNome;
        }

        const response = await api.post('/api/importacao/vincular-pedidos', payload);

        if (response.data?.success) {
          const resultados = response.data.resultados || [];
          const codCredorResolvido = response.data.cod_credor_resolvido;
          totalVinculados += resultados.length;

          setFaturas((prev) => {
            const novas = prev.map((f) => ({ ...f, itens: [...(f.itens || [])] }));

            // Atualizar cod_credor da fatura se foi resolvido pelo backend
            if (codCredorResolvido && !novas[faturaPendente.faturaIdx].cod_credor) {
              novas[faturaPendente.faturaIdx] = {
                ...novas[faturaPendente.faturaIdx],
                cod_credor: codCredorResolvido,
              };
            }

            // Atualizar id_orc dos itens vinculados
            for (const r of resultados) {
              const itensArr = novas[r.faturaIdx].itens!;
              itensArr[r.itemIdx] = {
                ...itensArr[r.itemIdx],
                id_orc: r.id_orc,
              };
            }

            return novas;
          });
        }
      }

      setVinculadoStats({ total: totalItens, vinculados: totalVinculados });

      // Auto-save: salvar no banco após a próxima atualização de faturas
      if (totalVinculados > 0) {
        setPendingSave(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro ao vincular pedidos');
    } finally {
      setVinculandoPedidos(false);
    }
  }, [faturas]);

  // Associar + Vincular combinado (1 clique)
  const [associandoEVinculando, setAssociandoEVinculando] = useState(false);
  const [associarEVincularStats, setAssociarEVincularStats] = useState<{
    total_itens: number; associados: number; vinculados: number;
    por_ref: number; por_ref_com_marca?: number; por_aprendizado: number; por_similaridade: number;
  } | null>(null);

  const associarEVincular = useCallback(async () => {
    // Montar payload com todas as faturas e seus itens
    const faturasPayload = faturas.map((fatura, faturaIdx) => ({
      faturaIdx,
      cod_credor: fatura.cod_credor || '',
      fornecedor_nome: fatura.fornecedor_nome || '',
      itens: (fatura.itens || []).map((item, itemIdx) => ({
        itemIdx,
        descricao: item.descricao || '',
        ncm: item.ncm,
        qtd: item.qtd || 0,
        codprod: item.codprod || '',
        id_orc: item.id_orc || undefined,
      })),
    }));

    const totalItens = faturasPayload.reduce((s, f) => s + f.itens.length, 0);
    if (totalItens === 0) {
      setError('Nenhum item para processar');
      return;
    }

    setAssociandoEVinculando(true);
    setError('');
    setAssociarEVincularStats(null);
    setAutoAssociadoStats(null);
    setVinculadoStats(null);

    try {
      const response = await api.post('/api/importacao/associar-e-vincular', {
        id_importacao: importacaoId,
        faturas: faturasPayload,
      });

      if (response.data?.success) {
        const associacoes = response.data.associacoes || [];
        const vinculacoes = response.data.vinculacoes || [];

        // Aplicar codprod E id_orc em um único setFaturas
        setFaturas((prev) => {
          const novas = prev.map((f) => ({ ...f, itens: [...(f.itens || [])] }));

          for (const a of associacoes) {
            const itens = novas[a.faturaIdx].itens!;
            itens[a.itemIdx] = { ...itens[a.itemIdx], codprod: a.codprod };
          }

          for (const v of vinculacoes) {
            const itens = novas[v.faturaIdx].itens!;
            itens[v.itemIdx] = { ...itens[v.itemIdx], id_orc: v.id_orc };
          }

          return novas;
        });

        setAssociarEVincularStats(response.data.stats);

        // Auto-save
        if (associacoes.length > 0 || vinculacoes.length > 0) {
          setPendingSave(true);
        }
      } else {
        setError(response.data?.message || 'Erro na operação');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro ao associar e vincular');
    } finally {
      setAssociandoEVinculando(false);
    }
  }, [faturas, importacaoId]);

  // Calcular custos da DI
  const [calculandoCustos, setCalculandoCustos] = useState(false);

  const calcularCustos = useCallback(async () => {
    if (!importacaoId) return;

    setCalculandoCustos(true);
    setError('');

    try {
      const response = await api.post(`/api/importacao/${importacaoId}/calcular-custos`);

      if (response.data?.success) {
        // Recarregar dados para refletir os custos calculados
        await fetchData();
      } else {
        setError(response.data?.message || 'Erro ao calcular custos');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro ao calcular custos');
    } finally {
      setCalculandoCustos(false);
    }
  }, [importacaoId, fetchData]);

  // Gerar entradas de estoque a partir da DI
  const [gerandoEntradas, setGerandoEntradas] = useState(false);

  const gerarEntradas = useCallback(async () => {
    if (!importacaoId) return;

    setGerandoEntradas(true);
    setError('');

    try {
      const response = await api.post(`/api/importacao/${importacaoId}/gerar-entradas`);

      if (response.data?.success) {
        // Recarregar dados - DI agora tem status='E' (readOnly)
        await fetchData();
      } else {
        setError(response.data?.message || 'Erro ao gerar entradas');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro ao gerar entradas');
    } finally {
      setGerandoEntradas(false);
    }
  }, [importacaoId, fetchData]);

  // Importar itens do pedido de compra (manual, via modal)
  const importarDoPedido = useCallback((faturaIdx: number, itensImportados: ItemImportacao[]) => {
    setFaturas((prev) => {
      const novas = prev.map((f) => ({ ...f, itens: [...(f.itens || [])] }));
      for (const item of itensImportados) {
        novas[faturaIdx].itens!.push(item);
      }
      return novas;
    });
  }, []);

  // Dividir um item em duas partes (para vincular a OCs diferentes)
  const dividirItem = useCallback((faturaIndex: number, itemIndex: number, qtdPrimeiro: number) => {
    setFaturas((prev) => {
      const novas = prev.map((f) => ({ ...f, itens: [...(f.itens || [])] }));
      const itens = novas[faturaIndex].itens!;
      const original = itens[itemIndex];
      const qtdSegundo = original.qtd - qtdPrimeiro;

      // Item 1: quantidade reduzida
      itens[itemIndex] = {
        ...original,
        qtd: qtdPrimeiro,
        proforma_total: qtdPrimeiro * original.proforma_unit,
        invoice_total: qtdPrimeiro * original.invoice_unit,
      };

      // Item 2: nova linha com o restante (sem id_orc - precisa revincular)
      const novoItem: ItemImportacao = {
        ...original,
        id: undefined,
        qtd: qtdSegundo,
        proforma_total: qtdSegundo * original.proforma_unit,
        invoice_total: qtdSegundo * original.invoice_unit,
        id_orc: undefined,
      };

      itens.splice(itemIndex + 1, 0, novoItem);
      return novas;
    });

    setPendingSave(true);
  }, []);

  // Mover itens de uma fatura para outra (existente ou nova)
  const moverItens = useCallback((
    faturaOrigemIdx: number,
    itensIndices: number[],
    destinoFaturaIdx: number | 'nova'
  ) => {
    setFaturas((prev) => {
      const novas = prev.map((f) => ({ ...f, itens: [...(f.itens || [])] }));
      const origem = novas[faturaOrigemIdx];

      // Extrair itens selecionados (manter ordem)
      const itensMover = itensIndices
        .sort((a, b) => a - b)
        .map((idx) => ({ ...origem.itens![idx], id: undefined }));

      // Remover da origem (de tras pra frente para nao deslocar indices)
      [...itensIndices].sort((a, b) => b - a).forEach((idx) => {
        origem.itens!.splice(idx, 1);
      });

      if (destinoFaturaIdx === 'nova') {
        novas.push({
          id_importacao: origem.id_importacao,
          cod_credor: origem.cod_credor,
          fornecedor_nome: origem.fornecedor_nome,
          cod_cliente: origem.cod_cliente,
          cod_comprador: origem.cod_comprador,
          itens: itensMover,
        });
      } else {
        novas[destinoFaturaIdx].itens!.push(...itensMover);
      }

      return novas;
    });

    setPendingSave(true);
  }, []);

  // Atualizar campos de um item específico (ex: associar codprod)
  const updateItem = (faturaIndex: number, itemIndex: number, updates: Partial<ItemImportacao>) => {
    setFaturas((prev) => {
      const novas = [...prev];
      const itens = [...(novas[faturaIndex].itens || [])];
      itens[itemIndex] = { ...itens[itemIndex], ...updates };
      novas[faturaIndex] = { ...novas[faturaIndex], itens };
      return novas;
    });
  };

  return {
    isNovo,
    loading,
    saving,
    error,
    activeTab,
    setActiveTab,
    cabecalho,
    setCabecalho,
    contratos,
    faturas,
    resumoCustos,
    readOnly,
    salvar,
    fetchData,
    addContrato,
    removeContrato,
    addFatura,
    removeFatura,
    addItem,
    removeItem,
    updateItem,
    autoAssociar,
    autoAssociando,
    autoAssociadoStats,
    vincularPedidos,
    vinculandoPedidos,
    vinculadoStats,
    associarEVincular,
    associandoEVinculando,
    associarEVincularStats,
    calcularCustos,
    calculandoCustos,
    gerarEntradas,
    gerandoEntradas,
    importarDoPedido,
    dividirItem,
    moverItens,
  };
}
