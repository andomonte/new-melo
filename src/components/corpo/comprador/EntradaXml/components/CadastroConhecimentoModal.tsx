import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Truck, DollarSign, FileText, AlertCircle, CheckCircle,
  Upload, RefreshCw, Wand2, PenLine, FileUp, Bot, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import SelectPadrao from '@/components/common/SelectPadrao';
import CadastroTransportadoraModal from '@/components/corpo/admin/cadastro/transportadoras/modalCadastrar';

interface Transportadora {
  codtransp: string;
  nome: string;
  cnpj_cpf?: string;
  cpfcgc?: string;
}

interface DadosConhecimento {
  codtransp: string;
  nrocon: string;
  serie: string;
  cfop: string;
  icms: number;
  baseicms: number;
  totalcon: number;
  totaltransp: number;
  dtcon: string;
  cif: 'S' | 'N';  // S=CIF (frete fornecedor), N=FOB (frete comprador)
  tipocalc: '1' | '2';  // 1=Peso, 2=Cubagem
  tipocon: '08' | '09' | '10';  // 08=Rodoviário, 09=Aquaviário, 10=Aéreo
  kg?: number;
  kgcub?: number;
  chave?: string;
  protocolo?: string;
  nomebarco?: string;
  placacarreta?: string;
  /** Chaves das NF-e que o CTe transporta (do XML) — para vincular todas ao conhecimento. */
  nfesVinculadas?: string[];
}

interface CtePendente {
  codtransp: string;
  nrocon: string;
  serie: string;
  cfop: string;
  dtcon: string;
  totalcon: number;
  totaltransp: number;
  baseicms: number;
  icms: number;
  cif: 'S' | 'N';
  tipocon: string;
  chave: string;
  protocolo: string;
  kg: number;
  kgcub: number;
  transp_nome: string;
  transp_cnpj: string;
  nfes_vinculadas: string[];
}

interface CadastroConhecimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSalvar: (dados: DadosConhecimento) => void;
  valorTotalNfe?: number;
  chaveNfe?: string;  // Para buscar CTe automático
  transportadoraNfe?: {
    cnpj?: string;
    nome?: string;
  };
}

type TabType = 'upload' | 'automatico' | 'formulario';

// Estado para controlar quais campos foram preenchidos pelo XML/automático
interface CamposPreenchidos {
  codtransp: boolean;
  nrocon: boolean;
  serie: boolean;
  cfop: boolean;
  dtcon: boolean;
  totalcon: boolean;
  totaltransp: boolean;
  baseicms: boolean;
  icms: boolean;
  cif: boolean;
  tipocon: boolean;
  kg: boolean;
  kgcub: boolean;
  chave: boolean;
  protocolo: boolean;
}

/**
 * CFOP de ENTRADA do conhecimento de frete. O 1º dígito indica a origem do
 * serviço em relação ao nosso estado (AM): 1 = dentro do estado, 2 = interestadual.
 *
 * O CTe traz o CFOP de SAÍDA do emitente (transportadora): 5xxx = interno,
 * 6xxx = interestadual. Convertendo para a entrada mantendo os 3 últimos dígitos:
 *   5352 -> 1352 (dentro do AM) · 6352 -> 2352 (outro estado).
 *
 * Fallback (CFOP sem prefixo 5/6): usa a UF do emitente pelos 2 primeiros dígitos
 * da chave (13 = AM). O campo permanece editável para ajuste manual.
 */
export function derivarCfopEntradaConhecimento(cteCfop: string, chave?: string): string {
  const digitos = (cteCfop || '').replace(/\D/g, '');
  const sufixo = digitos.slice(-3);
  if (sufixo.length < 3) return cteCfop || '';

  const primeiroCte = digitos.charAt(0);
  let primeiro: string;
  if (primeiroCte === '5') {
    primeiro = '1'; // saída interna do emitente → entrada interna (AM)
  } else if (primeiroCte === '6') {
    primeiro = '2'; // saída interestadual → entrada interestadual
  } else {
    const ufEmitente = (chave || '').replace(/\D/g, '').substring(0, 2);
    primeiro = ufEmitente === '13' ? '1' : '2'; // 13 = AM
  }
  return primeiro + sufixo;
}

