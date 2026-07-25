import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { X, FileText, Building2, User, Package, Truck, Save, ArrowRight, Search, ChevronDown, CheckCircle2, AlertTriangle, Plus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NFeDTO } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { FornecedorAutocomplete } from '../../RequisicoesCompra/components/FornecedorAutocomplete';
import { CompradorAutocomplete } from '../../RequisicoesCompra/components/CompradorAutocomplete';
import { useToast } from '@/hooks/use-toast';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import CadastroFornecedorModal from '@/components/corpo/admin/cadastro/fornecedores/modalCadastrar';
import CadastroTransportadoraModal from '@/components/corpo/admin/cadastro/transportadoras/modalCadastrar';
import { useDebounce } from 'use-debounce';
import api from '@/components/services/api';

interface ConfirmNFeDataModalProps {
  isOpen: boolean;
  nfe: NFeDTO;
  onClose: () => void;
  onConfirm: (data: NFeConfirmationData) => void;
  loading?: boolean;
}

export interface NFeConfirmationData {
  operacao: number;
  compradorId: string;
  fornecedorId: string;
  transportadoraId: string;
  calculoCusto: boolean;
  devolucao: boolean;
  nfeComplementar: boolean;
  // Novos campos financeiros
  custoFinanceiro: number;
  desconto: number;
  acrescimo: number;
  verbaTmk: number;
  cfop: string;
  // Novos checkboxes
  descontoIcms: boolean;
  descontoSt: boolean;
  zerarIpi: boolean;
  zerarSt: boolean;
  // Devolução
  devCodfat: string;
}

// Mapeamento de operações conforme Oracle (DBNFE_ENT_AUX.OPERACAO)
const OPERACOES = [
  { value: 0, label: '0 - Compra' },
  { value: 1, label: '1 - Transferência Entrada' },
  { value: 2, label: '2 - Devolução Venda' },
  { value: 3, label: '3 - Bonificação' },
  { value: 4, label: '4 - Remessa/Retorno' },
  { value: 5, label: '5 - Retorno Comodato' },
  { value: 6, label: '6 - Consignação' },
  { value: 7, label: '7 - Doação' },
  { value: 8, label: '8 - Transferência' },
  { value: 9, label: '9 - Retorno Demonstração' },
  { value: 10, label: '10 - Importação' },
];

// Interface para Transportadora do banco
interface Transportadora {
  cod_credor: string;
  nome: string;
  cpf_cgc?: string;
  cidade?: string;
  uf?: string;
}

