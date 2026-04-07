import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import FaturamentoNota from '../novoFaturamento/modalFaturamentonota/FaturamentoNota';
import { useRouter } from 'next/router';
import { Plus, PlusIcon } from 'lucide-react';
import DataTableFaturasAvancado from '@/components/common/DataTableFaturasAvancado';
import { DefaultButton } from '@/components/common/Buttons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import NovoFaturamento from '../novoFaturamento';
import { toast } from 'sonner';
import { StatusEstruturaBanco } from '@/components/common/StatusEstruturaBanco';

export default function ConsultaFaturasPage() {
  console.log('🎬 ConsultaFaturasPage RENDERIZANDO');
  
  const [faturas, setFaturas] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const [carregando, setCarregando] = useState(false);
  console.log('📊 Estado carregando:', carregando);
  const [filtrosAtivos, setFiltrosAtivos] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const router = useRouter();
  const [filtroAgrupadas, setFiltroAgrupadas] = useState<'todas' | 'agrupadas'>('todas');
  const [filtroStatusNFe, setFiltroStatusNFe] = useState<'todas' | 'autorizadas' | 'canceladas' | 'rejeitadas' | 'denegadas'>('todas');
  const [faturasParaFaturar, setFaturasParaFaturar] = useState<any[] | null>(null);
  const [dadosFaturasAgrupadas, setDadosFaturasAgrupadas] = useState<any[] | null>(null);
  const [primeiroCarregamento, setPrimeiroCarregamento] = useState(true);

  // Listener para detectar quando a rota muda
  useEffect(() => {
    console.log('🔄 ConsultaFatura MONTADO/ATUALIZADO');
    console.log('📍 Router path:', router.pathname);
    console.log('🎯 Router query:', router.query);
    
    // Quando o componente montar ou a rota mudar, forçar recarga
    const handleRouteChange = (url: string) => {
      console.log('🔄 Rota mudou para:', url);
      if (url.includes('/faturamento/consultaFatura')) {
        console.log('🔄 Rota é consultaFatura - resetando estado');
        setPrimeiroCarregamento(true);
        setCarregando(false);
      }
    };

    router.events?.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events?.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

 const buscarFaturas = useCallback(async (
  page = 1,
  perPage = 10,
  filtros: any[] = [],
  filtroAgrupadasParam = 'todas' as 'todas' | 'agrupadas',
  filtroStatusNFeParam = 'todas' as 'todas' | 'autorizadas' | 'canceladas' | 'rejeitadas' | 'denegadas'
 ) => {
  console.log('🚀 buscarFaturas INICIADA', { page, perPage, filtros, filtroAgrupadasParam, filtroStatusNFeParam });
  try {
    console.log('⏳ Setando carregando=true');
    setCarregando(true);

    const colunasValidas = [
      'codfat',
      'nroform',
      'cliente_nome',
      'totalnf',
      'data',
      'codvend',
      'codtransp',
      'cancel',
      'cobranca',
      'nfs',
      'codgp',
      'grupo_pagamento',
    ];

    const filtrosLimpos = Array.isArray(filtros)
      ? [...filtros.filter((f) => colunasValidas.includes(f.campo))]
      : [];

    if (termoBusca?.trim()) {
      const busca = termoBusca.trim().toLowerCase();
      filtrosLimpos.push(
        { campo: 'codfat', tipo: 'contém', valor: busca, global: true },
        { campo: 'nroform', tipo: 'contém', valor: busca, global: true },
        { campo: 'cliente_nome', tipo: 'contém', valor: busca, global: true },
        { campo: 'codvend', tipo: 'contém', valor: busca, global: true },
      );
    }

    // Filtro para faturas agrupadas
    console.log('🔍 Frontend - Aplicando filtro agrupadas:', filtroAgrupadasParam);
    if (filtroAgrupadasParam === 'agrupadas') {
      filtrosLimpos.push({
        campo: 'grupo_pagamento',
        tipo: 'nao_nulo',
        valor: '',
      });
    }
    // Se for 'todas', não adiciona nenhum filtro de agrupamento

    // Filtro para status da NFe
    console.log('🔍 Frontend - Aplicando filtro status NFe:', filtroStatusNFeParam);
    if (filtroStatusNFeParam === 'autorizadas') {
      filtrosLimpos.push({
        campo: 'nfe_status',
        tipo: 'igual',
        valor: '100', // Status 100 = Autorizada
      });
    } else if (filtroStatusNFeParam === 'canceladas') {
      // Canceladas: verificar se tem data de cancelamento preenchida
      filtrosLimpos.push({
        campo: 'motivocancelamento',
        tipo: 'nao_nulo',
        valor: '',
      });
    } else if (filtroStatusNFeParam === 'rejeitadas') {
      filtrosLimpos.push({
        campo: 'mensagem_rejeicao',
        tipo: 'nao_nulo',
        valor: '',
      });
    } else if (filtroStatusNFeParam === 'denegadas') {
      filtrosLimpos.push({
        campo: 'denegada',
        tipo: 'igual',
        valor: 'S',
      });
    }
    // Se for 'todas', não adiciona nenhum filtro de status NFe

    console.log('🔍 Frontend - Enviando filtros para API:', filtrosLimpos);
    console.log('📡 Fazendo requisição para /api/faturamento/listar-faturas...');

    const { data } = await axios.get('/api/faturamento/listar-faturas', {
      params: {
        page,
        perPage,
        filtros: JSON.stringify(filtrosLimpos),
      },
      timeout: 30000, // 30 segundos de timeout
    });

  
    setFaturas(data.faturas || []);
    setMeta(data.meta || { currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  
  } catch (error: any) {
     toast.error('Erro ao buscar faturas');
    if (error.code === 'ECONNABORTED') {
      toast.error('A requisição demorou muito para responder. Tente novamente.');
    } else if (error.response) {
      toast.error(`Erro ao buscar faturas: ${error.response.data?.error || error.message}`);
    } else {
      toast.error('Erro ao buscar faturas. Verifique sua conexão.');
    }
    setFaturas([]);
    setMeta({ currentPage: 1, lastPage: 1, perPage: 10, total: 0 });
  } finally {
    console.log('🏁 buscarFaturas FINALIZANDO - setando carregando=false');
    setCarregando(false);
    console.log('✅ buscarFaturas COMPLETA');
  }
 }, []); // useCallback sem dependências pois usa apenas os parâmetros passados

  const handleFiltroChange = (filtros: any[]) => {

    setFiltrosAtivos(filtros);
    buscarFaturas(1, meta.perPage, filtros, filtroAgrupadas, filtroStatusNFe);
  };

  const [abrirNovoFaturamento, setAbrirNovoFaturamento] = useState(false);
  const handleNovaFatura = () => {
    // Aqui você pode navegar para a página de nova fatura
    router.push('/faturamento/novoFaturamento');
    // Ou abrir um modal, etc.
  };

  const handleCriarGrupoPagamento = async (faturas: any[]) => {
    // Evita múltiplas execuções simultâneas
    if (carregando) return;
    setCarregando(true);

    // Validação: todas as faturas devem ser do mesmo cliente
    const clientesUnicos = Array.from(new Set(faturas.map(f => f.codcli || f.cliente_nome)));
    if (clientesUnicos.length > 1) {
      const clientesFormatados = clientesUnicos.map(c => c || 'Cliente não identificado').join(', ');
      toast.error(`Só é permitido agrupar faturas do mesmo cliente. Clientes selecionados: ${clientesFormatados}`, {
        position: 'top-right',
        duration: 4000,
      });
      setCarregando(false);
      return;
    }

    // Validação: verificar se alguma fatura já possui cobrança gerada
    const faturasComCobranca = faturas.filter(f => f.cobranca === 'S');
    // if (faturasComCobranca.length > 0) {
    //   const codigosFaturas = faturasComCobranca.map(f => f.codfat).join(', ');
    //   toast.error(`As seguintes faturas já possuem cobrança gerada e não podem ser agrupadas: ${codigosFaturas}`, {
    //     position: 'top-right',
    //     duration: 5000,
    //   });
    //   setCarregando(false);
    //   return;
    // }

    console.log('🔍 Faturas selecionadas para agrupamento:', faturas);
    
    try {
      // Para cada fatura, buscar codvenda via fatura-venda se não estiver presente
      const faturasComVenda = await Promise.all(
        faturas.map(async (fat) => {
          console.log('📋 Processando fatura:', fat);
          let codvenda = fat.codvenda;
          if (!codvenda && fat.codfat) {
            try {
              const res = await axios.get(`/api/faturamento/fatura-venda?codfat=${fat.codfat}`);
              if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                codvenda = res.data[0].codvenda;
                console.log(`📊 codvenda encontrado para fatura ${fat.codfat}:`, codvenda);
              }
            } catch (e) {
              console.error(`❌ Erro ao buscar codvenda para fatura ${fat.codfat}:`, e);
            }
          }
          return { ...fat, codvenda };
        })
      );
      
      console.log('🔗 Faturas com codvenda:', faturasComVenda);
      
      const faturasValidas = faturasComVenda.filter(
        (fat) => !!fat.nrovenda || !!fat.codvenda
      );
      
      if (faturasValidas.length === 0) {
        toast.error('Nenhuma fatura válida selecionada para agrupamento.');
        setCarregando(false);
        return;
      }
      
      console.log('✅ Faturas válidas para buscar detalhes:', faturasValidas);
      
      // Em vez de usar nrovenda que pode estar duplicado, usar codfat diretamente
      // para buscar as vendas associadas via fatura_venda
      const detalhesPromises = faturasValidas.map(async (fat, index) => {
        console.log(`📡 Buscando detalhes ${index + 1}/${faturasValidas.length} para fatura:`, fat.codfat);
        
        try {
          // Primeiro buscar vendas associadas à fatura
          const vendasRes = await axios.get(`/api/faturamento/fatura-venda?codfat=${fat.codfat}`);
          
          if (!vendasRes.data || !Array.isArray(vendasRes.data) || vendasRes.data.length === 0) {
            console.warn(`⚠️ Nenhuma venda encontrada para fatura ${fat.codfat}`);
            return null;
          }
          
          // Usar o primeiro codvenda para buscar detalhes
          const primeiroCodevenda = vendasRes.data[0].codvenda;
          console.log(`� Usando codvenda ${primeiroCodevenda} para buscar detalhes da fatura ${fat.codfat}`);
          
          const detalhesRes = await axios.get(`/api/faturamento/detalhes-venda?nrovenda=${primeiroCodevenda}`);
          
          // Adicionar informações da fatura aos detalhes
          const detalhes = detalhesRes.data;
          if (detalhes && typeof detalhes === 'object') {
            detalhes.faturas = [{ codfat: fat.codfat, ...fat }];
            detalhes.codfat_original = fat.codfat;
          }
          
          console.log(`✅ Detalhes obtidos para fatura ${fat.codfat}:`, detalhes);
          return detalhes;
          
        } catch (error) {
          console.error(`❌ Erro ao buscar detalhes para fatura ${fat.codfat}:`, error);
          return null;
        }
      });
      
      const detalhesResults = await Promise.all(detalhesPromises);
      const detalhes = detalhesResults.filter(d => d !== null);
      
      console.log('🎯 Detalhes finais filtrados:', detalhes);
      
      setDadosFaturasAgrupadas(detalhes);
      setFaturasParaFaturar(faturasValidas);
      // Só abre o modal após o carregamento completo
      setAbrirNovoFaturamento(true);
    } catch (err) {
      console.error('❌ Erro ao buscar detalhes das faturas agrupadas:', err);
      toast.error('Erro ao buscar detalhes das faturas agrupadas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // Carregamento inicial das faturas sem filtros - só executa uma vez
    console.log('🚀 useEffect inicial - primeiroCarregamento:', primeiroCarregamento);
    if (primeiroCarregamento) {
      console.log('📊 Iniciando primeira carga de faturas...');
      buscarFaturas(1, 10, [], 'todas', 'todas');
      setPrimeiroCarregamento(false);
    }
  }, [primeiroCarregamento, buscarFaturas]); // Dependências corretas

  useEffect(() => {
    // Busca com delay ao alterar termoBusca
    if (!primeiroCarregamento && termoBusca !== undefined) {
      console.log('🔍 termoBusca alterado:', termoBusca);
      const delay = setTimeout(() => {
        buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe);
      }, 300);
      return () => clearTimeout(delay);
    }
  }, [termoBusca, primeiroCarregamento, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, buscarFaturas]); // Todas as dependências
  const [limiteColunas, setLimiteColunas] = useState(9);
  const [mostrarStatusBanco, setMostrarStatusBanco] = useState(false);
  
  // Função para fechar o modal e limpar estados
  const handleFecharModalFaturamento = () => {
    setAbrirNovoFaturamento(false);
    setFaturasParaFaturar(null);
    setDadosFaturasAgrupadas(null);
  };
  
  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300  bg-white dark:bg-slate-900">
      <main className="p-4  w-full">
        {/* Header com título e botão */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-black dark:text-white">
            Consulta de Faturas
          </h1>
          <div className="flex items-center gap-2">
            {/* <DefaultButton
              onClick={() => setMostrarStatusBanco(!mostrarStatusBanco)}
              className="flex items-center gap-1 px-3 py-2 text-sm h-8"
              text={mostrarStatusBanco ? "Ocultar Status" : "Status DB"}
              variant="secondary"
            /> */}
            <DefaultButton
              onClick={() => {
                // Limpar estados antes de abrir o modal para garantir que seja um novo faturamento
                setFaturasParaFaturar(null);
                setDadosFaturasAgrupadas(null);
                setAbrirNovoFaturamento(true);
              }}
              className="flex items-center gap-0 px-3 py-2 text-sm h-8"
              text="Novo"
              icon={<PlusIcon size={18} />}
            />
          </div>
        </div>

        {/* Status da estrutura do banco */}
        {/* {mostrarStatusBanco && (
          <div className="mb-4">
            <StatusEstruturaBanco />
          </div>
        )} */}

        {/* Filtros com design moderno */}
        <div className="flex flex-wrap items-center gap-6 mb-4 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
          {/* Tipo de Fatura */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Tipo:
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setFiltroAgrupadas('todas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, 'todas', filtroStatusNFe);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  filtroAgrupadas === 'todas'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => {
                  setFiltroAgrupadas('agrupadas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, 'agrupadas', filtroStatusNFe);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroAgrupadas === 'agrupadas'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Agrupadas
              </button>
            </div>
          </div>

          {/* Separador vertical */}
          <div className="h-8 w-px bg-gray-300 dark:bg-zinc-600 hidden sm:block"></div>

          {/* Status NFe */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Status NFe:
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => {
                  setFiltroStatusNFe('todas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, 'todas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  filtroStatusNFe === 'todas'
                    ? 'bg-gray-700 text-white shadow-md'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => {
                  setFiltroStatusNFe('autorizadas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, 'autorizadas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroStatusNFe === 'autorizadas'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Autorizadas
              </button>
              <button
                onClick={() => {
                  setFiltroStatusNFe('canceladas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, 'canceladas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroStatusNFe === 'canceladas'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Canceladas
              </button>
              <button
                onClick={() => {
                  setFiltroStatusNFe('rejeitadas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, 'rejeitadas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroStatusNFe === 'rejeitadas'
                    ? 'bg-yellow-600 text-white shadow-md'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Rejeitadas
              </button>
              <button
                onClick={() => {
                  setFiltroStatusNFe('denegadas');
                  buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, 'denegadas');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${
                  filtroStatusNFe === 'denegadas'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Denegadas
              </button>
            </div>
          </div>

          {/* Separador */}
          <div className="h-8 w-px bg-gray-300 dark:bg-zinc-600 hidden lg:block"></div>

          {/* Legenda de cores */}
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">Legenda:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Cancelado</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Denegada</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Agrupado</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-700 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Cobrança</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
              <span className="text-xs text-gray-600 dark:text-gray-300">S/ Cobrança</span>
            </div>
          </div>
        </div>
        <DataTableFaturasAvancado
          faturas={faturas}
          meta={meta}
          carregando={carregando}
          colunasFiltro={[
            'codfat',
            'nroform',
            'cliente_nome',
            'totalnf',
            'data',
            'codvend',
            'codtransp',
            'cancel',
            'cobranca',
            'codgp',
            'grupo_pagamento',
          ]}
          onPageChange={(page) => buscarFaturas(page, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe)}
          onPerPageChange={(perPage) => buscarFaturas(1, perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe)}
          onFiltroChange={handleFiltroChange}
          onAtualizarLista={() =>
            buscarFaturas(meta.currentPage, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe)
          }
          termoBusca={termoBusca}
          setTermoBusca={setTermoBusca}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={setLimiteColunas}
          onCriarGrupoPagamento={handleCriarGrupoPagamento}
        />
      </main>
      <Dialog
        open={abrirNovoFaturamento}
        onOpenChange={handleFecharModalFaturamento}
      >
        {/* CORREÇÃO: Classes ajustadas para um modal grande com padding, e Dialog duplicado removido. */}
        <DialogContent className="w-[96vw] h-[95vh] max-w-none p-6">
          <DialogTitle style={{ position: 'absolute', left: '-9999px', height: '1px', width: '1px', overflow: 'hidden' }}>
            Novo Faturamento
          </DialogTitle>
          <div className="w-full h-full bg-white dark:bg-zinc-900 overflow-y-auto">
            {dadosFaturasAgrupadas ? (
              <FaturamentoNota
                isOpen={abrirNovoFaturamento}
                onClose={handleFecharModalFaturamento}
                faturasAgrupadas={dadosFaturasAgrupadas}
                statusVenda={{ tipodoc: 'N', cobranca: 'S', insc07: 'N' }}
                setStatusVenda={() => {}}
              />
            ) : (
              <NovoFaturamento faturasParaFaturar={faturasParaFaturar || undefined} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
