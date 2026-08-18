import React, { useContext, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import axios from 'axios';
import { AuthContext } from '@/contexts/authContexts';
import { ShoppingCart, Plus } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
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
  const [faturas, setFaturas] = useState([]);
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
  }, [page, perPage, filtros, termoBusca]); // Adicionar termoBusca ao array de dependências

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

  return (
    <div className=" h-full flex flex-col flex-grow border border-gray-300  bg-white dark:bg-slate-900">
      <main className="p-4 w-full flex flex-col flex-1 min-h-0">
        <Head>
          <title className="text-2xl font-semibold text-black dark:text-white">
            Novo Faturamento
          </title>
        </Head>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-black dark:text-white">
            Novo Faturamento
          </h1>

          <div className="flex gap-3 items-center relative mr-4">
     
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
    </div>
  );
}
