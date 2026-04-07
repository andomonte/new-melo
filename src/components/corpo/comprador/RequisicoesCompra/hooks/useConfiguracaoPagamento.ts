import { useState, useEffect } from 'react';
import api from '@/components/services/api';
import { toast } from 'sonner';

export interface Banco {
  banco: string;
  nome: string;
}

export interface ParcelaPagamento {
  id?: number;
  numero_parcela: number;
  dias: number;
  data_vencimento: string;
  valor_parcela: number;
  status?: string;
  numero_duplicata?: string; // Número da duplicata (do XML ou gerado)
  origem?: 'XML' | 'ANTECIPADO'; // Origem da parcela (para mostrar badge)
}

export interface ConfiguracaoPagamento {
  banco: string;
  tipoDocumento: string;
  valorEntrada: string;
  habilitarEntrada: boolean;
  parcelas: ParcelaPagamento[];
}

export interface UseConfiguracaoPagamentoReturn {
  bancos: Banco[];
  configuracao: ConfiguracaoPagamento;
  loading: boolean;
  error: string | null;
  setConfiguracao: React.Dispatch<React.SetStateAction<ConfiguracaoPagamento>>;
  buscarBancos: () => Promise<void>;
  salvarConfiguracao: (orcId: number) => Promise<boolean>;
  buscarConfiguracao: (orcId: number) => Promise<void>;
  adicionarParcela: (dias: number, valorParcela: number) => void;
  removerParcela: (index: number) => void;
  atualizarParcela: (index: number, campo: keyof ParcelaPagamento, valor: any) => void;
  limparConfiguracao: () => void;
}

