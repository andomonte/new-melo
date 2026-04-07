import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { X, Building2, User, Calendar, Package, MapPin, Plus, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FornecedorAutocomplete } from '../components/FornecedorAutocomplete';
import { CompradorAutocomplete } from '../components/CompradorAutocomplete';
import api from '@/components/services/api';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import FormFooter2 from '@/components/common/FormFooter2';
import { AdicionarProdutosModal } from '../components/AdicionarProdutosModal';
import { TiShoppingCart } from 'react-icons/ti';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';

interface EditRequisitionModalProps {
  isOpen: boolean;
  requisition: RequisitionDTO | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TipoRequisicao {
  id: string;
  nome: string;
}

interface Filial {
  unm_id: string;
  unm_nome: string;
}

interface FormData {
  tipo: string;
  fornecedor: any;
  comprador_codigo: string;
  comprador_nome: string;
  entrega_em: string;
  destinado_para: string;
  previsao_chegada: string;
  condicoes_pagamento: string;
  observacao: string;
}

export default function EditRequisitionModal({
  isOpen,
  requisition,
  onClose,
  onSuccess,
}: EditRequisitionModalProps) {
  const { toast } = useToast();
  const { user } = useContext(AuthContext);
  const [formData, setFormData] = useState<FormData>({
    tipo: '',
    fornecedor: null,
    comprador_codigo: '',
    comprador_nome: '',
    entrega_em: '',
    destinado_para: '',
    previsao_chegada: '',
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
    if (isOpen && requisition) {
      loadInitialData();
    }
  }, [isOpen, requisition]);

  // Carregar dados da requisição após filiais serem carregadas
  useEffect(() => {
    if (isOpen && requisition && filiais.length > 0 && !loading) {
      loadRequisitionData();
    }
  }, [filiais, isOpen, requisition, loading]);

  // Marcar todos os produtos quando abrir modal de edição
  useEffect(() => {
    if (showEditProdutosModal) {
      const todosMarcados = new Set(produtosSelecionados.map((p, idx) => `${p.codprod}-${idx}`));
      setProdutosMarcados(todosMarcados);
    }
  }, [showEditProdutosModal, produtosSelecionados]);

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

  // Carregar dados quando modal abrir
  useEffect(() => {
    if (isOpen && requisition) {
      loadInitialData();
    }
  }, [isOpen, requisition, loadInitialData]);
  const loadRequisitionItems = useCallback(async () => {
    if (!requisition?.requisicao) return;

    console.log(
      'EditModal - Carregando itens para requisição ID:',
      requisition.requisicao,
    );

    try {
      const response = await api.get(
        `/api/requisicoesCompra/${requisition.requisicao}/items`,
      );

      console.log('EditModal - Resposta da API de itens:', response.data);

      if (response.data.success) {
        const items = response.data.data || [];

        console.log('EditModal - Itens recebidos da API:', items);

        if (items.length > 0) {
          const itensMapeados = items.map((item: any) => ({
            id: item.id,
            produtoId: item.id,
            produtoNome: item.produto_nome || `Produto ${item.codprod}`,
            produtoCodigo: item.codprod,
            quantidade: parseFloat(item.quantidade),
            preco_unitario: parseFloat(item.preco_unitario),
            preco_total: parseFloat(item.preco_total),
            observacao: item.observacao || '',
            descricao: item.produto_nome || `Produto ${item.codprod}`,
            codigo: item.codprod,
            codprod: item.codprod,
            descr: item.produto_nome || `Produto ${item.codprod}`,
            marca: item.produto_marca || '',
            prcompra: parseFloat(item.preco_unitario) || 0,
            estoque: 0,
          }));

          setProdutosSelecionados(itensMapeados);
        } else {
          setProdutosSelecionados([]);
        }
      } else {
        setProdutosSelecionados([]);
      }
    } catch (error) {
      console.error('Erro ao carregar itens da requisição:', error);
      setProdutosSelecionados([]);
    }
  }, [requisition?.requisicao]);
  const loadRequisitionData = useCallback(async () => {
    if (!requisition) return;

    const fornecedorData = requisition.fornecedorCodigo
      ? {
          cod_credor: requisition.fornecedorCodigo,
          nome: requisition.fornecedorNome || '',
          cpf_cnpj: requisition.fornecedorCpfCnpj || '',
        }
      : null;

    let entregaId = '';
    let destinoId = '';

    if (requisition.localEntrega && filiais.length > 0) {
      const filialEntrega = filiais.find(
        (f) => f.unm_nome === requisition.localEntrega,
      );
      entregaId = filialEntrega ? filialEntrega.unm_id : '';
    } else if (requisition.entregaId) {
      entregaId = requisition.entregaId.toString();
    }

    if (requisition.destino && filiais.length > 0) {
      const filialDestino = filiais.find(
        (f) => f.unm_nome === requisition.destino,
      );
      destinoId = filialDestino ? filialDestino.unm_id : '';
    } else if (requisition.destinoId) {
      destinoId = requisition.destinoId.toString();
    }

    const formDataMapeado = {
      tipo: requisition.tipo || '',
      fornecedor: fornecedorData,
      comprador_codigo: requisition.compradorCodigo || '',
      comprador_nome: requisition.compradorNome || '',
      entrega_em: entregaId,
      destinado_para: destinoId,
      previsao_chegada: requisition.previsaoChegada
        ? new Date(requisition.previsaoChegada).toISOString().split('T')[0]
        : '',
      condicoes_pagamento:
        requisition.condicoesPagamento || requisition.condPagto || '',
      observacao: requisition.observacao || '',
    };

    setFormData(formDataMapeado);

    await loadRequisitionItems();
  }, [requisition, filiais, loadRequisitionItems]);

  // Carregar dados da requisição após filiais serem carregadas
  useEffect(() => {
    if (isOpen && requisition && filiais.length > 0) {
      loadRequisitionData();
    }
  }, [isOpen, requisition, filiais.length, loadRequisitionData]);

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFornecedorChange = (fornecedor: any) => {
    setFormData((prev) => ({
      ...prev,
      fornecedor,
    }));
  };

  const handleCompradorChange = (comprador: any) => {
    setFormData((prev) => ({
      ...prev,
      comprador_codigo: comprador?.codigo || '',
      comprador_nome: comprador?.nome || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requisition?.requisicao) return;

    // Validação de campos obrigatórios
    if (
      !formData.tipo ||
      !formData.fornecedor ||
      !formData.comprador_nome ||
      !formData.entrega_em ||
      !formData.destinado_para
    ) {
      toast({
        title: 'Campos obrigatórios',
        description:
          'Preencha todos os campos obrigatórios antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    // Validação de produtos
    if (produtosSelecionados.length === 0) {
      toast({
        title: 'Produtos obrigatórios',
        description:
          'Adicione pelo menos um produto à requisição antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    // Validação de data de previsão - Na edição, permitir datas passadas
    // (apenas alertar se mudou para data muito antiga)
    if (formData.previsao_chegada) {
      const dataPrevisao = new Date(formData.previsao_chegada);
      const umMesAtras = new Date();
      umMesAtras.setMonth(umMesAtras.getMonth() - 1);

      if (dataPrevisao < umMesAtras) {
        const continuar = confirm(
          'A data de previsão é muito antiga (mais de 1 mês atrás). Deseja continuar?',
        );
        if (!continuar) {
          return;
        }
      }
    }

    // Validação do fornecedor (CNPJ/CPF)
    if (formData.fornecedor?.cpf_cnpj) {
      const documento = formData.fornecedor.cpf_cnpj.replace(/[^0-9]/g, '');
      if (documento.length !== 11 && documento.length !== 14) {
        toast({
          title: 'Documento inválido',
          description: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Validação de itens (quantidade > 0, preço >= 0)
    const itemsInvalidos = produtosSelecionados.filter(
      (item) =>
        !item.quantidade ||
        item.quantidade <= 0 ||
        !item.preco_unitario ||
        item.preco_unitario < 0,
    );

    if (itemsInvalidos.length > 0) {
      toast({
        title: 'Itens inválidos',
        description:
          'Todos os itens devem ter quantidade maior que zero e preço válido.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: requisition.requisicao,
        tipo: formData.tipo,
        fornecedorCodigo: formData.fornecedor?.cod_credor,
        compradorCodigo: formData.comprador_codigo,
        compradorNome: formData.comprador_nome,
        localEntrega: formData.entrega_em,
        destino: formData.destinado_para,
        previsaoChegada: formData.previsao_chegada || null,
        condicoesPagamento: formData.condicoes_pagamento,
        observacao: formData.observacao,
        userId: user?.codusr,
        userName: user?.usuario,
      };

      const response = await api.put('/api/requisicoesCompra/update', payload);

      if (response.data.success) {
        // Atualizar produtos se houver mudanças
        await api.put(
          `/api/requisicoesCompra/${requisition.requisicao}/items`,
          {
            items: produtosSelecionados,
          },
        );

        toast({
          title: 'Requisição atualizada!',
          description: 'A requisição foi atualizada com sucesso.',
          variant: 'default',
        });

        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: 'Erro ao atualizar requisição',
          description: response.data?.message || 'Ocorreu um erro inesperado.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar requisição:', error);
      toast({
        title: 'Erro ao atualizar requisição',
        description:
          'Não foi possível atualizar a requisição. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const resetForm = () => {
    if (requisition) {
      loadRequisitionData();
    }
  };

  if (!isOpen || !requisition) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">
              Editar Requisição de Compra
            </h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter2
              onSubmit={() => handleSubmit(new Event('submit') as any)}
              onClear={resetForm}
              isSaving={submitting}
              hasChanges={true}
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
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto"
          >
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">
                  Carregando dados...
                </p>
              </div>
            ) : (
              <>
                {/* Primeira linha - Tipo, Comprador, Entrega, Destino */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Tipo da Requisição *
                    </Label>
                    <select
                      value={formData.tipo}
                      onChange={(e) =>
                        handleFieldChange('tipo', e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      required
                    >
                      <option value="" disabled>
                        Selecione o tipo
                      </option>
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
                      value={
                        formData.comprador_codigo && formData.comprador_nome
                          ? {
                              codigo: formData.comprador_codigo,
                              nome: formData.comprador_nome,
                            }
                          : null
                      }
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
                      onChange={(e) =>
                        handleFieldChange('entrega_em', e.target.value)
                      }
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
                      onChange={(e) =>
                        handleFieldChange('destinado_para', e.target.value)
                      }
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
                    onChange={handleFornecedorChange}
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

                {/* Observação e Botões */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <Label className="text-sm font-medium">Observação</Label>
                    <Textarea
                      value={formData.observacao}
                      onChange={(e) =>
                        handleFieldChange('observacao', e.target.value)
                      }
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

                      {/* Botão verde - com contador e Pencil - Mostra sempre em edição para permitir gerenciar itens */}
                      {(produtosSelecionados.length > 0 ||
                        requisition?.valorTotal !== undefined) && (
                        <button
                          type="button"
                          onClick={() => setShowEditProdutosModal(true)}
                          disabled={submitting}
                          title="Editar produtos selecionados"
                          className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:bg-green-700 dark:hover:bg-green-800 flex items-center justify-center h-[42px] relative"
                        >
                          <Pencil className="h-4 w-4 ml-1" />
                          <span className="absolute -top-1 -left-0.5 h-4 w-4 text-white text-xs flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded-full bg-red-600 dark:bg-red-700">
                            {produtosSelecionados.length || '0'}
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

      {/* Modal de Produtos Adicionados - Contexto de Compras */}
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
                  onClick={() => {
                    setShowEditProdutosModal(false);
                    setShowProdutosModal(true);
                  }}
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
                  <p className="text-gray-500 text-lg">
                    Nenhum produto selecionado
                  </p>
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
                        <div className="font-medium text-slate-800 dark:text-gray-100">
                          {produto.descr}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          COD: {produto.codprod} | Marca: {produto.marca}
                        </div>
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-2 text-center">
                        <span className="text-slate-800 dark:text-gray-100">
                          {produto.quantidade}
                        </span>
                      </div>

                      {/* Preço Unitário */}
                      <div className="col-span-1 text-center">
                        <span className="text-slate-800 dark:text-gray-100">
                          R$ {(produto.preco_unitario || 0).toFixed(2)}
                        </span>
                      </div>

                      {/* Total */}
                      <div className="col-span-1 text-center">
                        <span className="font-medium text-slate-800 dark:text-gray-100">
                          R$ {(produto.preco_total || 0).toFixed(2)}
                        </span>
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
                Total Geral: R$ {produtosSelecionados
                  .filter((p, idx) => produtosMarcados.has(`${p.codprod}-${idx}`))
                  .reduce((total, p) => total + (p.preco_total || 0), 0)
                  .toFixed(2)}
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
}
