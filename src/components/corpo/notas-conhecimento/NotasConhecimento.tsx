'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useNotasConhecimento, type FiltrosNotasConhecimento, type NotaConhecimento } from '@/hooks/useNotasConhecimento';
import { toast } from 'sonner';
import { DefaultButton } from '@/components/common/Buttons';
import Modal from '@/components/common/Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Eye, DollarSign, Truck } from 'lucide-react';
import DataTableContasPagar from '@/components/common/DataTableContasPagar';
import DropdownNotasConhecimento from '@/components/common/DropdownNotasConhecimento';
import { Autocomplete } from '@/components/common/Autocomplete';
import { Meta } from '@/data/common/meta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotasConhecimento() {
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

  // Estados para modais
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalGerarTituloAberto, setModalGerarTituloAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState<NotaConhecimento | null>(null);
  
  // Estados para bancos
  const [bancosDisponiveis, setBancosDisponiveis] = useState<{ value: string; label: string }[]>([]);

  // Estados para modal gerar título individual
  const [bancoTitulo, setBancoTitulo] = useState('');
  const [descricaoTitulo, setDescricaoTitulo] = useState('');

  // Estados para modal gerar conta a pagar
  const [modalGerarContaAberto, setModalGerarContaAberto] = useState(false);
  const [contaDados, setContaDados] = useState({
    tipo: 'T' as 'F' | 'T', // Sempre transportadora para CT-e
    cod_conta: '7', // Default: item 7
    cod_comprador: '',
    dt_venc: '',
    obs: '',
  });

  // Estados para seleção múltipla
  const [notasSelecionadas, setNotasSelecionadas] = useState<Set<string>>(new Set());
  const [filtroTituloGerado, setFiltroTituloGerado] = useState<'todos' | 'com_titulo' | 'sem_titulo'>('sem_titulo');

  // Colunas disponíveis para filtro avançado
  const colunasDisponiveis = [
    'codtransp',
    'nrocon',
    'serie',
    'dtcon',
    'totaltransp',
    'nome_transp'
  ];

  // Headers da tabela
  const headers = [
    '☑️',
    'Nº CT-e',
    'Série',
    'Transportadora',
    'Emissão',
    'Valor',
    'Ações',
  ];

  // Converter paginação para formato Meta
  const meta: Meta = {
    total: total || 0,
    lastPage: totalPaginas || 1,
    currentPage: paginaAtual,
    perPage: limite,
    to: Math.min(paginaAtual * limite, total || 0),
    from: ((paginaAtual - 1) * limite) + 1
  };

  useEffect(() => {
    consultarNotas(paginaAtual, limite, filtros);
  }, [paginaAtual, limite, filtros]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const toggleSelecionarNota = (chave: string) => {
    const novasSelecoes = new Set(notasSelecionadas);
    if (novasSelecoes.has(chave)) {
      novasSelecoes.delete(chave);
    } else {
      novasSelecoes.add(chave);
    }
    setNotasSelecionadas(novasSelecoes);
  };

  const toggleSelecionarTodos = () => {
    // Filtra apenas notas que não têm título gerado (todos são pendentes)
    const notasSelecionaveis = notas.filter(n => !n.cod_pgto);
    
    if (notasSelecionadas.size === notasSelecionaveis.length) {
      setNotasSelecionadas(new Set());
    } else {
      const chaves = notasSelecionaveis.map((n) => 
        `${n.codtransp}-${n.nrocon}-${n.serie || '0'}-${notas.indexOf(n)}`
      );
      setNotasSelecionadas(new Set(chaves));
    }
  };

  const limparSelecao = () => {
    setNotasSelecionadas(new Set());
  };

  const getNotasSelecionadasDetalhes = (): NotaConhecimento[] => {
    return notas.filter((nota, index) => {
      const chave = `${nota.codtransp}-${nota.nrocon}-${nota.serie || '0'}-${index}`;
      return notasSelecionadas.has(chave);
    });
  };

  const calcularTotalSelecionado = () => {
    const notasDetalhes = getNotasSelecionadasDetalhes();
    return notasDetalhes.reduce((acc, nota) => acc + nota.totaltransp, 0);
  };

  // Função para aplicar filtro de título
  const getNotasFiltradas = () => {
    let notasFiltradas = notas;
    if (filtroTituloGerado === 'com_titulo') {
      notasFiltradas = notas.filter(n => n.cod_pgto);
    } else if (filtroTituloGerado === 'sem_titulo') {
      notasFiltradas = notas.filter(n => !n.cod_pgto);
    }
    return notasFiltradas;
  };

  // Preparar dados no formato que o DataTable espera
  const prepararDadosTabela = () => {
    // Aplicar filtro de título gerado
    const notasFiltradas = getNotasFiltradas();

    return notasFiltradas.map((nota, index) => {
      // Usar índice + dados para garantir unicidade absoluta
      const chave = `${nota.codtransp}-${nota.nrocon}-${nota.serie || '0'}-${notasFiltradas.indexOf(nota)}`;
      const isSelecionado = notasSelecionadas.has(chave);
      
      // Lógica de exibição do checkbox baseada no filtro
      let mostrarCheckbox = false;
      if (filtroTituloGerado === 'todos') {
        // Mostra checkbox para os sem título e "-" para os com título
        mostrarCheckbox = !nota.cod_pgto;
      } else if (filtroTituloGerado === 'sem_titulo') {
        // Mostra checkbox normal (só exibe notas sem título)
        mostrarCheckbox = true;
      }
      // Se filtro é 'com_titulo', mostrarCheckbox fica false (sempre mostra "-")

      // Retornar array na ordem dos headers
      return [
        // ☑️ (checkbox)
        mostrarCheckbox ? (
          <input
            type="checkbox"
            checked={isSelecionado}
            onChange={() => toggleSelecionarNota(chave)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
          />
        ) : (
          <span className="text-gray-300 dark:text-gray-600">-</span>
        ),

        // Nº CT-e
        <span className="font-mono font-medium">{nota.nrocon}</span>,

        // Série
        <span className="text-sm">{nota.serie || '-'}</span>,

        // Transportadora
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{nota.codtransp}</span>
            {" - "}
            {nota.nome_transp || 'Não informado'}
          </span>
        </div>,

        // Emissão
        <span className="text-sm">{formatarData(nota.dtcon)}</span>,

        // Valor
        <span className="font-mono font-medium">{formatarMoeda(nota.totaltransp)}</span>,

        // Ações
        <DropdownNotasConhecimento
          nota={nota}
          onVisualizarClick={() => abrirModalDetalhes(nota)}
          onGerarTituloClick={() => abrirModalGerarTitulo(nota)}
          onExportarClick={() => {
            toast.info('Função de exportar em desenvolvimento');
          }}
          onImprimirClick={() => {
            toast.info('Função de imprimir em desenvolvimento');
          }}
        />
      ];
    });
  };

  const handleFiltroAvancado = (filtrosDinamicos: { campo: string; tipo: string; valor: string }[]) => {
    console.log('Filtros dinâmicos recebidos:', filtrosDinamicos);
    
    const novosFiltros: FiltrosNotasConhecimento = {};
    
    filtrosDinamicos.forEach(filtro => {
      const { campo, tipo, valor } = filtro;
      
      switch (campo) {
        case 'codtransp':
          novosFiltros.codtransp = valor;
          break;
        case 'nrocon':
        case 'nº ct-e':
          novosFiltros.nrocon = valor;
          break;
        case 'serie':
        case 'seriecon':
          // Serie não tem filtro específico na API
          break;
        case 'dtcon':
        case 'emissão':
        case 'emissao':
          if (tipo === 'maior' || tipo === 'maior_igual' || tipo === 'igual') {
            novosFiltros.data_inicio = valor;
          }
          if (tipo === 'menor' || tipo === 'menor_igual' || tipo === 'igual') {
            novosFiltros.data_fim = valor;
          }
          break;
        case 'valor':
        case 'totaltransp':
          // Valor não tem filtro específico na API atualmente
          break;
      }
    });
    
    console.log('Filtros convertidos para API:', novosFiltros);
    
    setFiltros(novosFiltros);
    setPaginaAtual(1);
    
    toast.success('Filtros aplicados!', {
      position: 'top-right',
    });
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setTermoBusca(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const novosFiltros = { ...filtros };
      if (termoBusca) {
        novosFiltros.search = termoBusca;
      } else {
        delete novosFiltros.search;
      }
      setFiltros(novosFiltros);
      setPaginaAtual(1);
    }
  };

  const abrirModalDetalhes = (nota: NotaConhecimento) => {
    setNotaSelecionada(nota);
    setModalDetalhesAberto(true);
  };

  const abrirModalGerarTitulo = (nota: NotaConhecimento) => {
    setNotaSelecionada(nota);
    setBancoTitulo('');
    setDescricaoTitulo('');
    setModalGerarTituloAberto(true);
  };

  const handleGerarTitulo = async () => {
    if (!notaSelecionada || !bancoTitulo) {
      toast.error('Selecione o banco para gerar o título');
      return;
    }

    try {
      const response = await fetch('/api/notas-conhecimento/gerar-titulo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codtransp: notaSelecionada.codtransp,
          nrocon: notaSelecionada.nrocon,
          banco: bancoTitulo,
          descricao: descricaoTitulo || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || `Erro HTTP: ${response.status}`);
      }

      if (data.sucesso && data.boleto) {
        toast.success(`Título gerado com sucesso! Linha digitável: ${data.boleto.linhaDigitavel}`, {
          duration: 5000,
        });

        console.log('Boleto gerado:', data.boleto);
      }

      setModalGerarTituloAberto(false);
      setNotaSelecionada(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar título', {
        position: 'top-right',
      });
    }
  };

  const abrirModalGerarConta = () => {
    if (notasSelecionadas.size === 0) {
      toast.error('Selecione pelo menos uma nota de conhecimento');
      return;
    }

    // Calcular data de vencimento baseada na data mais recente das notas selecionadas
    const notasDetalhes = getNotasSelecionadasDetalhes();
    const dataMaisRecente = notasDetalhes.reduce((maisRecente, nota) => {
      const dataNota = new Date(nota.dtcon + 'T00:00:00');
      return dataNota > maisRecente ? dataNota : maisRecente;
    }, new Date('1900-01-01'));

    // Definir vencimento para 30 dias após a data mais recente
    const dataVencimento = new Date(dataMaisRecente);
    dataVencimento.setDate(dataVencimento.getDate() + 30);

    setContaDados({
      tipo: 'T', // Sempre transportadora
      cod_conta: '',
      cod_comprador: '',
      dt_venc: dataVencimento.toISOString().split('T')[0],
      obs: `Pagamento de ${notasSelecionadas.size} CT-e(s): ${notasDetalhes.map(n => n.nrocon).join(', ')}`,
    });

    setModalGerarContaAberto(true);
  };

  const handleGerarConta = async () => {
    if (!contaDados.cod_conta || !contaDados.dt_venc) {
      toast.error('Preencha os campos obrigatórios (Conta e Data de Vencimento)');
      return;
    }

    const notasDetalhes = getNotasSelecionadasDetalhes();

    // Preparar dados para o novo endpoint
    const dadosGeracao = {
      notas: notasDetalhes.map(nota => ({
        codtransp: nota.codtransp,
        nrocon: nota.nrocon
      })),
      cod_conta: contaDados.cod_conta,
      cod_comprador: contaDados.cod_comprador || undefined,
      dt_venc: contaDados.dt_venc,
      obs: contaDados.obs
    };

    toast.promise(
      (async () => {
        const response = await fetch('/api/notas-conhecimento/gerar-titulo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dadosGeracao),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.erro || `Erro HTTP: ${response.status}`);
        }

        return data;
      })(),
      {
        loading: 'Gerando conta a pagar...',
        success: (data) => {
          setModalGerarContaAberto(false);
          limparSelecao();
          setContaDados({
            tipo: 'T',
            cod_conta: '7',
            cod_comprador: '',
            dt_venc: '',
            obs: '',
          });

          return `Conta a pagar gerada com sucesso! Código: ${data.conta.cod_pgto} - Valor: R$ ${data.conta.valor_total.toFixed(2)}`;
        },
        error: (err) => `Erro ao gerar conta a pagar: ${err.message}`,
      }
    );
  };

  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Header com título e ações */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white">
              Notas de Conhecimento (CT-e)
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Geração de contas a pagar a partir de CT-e
            </p>
          </div>

          <div className="flex gap-3 items-center">
            {/* Filtro de título gerado */}
            <Select value={filtroTituloGerado} onValueChange={(value) => setFiltroTituloGerado(value as 'todos' | 'com_titulo' | 'sem_titulo')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sem_titulo">Sem título</SelectItem>
                <SelectItem value="com_titulo">Com título</SelectItem>
              </SelectContent>
            </Select>

            {notasSelecionadas.size > 0 && (
              <DefaultButton
                variant="primary"
                size="default"
                onClick={() => setModalGerarContaAberto(true)}
                icon={<DollarSign className="w-4 h-4" />}
                text={`Gerar Conta a Pagar (${notasSelecionadas.size})`}
                className="relative"
              />
            )}
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 flex-shrink-0">
          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Total de CT-e
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {getNotasFiltradas().length}
              </div>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-500">
                {getNotasFiltradas().length}
              </div>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="p-0 pb-1">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Valor Total Pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <div className="text-lg font-bold text-red-600 dark:text-red-500">
                {formatarMoeda(
                  getNotasFiltradas()
                    .reduce((acc, n) => acc + n.totaltransp, 0)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Container da tabela com altura calculada */}
        <div className="flex-1 min-h-0 flex flex-col">
          <DataTableContasPagar
            headers={headers}
            rows={prepararDadosTabela()}
            meta={meta}
            onPageChange={setPaginaAtual}
            onPerPageChange={(perPage) => {
              setLimite(perPage);
              setPaginaAtual(1);
            }}
            onSearch={handleSearch}
            onSearchKeyDown={handleSearchKeyDown}
            searchInputPlaceholder="Buscar (CT-e, transportadora, série...)"
            loading={carregando}
            noDataMessage="Nenhuma nota de conhecimento encontrada"
            onFiltroChange={handleFiltroAvancado}
            colunasFiltro={colunasDisponiveis}
            columnWidths={['100px', '140px', '90px', '300px', '120px', '140px', '110px', '120px']}
          />
        </div>
      </main>

      {/* Modal Detalhes */}
      <Modal
        isOpen={modalDetalhesAberto}
        onClose={() => setModalDetalhesAberto(false)}
        title="Detalhes da Nota de Conhecimento"
        width="w-11/12 md:w-3/4 lg:w-2/3"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Nº CT-e</Label>
              <p className="font-mono font-semibold">{notaSelecionada?.nrocon}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Série</Label>
              <p className="font-semibold">{notaSelecionada?.serie || '-'}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Transportadora</Label>
              <p className="font-semibold">{notaSelecionada?.nome_transp || notaSelecionada?.codtransp}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Data Emissão</Label>
              <p className="font-semibold">{formatarData(notaSelecionada?.dtcon || null)}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Valor Total</Label>
              <p className="font-mono font-bold text-lg">{formatarMoeda(notaSelecionada?.totaltransp || 0)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <DefaultButton
              variant="secondary"
              size="default"
              onClick={() => setModalDetalhesAberto(false)}
              text="Fechar"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Gerar Título */}
      <Modal
        isOpen={modalGerarTituloAberto}
        onClose={() => {
          setModalGerarTituloAberto(false);
          setBancoTitulo('');
          setDescricaoTitulo('');
        }}
        title="Gerar Título - CT-e"
        width="w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2"
      >
        <div className="space-y-4">
          {/* Informações do CT-e */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-3">
              📄 Informações do CT-e
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-orange-700 dark:text-orange-300">CT-e:</span>
                <span className="font-semibold ml-2">{notaSelecionada?.nrocon}</span>
              </div>
              <div>
                <span className="text-orange-700 dark:text-orange-300">Transportadora:</span>
                <span className="font-semibold ml-2">{notaSelecionada?.nome_transp || notaSelecionada?.codtransp}</span>
              </div>
              <div>
                <span className="text-orange-700 dark:text-orange-300">Valor:</span>
                <span className="font-bold text-lg ml-2">{formatarMoeda(notaSelecionada?.totaltransp || 0)}</span>
              </div>
              <div>
                <span className="text-orange-700 dark:text-orange-300">Vencimento:</span>
                <span className="font-semibold ml-2">{formatarData(notaSelecionada?.dtcon || null)}</span>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="banco-titulo">Banco *</Label>
              <Select value={bancoTitulo} onValueChange={setBancoTitulo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  {bancosDisponiveis.map(banco => (
                    <SelectItem key={banco.value} value={banco.value}>
                      {banco.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="descricao-titulo">Descrição (opcional)</Label>
              <Input
                id="descricao-titulo"
                type="text"
                value={descricaoTitulo}
                onChange={(e) => setDescricaoTitulo(e.target.value)}
                placeholder="Ex: CT-e Transportadora XYZ"
                className="mt-1"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="secondary"
              size="default"
              onClick={() => {
                setModalGerarTituloAberto(false);
                setBancoTitulo('');
                setDescricaoTitulo('');
              }}
              text="Cancelar"
            />
            <DefaultButton
              variant="primary"
              size="default"
              onClick={handleGerarTitulo}
              disabled={!bancoTitulo}
              text="Gerar Título"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Gerar Conta a Pagar */}
      {/* conta financeira -   cad_conta_financeira*/}
       {/* resumo notas de conhecimento  -   ao clicar em ver notas associadas, clicar em link para notas de de entrada */}
      <Modal
        isOpen={modalGerarContaAberto}
        onClose={() => {
          setModalGerarContaAberto(false);
          setContaDados({
            tipo: 'T',
            cod_conta: '7',
            cod_comprador: '',
            dt_venc: '',
            obs: '',
          });
        }}
        title="Gerar Conta a Pagar - CT-e"
        width="w-11/12 md:w-5/6 lg:w-4/5 xl:w-3/4"
      >
        <div className="space-y-6">
          {/* Resumo dos CT-e Selecionados */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">
              📋 Resumo dos CT-e Selecionados
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-green-700 dark:text-green-300 text-sm">Quantidade de notas:</span>
                <span className="font-semibold ml-2">{notasSelecionadas.size}</span>
              </div>
              <div>
                <span className="text-green-700 dark:text-green-300 text-sm">Valor total:</span>
                <span className="font-bold text-lg ml-2">{formatarMoeda(calcularTotalSelecionado())}</span>
              </div>
            </div>
          </div>

          {/* Lista de CT-e */}
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">CT-e</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Transportadora</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {getNotasSelecionadasDetalhes().map((nota) => (
                  <tr key={`${nota.codtransp}-${nota.nrocon}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-3 py-2 font-mono text-xs">{nota.nrocon}</td>
                    <td className="px-3 py-2 text-xs truncate max-w-[200px]">{nota.nome_transp}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold">
                      {formatarMoeda(nota.totaltransp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formulário da Conta a Pagar */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Configurações da Conta a Pagar
            </h3>

            <div className="space-y-4">
              {/* Tipo (sempre transportadora) */}
              <div>
                <Label>Tipo de Conta</Label>
                <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Transportadora
                </div>
              </div>

              {/* Conta Contábil */}
              <div>
                <Label>Conta Financeira *</Label>
                <Autocomplete
                  placeholder="Buscar conta financeira..."
                  apiUrl="/api/contas-pagar/contas"
                  value={contaDados.cod_conta}
                  onChange={(value) => setContaDados({ ...contaDados, cod_conta: value })}
                  mapResponse={(data) => data.contas || []}
                />
              </div>

              {/* Código da Conta e Comprador */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Código da Conta (Banco)</Label>
                  <Autocomplete
                    placeholder="Buscar conta..."
                    apiUrl="/api/contas-pagar/contas-dbconta"
                    value={contaDados.cod_conta}
                    onChange={(value) => setContaDados({ ...contaDados, cod_conta: value })}
                    mapResponse={(data) => data.contas || []}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Conta bancária vinculada ao pagamento
                  </p>
                </div>

                <div>
                  <Label>Código do Comprador</Label>
                  <Autocomplete
                    placeholder="Buscar comprador..."
                    apiUrl="/api/contas-pagar/compradores"
                    value={contaDados.cod_comprador}
                    onChange={(value) => setContaDados({ ...contaDados, cod_comprador: value })}
                    mapResponse={(data) => data.compradores || []}
                  />
                </div>
              </div>

              {/* Data de Vencimento */}
              <div>
                <Label>Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={contaDados.dt_venc}
                  onChange={(e) => setContaDados({ ...contaDados, dt_venc: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Sugerido: 30 dias após a data do CT-e mais recente
                </p>
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  name="obs"
                  value={contaDados.obs}
                  onChange={(e) => setContaDados({ ...contaDados, obs: e.target.value })}
                  placeholder="Observações sobre esta conta..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="secondary"
              size="default"
              onClick={() => {
                setModalGerarContaAberto(false);
                setContaDados({
                  tipo: 'T',
                  cod_conta: '7',
                  cod_comprador: '',
                  dt_venc: '',
                  obs: '',
                });
              }}
              text="Cancelar"
            />
            <DefaultButton
              variant="primary"
              size="default"
              onClick={handleGerarConta}
              text="Gerar Conta a Pagar"
              disabled={!contaDados.cod_conta || !contaDados.dt_venc}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
