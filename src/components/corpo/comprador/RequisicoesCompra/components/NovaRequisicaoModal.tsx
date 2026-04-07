import React, { useEffect, useState, useContext } from 'react';
import { X, Building2, User, Calendar, Package, MapPin, Plus, Pencil } from 'lucide-react';
import { AuthContext } from '@/contexts/authContexts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FornecedorAutocomplete } from './FornecedorAutocomplete';
import { CompradorAutocomplete } from './CompradorAutocomplete';
import api from '@/components/services/api';
import type { ModalProps } from '../types';
import {
  NovaRequisicaoForm,
  CreateRequisitionResponse,
  mapFormToApiPayload,
  type Filial
} from '@/types/compras';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { ToastAction } from '@/components/ui/toast';
import FormFooter2 from '@/components/common/FormFooter2';
import { AdicionarProdutosModal } from './AdicionarProdutosModal';
import { TiShoppingCart } from 'react-icons/ti';
import { useRouter } from 'next/router';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';

interface NovaRequisicaoModalProps extends ModalProps {
  onRequisitionCreated?: (requisition: any) => void;
  initialData?: any; // Dados iniciais para duplicação
}

interface TipoRequisicao {
  id: string;
  nome: string;
}

// Usar o tipo unificado para FormData
type FormData = NovaRequisicaoForm;

