'use client';

import React, { useState, useEffect, useContext, useRef, ChangeEvent } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { useNotasConhecimento, type FiltrosNotasConhecimento, type NotaConhecimento } from '@/hooks/useNotasConhecimento';
import { toast } from 'sonner';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import Modal from '@/components/common/Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Truck } from 'lucide-react';
import DataTableContasPagar from '@/components/common/DataTableContasPagar';
import DropdownNotasConhecimento from '@/components/common/DropdownNotasConhecimento';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Meta } from '@/data/common/meta';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function NotasConhecimento() {
  const { user } = useContext(AuthContext);
  const {
    notas,
    carregando,
    paginaAtual,
    totalPaginas,
    total,
    limite,
    consultarNotas,
    setPaginaAtual,
    setLimite,
  } = useNotasConhecimento();

  // Estados para filtros
  const [filtros, setFiltros] = useState<FiltrosNotasConhecimento>({});
  const [termoBusca, setTermoBusca] = useState('');
  const [prefsProntas, setPrefsProntas] = useState(false);
  const rangeInteracaoRef = useRef(false);

  // Filtro de período
  const calcularSemanaAtual = () => {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaSemana);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    return {
      dataInicio: inicioSemana.toISOString().split('T')[0],
      dataFim: fimSemana.toISOString().split('T')[0]
    };
  };

  const [rangeDataAtivo, setRangeDataAtivoLocal] = useState<'semana' | 'mes' | 'personalizado' | 'todos'>('todos');
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('');

  // Carregar preferência de período
  useEffect(() => {
    if (!user?.usuario) { setPrefsProntas(true); return; }
    fetch(`/api/userPreferences?user=${encodeURIComponent(user.usuario)}&screen=notas-conhecimento_rangeData`)
      .then(r => r.json())
      .then(data => {
        const hoje = new Date();
        const valor = (data.preferences?.value || 'todos') as 'semana' | 'mes' | 'personalizado' | 'todos';
        setRangeDataAtivoLocal(valor);
        if (valor === 'semana') {
          const s = calcularSemanaAtual();
          setFiltros(prev => ({ ...prev, data_inicio: s.dataInicio, data_fim: s.dataFim }));
        } else if (valor === 'mes') {
          const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          setFiltros(prev => ({ ...prev, data_inicio: inicioMes.toISOString().split('T')[0], data_fim: fimMes.toISOString().split('T')[0] }));
        }
        // 'todos' = sem filtro de data (padrão)
      })
      .catch(() => {})
      .finally(() => setPrefsProntas(true));
  }, [user?.usuario]);

  const setRangeDataAtivo = (value: 'semana' | 'mes' | 'personalizado' | 'todos') => {
    rangeInteracaoRef.current = true;
    setRangeDataAtivoLocal(value);
    if (user?.usuario) {
      fetch('/api/userPreferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.usuario, screen: 'notas-conhecimento_rangeData', preferences: { value } }),
      }).catch(() => {});
    }
  };

  // Recalcular datas quando range muda (só por interação)
  useEffect(() => {
    if (!rangeInteracaoRef.current) return;
    const hoje = new Date();
    if (rangeDataAtivo === 'semana') {
      const s = calcularSemanaAtual();
      setFiltros(prev => ({ ...prev, data_inicio: s.dataInicio, data_fim: s.dataFim }));
    } else if (rangeDataAtivo === 'mes') {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      setFiltros(prev => ({ ...prev, data_inicio: inicioMes.toISOString().split('T')[0], data_fim: fimMes.toISOString().split('T')[0] }));
    } else if (rangeDataAtivo === 'todos') {
      setFiltros(prev => {
        const { data_inicio, data_fim, ...rest } = prev as any;
        return rest;
      });
    } else if (rangeDataAtivo === 'personalizado' && dataInicioPersonalizada && dataFimPersonalizada) {
      setFiltros(prev => ({ ...prev, data_inicio: dataInicioPersonalizada, data_fim: dataFimPersonalizada }));
    }
    setPaginaAtual(1);
  }, [rangeDataAtivo, dataInicioPersonalizada, dataFimPersonalizada]);

  // Estados para modais
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalGerarTituloAberto, setModalGerarTituloAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState<NotaConhecimento | null>(null);
  const [bancosDisponiveis, setBancosDisponiveis] = useState<{ value: string; label: string }[]>([]);
  const [bancoTitulo, setBancoTitulo] = useState('');
  const [descricaoTitulo, setDescricaoTitulo] = useState('');
  const [modalGerarContaAberto, setModalGerarContaAberto] = useState(false);
  const [contaDados, setContaDados] = useState({
    tipo: 'T' as 'F' | 'T',
    cod_conta: '7',
    cod_comprador: '',
    dt_venc: '',
    obs: '',
  });

  // Estados para seleção múltipla
  const [notasSelecionadas, setNotasSelecionadas] = useState<Set<string>>(new Set());
  const [filtroTituloGerado, setFiltroTituloGerado] = useState<'todos' | 'com_titulo' | 'sem_titulo'>('sem_titulo');

  const colunasDisponiveis = ['codtransp', 'nrocon', 'serie', 'dtcon', 'totaltransp', 'nome_transp'];

  const headers = ['☑️', 'Nº CT-e', 'Série', 'Transportadora', 'Emissão', 'Valor', 'Ações'];

  const meta: Meta = {
    total: total || 0,
    lastPage: totalPaginas || 1,
    currentPage: paginaAtual,
    perPage: limite,
  };

  // Carregar dados (só após prefs prontas)
  useEffect(() => {
    if (!prefsProntas) return;
    consultarNotas(paginaAtual, limite, filtros);
  }, [paginaAtual, limite, filtros, prefsProntas]);

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  // Seleção
  const toggleSelecionarNota = (chave: string) => {
    const novas = new Set(notasSelecionadas);
    if (novas.has(chave)) novas.delete(chave); else novas.add(chave);
    setNotasSelecionadas(novas);
  };

  const toggleSelecionarTodos = () => {
    const selecionaveis = notas.filter(n => !n.cod_pgto);
    if (notasSelecionadas.size === selecionaveis.length) {
      setNotasSelecionadas(new Set());
    } else {
      setNotasSelecionadas(new Set(selecionaveis.map((n, i) => `${n.codtransp}-${n.nrocon}-${n.serie || '0'}-${i}`)));
    }
  };

  const limparSelecao = () => setNotasSelecionadas(new Set());

  const getNotasSelecionadasDetalhes = (): NotaConhecimento[] =>
    notas.filter((nota, index) => notasSelecionadas.has(`${nota.codtransp}-${nota.nrocon}-${nota.serie || '0'}-${index}`));

  const calcularTotalSelecionado = () => getNotasSelecionadasDetalhes().reduce((acc, n) => acc + n.totaltransp, 0);

  const getNotasFiltradas = () => {
    if (filtroTituloGerado === 'com_titulo') return notas.filter(n => n.cod_pgto);
    if (filtroTituloGerado === 'sem_titulo') return notas.filter(n => !n.cod_pgto);
    return notas;
  };

  // Preparar dados da tabela — padrão text-xs
  const prepararDadosTabela = () => {
    const notasFiltradas = getNotasFiltradas();
    return notasFiltradas.map((nota, index) => {
      const chave = `${nota.codtransp}-${nota.nrocon}-${nota.serie || '0'}-${notasFiltradas.indexOf(nota)}`;
      const isSelecionado = notasSelecionadas.has(chave);
      let mostrarCheckbox = filtroTituloGerado === 'sem_titulo' || (filtroTituloGerado === 'todos' && !nota.cod_pgto);

      return [
        mostrarCheckbox ? (
          <input type="checkbox" checked={isSelecionado} onChange={() => toggleSelecionarNota(chave)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
        ) : (<span className="text-gray-300 dark:text-gray-600">-</span>),
        <span className="font-mono text-xs">{nota.nrocon}</span>,
        <span className="text-xs">{nota.serie || '-'}</span>,
        <span className="text-xs">
          <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{nota.codtransp}</span>
          {" - "}{nota.nome_transp || 'Não informado'}
        </span>,
        <span className="text-xs">{formatarData(nota.dtcon)}</span>,
        <span className="font-mono text-xs">{formatarMoeda(nota.totaltransp)}</span>,
        <DropdownNotasConhecimento
          nota={nota}
          onVisualizarClick={() => abrirModalDetalhes(nota)}
          onGerarTituloClick={() => abrirModalGerarTitulo(nota)}
          onExportarClick={() => toast.info('Função em desenvolvimento')}
          onImprimirClick={() => toast.info('Função em desenvolvimento')}
        />
      ];
    });
  };

  const handleFiltroAvancado = (filtrosDinamicos: { campo: string; tipo: string; valor: string }[]) => {
    const novosFiltros: FiltrosNotasConhecimento = {};
    filtrosDinamicos.forEach(({ campo, tipo, valor }) => {
      if (campo === 'codtransp') novosFiltros.codtransp = valor;
      if (campo === 'nrocon' || campo === 'nº ct-e') novosFiltros.nrocon = valor;
      if (campo === 'dtcon' || campo === 'emissão') {
        if (tipo === 'maior' || tipo === 'maior_igual' || tipo === 'igual') novosFiltros.data_inicio = valor;
        if (tipo === 'menor' || tipo === 'menor_igual' || tipo === 'igual') novosFiltros.data_fim = valor;
      }
    });
    const filtrosMesclados = { ...filtros };
    Object.keys(novosFiltros).forEach(key => {
      const v = novosFiltros[key as keyof FiltrosNotasConhecimento];
      if (v === '' || v === undefined) delete filtrosMesclados[key as keyof FiltrosNotasConhecimento];
      else (filtrosMesclados as any)[key] = v;
    });
    setFiltros(filtrosMesclados);
    setPaginaAtual(1);
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => setTermoBusca(e.target.value);
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const f = { ...filtros };
      if (termoBusca) f.search = termoBusca; else delete f.search;
      setFiltros(f);
      setPaginaAtual(1);
    }
  };

  const abrirModalDetalhes = (nota: NotaConhecimento) => { setNotaSelecionada(nota); setModalDetalhesAberto(true); };
  const abrirModalGerarTitulo = (nota: NotaConhecimento) => { setNotaSelecionada(nota); setBancoTitulo(''); setDescricaoTitulo(''); setModalGerarTituloAberto(true); };

  const handleGerarTitulo = async () => {
    if (!notaSelecionada || !bancoTitulo) { toast.error('Selecione o banco'); return; }
    try {
      const resp = await fetch('/api/notas-conhecimento/gerar-titulo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codtransp: notaSelecionada.codtransp, nrocon: notaSelecionada.nrocon, banco: bancoTitulo, descricao: descricaoTitulo || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Erro');
      if (data.sucesso && data.boleto) toast.success(`Título gerado! Linha digitável: ${data.boleto.linhaDigitavel}`, { duration: 5000 });
      setModalGerarTituloAberto(false);
      setNotaSelecionada(null);
    } catch (err: any) { toast.error(err.message || 'Erro ao gerar título'); }
  };

  const abrirModalGerarConta = () => {
    if (notasSelecionadas.size === 0) { toast.error('Selecione pelo menos uma nota'); return; }
    const detalhes = getNotasSelecionadasDetalhes();
    const maisRecente = detalhes.reduce((mr, n) => { const d = new Date(n.dtcon + 'T00:00:00'); return d > mr ? d : mr; }, new Date('1900-01-01'));
    const venc = new Date(maisRecente); venc.setDate(venc.getDate() + 30);
    setContaDados({ tipo: 'T', cod_conta: '', cod_comprador: '', dt_venc: venc.toISOString().split('T')[0], obs: `Pagamento de ${notasSelecionadas.size} CT-e(s): ${detalhes.map(n => n.nrocon).join(', ')}` });
    setModalGerarContaAberto(true);
  };

  const handleGerarConta = async () => {
    if (!contaDados.cod_conta || !contaDados.dt_venc) { toast.error('Preencha Conta e Vencimento'); return; }
    const detalhes = getNotasSelecionadasDetalhes();
    toast.promise(
      (async () => {
        const resp = await fetch('/api/notas-conhecimento/gerar-titulo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notas: detalhes.map(n => ({ codtransp: n.codtransp, nrocon: n.nrocon })), cod_conta: contaDados.cod_conta, cod_comprador: contaDados.cod_comprador || undefined, dt_venc: contaDados.dt_venc, obs: contaDados.obs }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.erro || 'Erro');
        return data;
      })(),
      {
        loading: 'Gerando conta a pagar...',
        success: (data) => { setModalGerarContaAberto(false); limparSelecao(); return `Conta gerada! Código: ${data.conta.cod_pgto}`; },
        error: (err) => `Erro: ${err.message}`,
      }
    );
  };

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-black dark:text-white">
              Notas de Conhecimento (CT-e)
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {carregando && notas.length === 0 ? (
                <span className="inline-flex gap-2 items-center">
                  <span className="inline-block h-3 w-8 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                  CT-e pendentes
                </span>
              ) : (
                <>{getNotasFiltradas().length} CT-e encontrados - {formatarMoeda(getNotasFiltradas().reduce((acc, n) => acc + n.totaltransp, 0))}</>
              )}
            </p>
          </div>

          <div className="flex gap-2 items-center">
            {/* Filtro de período */}
            <div className="flex gap-1 border border-gray-300 dark:border-gray-600 rounded-md p-1">
              {(['semana', 'mes', 'personalizado', 'todos'] as const).map(opt => (
                <button key={opt} onClick={() => setRangeDataAtivo(opt)}
                  className={`px-3 py-1 text-xs rounded transition ${rangeDataAtivo === opt ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  {opt === 'semana' ? 'Semana' : opt === 'mes' ? 'Mês' : opt === 'personalizado' ? 'Personalizado' : 'Todos'}
                </button>
              ))}
            </div>

            {rangeDataAtivo === 'personalizado' && (
              <div className="flex gap-2 items-center">
                <Input type="date" value={dataInicioPersonalizada} onChange={(e) => setDataInicioPersonalizada(e.target.value)} className="w-36 h-8 text-xs" />
                <span className="text-xs text-gray-500 dark:text-gray-400">até</span>
                <Input type="date" value={dataFimPersonalizada} onChange={(e) => setDataFimPersonalizada(e.target.value)} className="w-36 h-8 text-xs" />
              </div>
            )}

            {/* Filtro de título */}
            <Select value={filtroTituloGerado} onValueChange={(v) => setFiltroTituloGerado(v as any)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem_titulo">Sem título</SelectItem>
                <SelectItem value="com_titulo">Com título</SelectItem>
              </SelectContent>
            </Select>

            {notasSelecionadas.size > 0 && (
              <DefaultButton variant="primary" size="default" onClick={abrirModalGerarConta}
                icon={<DollarSign className="w-4 h-4" />} text={`Gerar Conta (${notasSelecionadas.size})`} />
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 min-h-20 flex flex-col">
          <DataTableContasPagar
            screenKey="notas-conhecimento"
            userName={user?.usuario}
            headers={headers}
            rows={prepararDadosTabela()}
            meta={meta}
            onPageChange={setPaginaAtual}
            onPerPageChange={(perPage) => { setLimite(perPage); setPaginaAtual(1); }}
            onSearch={handleSearch}
            onSearchKeyDown={handleSearchKeyDown}
            searchInputPlaceholder="Buscar (CT-e, transportadora, série...)"
            loading={carregando}
            noDataMessage="Nenhuma nota de conhecimento encontrada"
            onFiltroChange={handleFiltroAvancado}
            colunasFiltro={colunasDisponiveis}
            nonsortableColumns={['☑️', 'Ações']}
          />
        </div>
      </main>

      {/* Modal Detalhes */}
      <Modal isOpen={modalDetalhesAberto} onClose={() => setModalDetalhesAberto(false)} title="Detalhes do CT-e">
        <div className="form-compact space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Nº CT-e</Label><p className="font-mono text-xs">{notaSelecionada?.nrocon}</p></div>
            <div><Label>Série</Label><p className="text-xs">{notaSelecionada?.serie || '-'}</p></div>
            <div><Label>Transportadora</Label><p className="text-xs">{notaSelecionada?.nome_transp || notaSelecionada?.codtransp}</p></div>
            <div><Label>Data Emissão</Label><p className="text-xs">{formatarData(notaSelecionada?.dtcon || null)}</p></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Valor Total</Label><p className="font-mono text-xs">{formatarMoeda(notaSelecionada?.totaltransp || 0)}</p></div>
          </div>
          <div className="flex justify-end pt-3 border-t">
            <AuxButton variant="secondary" onClick={() => setModalDetalhesAberto(false)} text="Fechar" />
          </div>
        </div>
      </Modal>

      {/* Modal Gerar Título */}
      <Modal isOpen={modalGerarTituloAberto} onClose={() => { setModalGerarTituloAberto(false); setBancoTitulo(''); setDescricaoTitulo(''); }} title="Gerar Título - CT-e">
        <div className="form-compact space-y-3">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-2">
            <div className="flex gap-4 text-[11px]">
              <span className="text-orange-700 dark:text-orange-300"><strong>CT-e:</strong> {notaSelecionada?.nrocon}</span>
              <span className="text-orange-700 dark:text-orange-300"><strong>Transp:</strong> {notaSelecionada?.nome_transp || notaSelecionada?.codtransp}</span>
              <span className="text-orange-700 dark:text-orange-300"><strong>Valor:</strong> {formatarMoeda(notaSelecionada?.totaltransp || 0)}</span>
              <span className="text-orange-700 dark:text-orange-300"><strong>Venc:</strong> {formatarData(notaSelecionada?.dtcon || null)}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Banco *</Label>
              <SearchableSelect value={bancoTitulo} onValueChange={setBancoTitulo} placeholder="Selecione o banco" options={bancosDisponiveis} />
            </div>
            <div className="col-span-3">
              <Label>Descrição (opcional)</Label>
              <Input type="text" value={descricaoTitulo} onChange={(e) => setDescricaoTitulo(e.target.value)} placeholder="Ex: CT-e Transportadora XYZ" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <AuxButton variant="secondary" onClick={() => { setModalGerarTituloAberto(false); setBancoTitulo(''); setDescricaoTitulo(''); }} text="Cancelar" />
            <DefaultButton variant="primary" onClick={handleGerarTitulo} disabled={!bancoTitulo} text="Gerar Título" />
          </div>
        </div>
      </Modal>

      {/* Modal Gerar Conta a Pagar */}
      <Modal isOpen={modalGerarContaAberto} onClose={() => { setModalGerarContaAberto(false); setContaDados({ tipo: 'T', cod_conta: '7', cod_comprador: '', dt_venc: '', obs: '' }); }} title="Gerar Conta a Pagar - CT-e">
        <div className="form-compact space-y-3">
          {/* Resumo */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
            <div className="flex gap-4 text-[11px]">
              <span className="text-green-700 dark:text-green-300"><strong>Notas:</strong> {notasSelecionadas.size}</span>
              <span className="text-green-700 dark:text-green-300"><strong>Valor total:</strong> {formatarMoeda(calcularTotalSelecionado())}</span>
            </div>
          </div>

          {/* Lista de CT-e */}
          <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300">CT-e</th>
                  <th className="px-2 py-1 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300">Transportadora</th>
                  <th className="px-2 py-1 text-right text-[10px] font-medium text-gray-700 dark:text-gray-300">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {getNotasSelecionadasDetalhes().map((nota) => (
                  <tr key={`${nota.codtransp}-${nota.nrocon}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-2 py-1 font-mono text-xs">{nota.nrocon}</td>
                    <td className="px-2 py-1 text-xs truncate max-w-[200px]">{nota.nome_transp}</td>
                    <td className="px-2 py-1 text-xs text-right">{formatarMoeda(nota.totaltransp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formulário */}
          <div className="border-t pt-3">
            <h3 className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-300 uppercase tracking-wide">Configurações da Conta a Pagar</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Tipo de Conta</Label>
                <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Transportadora
                </div>
              </div>
              <div>
                <Label>Conta Financeira *</Label>
                <Autocomplete placeholder="Buscar conta..." apiUrl="/api/contas-pagar/contas" value={contaDados.cod_conta}
                  onChange={(v) => setContaDados({ ...contaDados, cod_conta: v })} mapResponse={(d) => d.contas || []} />
              </div>
              <div>
                <Label>Comprador</Label>
                <Autocomplete placeholder="Buscar..." apiUrl="/api/contas-pagar/compradores" value={contaDados.cod_comprador}
                  onChange={(v) => setContaDados({ ...contaDados, cod_comprador: v })} mapResponse={(d) => d.compradores || []} />
              </div>
              <div>
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={contaDados.dt_venc} onChange={(e) => setContaDados({ ...contaDados, dt_venc: e.target.value })} />
              </div>
            </div>
            <div className="mt-3">
              <Label>Observações</Label>
              <Textarea name="obs" value={contaDados.obs} onChange={(e) => setContaDados({ ...contaDados, obs: e.target.value })} placeholder="Observações..." rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <AuxButton variant="secondary" onClick={() => { setModalGerarContaAberto(false); setContaDados({ tipo: 'T', cod_conta: '7', cod_comprador: '', dt_venc: '', obs: '' }); }} text="Cancelar" />
            <DefaultButton variant="primary" onClick={handleGerarConta} text="Gerar Conta a Pagar" disabled={!contaDados.cod_conta || !contaDados.dt_venc} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
