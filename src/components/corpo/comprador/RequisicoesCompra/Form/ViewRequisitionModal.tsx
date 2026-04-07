import React, { useEffect, useState } from 'react';
import { X, Building2, User, Calendar, Package, MapPin, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/components/services/api';
import type { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';

interface ViewRequisitionModalProps {
  isOpen: boolean;
  requisition: RequisitionDTO | null;
  onClose: () => void;
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

interface RequisitionItem {
  id: number;
  codprod: string;
  quantidade: string;
  preco_unitario: string;
  preco_total: string;
  observacao: string;
  base_indicacao: string;
  produto_nome?: string;
  produto_ref?: string;
  produto_marca_nome?: string;
  multiplo_compra?: number;
  produto?: {
    descr: string;
    marca?: string;
  };
}

export default function ViewRequisitionModal({
  isOpen,
  requisition,
  onClose,
}: ViewRequisitionModalProps) {
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
  const [items, setItems] = useState<RequisitionItem[]>([]);

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
      loadRequisitionItems();
    }
  }, [filiais, isOpen, requisition, loading]);

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

  const loadRequisitionData = async () => {
    if (!requisition) return;

    // Mapear campos com múltiplas possibilidades de nomes
    const fornecedorData = requisition.fornecedorCodigo ? {
      cod_credor: requisition.fornecedorCodigo,
      nome: requisition.fornecedorNome || '',
      cpf_cnpj: requisition.fornecedorCpfCnpj || ''
    } : null;

    // Para entrega e destino, mapear o nome da filial para o ID
    let entregaId = '';
    let destinoId = '';

    if (requisition.localEntrega && filiais.length > 0) {
      const filialEntrega = filiais.find(f => f.unm_nome === requisition.localEntrega);
      entregaId = filialEntrega ? filialEntrega.unm_id : '';
    } else if (requisition.entregaId) {
      entregaId = requisition.entregaId.toString();
    }

    if (requisition.destino && filiais.length > 0) {
      const filialDestino = filiais.find(f => f.unm_nome === requisition.destino);
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
      previsao_chegada: requisition.previsaoChegada ? 
        new Date(requisition.previsaoChegada).toISOString().split('T')[0] : '',
      condicoes_pagamento: requisition.condicoesPagamento || requisition.condPagto || '',
      observacao: requisition.observacao || '',
    };

    setFormData(formDataMapeado);
  };

  const loadRequisitionItems = async () => {
    if (!requisition?.requisicao) return;

    console.log('ViewModal - Carregando itens para requisição ID:', requisition.requisicao);
    
    try {
      const response = await api.get(`/api/requisicoesCompra/${requisition.requisicao}/items`);
      
      console.log('ViewModal - Resposta da API de itens:', response.data);
      
      if (response.data.success) {
        const itemsData = response.data.data || [];
        console.log('ViewModal - Itens carregados:', itemsData);
        setItems(itemsData);
      } else {
        console.log('ViewModal - API retornou erro:', response.data);
        setItems([]);
      }
    } catch (error) {
      console.error('ViewModal - Erro ao carregar itens da requisição:', error);
      setItems([]);
    }
  };

  const getTipoNome = (tipoId: string) => {
    if (!tipoId) return 'Não informado';

    // Busca exata pelo ID
    const tipo = tipos.find(t => t.id === tipoId);
    if (tipo) return tipo.nome;

    // Se não encontrar, tenta busca parcial (caso seja só 1 caractere)
    const tipoParcial = tipos.find(t => t.id.startsWith(tipoId.toUpperCase()));
    if (tipoParcial) return `${tipoParcial.nome} (${tipoParcial.id})`;

    // Fallback: mostra o código com aviso
    return `Tipo inválido: ${tipoId}`;
  };

  const getFilialNome = (filialId: string) => {
    const filial = filiais.find(f => f.unm_id === filialId);
    return filial ? filial.unm_nome : filialId;
  };

  if (!isOpen || !requisition) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-between items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0">
            <h4 className="text-xl font-bold text-[#347AB6]">
              Visualizar Requisição de Compra - {requisition.requisicao}
            </h4>
          </header>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-100 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Carregando dados...</p>
              </div>
            ) : (
              <>
                {/* Primeira linha - Tipo, Comprador, Entrega, Destino */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Tipo da Requisição
                    </Label>
                    <Input
                      value={getTipoNome(formData.tipo)}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Comprador
                    </Label>
                    <Input
                      value={formData.comprador_nome}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Entrega em
                    </Label>
                    <Input
                      value={getFilialNome(formData.entrega_em)}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Destinado para
                    </Label>
                    <Input
                      value={getFilialNome(formData.destinado_para)}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                {/* Fornecedor */}
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4" />
                    Fornecedor
                  </Label>
                  <Input
                    value={formData.fornecedor ? `${formData.fornecedor.cod_credor} - ${formData.fornecedor.nome}` : ''}
                    readOnly
                    className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                  />
                </div>

                {/* Datas e Condições */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Previsão de Chegada
                    </Label>
                    <Input
                      value={formData.previsao_chegada}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Condições de Pagamento
                    </Label>
                    <Input
                      value={formData.condicoes_pagamento}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                {/* Observação */}
                <div>
                  <Label className="text-sm font-medium">
                    Observação
                  </Label>
                  <Textarea
                    value={formData.observacao}
                    readOnly
                    rows={3}
                    className="mt-1 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-gray-700"
                  />
                </div>

                {/* Tabela de Itens */}
                {items.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Itens da Requisição ({items.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-zinc-700">
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Código</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Referência</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Descrição</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Marca</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Sugestão</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Quantidade</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Múltiplo</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Preço Unit.</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Preço Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-gray-50 dark:hover:bg-zinc-600">
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono">
                                {item.codprod}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                                {item.produto_ref || '-'}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                                {item.produto_nome || item.produto?.descr || '-'}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                                {item.produto_marca_nome || item.produto?.marca || '-'}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                {item.base_indicacao === 'SUGESTAO' ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Sim
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                    Não
                                  </span>
                                )}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">
                                {parseFloat(item.quantidade).toFixed(3)}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                                {item.multiplo_compra || 1}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">
                                R$ {parseFloat(item.preco_unitario).toFixed(2)}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-semibold">
                                R$ {parseFloat(item.preco_total).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 dark:bg-zinc-700 font-semibold">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2" colSpan={8}>
                              Total Geral:
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right">
                              R$ {items.reduce((total, item) => total + parseFloat(item.preco_total), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}