import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { useNavegacaoTecladoTabela, CLASSE_LINHA_ATIVA } from '@/hooks/useNavegacaoTecladoTabela';

// Cor da LINHA por status (estilo Delphi), calibrada p/ tema escuro:
// borda lateral + fundo levíssimo + texto das células tonalizado. Prioridade
// (a categoria vem de __statusCor no wrapper): Cancelado > Denegada > Agrupado > Com/Sem cobrança.
// Listra lateral via box-shadow inset (funciona com border-collapse, diferente de border-l)
// + fundo levíssimo + texto tonalizado. Cores por categoria (__statusCor do wrapper).
// Sem fundo colorido (distraía): só a listra lateral + o texto tonalizado, estilo Delphi.
const MAPA_COR_LINHA: Record<string, string> = {
  cancel:   'shadow-[inset_4px_0_0_0_#f43f5e] [&_td]:text-rose-700 dark:[&_td]:text-rose-300',
  denegada: 'shadow-[inset_4px_0_0_0_#f59e0b] [&_td]:text-amber-700 dark:[&_td]:text-amber-300',
  agrupado: 'shadow-[inset_4px_0_0_0_#3b82f6] [&_td]:text-blue-700 dark:[&_td]:text-blue-300',
  cobranca: 'shadow-[inset_4px_0_0_0_#10b981] [&_td]:text-emerald-700 dark:[&_td]:text-emerald-300',
  sem:      'shadow-[inset_4px_0_0_0_#ec4899] [&_td]:text-pink-700 dark:[&_td]:text-pink-300',
};

