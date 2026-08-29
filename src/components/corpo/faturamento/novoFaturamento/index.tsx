import React, { useContext, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import axios from 'axios';
import { AuthContext } from '@/contexts/authContexts';
import { ShoppingCart, Plus, Lock, RotateCcw } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import DataTableFaturamentoNovo from '@/components/common/DataTableFaturamento';

import { toast } from 'sonner';
import DataTableFaturamento from '@/components/common/DataTableFaturamento';
import DetalhesProdutoModal from './modalProdutos/DetalhesProdutoModal';
import DetalhesClienteModal from './modalDetlahesCliente';
import FaturamentoNota from './modalFaturamentonota/FaturamentoNota';
import ModalStatusVenda from './ModalStatusVenda';
import { set } from 'zod';

export default function NovoFaturamento({ faturasParaFaturar }: { faturasParaFaturar?: any[] }) {
  const { user } = useContext(AuthContext);
  const RESERVA_TTL_MIN = 3; // reserva expira sozinha em 3 min (renovada por heartbeat)
  const [faturas, setFaturas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [meta, setMeta] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const [filtros, setFiltros] = useState<any[]>([]);
  const [carrinho, setCarrinho] = useState<any[]>([]);
  const [nroVendaCarrinho, setNroVendaCarrinho] = useState('');
  const [vendaData, setVendaData] = useState<any | null>(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalFaturamentoAberto, setModalFaturamentoAberto] = useState(false);
  const [modalVendaAberto, setModalVendaAberto] = useState(false);
  const [statusVenda, setStatusVenda] = useState({
    tipodoc: 'N',
    cobranca: 'S',
    insc07: 'N',
  });
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<any | null>(
    null,
  );
  const [termoBusca, setTermoBusca] = useState('');
  const [limiteColunas, setLimiteColunas] = useState(9);
  const [fechandoVendas, setFechandoVendas] = useState(false);
  const [voltandoVendas, setVoltandoVendas] = useState(false);
  // Modal de "Fechar Vendas": Tipo de Fechamento (dbfecharvendas.status) + Data do Fechamento.
  // Valores fiéis ao front do Delphi: '2'=Não Estocado, '3'=Uso na Loja, '4'=entra no Total.
  const [modalFecharAberto, setModalFecharAberto] = useState(false);
  const [tipoFechamento, setTipoFechamento] = useState<'' | '2' | '3' | '4'>('');
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [dataFechamento, setDataFechamento] = useState<string>(hojeISO);
  // modo da lista: 'faturar' (vendas a faturar, padrão) | 'fechadas' (fechadas p/ Voltar).
  const [modo, setModo] = useState<'faturar' | 'fechadas'>('faturar');
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();
  
  const fetchFaturas = async (silent = false) => {
    if (!silent) setCarregando(true);
    try {
      const result = await axios.get('/api/faturamento/listar-vendas', {
        params: {
          page,
          perPage,
          filtros: JSON.stringify(filtros),
          search: termoBusca, // Adicionar termo de busca global
          usuario: user?.usuario || '', // marca reservas de OUTROS usuários
          modo, // 'faturar' (padrão) | 'fechadas'
        },
      });

      setFaturas(result.data.data);
      setMeta(result.data.meta);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      if (!silent) setCarregando(false);
    }
  };

  // ===== RESERVA (soft lock) de vendas =====
  // Espelha o carrinho num ref para o cleanup/beacon sempre ver o valor atual.
  const carrinhoRef = useRef<any[]>([]);
  useEffect(() => {
    carrinhoRef.current = carrinho;
  }, [carrinho]);

  const liberarVendas = (codvendas: string[]) => {
    if (!codvendas.length || !user?.usuario) return;
    axios
      .post('/api/faturamento/liberar-venda', {
        codvendas,
        usuario: user.usuario,
      })
      .catch(() => {});
  };

  // Chamado quando o usuário marca/desmarca vendas: reserva as novas (atômico no
  // servidor) e libera as removidas. Vendas "em uso por outro" são recusadas.
  const handleSelecionarCarrinho = async (novaSelecao: any[]) => {
    // Modo "fechadas": seleção é só para Voltar Venda — sem reserva/soft-lock.
    if (modo === 'fechadas') {
      setCarrinho(novaSelecao);
      return;
    }
    const atuaisIds = new Set(carrinho.map((v) => v.codvenda));
    const novosIds = new Set(novaSelecao.map((v) => v.codvenda));
    const adicionados = novaSelecao.filter((v) => !atuaisIds.has(v.codvenda));
    const removidos = carrinho.filter((v) => !novosIds.has(v.codvenda));

    if (removidos.length > 0) {
      liberarVendas(removidos.map((v) => v.codvenda));
    }

    let selecaoFinal = novaSelecao;

    if (adicionados.length > 0) {
      try {
        const { data } = await axios.post('/api/faturamento/reservar-venda', {
          codvendas: adicionados.map((v) => v.codvenda),
          usuario: user?.usuario,
          usuario_nome: user?.usuario,
          ttlMin: RESERVA_TTL_MIN,
        });
        const emUso: Array<{ codvenda: string; usuario_nome: string }> =
          data?.emUso || [];
        if (emUso.length > 0) {
          const emUsoIds = new Set(emUso.map((e) => String(e.codvenda)));
          emUso.forEach((e) =>
            toast.error(`Venda ${e.codvenda} em uso por ${e.usuario_nome}.`),
          );
          selecaoFinal = novaSelecao.filter(
            (v) => !emUsoIds.has(String(v.codvenda)),
          );
          fetchFaturas(true); // atualiza a lista p/ mostrar a reserva de terceiros
        }
      } catch (err) {
        toast.error('Erro ao reservar a venda. Tente novamente.');
        const addIds = new Set(adicionados.map((v) => v.codvenda));
        selecaoFinal = novaSelecao.filter((v) => !addIds.has(v.codvenda));
      }
    }

    setCarrinho(selecaoFinal);
  };

  // Função para processar filtros dinâmicos (similar ao ContasAPagar)
  const handleFiltroAvancado = (filtrosDinamicos: { campo: string; tipo: string; valor: string }[]) => {
    console.log('🔍 Filtros dinâmicos recebidos no NovoFaturamento:', filtrosDinamicos);
    
    // Converter filtros dinâmicos para o formato da API
    const filtrosProcessados = filtrosDinamicos.map(filtro => {
      const { campo, tipo, valor } = filtro;
      
      // Mapeamento de nomes de campos (se necessário)
      let campoMapeado = campo;
      
      // Mapeamento específico para campos que podem ter nomes diferentes
      if (campo === 'nrovenda' || campo === 'número venda') {
        campoMapeado = 'nrovenda';
      } else if (campo === 'cliente' || campo === 'nome cliente') {
        campoMapeado = 'cliente';
      } else if (campo === 'total' || campo === 'valor total') {
        campoMapeado = 'total';
      }
      
      return {
        campo: campoMapeado,
        tipo,
        valor,
        global: false // Por padrão, não é filtro global
      };
    });
    
    console.log('📋 Filtros processados:', filtrosProcessados);
    setFiltros(filtrosProcessados);
    setPage(1); // Voltar para a primeira página ao aplicar filtros
  };

  const handleBuscaGlobal = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTermoBusca(e.target.value);
  };

  const handleAbrirCarrinho = async (nrovenda: string) => {
    try {
      setNroVendaCarrinho(nrovenda);
      const { data } = await axios.get(
        `/api/faturamento/detalhes-venda?nrovenda=${nrovenda}`,
      );
      setVendaData(data);
    } catch (err) {
      toast.error('Erro ao carregar a venda do carrinho');
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchFaturas();
    }, 300);

    return () => clearTimeout(delay);
  }, [page, perPage, filtros, termoBusca, modo]); // + modo (a faturar / fechadas)

  // POLLING: recarrega a lista a cada 20s (silencioso) para refletir reservas de
  // outros usuários em tempo quase-real, sem WebSocket.
  useEffect(() => {
    const id = setInterval(() => fetchFaturas(true), 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, filtros, termoBusca, user?.usuario]);

  // HEARTBEAT: enquanto houver vendas no carrinho, renova a reserva a cada 60s
  // (TTL de 3 min). Se o navegador travar/fechar, a reserva expira e libera a venda.
  useEffect(() => {
    if (carrinho.length === 0 || !user?.usuario) return;
    const id = setInterval(() => {
      axios
        .post('/api/faturamento/reservar-venda', {
          codvendas: carrinho.map((v) => v.codvenda),
          usuario: user.usuario,
          usuario_nome: user.usuario,
          ttlMin: RESERVA_TTL_MIN,
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrinho, user?.usuario]);

  // LIBERAR ao fechar a aba (sendBeacon) e ao desmontar (navegação SPA). Usa o ref
  // para sempre enxergar o carrinho atual sem re-registrar o listener a cada mudança.
  useEffect(() => {
    const liberarBeacon = () => {
      const cart = carrinhoRef.current;
      if (!cart.length || !user?.usuario) return;
      const payload = JSON.stringify({
        codvendas: cart.map((v) => v.codvenda),
        usuario: user.usuario,
      });
      navigator.sendBeacon(
        '/api/faturamento/liberar-venda',
        new Blob([payload], { type: 'application/json' }),
      );
    };
    window.addEventListener('beforeunload', liberarBeacon);
    return () => {
      window.removeEventListener('beforeunload', liberarBeacon);
      liberarBeacon(); // libera ao sair da tela (navegação interna)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.usuario]);

  // Efeito para pré-selecionar faturas quando faturasParaFaturar é fornecido
  useEffect(() => {
    if (faturasParaFaturar && faturasParaFaturar.length > 0) {
      setCarrinho(faturasParaFaturar);
    }
  }, [faturasParaFaturar]);

  const handleAdicionarVenda = (venda: any) => {
    const clienteAtual = carrinho[0]?.codcli;
    if (carrinho.length > 0 && venda.dbclien?.codcli !== clienteAtual) {
      return alert(
        'Só é possível adicionar vendas do mesmo cliente ao carrinho.',
      );
    }

    const existe = carrinho.find((f) => f.codvenda === venda.codvenda);
    if (existe) {
      return alert('Venda já está no carrinho.');
    }

    setCarrinho([...carrinho, venda]);
    console.log('Venda adicionada ao carrinho:', venda);
    console.log ('Carrinho atual:', carrinho);
  };

  const abrirDetalhes = async (tipo: 'cliente' | 'produto') => {
    if (carrinho.length === 0) {
      toast.info('Nenhuma venda selecionada.');
      return;
    }

    const nrovenda = carrinho[0]?.nrovenda;
    try {
      setCarregando(true);
      const { data } = await axios.get(
        `/api/faturamento/detalhes-venda?nrovenda=${nrovenda}`,
      );
      setVendaData(data);

      if (tipo === 'cliente') {
        setModalClienteAberto(true);
      } else {
        const primeiroProduto = data.dbitvenda?.[0];
        if (!primeiroProduto) {
          toast.info('Nenhum produto encontrado.');
          return;
        }
        setProdutoSelecionado(primeiroProduto);
        setModalProdutoAberto(true);
      }
    } catch (err) {
      toast.error('Erro ao buscar detalhes da venda.');
    } finally {
      setCarregando(false);
    }
  };

  // Função para fechar o modal de faturamento e limpar estados
  const handleFecharModalFaturamento = () => {
    setModalFaturamentoAberto(false);
    // Libera as reservas das vendas do carrinho (emitiu ou abandonou) e atualiza a lista.
    if (carrinho.length > 0) {
      liberarVendas(carrinho.map((v) => v.codvenda));
    }
    fetchFaturas(true);
    // Limpar carrinho e outros estados relacionados
    setCarrinho([]);
    setNroVendaCarrinho('');
    setVendaData(null);
    // Resetar status da venda para valores padrão
    setStatusVenda({
      tipodoc: 'N',
      cobranca: 'S',
      insc07: 'N',
    });
  };

  // Fechar Vendas (fechamento administrativo, fiel ao Delphi). Abre o modal para escolher
  // o Tipo de Fechamento (dbfecharvendas.status) e a Data do Fechamento antes de confirmar.
  const handleFecharVendas = () => {
    if (carrinho.length === 0) {
      toast.info('Selecione ao menos uma venda para fechar.');
      return;
    }
    setTipoFechamento(''); // sem default — o Delphi obriga escolher o Tipo
    setDataFechamento(new Date().toISOString().slice(0, 10));
    setModalFecharAberto(true);
  };

  // Executa o fechamento com o Tipo + Data escolhidos. Marca dbvenda.status='F', grava
  // dbfecharvendas (status = tipo, data = data do fechamento) e loga. Não emite NF-e.
  const confirmarFecharVendas = async () => {
    const codvendas = carrinho.map((v) => v.codvenda);
    setFechandoVendas(true);
    try {
      const { data } = await axios.post('/api/faturamento/fechar-vendas', {
        codvendas,
        usuario: user?.usuario || '',
        tipoFechamento,
        dataFechamento,
      });
      const fechadas = Number(data?.fechadas ?? 0);
      const ignoradas = Number(data?.ignoradas ?? 0);
      if (fechadas > 0) {
        toast.success(
          `${fechadas} venda(s) fechada(s).` +
            (ignoradas > 0 ? ` ${ignoradas} ignorada(s) (já fechada/cancelada).` : ''),
        );
      } else {
        toast.warning('Nenhuma venda foi fechada (já fechadas/canceladas).');
      }
      // Libera as reservas e atualiza a lista (as fechadas saem de "a faturar").
      liberarVendas(codvendas);
      setCarrinho([]);
      setModalFecharAberto(false);
      // Atualização IMEDIATA: remove as fechadas da lista local + ajusta o total.
      const fechadasIds = new Set(
        ((data?.vendas as string[]) || codvendas).map((x) => String(x)),
      );
      setFaturas((prev: any[]) =>
        prev.filter((v) => !fechadasIds.has(String(v.codvenda))),
      );
      setMeta((m) => ({ ...m, total: Math.max(0, (m.total || 0) - fechadas) }));
      fetchFaturas(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao fechar as vendas.');
    } finally {
      setFechandoVendas(false);
    }
  };

  // Troca entre "a faturar" e "fechadas". Ao sair do modo faturar com carrinho reservado,
  // libera as reservas; sempre limpa a seleção e volta pra página 1.
  const handleTrocarModo = (novo: 'faturar' | 'fechadas') => {
    if (novo === modo) return;
    if (modo === 'faturar' && carrinho.length > 0) {
      liberarVendas(carrinho.map((v) => v.codvenda));
    }
    setCarrinho([]);
    setPage(1);
    setModo(novo);
  };

  // Voltar Venda (desfazer fechamento) — fiel ao VENDAS_OPERACOES.Voltar_Venda: volta o
  // status para 'I' (IMPRESSO) e remove o registro de dbfecharvendas. Só reverte fechadas
  // administrativas; vendas realmente faturadas são ignoradas (motivo no aviso).
  const handleVoltarVendas = () => {
    if (carrinho.length === 0) {
      toast.info('Selecione ao menos uma venda para voltar.');
      return;
    }
    const codvendas = carrinho.map((v) => v.codvenda);
    pedirConfirmacao(
      async () => {
        setVoltandoVendas(true);
        try {
          const { data } = await axios.post('/api/faturamento/voltar-venda', {
            codvendas,
            usuario: user?.usuario || '',
          });
          const revertidas = Number(data?.revertidas ?? 0);
          const ignoradas = Number(data?.ignoradas ?? 0);
          if (revertidas > 0) {
            toast.success(
              `${revertidas} venda(s) voltaram para "a faturar".` +
                (ignoradas > 0 ? ` ${ignoradas} ignorada(s).` : ''),
            );
          } else {
            toast.warning('Nenhuma venda pôde ser revertida.');
          }
          // Motivos das ignoradas (Venda Faturada / Cancelada / Bloqueada).
          (data?.detalhes || []).forEach((d: any) =>
            toast.warning(`Venda ${d.codvenda}: ${d.motivo}`),
          );
          setCarrinho([]);
          // Atualização IMEDIATA: remove as revertidas da lista de fechadas + ajusta total.
          const revertidasIds = new Set(
            ((data?.vendas as string[]) || []).map((x) => String(x)),
          );
          setFaturas((prev: any[]) =>
            prev.filter((v) => !revertidasIds.has(String(v.codvenda))),
          );
          setMeta((m) => ({ ...m, total: Math.max(0, (m.total || 0) - revertidas) }));
          fetchFaturas(true);
        } catch (err: any) {
          toast.error(err?.response?.data?.erro || 'Erro ao voltar as vendas.');
        } finally {
          setVoltandoVendas(false);
        }
      },
      {
        type: 'warning',
        title: 'Voltar Venda',
        message:
          `Voltar ${carrinho.length} venda(s) para a lista de faturamento?\n\n` +
          'O fechamento será desfeito e o status volta para IMPRESSO. Vendas realmente faturadas (NF-e) não são revertidas.',
        confirmText: 'Sim, voltar',
        cancelText: 'Cancelar',
      },
    );
  };

  return (
    <div className=" h-full flex flex-col flex-grow border border-gray-300  bg-white dark:bg-slate-900">
      <main className="p-4 w-full flex flex-col flex-1 min-h-0">
        <Head>
          <title className="text-2xl font-semibold text-black dark:text-white">
            Novo Faturamento
          </title>
        </Head>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-black dark:text-white">
              Novo Faturamento
            </h1>
            {/* Toggle: A faturar (padrão) | Fechadas (para Voltar Venda). */}
            <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
              <button
                className={`px-3 py-1.5 font-medium transition-colors ${modo === 'faturar' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                onClick={() => handleTrocarModo('faturar')}
              >
                A faturar
              </button>
              <button
                className={`px-3 py-1.5 font-medium transition-colors ${modo === 'fechadas' ? 'bg-amber-600 text-white' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                onClick={() => handleTrocarModo('fechadas')}
              >
                Fechadas
              </button>
            </div>
          </div>

          <div className="flex gap-3 items-center relative mr-4">

            {modo === 'fechadas' ? (
              /* Voltar Venda — desfaz o fechamento das vendas selecionadas. */
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={carrinho.length === 0 || voltandoVendas}
                onClick={handleVoltarVendas}
                title="Voltar as vendas selecionadas para a lista de faturamento (desfaz o fechamento)"
              >
                <RotateCcw size={16} />
                {voltandoVendas
                  ? 'Voltando...'
                  : `Voltar ${carrinho.length > 0 ? carrinho.length + ' ' : ''}venda${carrinho.length === 1 ? '' : 's'}`}
              </button>
            ) : (
              <>
                {/* Fechar Vendas — fechamento administrativo das vendas selecionadas (1 ou várias). */}
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={carrinho.length === 0 || fechandoVendas}
                  onClick={handleFecharVendas}
                  title="Fechar as vendas selecionadas (fechamento administrativo — não emite NF-e)"
                >
                  <Lock size={16} />
                  {fechandoVendas
                    ? 'Fechando...'
                    : `Fechar ${carrinho.length > 0 ? carrinho.length + ' ' : ''}venda${carrinho.length === 1 ? '' : 's'}`}
                </button>

                <button
                  className="relative flex items-center gap-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    if (carrinho.length > 0) {
                      setModalFaturamentoAberto(true);
                    } else {
                      toast.info('Nenhuma venda no carrinho.');
                    }
                  }}
                >
              {/* 1. O ícone de Plus foi movido para DENTRO do botão */}
              <Plus size={18} className="text-blue-500 dark:text-white" />

              {/* O ícone do carrinho permanece aqui */}
              <ShoppingCart className="text-blue-500 dark:text-white size-6" />

              {/* A notificação de contagem continua funcionando como antes */}
              {carrinho.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {carrinho.length}
                </span>
              )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <DataTableFaturamento
            faturas={faturas}
            meta={meta}
            carregando={carregando}
            colunasFiltro={[
              'data',
              'tipo',
              'nrovenda',
              'total',
              'cliente',
              // 'codvend',
              'obs',
              'uf',
              'transporte',
              'cep',
              'cidade',
              'bairro',
              'ender',
              'numero',
              'complemento',
            ]}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
            onFiltroChange={handleFiltroAvancado}
            onSelecionarFaturas={handleSelecionarCarrinho}
            termoBusca={termoBusca}
            setTermoBusca={setTermoBusca}
            limiteColunas={limiteColunas}
            onLimiteColunasChange={setLimiteColunas}
            faturasSelecionadas={carrinho}
            onAbrirDetalhesCliente={() => abrirDetalhes('cliente')}
            onAbrirDetalhesProduto={() => abrirDetalhes('produto')}
          />
        </div>
      </main>

      <DetalhesProdutoModal
        isOpen={modalProdutoAberto}
        onClose={() => setModalProdutoAberto(false)}
        produto={produtoSelecionado}
        venda={vendaData}
      />
      <DetalhesClienteModal
        isOpen={modalClienteAberto}
        onClose={() => setModalClienteAberto(false)}
        cliente={vendaData?.dbclien}
      />
      {/* 4. ALTERADO: Passando a função 'setStatusVenda' para o FaturamentoNota */}
      <FaturamentoNota
        isOpen={modalFaturamentoAberto}
        onClose={handleFecharModalFaturamento}
        vendasSelecionadas={carrinho}
        statusVenda={statusVenda}
        setStatusVenda={setStatusVenda} // <- ADICIONADO
      />

      {/* 5. REMOVIDO: O ModalStatusVenda não é mais renderizado */}
      {/* <ModalStatusVenda
          isOpen={modalVendaAberto}
          onClose={() => setModalVendaAberto(false)}
          statusVenda={statusVenda}
          setStatusVenda={setStatusVenda}
          onConfirm={(status) => {
            setStatusVenda(status);
            setModalVendaAberto(false);
            setModalFaturamentoAberto(true);
          }}
        />
      */}

      {/* Modal Fechar Vendas — Tipo de Fechamento + Data (fiel ao "Fechar Venda" do Delphi). */}
      {modalFecharAberto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !fechandoVendas && setModalFecharAberto(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <Lock size={18} className="text-emerald-600" />
              <h3 className="text-lg font-semibold text-black dark:text-white">
                Fechar {carrinho.length} venda(s)
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Fechamento administrativo — não emite NF-e nem gera fatura. Dá para desfazer
              na aba &quot;Fechadas&quot; (Voltar Venda).
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Tipo de Fechamento
            </label>
            {/* Ordem/rótulos e valores fiéis ao combo do Delphi (status = ItemIndex + 2). */}
            <select
              value={tipoFechamento}
              onChange={(e) => setTipoFechamento(e.target.value as '' | '2' | '3' | '4')}
              className="w-full mb-4 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-black dark:text-white"
            >
              <option value="" disabled>
                Selecione o Tipo de Fechamento…
              </option>
              <option value="2">Fechar como Não Estocado</option>
              <option value="3">
                Fechar para Uso na Loja (não entra no total do faturamento)
              </option>
              <option value="4">Fechar para entrar no Total do Faturamento</option>
            </select>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Data do Fechamento
            </label>
            <input
              type="date"
              value={dataFechamento}
              max={hojeISO}
              onChange={(e) => setDataFechamento(e.target.value)}
              className="w-full mb-6 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-black dark:text-white"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalFecharAberto(false)}
                disabled={fechandoVendas}
                className="px-4 py-2 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarFecharVendas}
                disabled={
                  fechandoVendas ||
                  !tipoFechamento ||
                  !dataFechamento ||
                  dataFechamento > hojeISO
                }
                className="px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {fechandoVendas ? 'Fechando...' : 'Fechar vendas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmacaoSalvarModal}
    </div>
  );
}
