import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormFooter2 from '@/components/common/FormFooter2';
import { useDebounce } from 'use-debounce';
import type { Produto } from '../types';
import api from '@/components/services/api';
import { formataMoedaBR } from '@/components/common/InputMoeda';
import { useToast } from '@/hooks/use-toast';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import { motivoBloqueioRequisicao, rotuloStatus } from '../statusRequisicao';
import SugestaoAutomatica, { ItemSugestao } from './SugestaoAutomatica';
import CadastroProdutoModal from '@/components/corpo/admin/cadastro/produtos/modalCadastrar';
import { Plus } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProdutoSelecionado extends Produto {
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  observacao?: string;
}

interface AdicionarProdutosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (produtos: ProdutoSelecionado[]) => void;
  produtosJaAdicionados?: ProdutoSelecionado[];
  /** Fornecedor da requisição — filtra a busca/import pela marca do fornecedor. */
  codCredor?: string;
}

export const AdicionarProdutosModal: React.FC<AdicionarProdutosModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  produtosJaAdicionados = [],
  codCredor,
}) => {
  const { toast } = useToast();
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Produto não permitido',
    message: '',
  });
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [abaAdd, setAbaAdd] = useState<'buscar' | 'sugestao'>('buscar');
  // Cadastro de produto na hora, quando a busca não encontra
  const [showCadastroProduto, setShowCadastroProduto] = useState(false);

  // Itens vindos da Sugestão Automática entram no MESMO carrinho, usando a
  // quantidade sugerida e o preço da sugestão. Bloqueia D/S/N como no manual.
  const adicionarSugeridos = (itens: ItemSugestao[]) => {
    const bloqueados: string[] = [];
    const semValor: string[] = [];
    setProdutosSelecionados((prev) => {
      const mapa = new Map(prev.map((p) => [p.codprod, p]));
      itens.forEach((it) => {
        if (motivoBloqueioRequisicao((it as any).inf)) {
          bloqueados.push(it.ref || it.codprod);
          return;
        }
        const preco = Number(it.preco) || 0;
        // Não permite entrar com valor 0 — o preço é editável na lista da
        // sugestão; informe antes de adicionar.
        if (!(preco > 0)) {
          semValor.push(it.ref || it.codprod);
          return;
        }
        const qtd = Number(it.qtdSugerida) || 1;
        mapa.set(it.codprod, {
          ...(mapa.get(it.codprod) as any),
          codprod: it.codprod,
          descr: it.descr,
          marca: it.marca,
          ref: it.ref,
          quantidade: qtd,
          preco_unitario: preco,
          preco_total: qtd * preco,
          observacao: '',
        } as ProdutoSelecionado);
      });
      return Array.from(mapa.values());
    });
    const avisos: string[] = [];
    if (bloqueados.length) {
      avisos.push(
        `Desativados/substituídos/sem giro: ${bloqueados.slice(0, 5).join(', ')}${bloqueados.length > 5 ? '…' : ''}`,
      );
    }
    if (semValor.length) {
      avisos.push(
        `Sem preço (valor 0) — informe o preço na lista antes de adicionar: ${semValor.slice(0, 5).join(', ')}${semValor.length > 5 ? '…' : ''}`,
      );
    }
    if (avisos.length) {
      pedirConfirmacao(() => {}, {
        title: 'Alguns itens não foram adicionados',
        message: avisos.join('\n'),
        type: 'warning',
        confirmText: 'OK',
        somenteOk: true,
      });
    }
  };
  const [busca, setBusca] = useState('');
  const [debouncedBusca] = useDebounce(busca, 500);
  // Importação de planilha (CSV) REF;QUANTIDADE
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  // Fluxo por teclado (estilo Delphi): Enter na busca foca a quantidade;
  // Enter na quantidade volta o foco pra busca (próximo item).
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [focarQtdCodprod, setFocarQtdCodprod] = useState<string | null>(null);
  // Referências que a última importação NÃO encontrou (para ficar visível na tela).
  const [refsNaoImportadas, setRefsNaoImportadas] = useState<
    { ref: string; qtd: number; motivo: 'nao_encontrado' | 'bloqueado' }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalItens, setTotalItens] = useState(0);

  // Inicializar com produtos já adicionados se houver
  useEffect(() => {
    if (isOpen && produtosJaAdicionados.length > 0) {
      setProdutosSelecionados([...produtosJaAdicionados]);
    } else if (isOpen) {
      setProdutosSelecionados([]);
    }
  }, [isOpen, produtosJaAdicionados]);

  const buscarProdutos = async (termoBusca: string, paginaAtual: number = 1) => {
    setLoading(true);
    try {
      const response = await api.get('/api/compras/produtos', {
        params: {
          search: termoBusca,
          page: paginaAtual,
          perPage: 10,
          ...(codCredor ? { codCredor } : {}),
        },
      });

      if (response.data?.data) {
        setProdutos(response.data.data);
        setTotalPaginas(response.data.meta?.lastPage || 1);
        setTotalItens(response.data.meta?.total || 0);
        return response.data.data as Produto[];
      } else {
        setProdutos([]);
        setTotalPaginas(1);
        setTotalItens(0);
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      setProdutos([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Foca o campo de quantidade do produto recém-selecionado (após a linha existir).
  useEffect(() => {
    if (!focarQtdCodprod) return;
    const el = qtyInputRefs.current[focarQtdCodprod];
    if (el) {
      el.focus();
      el.select();
      setFocarQtdCodprod(null);
    }
  }, [focarQtdCodprod, produtos, produtosSelecionados]);

  // Enter na busca: se houver 1 produto (busca imediata, sem debounce), seleciona
  // e foca a quantidade. Com vários, apenas exibe a lista.
  const handleSearchEnter = async () => {
    const termo = busca.trim();
    if (!termo) return;
    const resultados = await buscarProdutos(termo, 1);
    setPagina(1);
    if (resultados.length === 1) {
      const prod = resultados[0];
      if (rotuloStatus(prod.inf)) {
        adicionarProduto(prod); // trata bloqueio/substituto (modal)
      } else {
        if (!produtoEstaSelecionado(prod.codprod)) inserirProduto(prod);
        setFocarQtdCodprod(prod.codprod);
      }
    }
  };

  // Enter na quantidade: item já está no carrinho; limpa a busca e volta o foco
  // pro campo de busca (pronto pro próximo item), como no Delphi.
  const handleQtdEnter = () => {
    setBusca('');
    setProdutos([]);
    setTotalItens(0);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (isOpen && debouncedBusca.trim()) {
      buscarProdutos(debouncedBusca, 1);
      setPagina(1);
    }
  }, [debouncedBusca, isOpen]);

  const handleBuscaChange = (value: string) => {
    setBusca(value);
  };

  const handlePaginaChange = (novaPagina: number) => {
    setPagina(novaPagina);
    buscarProdutos(debouncedBusca, novaPagina);
  };

  // Insere de fato no carrinho (sem revalidar status).
  const inserirProduto = (produto: Produto) => {
    const jaAdicionado = produtosSelecionados.find(p => p.codprod === produto.codprod);

    if (jaAdicionado) {
      // Se já está adicionado, incrementa quantidade
      setProdutosSelecionados(prev =>
        prev.map(p =>
          p.codprod === produto.codprod
            ? { ...p, quantidade: p.quantidade + 1, preco_total: (p.quantidade + 1) * p.preco_unitario }
            : p
        )
      );
    } else {
      // Adiciona novo produto
      const novoProduto: ProdutoSelecionado = {
        ...produto,
        quantidade: 1,
        preco_unitario: Number(produto.prcompra || 0),
        preco_total: Number(produto.prcompra || 0),
        observacao: '',
      };
      setProdutosSelecionados(prev => [...prev, novoProduto]);
    }
  };

  const adicionarProduto = async (produto: Produto) => {
    // Regra do Delphi: bloqueia incluir produto com inf D/S/N na requisição.
    const rotulo = rotuloStatus(produto.inf);
    if (rotulo) {
      // Bloqueado — tenta oferecer o substituto (dbprod_substituir).
      let substituto: Produto | null = null;
      try {
        const resp = await api.get('/api/produtos/substituto-requisicao', {
          params: { codprod: produto.codprod },
        });
        substituto = resp.data?.substituto ?? null;
      } catch {
        substituto = null;
      }

      if (substituto) {
        pedirConfirmacao(() => inserirProduto(substituto as Produto), {
          title: 'Produto substituído',
          message: `O produto ${produto.ref || produto.codprod} está ${rotulo}.\nDeseja adicionar o substituto ${substituto.ref} - ${substituto.descr}?`,
          type: 'warning',
          confirmText: 'Sim, adicionar substituto',
          cancelText: 'Não',
        });
      } else {
        pedirConfirmacao(() => {}, {
          title: 'Produto não permitido',
          message: motivoBloqueioRequisicao(produto.inf) as string,
          type: 'warning',
          confirmText: 'OK',
          somenteOk: true,
        });
      }
      return;
    }

    inserirProduto(produto);
  };

  const removerProduto = (codprod: string) => {
    setProdutosSelecionados(prev => prev.filter(p => p.codprod !== codprod));
  };

  const alterarQuantidade = (codprod: string, delta: number) => {
    setProdutosSelecionados(prev => 
      prev.map(p => {
        if (p.codprod === codprod) {
          const novaQuantidade = Math.max(1, p.quantidade + delta);
          return {
            ...p,
            quantidade: novaQuantidade,
            preco_total: novaQuantidade * p.preco_unitario,
          };
        }
        return p;
      }).filter(p => p.quantidade > 0)
    );
  };

  const definirQuantidade = (codprod: string, quantidade: number) => {
    setProdutosSelecionados(prev =>
      prev.map(p => {
        if (p.codprod === codprod) {
          const novaQuantidade = Math.max(1, quantidade); // Mínimo 1
          return {
            ...p,
            quantidade: novaQuantidade,
            preco_total: novaQuantidade * p.preco_unitario,
          };
        }
        return p;
      })
    );
  };

  const alterarPreco = (codprod: string, novoPreco: number) => {
    setProdutosSelecionados(prev => 
      prev.map(p => {
        if (p.codprod === codprod) {
          return {
            ...p,
            preco_unitario: novoPreco,
            preco_total: p.quantidade * novoPreco,
          };
        }
        return p;
      })
    );
  };

  // Importação de planilha (CSV ou Excel): lê colunas REF;QUANTIDADE, casa a REF
  // com o cadastro (dbprod.ref) e adiciona ao carrinho com o preço de compra.
  const parseQtd = (v: any): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v ?? '').trim();
    if (!s) return NaN;
    // Ignora valores que parecem DATA (ex.: 20.07.2026, 20/07/26) — não é quantidade.
    if (/\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4}/.test(s)) return NaN;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')); // trata milhar/decimal pt-BR
  };

  // Identifica a linha de cabeçalho (REF / QTE|QTD|PEDIDO|QUANTIDADE) para começar
  // a ler os itens SÓ depois dela (ignora nome do fornecedor + data no topo).
  const ehLinhaCabecalho = (c0: string, c1: string): boolean => {
    const a = c0.toLowerCase().replace(/[^a-z]/g, '');
    const b = c1.toLowerCase().replace(/[^a-z]/g, '');
    return a.startsWith('ref') && (b.startsWith('qt') || b.includes('quant') || b.includes('pedido'));
  };

  const extrairItens = (rows: any[][]): { ref: string; qtd: number }[] => {
    // Começa após a linha de cabeçalho, se houver; senão, do início.
    let inicio = 0;
    for (let i = 0; i < rows.length; i++) {
      const c0 = String(rows[i]?.[0] ?? '').trim();
      const c1 = String(rows[i]?.[1] ?? '').trim();
      if (ehLinhaCabecalho(c0, c1)) { inicio = i + 1; break; }
    }
    const itens: { ref: string; qtd: number }[] = [];
    for (let i = inicio; i < rows.length; i++) {
      const cols = rows[i];
      const ref = String(cols?.[0] ?? '').replace(/^﻿/, '').trim();
      const qtd = parseQtd(cols?.[1]);
      const refUpper = ref.toUpperCase().replace(/[^A-Z]/g, '');
      if (!ref || refUpper === 'REF') continue; // ignora cabeçalho/nome fornecedor
      if (!Number.isFinite(qtd) || qtd <= 0) continue; // ignora linhas sem quantidade
      itens.push({ ref, qtd });
    }
    return itens;
  };

  const lerArquivoComoItens = async (file: File): Promise<{ ref: string; qtd: number }[]> => {
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false, raw: true });
      return extrairItens(rows);
    }
    // CSV / TXT (separador ; , ou tab)
    const texto = await file.text();
    const rows = texto
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .map((l) => l.split(/[;,\t]/));
    return extrairItens(rows);
  };

  const handleImportarArquivo = async (file: File) => {
    setImportando(true);
    try {
      const itens = await lerArquivoComoItens(file);
      if (itens.length === 0) {
        pedirConfirmacao(() => {}, {
          title: 'Planilha sem itens',
          message: 'Não encontrei linhas no formato REF;QUANTIDADE no arquivo.',
          type: 'warning',
          confirmText: 'OK',
          somenteOk: true,
        });
        return;
      }

      const resp = await api.post('/api/compras/produtos/por-referencias', {
        refs: itens.map((i) => i.ref),
        ...(codCredor ? { codCredor } : {}),
      });
      const encontrados: any[] = resp.data?.data || [];
      // O backend retorna `ref_busca` = a referência de entrada que casou.
      const mapa = new Map(
        encontrados.map((p) => [String(p.ref_busca ?? p.ref ?? '').trim().toLowerCase(), p]),
      );

      const naoEncontrados: { ref: string; qtd: number; motivo: 'nao_encontrado' | 'bloqueado' }[] = [];
      const cart = new Map(produtosSelecionados.map((p) => [p.codprod, p]));

      for (const it of itens) {
        const prod = mapa.get(it.ref.trim().toLowerCase());
        if (!prod) { naoEncontrados.push({ ref: it.ref, qtd: it.qtd, motivo: 'nao_encontrado' }); continue; }
        if (motivoBloqueioRequisicao(prod.inf)) { naoEncontrados.push({ ref: it.ref, qtd: it.qtd, motivo: 'bloqueado' }); continue; }
        const preco = Number(prod.prcompra) || 0;
        const anterior = cart.get(prod.codprod) as any;
        cart.set(prod.codprod, {
          ...anterior,
          ...prod,
          quantidade: it.qtd,
          preco_unitario: preco,
          preco_total: it.qtd * preco,
          observacao: anterior?.observacao || '',
        } as ProdutoSelecionado);
      }

      setProdutosSelecionados(Array.from(cart.values()));
      setRefsNaoImportadas(naoEncontrados);
      setAbaAdd('buscar');

      const totalOk = itens.length - naoEncontrados.length;
      const msgs: string[] = [`${totalOk} de ${itens.length} item(ns) importado(s).`];
      if (naoEncontrados.length) {
        msgs.push(`${naoEncontrados.length} referência(s) não importada(s) — veja a lista destacada na tela para buscar ou cadastrar.`);
      }
      pedirConfirmacao(() => {}, {
        title: 'Importação concluída',
        message: msgs.join('\n'),
        type: naoEncontrados.length ? 'warning' : 'success',
        confirmText: 'OK',
        somenteOk: true,
      });
    } catch (error) {
      console.error('Erro ao importar planilha:', error);
      pedirConfirmacao(() => {}, {
        title: 'Erro na importação',
        message: 'Não foi possível ler o arquivo. Use um CSV com as colunas REF e QUANTIDADE (separador ; ou ,).',
        type: 'warning',
        confirmText: 'OK',
        somenteOk: true,
      });
    } finally {
      setImportando(false);
    }
  };

  const handleConfirmar = () => {
    // Não permitir itens com valor 0 — obrigatório valor > 0 para adicionar
    const semValor = produtosSelecionados.filter(
      (p) => !(Number(p.preco_unitario) > 0),
    );
    if (semValor.length > 0) {
      pedirConfirmacao(() => {}, {
        title: 'Informe um valor maior que 0',
        message: `${semValor.length} item(ns) estão com valor 0:\n${semValor
          .map((p) => p.ref || p.codprod)
          .slice(0, 5)
          .join(', ')}${semValor.length > 5 ? '…' : ''}`,
        type: 'warning',
        confirmText: 'OK',
        somenteOk: true,
      });
      return;
    }
    onConfirm(produtosSelecionados);
    onClose();
  };

  const handleLimpar = () => {
    setProdutosSelecionados([]);
    setBusca('');
    setProdutos([]);
  };

  const produtoEstaSelecionado = (codprod: string) => {
    return produtosSelecionados.some(p => p.codprod === codprod);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo - Replicando o padrão do sistema */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">Adicionar Produtos</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter2
              onSubmit={handleConfirmar}
              onClear={handleLimpar}
              isSaving={false}
              hasChanges={produtosSelecionados.length > 0}
              submitText="Adicionar à Compra"
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto">

            {/* Abas: Buscar Produtos | Sugestão Automática */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-600">
              {([
                ['buscar', 'Buscar Produtos'],
                ['sugestao', 'Sugestão Automática'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAbaAdd(val)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    abaAdd === val
                      ? 'border-[#347AB6] text-[#347AB6]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {abaAdd === 'buscar' && (
            <>
            {/* Campo de busca + importar planilha */}
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar produtos por código, descrição ou marca... (Enter seleciona)"
                  value={busca}
                  onChange={(e) => handleBuscaChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchEnter();
                    }
                  }}
                  className="pl-10 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                  autoFocus
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportarArquivo(file);
                  e.target.value = ''; // permite reimportar o mesmo arquivo
                }}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importando}
                className="whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2"
                title="Importar planilha Excel/CSV (colunas: REF e QUANTIDADE)"
              >
                <Upload size={16} />
                {importando ? 'Importando...' : 'Importar Planilha'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Aceita <strong>Excel</strong> (.xlsx/.xls) ou <strong>CSV</strong>, com as colunas
              <strong> REF</strong> e <strong>QUANTIDADE</strong>. A referência é casada pela marca do
              fornecedor e o preço vem do produto.
            </p>

            {/* Referências que a importação NÃO encontrou — visível para buscar/cadastrar */}
            {refsNaoImportadas.length > 0 && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    Referências não importadas ({refsNaoImportadas.length})
                  </h5>
                  <button
                    type="button"
                    onClick={() => setRefsNaoImportadas([])}
                    className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
                  >
                    Limpar lista
                  </button>
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  Clique em <strong>Buscar</strong> para procurar no cadastro (filtrando pela marca do
                  fornecedor) ou use <strong>Cadastrar Produto</strong>.
                </p>
                <div className="max-h-40 overflow-y-auto divide-y divide-amber-200/60 dark:divide-amber-800/60">
                  {refsNaoImportadas.map((r, i) => (
                    <div key={`${r.ref}-${i}`} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{r.ref}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Qtd: {r.qtd}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          r.motivo === 'bloqueado'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-gray-200 text-gray-600 dark:bg-zinc-700 dark:text-gray-300'
                        }`}
                      >
                        {r.motivo === 'bloqueado' ? 'desativado/substituído' : 'não encontrado'}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBusca(r.ref)}
                          className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Buscar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefsNaoImportadas((prev) => prev.filter((_, idx) => idx !== i))}
                          title="Remover da lista"
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCadastroProduto(true)}
                  className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:underline"
                >
                  <Plus size={12} />
                  Cadastrar produto novo
                </button>
              </div>
            )}

            {/* Estatísticas */}
            {totalItens > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{totalItens}</strong> produtos encontrados para &quot;{debouncedBusca}&quot;
              </div>
            )}

            {/* Tabela de produtos */}
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-700/80 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">BUSCANDO DADOS</p>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">AÇÕES</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">PRODUTO</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">PREÇO UNIT.</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">QUANTIDADE</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">TOTAL</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-gray-100">OBSERVAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.length === 0 && !loading && busca && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <p className="mb-3">
                            Nenhum produto encontrado para &quot;{debouncedBusca}&quot;.
                          </p>
                          <Button
                            type="button"
                            onClick={() => setShowCadastroProduto(true)}
                            className="bg-green-600 hover:bg-green-700 text-white inline-flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Cadastrar Produto
                          </Button>
                        </td>
                      </tr>
                    )}
                    {produtos.length === 0 && !loading && !busca && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Digite algo para buscar produtos ou aplique filtros.
                        </td>
                      </tr>
                    )}
                    {produtos.map((produto) => {
                      const produtoSelecionado = produtosSelecionados.find(p => p.codprod === produto.codprod);
                      const estaSelecionado = produtoEstaSelecionado(produto.codprod);
                      
                      return (
                        <tr key={produto.codprod} className="border-b border-gray-100 dark:border-gray-600 hover:bg-blue-50/20 dark:hover:bg-zinc-700/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {estaSelecionado ? (
                                <button
                                  onClick={() => removerProduto(produto.codprod)}
                                  className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded flex items-center justify-center transition-colors"
                                  title="Remover produto"
                                >
                                  <span className="text-white text-xs font-bold">✕</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => adicionarProduto(produto)}
                                  className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Adicionar produto"
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {produto.descr}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                COD: {produto.codprod} | {produto.ref ? `Ref: ${produto.ref} | ` : ''}Disp: {Number(produto.estoque || 0)} | Marca: {produto.marca} | R$ {Number(produto.prcompra || 0).toFixed(2)}
                              </div>
                              {Number(produto.prcompra) === 0 && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                                    ⚠️ Preço de compra não cadastrado
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg border-2 border-blue-400 dark:border-blue-500 h-10" style={{ minWidth: '140px', maxWidth: '160px' }}>
                                <span className="pl-3 pr-1 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formataMoedaBR(produtoSelecionado?.preco_unitario || 0)}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onChange={(e) => {
                                    const digitos = e.target.value.replace(/\D/g, '');
                                    alterarPreco(produto.codprod, digitos ? parseInt(digitos, 10) / 100 : 0);
                                  }}
                                  className="flex-1 px-2 text-sm font-bold text-right bg-transparent text-gray-900 dark:text-gray-100 outline-none border-none"
                                  style={{ minWidth: '0' }}
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">R$ {Number(produto.prcompra || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <div className="flex items-stretch bg-white dark:bg-zinc-900 rounded-lg overflow-hidden border-2 border-blue-400 dark:border-blue-500 h-10" style={{ width: '160px' }}>
                                <button
                                  onClick={() => alterarQuantidade(produto.codprod, -1)}
                                  className="w-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center justify-center text-lg font-bold text-white transition-colors"
                                  type="button"
                                >
                                  −
                                </button>
                                <input
                                  ref={(el) => { qtyInputRefs.current[produto.codprod] = el; }}
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={produtoSelecionado?.quantidade || 1}
                                  onChange={(e) => definirQuantidade(produto.codprod, Number(e.target.value))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleQtdEnter();
                                    }
                                  }}
                                  className="flex-1 text-center text-sm font-bold bg-transparent text-gray-900 dark:text-gray-100 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  style={{ minWidth: '0' }}
                                />
                                <button
                                  onClick={() => alterarQuantidade(produto.codprod, 1)}
                                  className="w-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center justify-center text-lg font-bold text-white transition-colors"
                                  type="button"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                                R$ {(produtoSelecionado?.preco_total || 0).toFixed(2)}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {estaSelecionado ? (
                              <input
                                type="text"
                                placeholder="Observação..."
                                value={produtoSelecionado?.observacao || ''}
                                onChange={(e) => {
                                  setProdutosSelecionados(prev =>
                                    prev.map(p =>
                                      p.codprod === produto.codprod
                                        ? { ...p, observacao: e.target.value }
                                        : p
                                    )
                                  );
                                }}
                                className="w-full text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 outline-none"
                              />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumo e Paginação */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-blue-200 dark:border-blue-800">
                {/* Total Geral */}
                <div className="flex items-center gap-4">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Produtos Selecionados: <span className="text-blue-600 dark:text-blue-400">{produtosSelecionados.length}</span>
                  </div>
                  {produtosSelecionados.length > 0 && (
                    <div className="text-base font-bold text-green-600 dark:text-green-400">
                      Total: R$ {produtosSelecionados.reduce((total, p) => total + (p.preco_total || 0), 0).toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Página {pagina} de {totalPaginas}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePaginaChange(pagina - 1)}
                        disabled={pagina <= 1}
                      >
                        ◀
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePaginaChange(pagina + 1)}
                        disabled={pagina >= totalPaginas}
                      >
                        ▶
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>
            )}

            {abaAdd === 'sugestao' && (
              <SugestaoAutomatica onAdicionarSelecionados={adicionarSugeridos} />
            )}

            {/* Carrinho — visível nas duas abas, para acompanhar e remover */}
            {produtosSelecionados.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-zinc-700 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-[#347AB6]">
                    Itens no Carrinho ({produtosSelecionados.length})
                  </h5>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    Total: R${' '}
                    {produtosSelecionados
                      .reduce((t, p) => t + (p.preco_total || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-600">
                  {produtosSelecionados.map((p) => (
                    <div
                      key={p.codprod}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-gray-900 dark:text-gray-100">
                          {p.ref ? `${p.ref} — ` : ''}
                          {p.descr}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Cód: {p.codprod}
                          {p.marca ? ` · Marca: ${p.marca}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-gray-600 dark:text-gray-300">{p.quantidade} ×</span>
                        {/* Preço unitário editável (útil quando vem 0 do cadastro) */}
                        <div
                          className={`flex items-center rounded border h-8 ${
                            Number(p.preco_unitario) > 0
                              ? 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'
                              : 'border-red-400 bg-red-50 dark:bg-red-900/20'
                          }`}
                          title={Number(p.preco_unitario) > 0 ? undefined : 'Sem preço — informe um valor'}
                        >
                          <span className="pl-2 pr-1 text-xs text-gray-500 dark:text-gray-400">R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formataMoedaBR(p.preco_unitario || 0)}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const digitos = e.target.value.replace(/\D/g, '');
                              alterarPreco(p.codprod, digitos ? parseInt(digitos, 10) / 100 : 0);
                            }}
                            className="w-24 px-1 text-right text-sm font-bold bg-transparent text-gray-900 dark:text-gray-100 outline-none border-none"
                          />
                        </div>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          R$ {Number(p.preco_total || 0).toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerProduto(p.codprod)}
                        title="Remover do carrinho"
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded bg-red-500 hover:bg-red-600 text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {ConfirmacaoSalvarModal}

      {/* Cadastro de produto na hora — ao salvar, refaz a busca para o novo
          produto já aparecer na lista de adicionar. */}
      {showCadastroProduto && (
        <CadastroProdutoModal
          isOpen={showCadastroProduto}
          onClose={() => setShowCadastroProduto(false)}
          title="Cadastrar Produto"
          onSuccess={() => {
            setShowCadastroProduto(false);
            buscarProdutos(debouncedBusca, 1);
            toast({ description: 'Produto cadastrado! Atualizando a busca...' });
          }}
        >
          <></>
        </CadastroProdutoModal>
      )}
    </div>
  );
};