export const NovaRequisicaoModal: React.FC<NovaRequisicaoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onRequisitionCreated,
  initialData
}) => {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useContext(AuthContext);
  
  // Obter data atual para o estado inicial
  const getDataAtual = () => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  };
  
  const [formData, setFormData] = useState<FormData>({
    tipo: '',
    fornecedor: null,
    comprador_codigo: '',
    comprador_nome: '',
    entrega_em: '',
    destinado_para: '',
    previsao_chegada: getDataAtual(), // Definir data atual como padrão
    condicoes_pagamento: '',
    observacao: '',
  });

  const [tipos, setTipos] = useState<TipoRequisicao[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showProdutosModal, setShowProdutosModal] = useState(false);
  const [showEditProdutosModal, setShowEditProdutosModal] = useState(false);
  const [produtosSelecionados, setProdutosSelecionados] = useState<any[]>([]);
  const [produtosMarcados, setProdutosMarcados] = useState<Set<string>>(new Set());

  // Carregar dados quando modal abrir
  useEffect(() => {
    if (isOpen) {
      resetForm(); // Reset primeiro
      loadInitialData();
    }
  }, [isOpen]);

  // Marcar todos os produtos quando abrir modal de edição
  useEffect(() => {
    if (showEditProdutosModal) {
      const todosMarcados = new Set(produtosSelecionados.map((p, idx) => `${p.codprod}-${idx}`));
      setProdutosMarcados(todosMarcados);
    }
  }, [showEditProdutosModal, produtosSelecionados]);

  // Preencher dados quando tiver initialData (duplicação)
  useEffect(() => {
    if (isOpen && initialData && filiais.length > 0 && tipos.length > 0) {
      // Aguardar um pouco para garantir que os dados foram carregados
      setTimeout(() => {
        loadDuplicateData();
      }, 200);
    }
  }, [isOpen, initialData, filiais, tipos]);

  const loadDuplicateData = () => {
    if (!initialData) return;

    // Mapear dados para duplicação com verificações mais robustas
    let entregaId = '';
    let destinoId = '';
    
    // Para entrega - tentar diferentes campos possíveis
    if (initialData.entregaId) {
      entregaId = initialData.entregaId.toString();
    } else if (initialData.localEntrega && filiais.length > 0) {
      const filialEntrega = filiais.find(f => f.unm_nome === initialData.localEntrega);
      entregaId = filialEntrega ? filialEntrega.unm_id : '';
    }
    
    // Para destino - tentar diferentes campos possíveis
    if (initialData.destinoId) {
      destinoId = initialData.destinoId.toString();
    } else if (initialData.destino && filiais.length > 0) {
      const filialDestino = filiais.find(f => f.unm_nome === initialData.destino);
      destinoId = filialDestino ? filialDestino.unm_id : '';
    }

    // Obter data atual como fallback
    const hoje = new Date();
    const dataAtual = hoje.toISOString().split('T')[0];
    
    const duplicatedFormData = {
      tipo: initialData.tipo || '',
      fornecedor: initialData.fornecedorCodigo ? {
        cod_credor: initialData.fornecedorCodigo,
        nome: initialData.fornecedorNome || '',
        cpf_cnpj: initialData.fornecedorCpfCnpj || ''
      } : null,
      comprador_codigo: initialData.compradorCodigo || '',
      comprador_nome: initialData.compradorNome || '',
      entrega_em: entregaId,
      destinado_para: destinoId,
      previsao_chegada: initialData.previsaoChegada ? 
        new Date(initialData.previsaoChegada).toISOString().split('T')[0] : dataAtual, // Usar data atual se não houver data na duplicação
      condicoes_pagamento: initialData.condicoesPagamento || initialData.condPagto || '',
      observacao: `${initialData.observacao || ''} (DUPLICADA)`,
    };

    console.log('Duplicando requisição:', { 
      original: initialData, 
      mapeado: duplicatedFormData 
    });
    
    setFormData(duplicatedFormData);
    
    // Carregar itens da requisição original
    loadOriginalItems();
  };

  const loadOriginalItems = async () => {
    if (!initialData?.requisicao) return;
    
    console.log('Carregando itens da requisição original para duplicar:', initialData.requisicao);
    
    try {
      const response = await api.get(`/api/requisicoesCompra/${initialData.requisicao}/items`);
      
      if (response.data.success && response.data.data?.length > 0) {
        const items = response.data.data;
        
        // Mapear os itens para o formato esperado pelo componente
        const itensMapeados = items.map((item: any) => ({
          id: item.id,
          produtoId: item.id,
          produtoNome: item.produto_nome || `Produto ${item.codprod}`,
          produtoCodigo: item.codprod,
          quantidade: parseFloat(item.quantidade) || 1,
          preco_unitario: parseFloat(item.preco_unitario) || 0,
          preco_total: parseFloat(item.preco_total) || 0,
          observacao: item.observacao || '',
          descricao: item.produto_nome || `Produto ${item.codprod}`,
          codigo: item.codprod,
          // Campos adicionais para o AdicionarProdutosModal
          codprod: item.codprod,
          descr: item.produto_nome || `Produto ${item.codprod}`,
          marca: item.produto_marca || '',
          prcompra: parseFloat(item.preco_unitario) || 0,
          estoque: 0
        }));
        
        console.log('Itens carregados para duplicação:', itensMapeados);
        setProdutosSelecionados(itensMapeados);
      } else {
        console.log('Nenhum item encontrado na requisição original');
        setProdutosSelecionados([]);
      }
    } catch (error) {
      console.error('Erro ao carregar itens da requisição original:', error);
      setProdutosSelecionados([]);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [tiposRes, filiaisRes] = await Promise.all([
        api.get('/api/compras/tipos-requisicao'),
        api.get('/api/compras/filiais'),
      ]);
      
      setTipos(tiposRes.data || []);
      setFiliais(filiaisRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    // Obter data atual no formato YYYY-MM-DD para o input de data
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];
    
    setFormData({
      tipo: '',
      fornecedor: null,
      comprador_codigo: '',
      comprador_nome: '',
      entrega_em: '',
      destinado_para: '',
      previsao_chegada: dataFormatada, // Definir data atual como padrão
      condicoes_pagamento: '',
      observacao: '',
    });
    setProdutosSelecionados([]); // Limpar produtos selecionados
  };

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompradorChange = (codigo: string, nome: string) => {
    setFormData(prev => ({
      ...prev,
      comprador_codigo: codigo,
      comprador_nome: nome,
    }));
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.tipo) {
      errors.push('Tipo da requisição é obrigatório');
    }

    if (!formData.fornecedor) {
      errors.push('Fornecedor é obrigatório');
    }

    if (!formData.comprador_codigo) {
      errors.push('Comprador é obrigatório');
    }

    if (!formData.entrega_em) {
      errors.push('Local de entrega é obrigatório');
    }

    if (!formData.destinado_para) {
      errors.push('Destino é obrigatório');
    }

    if (produtosSelecionados.length === 0) {
      errors.push('É necessário adicionar pelo menos um produto');
    }

    if (errors.length > 0) {
      toast({
        title: "Campos obrigatórios não preenchidos",
        description: errors.join(', '),
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleClose = () => {
    const hasData = Object.values(formData).some(value => 
      value !== '' && value !== null && value !== undefined
    );

    if (hasData) {
      toast({
        title: "Descartar alterações?",
        description: "Todas as informações não salvas serão perdidas.",
        variant: "destructive",
        action: (
          <ToastAction 
            altText="Confirmar"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Confirmar
          </ToastAction>
        ),
      });
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    toast({
      title: "Confirmar criação da requisição?",
      description: "Uma nova requisição de compra será criada com os dados informados.",
      action: (
        <ToastAction 
          altText="Confirmar"
          onClick={async () => {
            setSubmitting(true);
            try {
              const payload = mapFormToApiPayload(formData);
              // Adicionar flag de duplicação e dados do usuário
              const payloadComFlag = {
                ...payload,
                isDuplicate: !!initialData, // Se tem initialData, é duplicação
                userId: user?.codusr,
                userName: user?.usuario,
              };
              const response = await api.post<CreateRequisitionResponse>('/api/requisicoesCompra/post', payloadComFlag);
              
              if (response.data?.success && response.data.data) {
                const requisicao = response.data.data;
                console.log('Requisição criada:', requisicao);
                console.log('Produtos para salvar:', produtosSelecionados);

                // Salvar itens se existirem produtos selecionados (usando API batch para UMA entrada no histórico)
                if (produtosSelecionados.length > 0) {
                  try {
                    // Usar API batch para salvar todos os itens com uma única entrada no histórico
                    const batchPayload = {
                      req_id: requisicao.req_id,
                      req_versao: requisicao.req_versao || 1,
                      userId: user?.codusr,
                      userName: user?.usuario,
                      items: produtosSelecionados.map(produto => ({
                        codprod: produto.codprod,
                        quantidade: produto.quantidade || 1,
                        preco_unitario: produto.preco_unitario || produto.prcompra || 0,
                        observacao: produto.observacao || ''
                      }))
                    };

                    console.log('Salvando itens em lote:', batchPayload);

                    const batchResponse = await api.post('/api/requisicoesCompra/items/batch', batchPayload);

                    if (!batchResponse.data?.success) {
                      console.error('Erro ao salvar itens em lote:', batchResponse.data);
                      throw new Error('Falha ao salvar itens');
                    }

                    toast({
                      title: "Requisição criada com sucesso!",
                      description: `Requisição criada com ${produtosSelecionados.length} item(ns) adicionado(s).`,
                      variant: "default",
                    });
                  } catch (itemError) {
                    console.error('Erro ao salvar itens:', itemError);
                    toast({
                      title: "Requisição criada, mas erro ao salvar itens",
                      description: "A requisição foi criada, mas alguns itens podem não ter sido salvos. Verifique e edite se necessário.",
                      variant: "destructive",
                    });
                  }
                } else {
                  toast({
                    title: "Requisição criada com sucesso!",
                    description: "A requisição foi criada e está pronta para gerenciamento de itens.",
                    variant: "default",
                  });
                }
                
                resetForm();
                onClose();
                
                // Se estamos na página de novaCompra, redirecionar para requisições
                if (router.pathname.includes('/novaCompra')) {
                  toast({
                    title: "Redirecionando...",
                    description: "Você será redirecionado para a página de Requisições de Compra.",
                    variant: "default",
                  });
                  
                  setTimeout(() => {
                    router.push('/compras/requisicoes-compra');
                  }, 1500);
                } else {
                  // Comportamento normal quando já estamos na página de requisições
                  if (onRequisitionCreated) {
                    onRequisitionCreated(requisicao);
                  } else if (onSuccess) {
                    onSuccess();
                  }
                }
              } else {
                toast({
                  title: "Erro ao criar requisição",
                  description: response.data?.message || 'Ocorreu um erro inesperado.',
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error('Erro ao criar requisição:', error);
              toast({
                title: "Erro ao criar requisição",
                description: "Não foi possível criar a requisição. Tente novamente.",
                variant: "destructive",
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          Confirmar
        </ToastAction>
      ),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo - Replicando o padrão do sistema */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">Nova Requisição de Compra</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter2
              onSubmit={() => handleSubmit(new Event('submit') as any)}
              onClear={() => {
                resetForm();
              }}
              isSaving={submitting}
              hasChanges={Object.values(formData).some(value => 
                value !== '' && value !== null && value !== undefined
              )}
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={handleClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
              disabled={submitting}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Carregando dados...</p>
              </div>
            ) : (
              <>
                {/* Agrupamento para campos principais */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Tipo da Requisição *
                    </Label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => handleFieldChange('tipo', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      required
                    >
                      <option value="" disabled>Selecione o tipo</option>
                      {tipos.map((tipo) => (
                        <option key={tipo.id} value={tipo.id}>
                          {tipo.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Comprador *
                    </Label>
                    <CompradorAutocomplete
                      value={formData.comprador_codigo && formData.comprador_nome ? 
                        { codigo: formData.comprador_codigo, nome: formData.comprador_nome } : null}
                      onChange={handleCompradorChange}
                    />
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Entrega em *
                    </Label>
                    <select
                      value={formData.entrega_em}
                      onChange={(e) => handleFieldChange('entrega_em', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione a filial de entrega...</option>
                      {filiais.map((filial) => (
                        <option key={filial.unm_id} value={filial.unm_id}>
                          {filial.unm_nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Destinado para *
                    </Label>
                    <select
                      value={formData.destinado_para}
                      onChange={(e) => handleFieldChange('destinado_para', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione o destino...</option>
                      {filiais.map((filial) => (
                        <option key={filial.unm_id} value={filial.unm_id}>
                          {filial.unm_nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fornecedor */}
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4" />
                    Fornecedor *
                  </Label>
                  <FornecedorAutocomplete
                    value={formData.fornecedor}
                    onChange={(fornecedor) => handleFieldChange('fornecedor', fornecedor)}
                  />
                </div>

                {/* Datas e Condições */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Previsão de Chegada
                    </Label>
                    <DatePicker
                      selected={
                        formData.previsao_chegada
                          ? new Date(formData.previsao_chegada + 'T00:00:00')
                          : null
                      }
                      onChange={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          handleFieldChange('previsao_chegada', `${year}-${month}-${day}`);
                        } else {
                          handleFieldChange('previsao_chegada', '');
                        }
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale={ptBR}
                      placeholderText="Selecione a data"
                      className="w-full px-3 py-2 mt-1 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">
                      Condições de Pagamento
                    </Label>
                    <Input
                      type="text"
                      value={formData.condicoes_pagamento}
                      onChange={(e) => handleFieldChange('condicoes_pagamento', e.target.value)}
                      placeholder="Ex: 30/60/90 dias, À vista, etc."
                      className="mt-1 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                {/* Observação e Botões de Produtos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Observação
                    </Label>
                    <Textarea
                      value={formData.observacao}
                      onChange={(e) => handleFieldChange('observacao', e.target.value)}
                      placeholder="Observações adicionais sobre a requisição..."
                      rows={3}
                      className="mt-1 bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>

                  <div>
                    {/* Simula a altura do label dos inputs */}
                    <div className="text-sm font-medium h-[20px]">&nbsp;</div>

                    <div className="flex items-center gap-3 h-[100px]">
                      {/* Botão azul - sem contador */}
                      <button
                        type="button"
                        onClick={() => setShowProdutosModal(true)}
                        disabled={submitting}
                        title="Adicionar produtos à requisição"
                        className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800 flex items-center justify-center h-[42px] relative disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <TiShoppingCart className="h-5 w-5" />
                        <Plus className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-white border border-gray-400 dark:border-gray-600 rounded-full bg-blue-600 dark:bg-blue-700" />
                      </button>

                      {/* Botão verde - com contador e Pencil */}
                      {produtosSelecionados.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowEditProdutosModal(true)}
                          disabled={submitting}
                          title="Editar produtos selecionados"
                          className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:bg-green-700 dark:hover:bg-green-800 flex items-center justify-center h-[42px] relative"
                        >
                          <Pencil className="h-4 w-4 ml-1" />
                          <span className="absolute -top-1 -left-0.5 h-4 w-4 text-white text-xs flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded-full bg-red-600 dark:bg-red-700">
                            {produtosSelecionados.length}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>

      </div>
      <Toaster />

      {/* Modal de Adicionar Produtos */}
      {showProdutosModal && (
        <AdicionarProdutosModal
          isOpen={showProdutosModal}
          onClose={() => setShowProdutosModal(false)}
          onConfirm={(produtos) => {
            setProdutosSelecionados(produtos);
            setShowProdutosModal(false);
          }}
          produtosJaAdicionados={produtosSelecionados}
        />
      )}

      {/* Modal de Editar Produtos - Contexto de Compras */}
      {showEditProdutosModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-[95vw] h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-gray-100">
                Produtos Adicionados ({produtosSelecionados.length})
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowEditProdutosModal(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Alterar Itens
                </button>
                <button
                  onClick={() => setShowEditProdutosModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Table Header */}
            <div className="bg-slate-800 text-white px-6 py-4">
              <div className="grid grid-cols-10 gap-6 items-center text-sm font-medium">
                <div className="col-span-1 text-center">AÇÕES</div>
                <div className="col-span-5">PRODUTO</div>
                <div className="col-span-2 text-center">QUANTIDADE</div>
                <div className="col-span-1 text-center">PREÇO UNIT.</div>
                <div className="col-span-1 text-center">TOTAL</div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {produtosSelecionados.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 text-lg">Nenhum produto selecionado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {produtosSelecionados.map((produto, index) => {
                    const produtoKey = `${produto.codprod}-${index}`;
                    const estaMarcado = produtosMarcados.has(produtoKey);

                    return (
                    <div key={produtoKey} className={`grid grid-cols-10 gap-6 items-center p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 ${!estaMarcado ? 'opacity-50' : ''}`}>
                      {/* Checkbox */}
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={estaMarcado}
                          onChange={(e) => {
                            const novosMarcados = new Set(produtosMarcados);
                            if (e.target.checked) {
                              novosMarcados.add(produtoKey);
                            } else {
                              novosMarcados.delete(produtoKey);
                            }
                            setProdutosMarcados(novosMarcados);
                          }}
                          className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* Produto */}
                      <div className="col-span-5">
                        <div className="flex items-start space-x-4">
                          <div className="w-4 h-4 bg-blue-600 rounded-sm mt-1"></div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-800 dark:text-gray-100 text-base">
                              {produto.descricao || produto.descr || produto.codprod}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span className="font-medium">Código:</span> {produto.codprod}
                              {produto.marca && <span className="ml-3"><span className="font-medium">Marca:</span> {produto.marca}</span>}
                            </div>
                            {produto.observacao && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <span className="font-medium">Obs:</span> {produto.observacao}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-2 flex justify-center">
                        <div className="flex items-center bg-blue-600 text-white rounded-lg">
                          <button
                            className="px-3 py-2 hover:bg-blue-700 rounded-l-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!estaMarcado}
                            onClick={() => {
                              if (!estaMarcado) return;
                              const novoProdutos = [...produtosSelecionados];
                              const novaQtd = Math.max(1, (novoProdutos[index].quantidade || 1) - 1);
                              novoProdutos[index] = {
                                ...novoProdutos[index],
                                quantidade: novaQtd,
                                preco_total: novaQtd * (novoProdutos[index].preco_unitario || 0)
                              };
                              setProdutosSelecionados(novoProdutos);
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={produto.quantidade || 1}
                            disabled={!estaMarcado}
                            onChange={(e) => {
                              if (!estaMarcado) return;
                              const novoProdutos = [...produtosSelecionados];
                              const novaQtd = Math.max(1, parseInt(e.target.value) || 1);
                              novoProdutos[index] = {
                                ...novoProdutos[index],
                                quantidade: novaQtd,
                                preco_total: novaQtd * (novoProdutos[index].preco_unitario || 0)
                              };
                              setProdutosSelecionados(novoProdutos);
                            }}
                            className="w-16 text-center bg-transparent border-none text-white focus:outline-none py-2 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="1"
                          />
                          <button
                            className="px-3 py-2 hover:bg-blue-700 rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!estaMarcado}
                            onClick={() => {
                              if (!estaMarcado) return;
                              const novoProdutos = [...produtosSelecionados];
                              const novaQtd = (novoProdutos[index].quantidade || 1) + 1;
                              novoProdutos[index] = {
                                ...novoProdutos[index],
                                quantidade: novaQtd,
                                preco_total: novaQtd * (novoProdutos[index].preco_unitario || 0)
                              };
                              setProdutosSelecionados(novoProdutos);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Preço Unitário */}
                      <div className="col-span-1 text-center">
                        <input
                          type="number"
                          value={produto.preco_unitario || 0}
                          disabled={!estaMarcado}
                          onChange={(e) => {
                            if (!estaMarcado) return;
                            const novoProdutos = [...produtosSelecionados];
                            const novoPreco = parseFloat(e.target.value) || 0;
                            novoProdutos[index] = {
                              ...novoProdutos[index],
                              preco_unitario: novoPreco,
                              preco_total: (novoProdutos[index].quantidade || 1) * novoPreco
                            };
                            setProdutosSelecionados(novoProdutos);
                          }}
                          className="w-20 text-center p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          step="0.01"
                          min="0"
                        />
                      </div>

                      {/* Total */}
                      <div className="col-span-1 text-center">
                        <div className="font-medium text-slate-800 dark:text-gray-100 text-base">
                          R$ {(produto.preco_total || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
              <div className="text-lg font-medium text-slate-800 dark:text-gray-100">
                Total Geral: R$ {produtosSelecionados.reduce((total, p) => total + (p.preco_total || 0), 0).toFixed(2)}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditProdutosModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    // Filtrar apenas produtos marcados
                    const produtosMarcadosFiltrados = produtosSelecionados.filter((p, idx) => {
                      const produtoKey = `${p.codprod}-${idx}`;
                      return produtosMarcados.has(produtoKey);
                    });

                    setProdutosSelecionados(produtosMarcadosFiltrados);
                    setShowEditProdutosModal(false);
                  }}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};