// Interface para Fornecedor
interface Fornecedor {
  cod_credor: string;
  nome: string;
  nome_fant?: string;
  cpf_cgc?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

// Interface para dados de transportadora do XML
interface TransportadoraXml {
  cpf_cnpj?: string;
  xnome?: string;
  ie?: string;
  uf?: string;
  especie?: string;
  marca?: string;
  numeracao?: string;
  lacre?: string;
  rntc?: string;
  uf_placa?: string;
}

// Interface para o estado interno do formulário
interface FormDataState {
  operacao: number;
  comprador: { codigo: string; nome: string } | null;
  fornecedor: Fornecedor | null;
  transportadora: Transportadora | null;
  calculoCusto: boolean;
  devolucao: boolean;
  nfeComplementar: boolean;
  // Campos financeiros
  custoFinanceiro: number;
  desconto: number;
  acrescimo: number;
  verbaTmk: number;
  cfop: string;
  // Checkboxes
  descontoIcms: boolean;
  descontoSt: boolean;
  zerarIpi: boolean;
  zerarSt: boolean;
  // Devolução
  devCodfat: string;
  // Opção de usar dados da NFe ou cadastro
  usarFornecedorNfe: boolean;
  usarTransportadoraNfe: boolean;
}

// Componente de Autocomplete para Transportadora
const TransportadoraAutocomplete: React.FC<{
  value: Transportadora | null;
  onChange: (transportadora: Transportadora | null) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder = "Buscar transportadora...", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      fetchTransportadoras(debouncedSearch);
    } else {
      setTransportadoras([]);
    }
  }, [debouncedSearch]);

  const fetchTransportadoras = async (searchTerm: string) => {
    setLoading(true);
    try {
      // Usar o mesmo endpoint de fornecedores, filtrando por transportadoras
      const response = await api.get('/api/compras/fornecedores', {
        params: { search: searchTerm, perPage: 10, tipo: 'transportadora' }
      });
      setTransportadoras(response.data.fornecedores || []);
    } catch (error) {
      console.error('Erro ao buscar transportadoras:', error);
      setTransportadoras([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);
    setSelectedIndex(-1);
    if (!isOpen && newValue.length > 0) setIsOpen(true);
    if (newValue === '' && value) onChange(null);
  };

  const handleSelect = (t: Transportadora) => {
    onChange(t);
    setSearch(`${t.cod_credor} - ${t.nome}`);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < transportadoras.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && transportadoras[selectedIndex]) handleSelect(transportadoras[selectedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (value) {
      setSearch(`${value.cod_credor} - ${value.nome}`);
    } else {
      setSearch('');
    }
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          value={search}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => search.length >= 2 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && <div className="p-3 text-center text-sm text-gray-500">Buscando transportadoras...</div>}
          {!loading && debouncedSearch.length >= 2 && transportadoras.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">Nenhuma transportadora encontrada</div>
          )}
          {!loading && debouncedSearch.length < 2 && (
            <div className="p-3 text-center text-sm text-gray-500">Digite pelo menos 2 caracteres para buscar</div>
          )}
          {transportadoras.map((t, index) => (
            <button
              key={t.cod_credor}
              className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${index === selectedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
              onClick={() => handleSelect(t)}
            >
              <div className="flex items-start gap-3">
                <Truck className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-purple-600 dark:text-purple-400">{t.cod_credor}</span>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{t.nome}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {t.cpf_cgc && <span>CNPJ: {t.cpf_cgc}</span>}
                    {t.cidade && t.uf && <span>{t.cidade}/{t.uf}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Input de percentual com máscara "centavos": digita os dígitos e formata da direita
// (ex.: 1000 -> 10,00). Definido em nível de módulo p/ não recriar (não perde o foco).
const PercentInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => {
  const display = (Number(value) || 0).toFixed(2).replace('.', ',');
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
    onChange(digits ? parseInt(digits, 10) / 100 : 0);
  };
  return (
    <div>
      <Label>{label} (%)</Label>
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          className="pr-7 text-right"
          value={display}
          onChange={handle}
          placeholder="0,00"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">%</span>
      </div>
    </div>
  );
};

export const ConfirmNFeDataModal: React.FC<ConfirmNFeDataModalProps> = ({
  isOpen,
  nfe,
  onClose,
  onConfirm,
  loading = false
}) => {
  const { toast } = useToast();
  const { user } = useContext(AuthContext);
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Confirmar',
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const [transportadoraXml, setTransportadoraXml] = useState<TransportadoraXml | null>(null);
  // Status do casamento automático por CNPJ (espelha CON_FORNECEDOR/CON_TRANSP
  // do Delphi): null=não avaliado, 'auto'=vinculado sozinho, 'salvo'=veio de
  // associação já gravada, 'multiplos'=vários cadastros com o CNPJ (escolher),
  // 'nao_encontrado'=CNPJ ausente no cadastro.
  type MatchStatus = null | 'auto' | 'salvo' | 'multiplos' | 'nao_encontrado';
  const [matchFornec, setMatchFornec] = useState<MatchStatus>(null);
  const [matchTransp, setMatchTransp] = useState<MatchStatus>(null);
  // Quando há vários cadastros com o mesmo CNPJ, guardamos a lista p/ o usuário escolher.
  const [matchFornecList, setMatchFornecList] = useState<Fornecedor[]>([]);
  const [matchTranspList, setMatchTranspList] = useState<Transportadora[]>([]);
  const [cnpjCopiado, setCnpjCopiado] = useState<string | null>(null);
  // Cadastro rápido (na hora) de fornecedor/transportadora ausente no cadastro.
  const [cadFornecAberto, setCadFornecAberto] = useState(false);
  const [cadTranspAberto, setCadTranspAberto] = useState(false);

  const [formData, setFormData] = useState<FormDataState>({
    operacao: 0,
    comprador: null,
    fornecedor: null,
    transportadora: null,
    calculoCusto: false,
    devolucao: false,
    nfeComplementar: false,
    custoFinanceiro: 0,
    desconto: 0,
    acrescimo: 0,
    verbaTmk: 0,
    cfop: '',
    descontoIcms: false,
    descontoSt: false,
    zerarIpi: false,
    zerarSt: false,
    devCodfat: '',
    usarFornecedorNfe: true,
    usarTransportadoraNfe: true,
  });

  // Resetar e carregar dados quando o modal abre
  useEffect(() => {
    if (isOpen && nfe?.id) {
      // Resetar o formulário para valores padrão
      setFormData({
        operacao: 0,
        comprador: null,
        fornecedor: null,
        transportadora: null,
        calculoCusto: false,
        devolucao: false,
        nfeComplementar: false,
        custoFinanceiro: 0,
        desconto: 0,
        acrescimo: 0,
        verbaTmk: 0,
        cfop: '',
        descontoIcms: false,
        descontoSt: false,
        zerarIpi: false,
        zerarSt: false,
        devCodfat: '',
        usarFornecedorNfe: true,
        usarTransportadoraNfe: true,
      });
      setTransportadoraXml(null);
      setMatchFornec(null);
      setMatchTransp(null);

      // 1) carrega dados do XML e associação salva; 2) para o que não veio
      // salvo, casa o CNPJ com o cadastro (auto-vincula se achar exatamente 1).
      (async () => {
        const transp = await fetchTransportadoraXml();
        const aux = await fetchDadosAuxExistentes();

        // Auto-preenche o comprador pelo login logado (como no Delphi, que traz
        // o comprador do operador). Só quando a nota ainda não tem comprador salvo.
        if (!aux?.codcomprador && user?.usuario) {
          try {
            const r = await api.get('/api/usuarios/meu-comprador', {
              params: { login: user.usuario, filial: user.filial },
            });
            const c = r.data;
            if (c?.codcomprador) {
              setFormData(prev =>
                prev.comprador
                  ? prev
                  : { ...prev, comprador: { codigo: String(c.codcomprador), nome: c.nome || '' } },
              );
            }
          } catch {
            // sem comprador vinculado ao login — segue sem pré-preencher
          }
        }

        if (aux?.codcredor) {
          setMatchFornec('salvo');
        } else if (nfe.cnpjEmitente) {
          await autoMatchCredor(nfe.cnpjEmitente, 'fornecedor');
        }

        if (aux?.codtransp) {
          setMatchTransp('salvo');
        } else if (transp?.cpf_cnpj) {
          await autoMatchCredor(transp.cpf_cnpj, 'transportadora');
        }
      })();
    }
  }, [isOpen, nfe?.id]);

  // Busca no cadastro (dbcredor) o credor com o CNPJ da NFe. Se achar exatamente
  // 1, vincula sozinho; se achar vários, sinaliza para o usuário escolher; se
  // não achar, sinaliza ausência (para etapa de cadastrar na hora).
  const autoMatchCredor = async (
    cnpj: string,
    tipo: 'fornecedor' | 'transportadora',
  ) => {
    const setMatch = tipo === 'fornecedor' ? setMatchFornec : setMatchTransp;
    const setList = tipo === 'fornecedor' ? setMatchFornecList : setMatchTranspList;
    try {
      const r = await api.get('/api/entrada-xml/credor-por-cnpj', {
        params: { cnpj, tipo },
      });
      const matches: any[] = r.data?.data || [];
      setList(matches);
      if (matches.length === 1) {
        const m = matches[0];
        if (tipo === 'fornecedor') {
          setFormData((prev) => ({
            ...prev,
            fornecedor: m,
            usarFornecedorNfe: false,
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            transportadora: m,
            usarTransportadoraNfe: false,
          }));
        }
        setMatch('auto');
      } else if (matches.length === 0) {
        setMatch('nao_encontrado');
      } else {
        setMatch('multiplos');
      }
    } catch {
      // Silencioso — mantém o comportamento manual atual.
    }
  };

  // Escolha de um dos vários cadastros com o mesmo CNPJ.
  const escolherMatch = (tipo: 'fornecedor' | 'transportadora', m: any) => {
    if (tipo === 'fornecedor') {
      setFormData((prev) => ({ ...prev, fornecedor: m, usarFornecedorNfe: false }));
      setMatchFornec('auto');
    } else {
      setFormData((prev) => ({ ...prev, transportadora: m, usarTransportadoraNfe: false }));
      setMatchTransp('auto');
    }
  };

  const fetchTransportadoraXml = async (): Promise<TransportadoraXml | null> => {
    try {
      const response = await api.get(`/api/entrada-xml/transportadora-xml/${nfe.id}`);
      if (response.data.success && response.data.data) {
        setTransportadoraXml(response.data.data);
        return response.data.data as TransportadoraXml;
      }
    } catch (error) {
      // Dados de transportadora do XML não disponíveis
    }
    return null;
  };

  const fetchDadosAuxExistentes = async () => {
    try {
      const response = await api.get(`/api/entrada-xml/dados-confirmacao/${nfe.id}`);
      if (response.data.success && response.data.data) {
        const dados = response.data.data;

        // Buscar comprador se existir
        let compradorData = null;
        if (dados.codcomprador) {
          try {
            const compradorResponse = await api.get(`/api/compradores/get`, {
              params: { search: dados.codcomprador, perPage: 10 }
            });
            // A API retorna 'data' não 'compradores'
            const listaCompradores = compradorResponse.data?.data || compradorResponse.data?.compradores || [];
            // Buscar o comprador exato pelo código
            const compExato = listaCompradores.find((c: any) => c.codcomprador === dados.codcomprador);
            if (compExato) {
              compradorData = { codigo: compExato.codcomprador, nome: compExato.nome };
            }
          } catch (err) {
            // Erro ao buscar comprador
          }
        }

        // Buscar fornecedor se existir
        let fornecedorData = null;
        if (dados.codcredor) {
          try {
            const fornecedorResponse = await api.get(`/api/compras/fornecedores`, {
              params: { search: dados.codcredor, perPage: 1 }
            });
            if (fornecedorResponse.data?.fornecedores?.length > 0) {
              fornecedorData = fornecedorResponse.data.fornecedores[0];
            }
          } catch (err) {
            // Erro ao buscar fornecedor
          }
        }

        // Buscar transportadora se existir
        let transportadoraData = null;
        if (dados.codtransp) {
          try {
            const transpResponse = await api.get(`/api/compras/fornecedores`, {
              params: { search: dados.codtransp, perPage: 1, tipo: 'transportadora' }
            });
            if (transpResponse.data?.fornecedores?.length > 0) {
              transportadoraData = transpResponse.data.fornecedores[0];
            }
          } catch (err) {
            // Erro ao buscar transportadora
          }
        }

        setFormData(prev => ({
          ...prev,
          // pg devolve colunas numeric como string — coagir para número.
          operacao: Number(dados.operacao ?? 0),
          custoFinanceiro: Number(dados.custofin ?? 0),
          desconto: Number(dados.desconto ?? 0),
          acrescimo: Number(dados.acrescimo ?? 0),
          verbaTmk: Number(dados.verba_tmk ?? 0),
          cfop: dados.cfop?.toString() ?? '',
          descontoIcms: dados.desconto_icms === 'S',
          descontoSt: dados.desconto_st === 'S',
          zerarIpi: dados.zerar_ipi === 'S',
          zerarSt: dados.zerar_st === 'S',
          calculoCusto: dados.temcusto === 'S',
          nfeComplementar: dados.complementar === 1,
          devolucao: dados.devolucao === 1,
          devCodfat: dados.dev_codfat ?? '',
          // Dados carregados
          comprador: compradorData,
          fornecedor: fornecedorData,
          transportadora: transportadoraData,
          usarFornecedorNfe: !dados.codcredor,
          usarTransportadoraNfe: !dados.codtransp,
        }));
        return { codcredor: dados.codcredor, codtransp: dados.codtransp, codcomprador: dados.codcomprador };
      }
    } catch (error) {
      // Dados auxiliares ainda não existem
    }
    return null;
  };

  const handleInputChange = (field: keyof FormDataState, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Copia os dígitos do CNPJ para a área de transferência (ajuda a buscar/cadastrar).
  const copiarCnpj = async (valor?: string) => {
    const digits = (valor || '').replace(/\D/g, '');
    if (!digits) return;
    try {
      await navigator.clipboard.writeText(digits);
      setCnpjCopiado(digits);
      setTimeout(() => setCnpjCopiado((c) => (c === digits ? null : c)), 1500);
    } catch {
      /* clipboard indisponível — ignora */
    }
  };

  // Botão pequeno de copiar CNPJ, reutilizável.
  const BotaoCopiarCnpj: React.FC<{ cnpj?: string }> = ({ cnpj }) => {
    if (!cnpj) return null;
    const copiado = cnpjCopiado === (cnpj || '').replace(/\D/g, '');
    return (
      <button
        type="button"
        onClick={() => copiarCnpj(cnpj)}
        title="Copiar CNPJ"
        className="inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <Copy size={12} /> {copiado ? 'Copiado!' : 'Copiar CNPJ'}
      </button>
    );
  };

  // Selo do resultado do casamento por CNPJ, mostrado em cada seção.
  const renderMatchBadge = (
    status: MatchStatus,
    label: string,
    onCadastrar?: () => void,
    matches?: any[],
    onEscolher?: (m: any) => void,
    cnpj?: string,
  ) => {
    if (status === 'auto') {
      return (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 px-3 py-1.5 text-xs text-green-800 dark:text-green-200">
          <CheckCircle2 size={14} />
          {label} vinculado automaticamente pelo CNPJ da nota.
        </div>
      );
    }
    if (status === 'multiplos') {
      return (
        <div className="mb-3 rounded-md bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} />
            Vários cadastros com esse CNPJ — selecione o {label.toLowerCase()} correto:
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-auto">
            {(matches || []).map((m) => (
              <button
                key={m.cod_credor}
                type="button"
                onClick={() => onEscolher?.(m)}
                className="w-full text-left rounded border border-blue-200 dark:border-blue-700 bg-white/70 dark:bg-gray-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/60 px-2 py-1.5"
              >
                <span className="font-medium text-blue-700 dark:text-blue-300">{m.cod_credor}</span>
                {' — '}
                <span className="text-gray-900 dark:text-gray-100">{m.nome}</span>
                {(m.cidade || m.uf) && (
                  <span className="text-gray-500 ml-1">({m.cidade}{m.uf ? `/${m.uf}` : ''})</span>
                )}
                {m.cpf_cgc && <span className="text-gray-500 ml-1">· {m.cpf_cgc}</span>}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (status === 'nao_encontrado') {
      return (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            CNPJ da nota não encontrado no cadastro de {label.toLowerCase()}.
          </span>
          <span className="flex-shrink-0 flex items-center gap-2">
            <BotaoCopiarCnpj cnpj={cnpj} />
            {onCadastrar && (
              <button
                type="button"
                onClick={onCadastrar}
                className="inline-flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 font-medium"
              >
                <Plus size={12} /> Cadastrar {label.toLowerCase()}
              </button>
            )}
          </span>
        </div>
      );
    }
    return null;
  };

  const handleCompradorChange = (codigo: string, nome: string) => {
    if (codigo && nome) {
      setFormData(prev => ({ ...prev, comprador: { codigo, nome } }));
    } else {
      setFormData(prev => ({ ...prev, comprador: null }));
    }
  };

  // Monta o payload da tabela auxiliar (dbnfe_ent_aux) a partir do formulário.
  const montarPayloadAux = () => ({
    nfeId: nfe.id,
    // Coação defensiva: os campos numéricos podem chegar como string (input de texto
    // ou colunas numeric do pg) — garantir number para a validação do backend.
    operacao: Number(formData.operacao) || 0,
    codcomprador: formData.comprador?.codigo || '',
    // Fornecedor/transportadora são obrigatórios (do cadastro) — salvar sempre que houver seleção.
    codcredor: formData.fornecedor?.cod_credor || '',
    codtransp: formData.transportadora?.cod_credor || '',
    custofin: Number(formData.custoFinanceiro) || 0,
    desconto: Number(formData.desconto) || 0,
    acrescimo: Number(formData.acrescimo) || 0,
    verba_tmk: Number(formData.verbaTmk) || 0,
    cfop: formData.cfop ? parseInt(formData.cfop) : null,
    desconto_icms: formData.descontoIcms ? 'S' : 'N',
    desconto_st: formData.descontoSt ? 'S' : 'N',
    zerar_ipi: formData.zerarIpi ? 'S' : 'N',
    zerar_st: formData.zerarSt ? 'S' : 'N',
    temcusto: formData.calculoCusto ? 'S' : 'N',
    complementar: formData.nfeComplementar ? 1 : 0,
    devolucao: formData.devolucao ? 1 : 0,
    dev_codfat: formData.devCodfat || null,
  });

  const salvarDadosAux = () =>
    api.post('/api/entrada-xml/salvar-dados-confirmacao', montarPayloadAux());

  const handleSave = async () => {
    setSaving(true);
    try {
      await salvarDadosAux();
      toast({
        title: "Sucesso",
        description: "Dados de confirmação salvos com sucesso!",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Erro ao salvar dados de confirmação",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Ao avançar: PERSISTE fornecedor/transportadora/dados no dbnfe_ent_aux antes
  // de seguir. Antes, o "Avançar" não salvava — a associação (inclusive o
  // vínculo automático por CNPJ) se perdia se o usuário não clicasse "Salvar".
  const prosseguirConfirmacao = async () => {
    setSaving(true);
    try {
      await salvarDadosAux();
    } catch (error: any) {
      setSaving(false);
      return pedirConfirmacao(() => {}, {
        title: 'Erro ao salvar',
        message:
          error.response?.data?.error ||
          'Não foi possível salvar os dados da confirmação. Tente novamente.',
        type: 'danger',
        confirmText: 'OK',
        somenteOk: true,
      });
    }
    setSaving(false);
    const payload: NFeConfirmationData = {
      operacao: formData.operacao,
      compradorId: formData.comprador?.codigo || '',
      fornecedorId: formData.usarFornecedorNfe ? 'nfe' : formData.fornecedor?.cod_credor || '',
      transportadoraId: formData.usarTransportadoraNfe ? 'nfe' : formData.transportadora?.cod_credor || '',
      calculoCusto: formData.calculoCusto,
      devolucao: formData.devolucao,
      nfeComplementar: formData.nfeComplementar,
      custoFinanceiro: formData.custoFinanceiro,
      desconto: formData.desconto,
      acrescimo: formData.acrescimo,
      verbaTmk: formData.verbaTmk,
      cfop: formData.cfop,
      descontoIcms: formData.descontoIcms,
      descontoSt: formData.descontoSt,
      zerarIpi: formData.zerarIpi,
      zerarSt: formData.zerarSt,
      devCodfat: formData.devCodfat,
    };
    onConfirm(payload);
  };

  // Etapa 2: valida a associação de fornecedor/transportadora antes de avançar
  // (espelha as travas do Delphi). Erros claros bloqueiam; casos "sem vínculo"
  // pedem confirmação para prosseguir.
  const handleConfirm = () => {
    const soDigitos = (s?: string) => (s || '').replace(/\D/g, '');
    const cnpjNota = soDigitos(nfe.cnpjEmitente);

    // Comprador é OBRIGATÓRIO — como no Delphi ("INDIQUE UM COMPRADOR VÁLIDO").
    if (!formData.comprador?.codigo) {
      return pedirConfirmacao(() => {}, {
        title: 'Comprador obrigatório',
        message: 'Selecione um comprador válido para a entrada.',
        type: 'warning',
        confirmText: 'OK',
        somenteOk: true,
      });
    }

    // Fornecedor é OBRIGATÓRIO (do cadastro) — como no Delphi.
    if (!formData.fornecedor) {
      return pedirConfirmacao(() => {}, {
        title: 'Fornecedor obrigatório',
        message: 'Associe um fornecedor do cadastro à NFe: selecione na busca/lista ou cadastre-o.',
        type: 'warning',
        confirmText: 'OK',
        somenteOk: true,
      });
    }

    // CNPJ do fornecedor diverge da nota (aviso — permite prosseguir).
    const cnpjForn = soDigitos(formData.fornecedor?.cpf_cgc);
    if (cnpjForn && cnpjNota && cnpjForn !== cnpjNota) {
      return pedirConfirmacao(prosseguirConfirmacao, {
        title: 'CNPJ do fornecedor diverge da nota',
        message: `O CNPJ do fornecedor selecionado (${formData.fornecedor?.cpf_cgc}) é diferente do emitente da nota (${nfe.cnpjEmitente}). Deseja prosseguir mesmo assim?`,
        type: 'warning',
        confirmText: 'Sim, prosseguir',
        cancelText: 'Revisar',
      });
    }

    // Transportadora é OBRIGATÓRIA quando a nota tem transportadora — como no Delphi.
    const notaTemTransp = !!soDigitos(transportadoraXml?.cpf_cnpj);
    if (notaTemTransp && !formData.transportadora) {
      return pedirConfirmacao(() => {}, {
        title: 'Transportadora obrigatória',
        message: 'Associe uma transportadora do cadastro à NFe: selecione na busca/lista ou cadastre-a.',
        type: 'warning',
        confirmText: 'OK',
        somenteOk: true,
      });
    }

    prosseguirConfirmacao();
  };

  // Mapear finalidade NFe
  const getFinalidadeNFe = (finnfe?: number): string => {
    switch (finnfe) {
      case 1: return '1 - NFe normal';
      case 2: return '2 - NFe complementar';
      case 3: return '3 - NFe de ajuste';
      case 4: return '4 - Devolução de mercadoria';
      default: return '1 - NFe normal';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-[92vw] w-full mx-4 max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Confirmação dos Dados da Nota
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          {/* Dados da Nota Fiscal (Read-only) */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-4 flex items-center">
              <FileText size={20} className="mr-2" />
              Dados da Nota Fiscal
            </h3>
            {/* Primeira linha - Dados principais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Chave</Label>
                <div className="text-sm font-mono bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.chaveNFe}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">UF</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.emitenteUf || 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Versão</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.versao || '4.00'}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Protocolo de Autorização</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.protocolo || 'N/A'}
                </div>
              </div>
            </div>

            {/* Segunda linha */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Modelo</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  55
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Série</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.serie}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Doc Fiscal</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.numeroNF}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Data Emissão</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatDateTime(nfe.dataEmissao)}
                </div>
              </div>
            </div>

            {/* Terceira linha - Impostos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total ICMS</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorICMS || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">BC ICMS</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorBaseICMS || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total ICMS ST</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorICMSST || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">BC ICMS ST</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorBaseICMSST || 0)}
                </div>
              </div>
            </div>

            {/* Quarta linha - Mais impostos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total Prod.</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorProdutos || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Peso B.:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.pesoBruto?.toFixed(2) || '0,00'}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Natureza da Operação:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.naturezaOperacao || 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Impressão:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  DANFE Retrato
                </div>
              </div>
            </div>

            {/* Quinta linha - Fretes e outros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total Frete:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorFrete || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total Seguro:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorSeguro || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total Desconto:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorDesconto || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total II:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorII || 0)}
                </div>
              </div>
            </div>

            {/* Sexta linha - PIS/COFINS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total PIS:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorPIS || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total COFINS:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorCOFINS || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total Adicionais:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorOutros || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total NFe:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border font-bold">
                  {formatCurrency(nfe.valorTotal)}
                </div>
              </div>
            </div>

            {/* Sétima linha - IPI e Volume */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Total IPI:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {formatCurrency(nfe.valorIPI || 0)}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Peso L.:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.pesoLiquido?.toFixed(2) || '0,00'}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Modalidade do Frete:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {(() => {
                    const modalidade = nfe.modalidadeFrete || 0;
                    switch (modalidade) {
                      case 0: return '0 - Por conta do emitente';
                      case 1: return '1 - Por conta do destinatário/remetente';
                      case 2: return '2 - Por conta de terceiros';
                      case 3: return '3 - Transporte próprio por conta do remetente';
                      case 4: return '4 - Transporte próprio por conta do destinatário';
                      case 9: return '9 - Sem ocorrência de transporte';
                      default: return `${modalidade} - Desconhecida`;
                    }
                  })()}
                </div>
              </div>
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Finalidade:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {getFinalidadeNFe(nfe.finalidadeNFe)}
                </div>
              </div>
            </div>

            {/* Oitava linha - Volume */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label className="text-blue-700 dark:text-blue-300">Volume:</Label>
                <div className="text-sm bg-white dark:bg-slate-700 p-2 rounded border">
                  {nfe.quantidadeVolumes || 0}
                </div>
              </div>
              <div></div>
              <div></div>
              <div></div>
            </div>

          </div>

          {/* Dados da Entrada (Editáveis) */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-4 flex items-center">
              <Package size={20} className="mr-2" />
              Dados da Entrada
            </h3>

            {/* Primeira linha - Operação e Comprador */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Operação *</Label>
                <Select
                  value={formData.operacao.toString()}
                  onValueChange={(value) => handleInputChange('operacao', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERACOES.map(op => (
                      <SelectItem key={op.value} value={op.value.toString()}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Comprador</Label>
                <CompradorAutocomplete
                  value={formData.comprador}
                  onChange={handleCompradorChange}
                  placeholder="Selecione o comprador (opcional)"
                />
              </div>
            </div>

            {/* Checkboxes principais (espelham o Delphi) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="calculoCusto"
                  checked={formData.calculoCusto}
                  onCheckedChange={(checked) => handleInputChange('calculoCusto', checked)}
                />
                <Label htmlFor="calculoCusto" className="text-sm">Cálculo do Custo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="devolucao"
                  checked={formData.devolucao}
                  onCheckedChange={(checked) => handleInputChange('devolucao', checked)}
                />
                <Label htmlFor="devolucao" className="text-sm">Devolução ou Retorno de Comodato</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nfeComplementar"
                  checked={formData.nfeComplementar}
                  onCheckedChange={(checked) => handleInputChange('nfeComplementar', checked)}
                />
                <Label htmlFor="nfeComplementar" className="text-sm">NFe Complementar</Label>
              </div>
            </div>

            {/* Cálculo do Custo — campos aparecem só quando marcado (como o modal do Delphi) */}
            {formData.calculoCusto && (
              <div className="mt-4 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <PercentInput label="Custo Financeiro" value={formData.custoFinanceiro} onChange={(v) => handleInputChange('custoFinanceiro', v)} />
                  <PercentInput label="Desconto" value={formData.desconto} onChange={(v) => handleInputChange('desconto', v)} />
                  <PercentInput label="Acréscimo" value={formData.acrescimo} onChange={(v) => handleInputChange('acrescimo', v)} />
                  <PercentInput label="Verba Mkt" value={formData.verbaTmk} onChange={(v) => handleInputChange('verbaTmk', v)} />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="zerarIpi" checked={formData.zerarIpi} onCheckedChange={(checked) => handleInputChange('zerarIpi', checked)} />
                    <Label htmlFor="zerarIpi" className="text-sm">Zerar IPI</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="zerarSt" checked={formData.zerarSt} onCheckedChange={(checked) => handleInputChange('zerarSt', checked)} />
                    <Label htmlFor="zerarSt" className="text-sm">Zerar ST</Label>
                  </div>
                </div>
              </div>
            )}

            {/* Campo de devolução (aparece quando checkbox de devolução está marcado) */}
            {formData.devolucao && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="col-span-2">
                  <Label>Código da Fatura de Devolução (DEV_CODFAT)</Label>
                  <Input
                    type="text"
                    value={formData.devCodfat}
                    onChange={(e) => handleInputChange('devCodfat', e.target.value)}
                    placeholder="Código da fatura relacionada à devolução"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fornecedor */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-orange-800 dark:text-orange-200 mb-4 flex items-center">
              <Building2 size={20} className="mr-2" />
              Fornecedor
            </h3>

            {/* Opção de usar dados da NFe ou cadastro */}
            <div className="mb-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="fornecedor-nfe"
                  name="fornecedor-fonte"
                  checked={formData.usarFornecedorNfe}
                  onChange={() => handleInputChange('usarFornecedorNfe', true)}
                  className="h-4 w-4 text-orange-600"
                />
                <Label htmlFor="fornecedor-nfe" className="text-sm">Usar dados da NFe</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="fornecedor-cadastro"
                  name="fornecedor-fonte"
                  checked={!formData.usarFornecedorNfe}
                  onChange={() => handleInputChange('usarFornecedorNfe', false)}
                  className="h-4 w-4 text-orange-600"
                />
                <Label htmlFor="fornecedor-cadastro" className="text-sm">Buscar do cadastro</Label>
              </div>
            </div>

            {renderMatchBadge(matchFornec, 'Fornecedor', () => setCadFornecAberto(true), matchFornecList, (m) => escolherMatch('fornecedor', m), nfe.cnpjEmitente)}

            {/* Busca do fornecedor cadastrado */}
            {!formData.usarFornecedorNfe && (
              <div className="mb-4">
                <Label>Buscar fornecedor cadastrado</Label>
                <FornecedorAutocomplete
                  value={formData.fornecedor}
                  onChange={(fornecedor) => handleInputChange('fornecedor', fornecedor)}
                  placeholder="Buscar fornecedor por código, nome ou CNPJ..."
                />
              </div>
            )}

            {/* Dados do emitente da NFe (sempre visível) */}
            <div className="space-y-2">
              <Label>Dados do emitente constantes na nota fiscal</Label>
              <div className="bg-white dark:bg-slate-700 p-3 rounded border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Nome:</strong> {nfe.emitente}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span><strong>CPF/CNPJ:</strong> {nfe.cnpjEmitente}</span>
                    <BotaoCopiarCnpj cnpj={nfe.cnpjEmitente} />
                  </div>
                  <div>
                    <strong>Insc. Estadual:</strong> {nfe.emitenteIE || 'NÃO INFORMADO'}
                  </div>
                  <div>
                    <strong>UF:</strong> {nfe.emitenteUf || '--'}
                  </div>
                  <div className="col-span-2">
                    <strong>Endereço:</strong> {nfe.emitenteLogradouro}{nfe.emitenteNumero ? `, ${nfe.emitenteNumero}` : ''} - {nfe.emitenteBairro}
                  </div>
                  <div>
                    <strong>Município:</strong> {nfe.emitenteMunicipio}
                  </div>
                  <div>
                    <strong>CEP:</strong> {nfe.emitenteCep}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transportadora */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-purple-800 dark:text-purple-200 mb-4 flex items-center">
              <Truck size={20} className="mr-2" />
              Dados da Transportadora
            </h3>

            {/* Opção de usar dados da NFe ou cadastro */}
            <div className="mb-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="transp-nfe"
                  name="transp-fonte"
                  checked={formData.usarTransportadoraNfe}
                  onChange={() => handleInputChange('usarTransportadoraNfe', true)}
                  className="h-4 w-4 text-purple-600"
                />
                <Label htmlFor="transp-nfe" className="text-sm">Usar dados da NFe</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="transp-cadastro"
                  name="transp-fonte"
                  checked={!formData.usarTransportadoraNfe}
                  onChange={() => handleInputChange('usarTransportadoraNfe', false)}
                  className="h-4 w-4 text-purple-600"
                />
                <Label htmlFor="transp-cadastro" className="text-sm">Buscar do cadastro</Label>
              </div>
            </div>

            {renderMatchBadge(matchTransp, 'Transportadora', () => setCadTranspAberto(true), matchTranspList, (m) => escolherMatch('transportadora', m), transportadoraXml?.cpf_cnpj)}

            {/* Busca da transportadora cadastrada */}
            {!formData.usarTransportadoraNfe && (
              <div className="mb-4">
                <Label>Buscar transportadora cadastrada</Label>
                <TransportadoraAutocomplete
                  value={formData.transportadora}
                  onChange={(transp) => handleInputChange('transportadora', transp)}
                  placeholder="Buscar transportadora por código, nome ou CNPJ..."
                />
              </div>
            )}

            {/* Dados da transportadora da NFe */}
            <div className="bg-white dark:bg-slate-700 p-4 rounded border">
              <div className="grid grid-cols-1 gap-3">
                {/* Row 1 - Nome e CNPJ */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Razão Social:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.transportadora || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">CNPJ/CPF:</Label>
                      <BotaoCopiarCnpj cnpj={nfe.cnpjTransportadora} />
                    </div>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.cnpjTransportadora || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Inscrição Estadual:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.transportadoraIE || 'NÃO INFORMADO'}
                    </div>
                  </div>
                </div>

                {/* Row 2 - Endereço */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Endereço:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.transportadoraEndereco || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Município:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.transportadoraMunicipio || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">UF:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.transportadoraUf || '--'}
                    </div>
                  </div>
                </div>

                {/* Row 3 - Transporte Info */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Modalidade Frete:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {(() => {
                        const modalidade = nfe.modalidadeFrete || 0;
                        switch (modalidade) {
                          case 0: return '0 - Emitente';
                          case 1: return '1 - Destinatário/Remetente';
                          case 2: return '2 - Terceiros';
                          case 3: return '3 - Próprio Remetente';
                          case 4: return '4 - Próprio Destinatário';
                          case 9: return '9 - Sem Transporte';
                          default: return `${modalidade} - Desconhecida`;
                        }
                      })()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Placa:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.transportadoraPlaca || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">UF Veículo:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {transportadoraXml?.uf_placa || '--'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">ANTT (RNTC):</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {transportadoraXml?.rntc || 'NÃO INFORMADO'}
                    </div>
                  </div>
                </div>

                {/* Row 4 - Volumes */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Quantidade:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {nfe.quantidadeVolumes ? nfe.quantidadeVolumes.toString() : '0'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Espécie:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {transportadoraXml?.especie || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Marca:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {transportadoraXml?.marca || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Numeração:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {transportadoraXml?.numeracao || 'NÃO INFORMADO'}
                    </div>
                  </div>
                </div>

                {/* Row 5 - Lacre */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Lacre:</Label>
                    <div className="text-sm bg-gray-50 dark:bg-slate-600 p-2 rounded border mt-1">
                      {transportadoraXml?.lacre || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading || saving}
          >
            <X size={16} className="mr-2" />
            Voltar
          </Button>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={loading || saving}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRight size={16} className="mr-2" />
              Avançar
            </Button>
          </div>
        </div>
      </div>
      {ConfirmacaoSalvarModal}

      {/* Etapa 3: cadastrar na hora o fornecedor/transportadora ausente,
          pré-preenchido com os dados da NFe. Ao salvar, re-casa pelo CNPJ. */}
      {cadFornecAberto && (
        <CadastroFornecedorModal
          isOpen={cadFornecAberto}
          onClose={() => setCadFornecAberto(false)}
          onSuccess={() => {
            setCadFornecAberto(false);
            if (nfe.cnpjEmitente) autoMatchCredor(nfe.cnpjEmitente, 'fornecedor');
          }}
          dadosIniciais={{
            tipo: 'J',
            nome: nfe.emitente,
            cpf_cgc: nfe.cnpjEmitente,
            iest: nfe.emitenteIE,
            endereco: nfe.emitenteLogradouro,
            numero: nfe.emitenteNumero,
            bairro: nfe.emitenteBairro,
            cidade: nfe.emitenteMunicipio,
            uf: nfe.emitenteUf,
            cep: nfe.emitenteCep,
          } as any}
        />
      )}

      {cadTranspAberto && (
        <CadastroTransportadoraModal
          isOpen={cadTranspAberto}
          onClose={() => setCadTranspAberto(false)}
          onSuccess={() => {
            setCadTranspAberto(false);
            const cnpj = transportadoraXml?.cpf_cnpj;
            if (cnpj) autoMatchCredor(cnpj, 'transportadora');
          }}
          dadosIniciais={{
            // O modal de transportadora usa cpfcgc/ender (sem underscore).
            tipo: 'J',
            nome: transportadoraXml?.xnome,
            cpfcgc: transportadoraXml?.cpf_cnpj,
            ender: (transportadoraXml as any)?.xender,
            cidade: (transportadoraXml as any)?.xmun,
            uf: transportadoraXml?.uf,
          } as any}
        />
      )}
    </div>
  );
};
