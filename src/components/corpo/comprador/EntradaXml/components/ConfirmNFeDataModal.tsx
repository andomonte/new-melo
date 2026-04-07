import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Building2, User, Package, Truck, Save, ArrowRight, Search, ChevronDown } from 'lucide-react';
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

export const ConfirmNFeDataModal: React.FC<ConfirmNFeDataModalProps> = ({
  isOpen,
  nfe,
  onClose,
  onConfirm,
  loading = false
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [transportadoraXml, setTransportadoraXml] = useState<TransportadoraXml | null>(null);

  const [formData, setFormData] = useState<FormDataState>({
    operacao: 0,
    comprador: null,
    fornecedor: null,
    transportadora: null,
    calculoCusto: true,
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
        calculoCusto: true,
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

      // Carregar dados salvos
      fetchTransportadoraXml();
      fetchDadosAuxExistentes();
    }
  }, [isOpen, nfe?.id]);

  const fetchTransportadoraXml = async () => {
    try {
      const response = await api.get(`/api/entrada-xml/transportadora-xml/${nfe.id}`);
      if (response.data.success && response.data.data) {
        setTransportadoraXml(response.data.data);
      }
    } catch (error) {
      // Dados de transportadora do XML não disponíveis
    }
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
          operacao: dados.operacao ?? 0,
          custoFinanceiro: dados.custofin ?? 0,
          desconto: dados.desconto ?? 0,
          acrescimo: dados.acrescimo ?? 0,
          verbaTmk: dados.verba_tmk ?? 0,
          cfop: dados.cfop?.toString() ?? '',
          descontoIcms: dados.desconto_icms === 'S',
          descontoSt: dados.desconto_st === 'S',
          zerarIpi: dados.zerar_ipi === 'S',
          zerarSt: dados.zerar_st === 'S',
          calculoCusto: dados.temcusto === 'S' || dados.temcusto === null,
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
      }
    } catch (error) {
      // Dados auxiliares ainda não existem
    }
  };

  const handleInputChange = (field: keyof FormDataState, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompradorChange = (codigo: string, nome: string) => {
    if (codigo && nome) {
      setFormData(prev => ({ ...prev, comprador: { codigo, nome } }));
    } else {
      setFormData(prev => ({ ...prev, comprador: null }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        nfeId: nfe.id,
        operacao: formData.operacao,
        codcomprador: formData.comprador?.codigo || '',
        codcredor: formData.usarFornecedorNfe ? '' : formData.fornecedor?.cod_credor || '',
        codtransp: formData.usarTransportadoraNfe ? '' : formData.transportadora?.cod_credor || '',
        custofin: formData.custoFinanceiro,
        desconto: formData.desconto,
        acrescimo: formData.acrescimo,
        verba_tmk: formData.verbaTmk,
        cfop: formData.cfop ? parseInt(formData.cfop) : null,
        desconto_icms: formData.descontoIcms ? 'S' : 'N',
        desconto_st: formData.descontoSt ? 'S' : 'N',
        zerar_ipi: formData.zerarIpi ? 'S' : 'N',
        zerar_st: formData.zerarSt ? 'S' : 'N',
        temcusto: formData.calculoCusto ? 'S' : 'N',
        complementar: formData.nfeComplementar ? 1 : 0,
        devolucao: formData.devolucao ? 1 : 0,
        dev_codfat: formData.devCodfat || null,
      };

      await api.post('/api/entrada-xml/salvar-dados-confirmacao', payload);

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

  const handleConfirm = () => {
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
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
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
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

            {/* Segunda linha - Campos financeiros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label>Custo Financeiro (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.custoFinanceiro}
                  onChange={(e) => handleInputChange('custoFinanceiro', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.desconto}
                  onChange={(e) => handleInputChange('desconto', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Acréscimo (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.acrescimo}
                  onChange={(e) => handleInputChange('acrescimo', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Verba TMK (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.verbaTmk}
                  onChange={(e) => handleInputChange('verbaTmk', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Terceira linha - CFOP */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label>CFOP</Label>
                <Input
                  type="text"
                  maxLength={4}
                  value={formData.cfop}
                  onChange={(e) => handleInputChange('cfop', e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 1102"
                />
              </div>
              <div></div>
              <div></div>
              <div></div>
            </div>

            {/* Checkboxes - Primeira linha */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="calculoCusto"
                  checked={formData.calculoCusto}
                  onCheckedChange={(checked) => handleInputChange('calculoCusto', checked)}
                />
                <Label htmlFor="calculoCusto" className="text-sm">
                  Cálculo do Custo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="descontoIcms"
                  checked={formData.descontoIcms}
                  onCheckedChange={(checked) => handleInputChange('descontoIcms', checked)}
                />
                <Label htmlFor="descontoIcms" className="text-sm">
                  Desconto ICMS
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="descontoSt"
                  checked={formData.descontoSt}
                  onCheckedChange={(checked) => handleInputChange('descontoSt', checked)}
                />
                <Label htmlFor="descontoSt" className="text-sm">
                  Desconto ST
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="zerarIpi"
                  checked={formData.zerarIpi}
                  onCheckedChange={(checked) => handleInputChange('zerarIpi', checked)}
                />
                <Label htmlFor="zerarIpi" className="text-sm">
                  Zerar IPI
                </Label>
              </div>
            </div>

            {/* Checkboxes - Segunda linha */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="zerarSt"
                  checked={formData.zerarSt}
                  onCheckedChange={(checked) => handleInputChange('zerarSt', checked)}
                />
                <Label htmlFor="zerarSt" className="text-sm">
                  Zerar ST
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="devolucao"
                  checked={formData.devolucao}
                  onCheckedChange={(checked) => handleInputChange('devolucao', checked)}
                />
                <Label htmlFor="devolucao" className="text-sm">
                  Devolução ou Retorno de Comodato
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nfeComplementar"
                  checked={formData.nfeComplementar}
                  onCheckedChange={(checked) => handleInputChange('nfeComplementar', checked)}
                />
                <Label htmlFor="nfeComplementar" className="text-sm">
                  NFe Complementar
                </Label>
              </div>
              <div></div>
            </div>

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
                  <div>
                    <strong>CPF/CNPJ:</strong> {nfe.cnpjEmitente}
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
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">CNPJ/CPF:</Label>
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
    </div>
  );
};