export function useConfiguracaoPagamento(): UseConfiguracaoPagamentoReturn {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [configuracao, setConfiguracao] = useState<ConfiguracaoPagamento>({
    banco: 'MELO COM', // Máx 10 chars (varchar(10) no banco)
    tipoDocumento: 'BOLETO',
    valorEntrada: '0',
    habilitarEntrada: false,
    parcelas: [],
  });

  const buscarBancos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/bancos');
      setBancos(response.data);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar bancos:', err);
      setError('Erro ao buscar lista de bancos');
      toast.error('Erro ao carregar bancos');
    } finally {
      setLoading(false);
    }
  };

  const buscarConfiguracao = async (orcId: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/ordens/${orcId}/parcelas-pagamento`);

      console.log('=== RESPOSTA API PARCELAS-PAGAMENTO ===');
      console.log('Response data:', response.data);
      console.log('Configuração encontrada:', response.data.configuracao);

      if (response.data.configuracao) {
        console.log('Setando configuração:', response.data.configuracao);
        setConfiguracao(response.data.configuracao);
      } else {
        console.log('Nenhuma configuração encontrada na resposta');
      }
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar configuração:', err);
      setError('Erro ao buscar configuração de pagamento');
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracao = async (orcId: number): Promise<boolean> => {
    try {
      setLoading(true);

      // Validação: deve ter pelo menos uma parcela (pode ser só entrada)
      if (configuracao.parcelas.length === 0) {
        toast.error('Adicione pelo menos uma parcela ou configure o valor de entrada');
        return false;
      }

      // Se tem entrada, remover o "Pagamento Antecipado" da lista de parcelas
      // porque ele já vai separado como valorEntrada
      const parcelasParaEnviar = configuracao.habilitarEntrada
        ? configuracao.parcelas.slice(1) // Pula a primeira (Pagamento Antecipado)
        : configuracao.parcelas;

      const valorEntradaNumerico = configuracao.habilitarEntrada ? parseFloat(configuracao.valorEntrada) : 0;

      // DEBUG: Log do que está sendo enviado
      console.log('=== DEBUG FRONTEND ===');
      console.log('Configuração completa:', configuracao);
      console.log('Valor Entrada (string):', configuracao.valorEntrada);
      console.log('Valor Entrada (numeric):', valorEntradaNumerico);
      console.log('Parcelas para enviar:', parcelasParaEnviar.length, parcelasParaEnviar.map(p => ({ numero: p.numero_parcela, valor: p.valor_parcela })));
      console.log('Soma das parcelas:', parcelasParaEnviar.reduce((acc, p) => acc + p.valor_parcela, 0));
      console.log('Total calculado:', valorEntradaNumerico + parcelasParaEnviar.reduce((acc, p) => acc + p.valor_parcela, 0));

      const response = await api.post(`/api/ordens/${orcId}/configurar-pagamento`, {
        banco: configuracao.banco,
        tipoDocumento: configuracao.tipoDocumento,
        valorEntrada: valorEntradaNumerico,
        parcelas: parcelasParaEnviar,
      });

      if (response.data.success) {
        toast.success('Configuração de pagamento salva com sucesso!');
        setError(null);
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('Erro ao salvar configuração:', err);
      const errorMsg = err.response?.data?.error || 'Erro ao salvar configuração de pagamento';
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const adicionarParcela = (dias: number, valorParcela: number) => {
    if (!dias || dias <= 0) {
      toast.error('Informe um prazo válido (maior que 0)');
      return;
    }

    // Calcular data baseado nos dias ACUMULADOS de todas as parcelas anteriores
    setConfiguracao(prev => {
      const diasAcumulados = prev.parcelas.reduce((acc, p) => acc + p.dias, 0) + dias;

      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + diasAcumulados);

      // Se tem entrada habilitada e é a primeira parcela, é "Pagamento Antecipado"
      const isEntrada = prev.habilitarEntrada && prev.parcelas.length === 0;

      // Contar apenas parcelas normais (excluindo entrada) para numeração
      const parcelasNormais = prev.parcelas.filter(p => p.numero_parcela > 0);
      const proximoNumeroParcela = isEntrada ? 0 : parcelasNormais.length + 1;

      const novaParcela: ParcelaPagamento = {
        numero_parcela: proximoNumeroParcela,
        dias,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        valor_parcela: valorParcela,
        status: 'PENDENTE',
      };

      return {
        ...prev,
        parcelas: [...prev.parcelas, novaParcela],
      };
    });
  };

  const removerParcela = (index: number) => {
    setConfiguracao(prev => {
      const parcelasRestantes = prev.parcelas.filter((_, i) => i !== index);

      // Renumerar parcelas corretamente
      const parcelasRenumeradas = parcelasRestantes.map((p, i) => {
        // Se tem entrada, primeira parcela é 0 (Pagamento Antecipado), demais começam em 1
        const numero = prev.habilitarEntrada ? (i === 0 ? 0 : i) : i + 1;
        return {
          ...p,
          numero_parcela: numero,
        };
      });

      return {
        ...prev,
        parcelas: parcelasRenumeradas,
      };
    });
  };

  const atualizarParcela = (index: number, campo: keyof ParcelaPagamento, valor: any) => {
    setConfiguracao(prev => {
      const novasParcelas = [...prev.parcelas];

      // Se mudou os dias, recalcular TODAS as datas das parcelas seguintes
      if (campo === 'dias') {
        const diasNum = parseInt(valor) || 0;

        // Validar dias
        if (diasNum < 0) {
          toast.error('O prazo não pode ser negativo');
          return prev;
        }

        // Atualizar a parcela atual
        novasParcelas[index] = {
          ...novasParcelas[index],
          dias: diasNum,
        };

        // Recalcular datas de TODAS as parcelas baseado nos dias acumulados
        let diasAcumulados = 0;
        for (let i = 0; i < novasParcelas.length; i++) {
          diasAcumulados += novasParcelas[i].dias;
          const dataVencimento = new Date();
          dataVencimento.setDate(dataVencimento.getDate() + diasAcumulados);
          novasParcelas[i].data_vencimento = dataVencimento.toISOString().split('T')[0];
        }
      } else if (campo === 'data_vencimento') {
        // Se mudou a data manualmente, recalcular os dias e as parcelas seguintes
        const novaData = new Date(valor + 'T00:00:00');
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Calcular dias desde hoje até a nova data
        const diasDesdeHoje = Math.floor((novaData.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        // Calcular dias acumulados das parcelas anteriores
        let diasAcumuladosAnteriores = 0;
        for (let i = 0; i < index; i++) {
          diasAcumuladosAnteriores += novasParcelas[i].dias;
        }

        // Novo valor de dias para esta parcela
        const novosDias = Math.max(0, diasDesdeHoje - diasAcumuladosAnteriores);

        // Atualizar parcela atual com nova data e dias
        novasParcelas[index] = {
          ...novasParcelas[index],
          data_vencimento: valor,
          dias: novosDias,
        };

        // Recalcular parcelas seguintes baseado nos novos dias acumulados
        let diasAcumulados = 0;
        for (let i = 0; i <= index; i++) {
          diasAcumulados += novasParcelas[i].dias;
        }

        // Recalcular datas das parcelas seguintes
        for (let i = index + 1; i < novasParcelas.length; i++) {
          diasAcumulados += novasParcelas[i].dias;
          const dataVencimento = new Date();
          dataVencimento.setDate(dataVencimento.getDate() + diasAcumulados);
          novasParcelas[i].data_vencimento = dataVencimento.toISOString().split('T')[0];
        }
      } else {
        // Para outros campos, apenas atualizar
        novasParcelas[index] = {
          ...novasParcelas[index],
          [campo]: valor,
        };
      }

      return {
        ...prev,
        parcelas: novasParcelas,
      };
    });
  };

  const limparConfiguracao = () => {
    setConfiguracao({
      banco: 'MELO COM', // Máx 10 chars (varchar(10) no banco)
      tipoDocumento: 'BOLETO',
      valorEntrada: '0',
      habilitarEntrada: false,
      parcelas: [],
    });
  };

  return {
    bancos,
    configuracao,
    loading,
    error,
    setConfiguracao,
    buscarBancos,
    salvarConfiguracao,
    buscarConfiguracao,
    adicionarParcela,
    removerParcela,
    atualizarParcela,
    limparConfiguracao,
  };
}