/** Extrai número e série da NF-e a partir da chave de acesso (44 dígitos). */
export function dadosDaChaveNFe(chave: string): { numero: string; serie: string; chave: string } {
  const c = (chave || '').replace(/\D/g, '');
  if (c.length !== 44) return { numero: '', serie: '', chave: c };
  const serie = String(parseInt(c.substring(22, 25), 10) || 0);
  const numero = String(parseInt(c.substring(25, 34), 10) || 0);
  return { numero, serie, chave: c };
}

const CadastroConhecimentoModal: React.FC<CadastroConhecimentoModalProps> = ({
  isOpen,
  onClose,
  onSalvar,
  valorTotalNfe,
  chaveNfe,
  transportadoraNfe
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Cadastro de transportadora na hora (quando a busca não encontra)
  const [showCadastroTransp, setShowCadastroTransp] = useState(false);
  const [uploadingXml, setUploadingXml] = useState(false);
  const [buscandoCte, setBuscandoCte] = useState(false);
  const [cteEncontrado, setCteEncontrado] = useState<CtePendente | null>(null);
  const [ctesPendentes, setCtesPendentes] = useState<CtePendente[]>([]);
  const [xmlFileName, setXmlFileName] = useState<string | null>(null);

  // Controle de campos preenchidos automaticamente (XML ou automático)
  const [camposPreenchidos, setCamposPreenchidos] = useState<CamposPreenchidos>({
    codtransp: false, nrocon: false, serie: false, cfop: false, dtcon: false,
    totalcon: false, totaltransp: false, baseicms: false, icms: false, cif: false,
    tipocon: false, kg: false, kgcub: false, chave: false, protocolo: false
  });
  const [faltaCampos, setFaltaCampos] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dados do conhecimento
  const [codtransp, setCodtransp] = useState('');
  const [nrocon, setNrocon] = useState('');
  const [serie, setSerie] = useState('001');
  const [cfop, setCfop] = useState('5353');
  const [icms, setIcms] = useState(0);
  const [baseicms, setBaseicms] = useState(0);
  const [totalcon, setTotalcon] = useState(0);
  const [totaltransp, setTotaltransp] = useState(0);
  const [dtcon, setDtcon] = useState(new Date().toISOString().split('T')[0]);
  const [cif, setCif] = useState<'S' | 'N'>('N');
  const [tipocalc, setTipocalc] = useState<'1' | '2'>('1');
  const [tipocon, setTipocon] = useState<'08' | '09' | '10'>('08');
  const [kg, setKg] = useState(0);
  const [kgcub, setKgcub] = useState(0);
  const [chave, setChave] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [nomebarco, setNomebarco] = useState('');
  const [placacarreta, setPlacacarreta] = useState('');
  // NF-e que o CTe transporta (chaves extraídas do XML).
  const [nfesVinculadas, setNfesVinculadas] = useState<string[]>([]);
  // Subconjunto marcado para RECEBER o frete (rateio por valor). Default: todas.
  const [nfesComFrete, setNfesComFrete] = useState<string[]>([]);
  // A NFe do fluxo atual NÃO consta nas notas deste CTe (checado no upload manual).
  const [nfeNaoPertence, setNfeNaoPertence] = useState(false);
  // Dados da transportadora extraídos do XML do CTe (para buscar / pré-cadastrar).
  const [transportadoraXml, setTransportadoraXml] = useState<{
    cnpj?: string; nome?: string; fant?: string; ie?: string;
    ender?: string; numero?: string; bairro?: string; municipio?: string;
    codmunicipio?: string; uf?: string; cep?: string; fone?: string;
  } | null>(null);

  // Limpar formulário
  const limparFormulario = useCallback(() => {
    setCodtransp('');
    setNrocon('');
    setSerie('001');
    setCfop('5353');
    setIcms(0);
    setBaseicms(0);
    setTotalcon(0);
    setTotaltransp(0);
    setDtcon(new Date().toISOString().split('T')[0]);
    setCif('N');
    setTipocalc('1');
    setTipocon('08');
    setKg(0);
    setKgcub(0);
    setChave('');
    setProtocolo('');
    setNomebarco('');
    setPlacacarreta('');
    setNfesVinculadas([]);
    setNfesComFrete([]);
    setNfeNaoPertence(false);
    setTransportadoraXml(null);
    setXmlFileName(null);
    setCteEncontrado(null);
    setCamposPreenchidos({
      codtransp: false, nrocon: false, serie: false, cfop: false, dtcon: false,
      totalcon: false, totaltransp: false, baseicms: false, icms: false, cif: false,
      tipocon: false, kg: false, kgcub: false, chave: false, protocolo: false
    });
    setFaltaCampos([]);
    setActiveTab('upload');
  }, []);

  // Preencher formulário com dados do CTe (automático)
  const preencherComCte = useCallback((cte: CtePendente) => {
    const temTransportadora = !!cte.codtransp;
    setCodtransp(cte.codtransp);
    setNrocon(cte.nrocon);
    setSerie(cte.serie);
    setCfop(derivarCfopEntradaConhecimento(cte.cfop, cte.chave));
    setIcms(cte.icms);
    setBaseicms(cte.baseicms);
    setTotalcon(cte.totalcon);
    setTotaltransp(cte.totaltransp || cte.totalcon);
    setDtcon(cte.dtcon);
    setCif(cte.cif);
    setTipocon(cte.tipocon as '08' | '09' | '10');
    setKg(cte.kg);
    setKgcub(cte.kgcub);
    setChave(cte.chave);
    setProtocolo(cte.protocolo);
    setNfesVinculadas(cte.nfes_vinculadas || []);
    setNfesComFrete(cte.nfes_vinculadas || []); // default: todas recebem frete
    setNfeNaoPertence(false); // fluxo automático: pertencimento garantido pela busca
    setTransportadoraXml({ cnpj: cte.transp_cnpj || '', nome: cte.transp_nome || '' });
    setCteEncontrado(cte);

    // Marcar todos os campos como preenchidos (exceto transportadora se não veio)
    const novosCamposPreenchidos: CamposPreenchidos = {
      codtransp: temTransportadora,
      nrocon: true,
      serie: true,
      cfop: true,
      dtcon: true,
      totalcon: true,
      totaltransp: true,
      baseicms: true,
      icms: true,
      cif: true,
      tipocon: true,
      kg: true,
      kgcub: true,
      chave: true,
      protocolo: true
    };
    setCamposPreenchidos(novosCamposPreenchidos);

    // Verificar se falta algum campo obrigatório
    const camposFaltando: string[] = [];
    if (!temTransportadora) camposFaltando.push('Transportadora');
    setFaltaCampos(camposFaltando);
  }, []);

  // Carregar transportadoras
  const carregarTransportadoras = async (termo: string = '') => {
    setLoading(true);
    try {
      const url = termo
        ? `/api/transportadoras?search=${encodeURIComponent(termo)}`
        : '/api/transportadoras';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setTransportadoras(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar transportadoras:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca a transportadora pelo CNPJ (só dígitos) e, se encontrar, seleciona.
   * A API retorna o CNPJ em `cpfcgc` (o campo `cnpj_cpf` não existe no retorno —
   * era esse o motivo do auto-match falhar sempre). Retorna true se selecionou.
   */
  const buscarESelecionarTranspPorCnpj = async (cnpj?: string): Promise<boolean> => {
    const digitos = (cnpj || '').replace(/\D/g, '');
    if (!digitos) return false;
    setLoading(true);
    try {
      const res = await fetch(`/api/transportadoras?search=${encodeURIComponent(digitos)}`);
      const data = await res.json();
      const lista: Transportadora[] = data?.data || [];
      setTransportadoras(lista);
      const norm = (s?: string) => (s || '').replace(/\D/g, '');
      const match = lista.find(
        (t) => norm((t as any).cpfcgc) === digitos || norm(t.cnpj_cpf) === digitos,
      );
      if (match) {
        setCodtransp(match.codtransp);
        return true;
      }
    } catch (error) {
      console.error('Erro ao buscar transportadora por CNPJ:', error);
    } finally {
      setLoading(false);
    }
    return false;
  };

  // Buscar CTe automático pela chave da NFe
  const buscarCteAutomatico = useCallback(async () => {
    if (!chaveNfe) {
      toast.error('Chave da NFe não disponível');
      return;
    }

    setBuscandoCte(true);
    try {
      const response = await fetch(`/api/cte/pendentes?chavenfe=${chaveNfe}`);
      const data = await response.json();

      if (data.success && data.found && data.data) {
        preencherComCte(data.data);
        toast.success(`CTe ${data.data.nrocon} encontrado automaticamente!`);
        setActiveTab('formulario'); // Vai para formulário para confirmar
      } else {
        toast.info('Nenhum CTe encontrado para esta NFe');
      }
    } catch (error) {
      console.error('Erro ao buscar CTe:', error);
      toast.error('Erro ao buscar CTe automático');
    } finally {
      setBuscandoCte(false);
    }
  }, [chaveNfe, preencherComCte]);

  // Carregar CTes pendentes
  const carregarCtesPendentes = async () => {
    setBuscandoCte(true);
    try {
      const response = await fetch('/api/cte/pendentes');
      const data = await response.json();

      if (data.success) {
        setCtesPendentes(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar CTes pendentes:', error);
    } finally {
      setBuscandoCte(false);
    }
  };

  // Processar upload de XML
  const processarXmlUpload = async (file: File) => {
    setUploadingXml(true);
    setXmlFileName(file.name);

    try {
      const xmlContent = await file.text();

      const response = await fetch('/api/cte/parse-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xmlContent })
      });

      const data = await response.json();

      if (data.success && data.data) {
        const cteData = data.data;

        // Guarda os dados da transportadora do XML (para busca e pré-cadastro).
        setTransportadoraXml({
          cnpj: cteData.transp_cnpj || '',
          nome: cteData.transp_nome || '',
          fant: cteData.transp_fant || '',
          ie: cteData.transp_ie || '',
          ender: cteData.transp_ender || '',
          numero: cteData.transp_numero || '',
          bairro: cteData.transp_bairro || '',
          municipio: cteData.transp_municipio || '',
          codmunicipio: cteData.transp_codmunicipio || '',
          uf: cteData.transp_uf || '',
          cep: cteData.transp_cep || '',
          fone: cteData.transp_fone || '',
        });

        // Busca a transportadora pelo CNPJ do XML e seleciona automaticamente.
        const temTransportadora = await buscarESelecionarTranspPorCnpj(cteData.transp_cnpj);
        if (!temTransportadora) {
          toast.warning(`Transportadora "${cteData.transp_nome}" não encontrada no cadastro. Busque pelo CNPJ ${cteData.transp_cnpj} ou cadastre.`);
        }

        setNrocon(cteData.nrocon);
        setSerie(cteData.serie);
        setCfop(derivarCfopEntradaConhecimento(cteData.cfop, cteData.chave));
        setDtcon(cteData.dtcon);
        setTotalcon(cteData.totalcon);
        setTotaltransp(cteData.totaltransp || cteData.totalcon);
        setBaseicms(cteData.baseicms);
        setIcms(cteData.icms);
        setKg(cteData.kg);
        setKgcub(cteData.kgcub);
        setChave(cteData.chave);
        setProtocolo(cteData.protocolo);
        const listaNfes: string[] = cteData.nfes_vinculadas || [];
        setNfesVinculadas(listaNfes);
        setNfesComFrete(listaNfes); // default: todas recebem frete

        // Validação de pertencimento: a NFe do fluxo consta neste CTe?
        const norm = (s?: string) => (s || '').replace(/\D/g, '');
        const pertence = !chaveNfe || listaNfes.map(norm).includes(norm(chaveNfe));
        setNfeNaoPertence(!pertence);
        if (!pertence) {
          toast.warning('Atenção: a NFe atual não consta nas notas deste CTe.');
        }

        setCif(cteData.cif);
        setTipocon(cteData.tipocon);

        // Marcar campos como preenchidos pelo XML
        const novosCamposPreenchidos: CamposPreenchidos = {
          codtransp: temTransportadora,
          nrocon: !!cteData.nrocon,
          serie: !!cteData.serie,
          cfop: !!cteData.cfop,
          dtcon: !!cteData.dtcon,
          totalcon: cteData.totalcon > 0,
          totaltransp: (cteData.totaltransp || cteData.totalcon) > 0,
          baseicms: true,
          icms: true,
          cif: true,
          tipocon: true,
          kg: true,
          kgcub: true,
          chave: !!cteData.chave,
          protocolo: !!cteData.protocolo
        };
        setCamposPreenchidos(novosCamposPreenchidos);

        // Verificar campos faltantes
        const camposFaltando: string[] = [];
        if (!temTransportadora) camposFaltando.push('Transportadora');
        setFaltaCampos(camposFaltando);

        const qtdNfes = cteData.nfes_vinculadas?.length || 0;
        toast.success(`CTe ${cteData.nrocon} processado com sucesso.${qtdNfes > 0 ? ` ${qtdNfes} NF-e(s) vinculada(s).` : ''}`);

        // Vai para aba de formulário para confirmar/completar dados
        setActiveTab('formulario');
      } else {
        toast.error(data.error || 'Erro ao processar XML');
      }
    } catch (error) {
      console.error('Erro ao processar XML:', error);
      toast.error('Erro ao processar arquivo XML');
    } finally {
      setUploadingXml(false);
    }
  };

  // Handler do input de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xml')) {
        toast.error('Por favor, selecione um arquivo XML');
        return;
      }
      processarXmlUpload(file);
    }
  };

  // Drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xml')) {
        toast.error('Por favor, solte um arquivo XML');
        return;
      }
      processarXmlUpload(file);
    }
  };

  // Effects
  useEffect(() => {
    if (isOpen) {
      carregarTransportadoras();
      limparFormulario();

      // Se tem chaveNfe, buscar CTe automaticamente
      if (chaveNfe) {
        buscarCteAutomatico();
      }
    }
  }, [isOpen, chaveNfe, buscarCteAutomatico, limparFormulario]);

  useEffect(() => {
    if (activeTab === 'automatico') {
      carregarCtesPendentes();
    }
  }, [activeTab]);

  // Salvar
  const handleSalvar = async () => {
    if (!codtransp) {
      toast.error('Selecione uma transportadora');
      return;
    }
    if (!nrocon) {
      toast.error('Informe o número do conhecimento');
      return;
    }
    if (!serie) {
      toast.error('Informe a série do conhecimento');
      return;
    }
    if (totalcon <= 0) {
      toast.error('Informe o valor total do conhecimento');
      return;
    }

    setSalvando(true);

    try {
      const dados: DadosConhecimento = {
        codtransp,
        nrocon,
        serie,
        cfop,
        icms,
        baseicms,
        totalcon,
        totaltransp: totaltransp || totalcon,
        dtcon,
        cif,
        tipocalc,
        tipocon,
        kg: kg || undefined,
        kgcub: kgcub || undefined,
        chave: chave || undefined,
        protocolo: protocolo || undefined,
        nomebarco: nomebarco || undefined,
        placacarreta: placacarreta || undefined,
        // Só as notas MARCADAS recebem o frete (rateio por valor entre elas).
        nfesVinculadas: nfesComFrete.length > 0 ? nfesComFrete : undefined
      };

      onSalvar(dados);
      toast.success('Conhecimento configurado com sucesso!');
      onClose();
    } catch (error) {
      toast.error('Erro ao salvar conhecimento');
      console.error(error);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Cadastrar Conhecimento de Transporte (CTe)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs - Só mostra upload/automático. Formulário aparece após preencher dados */}
        {activeTab !== 'formulario' && (
          <div className="flex border-b border-gray-200 dark:border-zinc-700">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <FileUp size={18} />
              Upload XML
            </button>
            <button
              onClick={() => setActiveTab('automatico')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'automatico'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Bot size={18} />
              Automático
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* CTe Encontrado Badge */}
          {cteEncontrado && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 dark:text-green-300 text-sm">
                CTe {cteEncontrado.nrocon} preenchido automaticamente - {cteEncontrado.transp_nome}
              </span>
              <button
                onClick={limparFormulario}
                className="ml-auto text-green-600 hover:text-green-800 text-sm underline"
              >
                Limpar
              </button>
            </div>
          )}

          {xmlFileName && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 dark:text-blue-300 text-sm">
                Dados preenchidos do arquivo: {xmlFileName}
              </span>
              <button
                onClick={() => {
                  limparFormulario();
                  setXmlFileName(null);
                }}
                className="ml-auto text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Limpar
              </button>
            </div>
          )}

          {/* Tab Upload XML */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-12 text-center hover:border-green-500 dark:hover:border-green-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadingXml ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                    <p className="text-gray-600 dark:text-gray-400">Processando XML...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                      Arraste o arquivo XML do CTe aqui
                    </p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">
                      ou clique para selecionar
                    </p>
                    <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2">
                      <FileUp size={18} />
                      Selecionar Arquivo XML
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Como funciona:</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Faça upload do arquivo XML do CTe (Conhecimento de Transporte)</li>
                  <li>• Os dados serão extraídos automaticamente</li>
                  <li>• Confira e ajuste os dados na aba Manual se necessário</li>
                  <li>• A transportadora será identificada pelo CNPJ</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab Automático */}
          {activeTab === 'automatico' && (
            <div className="space-y-6">
              {/* Busca automática pela NFe */}
              {chaveNfe && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-purple-800 dark:text-purple-300">
                        Buscar CTe desta NFe
                      </h4>
                      <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                        O sistema buscará automaticamente CTes importados pelo robô que contenham esta NFe
                      </p>
                    </div>
                    <button
                      onClick={buscarCteAutomatico}
                      disabled={buscandoCte}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {buscandoCte ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Wand2 size={18} />
                          Buscar Automático
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de CTes pendentes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">
                    CTes Pendentes (Importados pelo Robô)
                  </h4>
                  <button
                    onClick={carregarCtesPendentes}
                    disabled={buscandoCte}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
                  >
                    <RefreshCw size={14} className={buscandoCte ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                </div>

                {buscandoCte ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : ctesPendentes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum CTe pendente encontrado</p>
                    <p className="text-sm mt-1">
                      O robô importará CTes automaticamente da SEFAZ
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ctesPendentes.map((cte) => (
                      <div
                        key={`${cte.codtransp}-${cte.nrocon}`}
                        className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                        onClick={() => {
                          preencherComCte(cte);
                          setActiveTab('formulario');
                          toast.success(`CTe ${cte.nrocon} selecionado`);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              CTe {cte.nrocon}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                              Série {cte.serie}
                            </span>
                          </div>
                          <span className={`text-sm px-2 py-1 rounded ${
                            cte.cif === 'S'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {cte.cif === 'S' ? 'CIF' : 'FOB'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>{cte.transp_nome}</span>
                          <span className="mx-2">•</span>
                          <span>R$ {cte.totalcon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="mx-2">•</span>
                          <span>{cte.dtcon}</span>
                        </div>
                        {cte.nfes_vinculadas.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                            {cte.nfes_vinculadas.length} NF-e(s) vinculada(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulário (após upload ou seleção automática) */}
          {activeTab === 'formulario' && (
            <>
              {/* Alerta: a NFe atual não consta nas notas deste CTe */}
              {nfeNaoPertence && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span className="text-red-800 dark:text-red-300 text-sm font-medium">
                      A NFe que você está processando <strong>não consta</strong> nas notas deste CTe.
                      Confira se subiu o XML correto antes de confirmar.
                    </span>
                  </div>
                </div>
              )}

              {/* Alerta de campos faltantes */}
              {faltaCampos.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-yellow-800 dark:text-yellow-300 text-sm font-medium">
                      Complete os campos faltantes: {faltaCampos.join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Alerta CIF/FOB */}
              <div className={`mb-6 p-4 rounded-lg border ${
                cif === 'S'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
              }`}>
                <div className="flex items-start gap-3">
                  {cif === 'S' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`font-medium ${cif === 'S' ? 'text-green-800 dark:text-green-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                      {cif === 'S' ? 'Frete CIF (pago pelo fornecedor)' : 'Frete FOB (pago pelo comprador)'}
                    </h4>
                    <p className={`text-sm mt-1 ${cif === 'S' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                      {cif === 'S'
                        ? 'O frete foi pago pelo fornecedor. NÃO será gerado título no contas a pagar.'
                        : 'O frete será pago pela empresa. SERÁ gerado um pré-título no contas a pagar para a transportadora.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados Principais */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transportadora *
                  </label>
                  <SelectPadrao
                    searchable
                    placeholder="Buscar transportadora (nome, código ou CNPJ)..."
                    options={transportadoras.map((t) => ({
                      value: t.codtransp,
                      label: `${t.codtransp} - ${t.cpfcgc || t.cnpj_cpf || 's/ CNPJ'} - ${t.nome}`,
                    }))}
                    value={codtransp}
                    onValueChange={(v) => setCodtransp(v)}
                    onInputChange={(termo) => carregarTransportadoras(termo)}
                    loading={loading}
                    disabled={camposPreenchidos.codtransp}
                  />
                  {!codtransp && transportadoraXml?.cnpj && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Do XML: <strong>{transportadoraXml.nome}</strong> · CNPJ {transportadoraXml.cnpj}
                      {transportadoraXml.uf ? ` · ${transportadoraXml.uf}` : ''}
                    </p>
                  )}
                  {!camposPreenchidos.codtransp && (
                    <button
                      type="button"
                      onClick={() => setShowCadastroTransp(true)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      <Plus size={12} />
                      Não encontrou? Cadastrar transportadora {transportadoraXml?.cnpj ? '(dados do XML)' : ''}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Frete *
                  </label>
                  <select
                    value={cif}
                    onChange={(e) => setCif(e.target.value as 'S' | 'N')}
                    disabled={camposPreenchidos.cif}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.cif ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  >
                    <option value="N">FOB - Frete por conta do comprador</option>
                    <option value="S">CIF - Frete por conta do fornecedor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Número do Conhecimento *
                  </label>
                  <input
                    type="text"
                    value={nrocon}
                    onChange={(e) => setNrocon(e.target.value)}
                    disabled={camposPreenchidos.nrocon}
                    placeholder="Ex: 000012345"
                    maxLength={9}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.nrocon ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Série *
                  </label>
                  <input
                    type="text"
                    value={serie}
                    onChange={(e) => setSerie(e.target.value)}
                    disabled={camposPreenchidos.serie}
                    placeholder="001"
                    maxLength={3}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.serie ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data do Conhecimento *
                  </label>
                  <input
                    type="date"
                    value={dtcon}
                    onChange={(e) => setDtcon(e.target.value)}
                    disabled={camposPreenchidos.dtcon}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.dtcon ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CFOP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cfop}
                    onChange={(e) => setCfop(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1352"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    1º dígito: <strong>1</strong> = dentro do AM · <strong>2</strong> = outro estado. Ajuste se necessário.
                  </p>
                </div>
              </div>

              {/* Valores */}
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Valores
              </h4>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Total CTe *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalcon}
                    onChange={(e) => setTotalcon(parseFloat(e.target.value) || 0)}
                    disabled={camposPreenchidos.totalcon}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.totalcon ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Transporte
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={totaltransp}
                    onChange={(e) => setTotaltransp(parseFloat(e.target.value) || 0)}
                    disabled={camposPreenchidos.totaltransp}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.totaltransp ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base ICMS
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={baseicms}
                    onChange={(e) => setBaseicms(parseFloat(e.target.value) || 0)}
                    disabled={camposPreenchidos.baseicms}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.baseicms ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor ICMS
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={icms}
                    onChange={(e) => setIcms(parseFloat(e.target.value) || 0)}
                    disabled={camposPreenchidos.icms}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.icms ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>
              </div>

              {/* Tipo de Transporte */}
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Tipo de Transporte
              </h4>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Modal de Transporte
                  </label>
                  <select
                    value={tipocon}
                    onChange={(e) => setTipocon(e.target.value as '08' | '09' | '10')}
                    disabled={camposPreenchidos.tipocon}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.tipocon ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  >
                    <option value="08">Rodoviário</option>
                    <option value="09">Aquaviário</option>
                    <option value="10">Aéreo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Cálculo
                  </label>
                  <select
                    value={tipocalc}
                    onChange={(e) => setTipocalc(e.target.value as '1' | '2')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="1">Peso</option>
                    <option value="2">Cubagem</option>
                  </select>
                </div>

                {tipocon === '09' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome do Barco
                    </label>
                    <input
                      type="text"
                      value={nomebarco}
                      onChange={(e) => setNomebarco(e.target.value)}
                      placeholder="Nome da embarcação"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Peso */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Peso (KG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={kg}
                    onChange={(e) => setKg(parseFloat(e.target.value) || 0)}
                    disabled={camposPreenchidos.kg}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.kg ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Peso Cubado (KG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={kgcub}
                    onChange={(e) => setKgcub(parseFloat(e.target.value) || 0)}
                    disabled={camposPreenchidos.kgcub}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.kgcub ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>
              </div>

              {/* Chave CTe */}
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dados do CTe Eletrônico
              </h4>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chave do CTe (44 dígitos)
                  </label>
                  <input
                    type="text"
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    disabled={camposPreenchidos.chave}
                    placeholder="Chave de acesso do CTe"
                    maxLength={44}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white font-mono text-sm ${camposPreenchidos.chave ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Protocolo de Autorização
                  </label>
                  <input
                    type="text"
                    value={protocolo}
                    onChange={(e) => setProtocolo(e.target.value)}
                    disabled={camposPreenchidos.protocolo}
                    placeholder="Número do protocolo"
                    maxLength={16}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white ${camposPreenchidos.protocolo ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-700' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Placa Carreta
                  </label>
                  <input
                    type="text"
                    value={placacarreta}
                    onChange={(e) => setPlacacarreta(e.target.value.toUpperCase())}
                    placeholder="ABC-1234"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-white uppercase"
                  />
                </div>
              </div>

              {/* Notas Fiscais vinculadas (extraídas do XML do CTe — somente leitura) */}
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mt-6 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notas Fiscais vinculadas
                {nfesVinculadas.length > 0 && (
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({nfesVinculadas.length})
                  </span>
                )}
              </h4>
              {nfesVinculadas.length === 0 ? (
                <div className="mb-4 p-3 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma NF-e vinculada foi encontrada no XML deste CTe.
                </div>
              ) : (
                <div className="mb-4 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-3 py-2 text-center w-16">Frete</th>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left w-28">Nº Nota</th>
                        <th className="px-3 py-2 text-left w-16">Série</th>
                        <th className="px-3 py-2 text-left">Chave de Acesso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nfesVinculadas.map((ch, idx) => {
                        const d = dadosDaChaveNFe(ch);
                        const soDig = (s?: string) => (s || '').replace(/\D/g, '');
                        const ehAtual = !!chaveNfe && soDig(ch) === soDig(chaveNfe);
                        const marcado = ehAtual || nfesComFrete.some((x) => soDig(x) === soDig(ch));
                        return (
                          <tr key={ch || idx} className="border-t border-gray-200 dark:border-zinc-700">
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-blue-600 disabled:opacity-60"
                                checked={marcado}
                                disabled={ehAtual}
                                title={ehAtual ? 'Nota atual — sempre recebe o frete' : 'Marque para esta nota receber o frete'}
                                onChange={(e) => {
                                  setNfesComFrete((prev) => {
                                    const sem = prev.filter((x) => soDig(x) !== soDig(ch));
                                    return e.target.checked ? [...sem, ch] : sem;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                              {d.numero || '—'}
                              {ehAtual && (
                                <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                  atual
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{d.serie || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
                              {d.chave}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                As notas são lidas do XML do CTe. O frete é rateado <strong>por valor</strong> entre as notas
                <strong> marcadas</strong> — desmarque as que não devem receber frete (ex.: deixar só em uma).
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-zinc-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {valorTotalNfe && (
              <span>Valor total da NFe: <strong>R$ {valorTotalNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
            >
              Cancelar
            </button>
            {activeTab === 'formulario' && (
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {salvando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Confirmar Conhecimento
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cadastro de transportadora na hora — ao salvar, refaz a busca */}
      {showCadastroTransp && (
        <CadastroTransportadoraModal
          isOpen={showCadastroTransp}
          onClose={() => setShowCadastroTransp(false)}
          dadosIniciais={
            transportadoraXml
              ? ({
                  tipo: 'J',
                  nome: transportadoraXml.nome || '',
                  nomefant: transportadoraXml.fant || transportadoraXml.nome || '',
                  cpfcgc: transportadoraXml.cnpj || '',
                  iest: transportadoraXml.ie || '',
                  ender: transportadoraXml.ender || '',
                  numero: transportadoraXml.numero || '',
                  bairro: transportadoraXml.bairro || '',
                  cidade: transportadoraXml.municipio || '',
                  codmunicipio: transportadoraXml.codmunicipio || '',
                  uf: transportadoraXml.uf || '',
                  cep: transportadoraXml.cep || '',
                  codpais: 1058,
                } as any)
              : undefined
          }
          onSuccess={(busca?: string) => {
            setShowCadastroTransp(false);
            carregarTransportadoras(busca || transportadoraXml?.cnpj || '');
            toast.success('Transportadora cadastrada! Busque e selecione na lista.');
          }}
        />
      )}
    </div>
  );
};

export default CadastroConhecimentoModal;