const fmtData = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
// Calcula o range De/Até de um atalho de período (Até sempre = hoje).
const calcPeriodo = (preset: string): { de: string; ate: string } => {
  const hoje = new Date();
  const ate = fmtData(hoje);
  if (preset === 'hoje') return { de: ate, ate };
  if (preset === 'semana') {
    const d = new Date(hoje); d.setDate(hoje.getDate() - 6);
    return { de: fmtData(d), ate };
  }
  if (preset === 'mes') return { de: fmtData(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate };
  if (preset === 'ano') return { de: fmtData(new Date(hoje.getFullYear(), 0, 1)), ate };
  return { de: '', ate: '' }; // todos
};

export default function ConsultaFaturasPage() {
  const [faturas, setFaturas] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  const [carregando, setCarregando] = useState(false);
  const [filtrosAtivos, setFiltrosAtivos] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  // Ref sempre atual do termo (buscarFaturas é useCallback sem deps → sem ref pegaria
  // o valor inicial). A busca só dispara no Enter/blur, então basta ler o ref na hora.
  const termoBuscaRef = useRef('');
  termoBuscaRef.current = termoBusca;

  // Período (De/Até) — atalhos preenchem o range; De/Até é a fonte da verdade.
  // Default = Mês (1º dia do mês até hoje). `periodoRef` é lido pelo buscarFaturas
  // (useCallback sem deps), assim TODAS as chamadas já incluem o filtro de data.
  const [dataDe, setDataDe] = useState(() => calcPeriodo('hoje').de);
  const [dataAte, setDataAte] = useState(() => calcPeriodo('hoje').ate);
  const [presetPeriodo, setPresetPeriodo] = useState<string>('hoje');
  const periodoRef = useRef(calcPeriodo('hoje'));
  const [legendaAberta, setLegendaAberta] = useState(false);
  const router = useRouter();
  const [filtroAgrupadas, setFiltroAgrupadas] = useState<'todas' | 'agrupadas'>('todas');
  const [filtroStatusNFe, setFiltroStatusNFe] = useState<'todas' | 'autorizadas' | 'canceladas' | 'rejeitadas' | 'denegadas' | 'pendentes'>('todas');
  const [filtroCobranca, setFiltroCobranca] = useState<'todas' | 'com' | 'sem'>('todas');
  const [faturasParaFaturar, setFaturasParaFaturar] = useState<any[] | null>(null);
  const [dadosFaturasAgrupadas, setDadosFaturasAgrupadas] = useState<any[] | null>(null);
  const [primeiroCarregamento, setPrimeiroCarregamento] = useState(true);

  // Listener para detectar quando a rota muda
  useEffect(() => {
    // Ao voltar para a Consulta de Faturas, força recarregar a lista.
    const handleRouteChange = (url: string) => {
      if (url.includes('/faturamento/consultaFatura')) {
        setPrimeiroCarregamento(true);
        setCarregando(false);
      }
    };

    router.events?.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events?.off('routeChangeComplete', handleRouteChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 const buscarFaturas = useCallback(async (
  page = 1,
  perPage = 10,
  filtros: any[] = [],
  filtroAgrupadasParam = 'todas' as 'todas' | 'agrupadas',
  filtroStatusNFeParam = 'todas' as 'todas' | 'autorizadas' | 'canceladas' | 'rejeitadas' | 'denegadas' | 'pendentes',
  filtroCobrancaParam = 'todas' as 'todas' | 'com' | 'sem'
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

    if (termoBuscaRef.current?.trim()) {
      const busca = termoBuscaRef.current.trim().toLowerCase();
      filtrosLimpos.push(
        { campo: 'codfat', tipo: 'contém', valor: busca, global: true },
        { campo: 'nroform', tipo: 'contém', valor: busca, global: true },
        { campo: 'cliente_nome', tipo: 'contém', valor: busca, global: true },
        { campo: 'codvend', tipo: 'contém', valor: busca, global: true },
      );
    }

    // Período (De/Até) — backend já suporta maior_igual/menor_igual no campo `data`.
    if (periodoRef.current?.de) {
      filtrosLimpos.push({ campo: 'data', tipo: 'maior_igual', valor: periodoRef.current.de });
    }
    if (periodoRef.current?.ate) {
      filtrosLimpos.push({ campo: 'data', tipo: 'menor_igual', valor: periodoRef.current.ate });
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
    } else if (filtroStatusNFeParam === 'pendentes') {
      // Pendente = casa com a pill: nenhuma NFe emitida (o LATERAL não achou linha
      // em dbfat_nfe, logo nfe_status é NULL). Denegada tem registro na SEFAZ.
      filtrosLimpos.push({
        campo: 'nfe_status',
        tipo: 'nulo',
        valor: '',
      });
    }
    // Se for 'todas', não adiciona nenhum filtro de status NFe

    // Filtro de cobrança (flag dbfatura.cobranca: S = tem cobrança, N = sem)
    if (filtroCobrancaParam === 'com') {
      filtrosLimpos.push({ campo: 'cobranca', tipo: 'igual', valor: 'S' });
    } else if (filtroCobrancaParam === 'sem') {
      filtrosLimpos.push({ campo: 'cobranca', tipo: 'igual', valor: 'N' });
      // Faturas AGRUPADAS têm cobrança (a agrupada) — não são "sem cobrança".
      // A classificação prioriza Agrupado sobre Sem cobrança; exclui via codgp NULL.
      filtrosLimpos.push({ campo: 'grupo_pagamento', tipo: 'nulo', valor: '' });
    }

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
    buscarFaturas(1, meta.perPage, filtros, filtroAgrupadas, filtroStatusNFe, filtroCobranca);
  };

  const [abrirNovoFaturamento, setAbrirNovoFaturamento] = useState(false);

  // Navegação por teclado (setas ↑/↓) na grade, no padrão de produtos/requisição.
  // `linhasExibidas` acompanha a ORDEM exibida (filtro + ordenação de coluna),
  // reportada pelo DataTable via onOrderedRowsChange, para o índice bater com a tela.
  const [linhasExibidas, setLinhasExibidas] = useState<any[]>([]);

  // Abre o menu "Ações" da linha selecionada (clica o trigger do dropdown na linha ativa).
  const abrirAcoesLinhaAtiva = () => {
    const rowEl = document.querySelector<HTMLElement>('.' + CLASSE_LINHA_ATIVA);
    const btn = rowEl?.querySelector<HTMLElement>('button[aria-haspopup="menu"]');
    btn?.click();
  };
  // Abre um novo faturamento (mesmo do botão "Novo").
  const abrirNovoFaturamentoLimpo = () => {
    setFaturasParaFaturar(null);
    setDadosFaturasAgrupadas(null);
    setAbrirNovoFaturamento(true);
  };

  const { linhaSelecionada, setLinhaSelecionada } = useNavegacaoTecladoTabela<any>({
    data: linhasExibidas,
    ativo: !abrirNovoFaturamento && !legendaAberta,
    // Atalhos (padrão da tela de produtos): ↑/↓ navega, Enter abre ações, Ctrl+N = Novo.
    onEnter: () => abrirAcoesLinhaAtiva(),
    atalhos: [
      { key: 'n', ctrl: true, precisaLinha: false, handler: () => abrirNovoFaturamentoLimpo() },
    ],
  });

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
          
          // Buscar por codvenda (chave exata) — antes ia como `nrovenda`, o que casava
          // por ambiguidade com a venda de OUTRO cliente e emitia a NF errada.
          const detalhesRes = await axios.get(`/api/faturamento/detalhes-venda?codvenda=${primeiroCodevenda}`);
          
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
    if (primeiroCarregamento) {
      buscarFaturas(1, 10, [], 'todas', 'todas', 'todas');
      setPrimeiroCarregamento(false);
    }
  }, [primeiroCarregamento, buscarFaturas]); // Dependências corretas

  // Busca dispara apenas no Enter ou ao sair do campo (onBuscar) — não a cada tecla.

  // ---- Período (De/Até + atalhos) ----
  const selecionarPreset = (p: string) => {
    const { de, ate } = calcPeriodo(p);
    setPresetPeriodo(p);
    setDataDe(de);
    setDataAte(ate);
    periodoRef.current = { de, ate };
    buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, filtroCobranca);
  };
  const mudarDataManual = (campo: 'de' | 'ate', valor: string) => {
    const novo = { de: campo === 'de' ? valor : dataDe, ate: campo === 'ate' ? valor : dataAte };
    setPresetPeriodo(''); // range personalizado — nenhum atalho aceso
    if (campo === 'de') setDataDe(valor); else setDataAte(valor);
    periodoRef.current = novo;
    buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, filtroCobranca);
  };

  // ---- Legenda-filtro (cada chip alterna um filtro existente do backend) ----
  const toggleLegenda = (cat: 'cancel' | 'denegada' | 'agrupado' | 'cobranca' | 'sem') => {
    if (cat === 'cancel') {
      const n = filtroStatusNFe === 'canceladas' ? 'todas' : 'canceladas';
      setFiltroStatusNFe(n as any);
      buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, n as any, filtroCobranca);
    } else if (cat === 'denegada') {
      const n = filtroStatusNFe === 'denegadas' ? 'todas' : 'denegadas';
      setFiltroStatusNFe(n as any);
      buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, n as any, filtroCobranca);
    } else if (cat === 'agrupado') {
      const n = filtroAgrupadas === 'agrupadas' ? 'todas' : 'agrupadas';
      setFiltroAgrupadas(n as any);
      buscarFaturas(1, meta.perPage, filtrosAtivos, n as any, filtroStatusNFe, filtroCobranca);
    } else if (cat === 'cobranca') {
      const n = filtroCobranca === 'com' ? 'todas' : 'com';
      setFiltroCobranca(n as any);
      buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, n as any);
    } else {
      const n = filtroCobranca === 'sem' ? 'todas' : 'sem';
      setFiltroCobranca(n as any);
      buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, n as any);
    }
  };

  // ---- Filtro por Status NFe (dropdown na coluna "Status NFe") ----
  // Casa 1:1 com a pill da coluna. Um por vez (backend já é enum).
  const opcoesStatusNFe = [
    { value: 'autorizadas', label: 'Autorizada' },
    { value: 'rejeitadas', label: 'Rejeitada' },
    { value: 'pendentes', label: 'Pendente' },
    { value: 'canceladas', label: 'Cancelada' },
    { value: 'denegadas', label: 'Denegada' },
  ];
  const mudarStatusNFe = (v: string) => {
    setFiltroStatusNFe(v as any);
    buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, v as any, filtroCobranca);
  };

  // Legenda-filtro (renderizada no RODAPÉ da tabela, ao lado de "Colunas").
  const legendaItens = [
    ['cancel', 'Cancelado', 'bg-rose-500', filtroStatusNFe === 'canceladas'],
    ['denegada', 'Denegada', 'bg-amber-400', filtroStatusNFe === 'denegadas'],
    ['agrupado', 'Agrupado', 'bg-blue-500', filtroAgrupadas === 'agrupadas'],
    ['cobranca', 'Com cobrança', 'bg-emerald-500', filtroCobranca === 'com'],
    ['sem', 'Sem cobrança', 'bg-pink-500', filtroCobranca === 'sem'],
  ] as [any, string, string, boolean][];
  const legendaAtivos = legendaItens.filter((i) => i[3]).length;

  // Legenda-filtro compacta: um botão (com preview das cores) que abre um popover
  // com os NOMES + cores clicáveis. Cabe numa linha no rodapé e mostra o significado.
  const legendaFiltro = (
    <div className="relative shrink-0">
      <button
        onClick={() => setLegendaAberta((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-xs text-gray-700 dark:text-gray-200 hover:border-gray-400 transition-colors"
      >
        <span className="flex items-center gap-0.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="w-2 h-2 rounded-full bg-pink-500" />
        </span>
        <span className="hidden lg:inline">Legenda</span>
        {legendaAtivos > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] leading-none">
            {legendaAtivos}
          </span>
        )}
        <span className="text-[9px] text-gray-400">▴</span>
      </button>

      {legendaAberta && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLegendaAberta(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 shadow-xl">
            <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Legenda / filtro por status
            </div>
            <div className="flex flex-col gap-0.5">
              {legendaItens.map(([cat, label, cor, ativo]) => (
                <button
                  key={cat}
                  onClick={() => toggleLegenda(cat)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    ativo
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-gray-900 dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${cor}`} />
                  <span className="flex-1 text-left">{label}</span>
                  {ativo && <span className="text-blue-600 dark:text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Toolbar (Tipo + Período) — injetada no HEADER da tabela (headerLeftSlot),
  // formando uma barra única com a busca e o Opções.
  const toolbarFiltros = (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Tipo:</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setFiltroAgrupadas('todas');
              buscarFaturas(1, meta.perPage, filtrosAtivos, 'todas', filtroStatusNFe, filtroCobranca);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
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
              buscarFaturas(1, meta.perPage, filtrosAtivos, 'agrupadas', filtroStatusNFe, filtroCobranca);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
              filtroAgrupadas === 'agrupadas'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
            }`}
          >
            Agrupadas
          </button>
        </div>
      </div>
      <div className="h-6 w-px bg-gray-300 dark:bg-zinc-600 hidden sm:block" />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Período:</span>
        <div className="flex gap-1">
          {(
            [
              ['hoje', 'Hoje'],
              ['semana', 'Semana'],
              ['mes', 'Mês'],
              ['ano', 'Ano'],
              ['todos', 'Todos'],
            ] as [string, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => selecionarPreset(p)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                presetPeriodo === p
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span>De</span>
          <input
            type="date"
            value={dataDe}
            onChange={(e) => mudarDataManual('de', e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-800 dark:text-white text-xs"
          />
          <span>Até</span>
          <input
            type="date"
            value={dataAte}
            onChange={(e) => mudarDataManual('ate', e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-800 dark:text-white text-xs"
          />
        </div>
      </div>
    </div>
  );
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
      <main className="p-4 w-full flex flex-col flex-1 min-h-0">
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

        {/* Toolbar (Tipo + Período) foi para o HEADER da tabela (headerLeftSlot),
            junto da busca e do Opções — barra única, mais espaço pra grade. */}
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
          onPageChange={(page) => buscarFaturas(page, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, filtroCobranca)}
          onPerPageChange={(perPage) => buscarFaturas(1, perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, filtroCobranca)}
          onFiltroChange={handleFiltroChange}
          onAtualizarLista={() =>
            buscarFaturas(meta.currentPage, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, filtroCobranca)
          }
          termoBusca={termoBusca}
          setTermoBusca={setTermoBusca}
          onBuscar={() =>
            buscarFaturas(1, meta.perPage, filtrosAtivos, filtroAgrupadas, filtroStatusNFe, filtroCobranca)
          }
          limiteColunas={limiteColunas}
          onLimiteColunasChange={setLimiteColunas}
          onCriarGrupoPagamento={handleCriarGrupoPagamento}
          onOrderedRowsChange={setLinhasExibidas}
          rowClassName={(row, i) => {
            const cor = MAPA_COR_LINHA[(row as any).__statusCor] || '';
            const sel =
              i === linhaSelecionada
                ? `ring-1 ring-inset ring-blue-400 ${CLASSE_LINHA_ATIVA}`
                : '';
            return `${cor} ${sel}`;
          }}
          onRowClick={(row) => setLinhaSelecionada(linhasExibidas.indexOf(row))}
          legendaSlot={legendaFiltro}
          headerLeftSlot={toolbarFiltros}
          searchCompacto
          statusFilterValue={filtroStatusNFe}
          onStatusFilterChange={mudarStatusNFe}
          statusFilterOptions={opcoesStatusNFe}
        />
      </main>
      <Dialog
        open={abrirNovoFaturamento}
        onOpenChange={handleFecharModalFaturamento}
      >
        {/* CORREÇÃO: Classes ajustadas para um modal grande com padding, e Dialog duplicado removido. */}
        {/* Não fechar ao clicar fora nem no Esc: evita perder um faturamento em andamento.
            O fechamento é intencional, pelo botão X (canto sup. direito) do DialogContent. */}
        <DialogContent
          className="w-[96vw] h-[95vh] max-w-none p-6"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
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
