import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import axios from 'axios';
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
  
  const fetchFaturas = async () => {
    setCarregando(true);
    try {
      const result = await axios.get('/api/faturamento/listar-vendas', {
        params: {
          page,
          perPage,
          filtros: JSON.stringify(filtros),
          search: termoBusca, // Adicionar termo de busca global
        },
      });

      setFaturas(result.data.data);
      setMeta(result.data.meta);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setCarregando(false);
    }
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
      <main className="p-4  w-full">
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

        <div className="h-full">
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
            onSelecionarFaturas={setCarrinho}
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
