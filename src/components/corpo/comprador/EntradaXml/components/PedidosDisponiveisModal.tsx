import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Plus, Minus, Calculator, Loader2, Package, Settings, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buscarPedidosDisponiveis, PedidoCompraDisponivel } from '../services/entradaConfigService';
import { useMultiploCompras } from '../hooks/useMultiploCompras';
import { MultiploComprasModal } from './MultiploComprasModal';
import { CentroCustoModal } from './CentroCustoModal';
import { toast } from 'sonner';

interface PedidosDisponiveisModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    nfeItemId: string;
    produtoId: string;
    produtoDescricao: string;
    quantidade: number;
    valorUnitario: number;
    produtoTipo?: string; // MC = Material de Consumo
  };
  onConfirm: (associacoes: any[], configExtra?: ConfiguracaoExtra) => void;
  associacoesExistentes?: AssociacaoTemp[]; // Para modo edição
  configExistente?: ConfiguracaoExtra; // Config de rateio/meia nota existente
  fornecedorCnpj?: string; // Filtrar ordens apenas do fornecedor da NFe
  ordemIdSelecionada?: string; // Filtrar pela ordem específica (quando vem da correspondência automática)
}

interface ConfiguracaoExtra {
  meiaNota: boolean;
  precoUnitarioNF?: number;
  rateio: string;
  criterioRateio?: string;
  centroCusto?: string;
}

interface OrdemCompraDisponivel {
  id: string;
  codigo_requisicao: string;
  filial: string;
  fornecedor: string;
  produto_id: string;
  produto_descricao: string;
  quantidade_pedida: number;
  quantidade_disponivel: number;
  valor_unitario: string | number;
  data_previsao?: string;
}

interface AssociacaoTemp {
  pedidoId: string;
  quantidade: number;
  valorUnitario: number;
}

export const PedidosDisponiveisModal: React.FC<PedidosDisponiveisModalProps> = ({
  isOpen,
  onClose,
  item,
  onConfirm,
  associacoesExistentes,
  configExistente,
  fornecedorCnpj,
  ordemIdSelecionada
}) => {
  const [ordensDisponiveis, setOrdensDisponiveis] = useState<OrdemCompraDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [associacoesTemp, setAssociacoesTemp] = useState<AssociacaoTemp[]>([]);
  const [showMultiploModal, setShowMultiploModal] = useState(false);
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemCompraDisponivel | null>(null);

  // Estados para configuração extra (rateio/meia nota)
  const [showConfigSection, setShowConfigSection] = useState(false);
  const [meiaNota, setMeiaNota] = useState(false);
  const [precoUnitarioNF, setPrecoUnitarioNF] = useState<number | undefined>(undefined);
  const [rateio, setRateio] = useState(false);
  const [criterioRateio, setCriterioRateio] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [centroCustoDescr, setCentroCustoDescr] = useState('');
  const [showCentroCustoModal, setShowCentroCustoModal] = useState(false);

  const isMaterialConsumo = item.produtoTipo === 'MC';

  const { alterarQuantidadeOrdem } = useMultiploCompras();

  const carregarOrdensDisponiveis = async () => {
    if (!isOpen || !item.produtoId) return;

    setLoading(true);
    try {
      // Construir URL com parâmetros de filtro
      const params = new URLSearchParams();
      if (fornecedorCnpj) {
        params.append('fornecedorCnpj', fornecedorCnpj);
      }
      if (ordemIdSelecionada) {
        params.append('ordemId', ordemIdSelecionada);
      }

      const queryString = params.toString();
      const url = `/api/entrada-xml/pedidos-disponiveis/${item.produtoId}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        setOrdensDisponiveis(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar ordens disponíveis:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarOrdensDisponiveis();
  }, [isOpen, item.produtoId, fornecedorCnpj, ordemIdSelecionada]);

  // Inicializar com associações existentes quando for modo edição
  useEffect(() => {
    if (isOpen && associacoesExistentes && associacoesExistentes.length > 0) {
      setAssociacoesTemp(associacoesExistentes);
    } else if (isOpen) {
      // Limpar associações quando abrir em modo novo
      setAssociacoesTemp([]);
    }
  }, [isOpen, associacoesExistentes]);

  // Inicializar config existente
  useEffect(() => {
    if (isOpen && configExistente) {
      setMeiaNota(configExistente.meiaNota);
      setPrecoUnitarioNF(configExistente.precoUnitarioNF);
      setRateio(configExistente.rateio === 'S');
      setCriterioRateio(configExistente.criterioRateio || '');
      setCentroCusto(configExistente.centroCusto || '');
      setShowConfigSection(true);
    } else if (isOpen) {
      // Reset config
      setMeiaNota(false);
      setPrecoUnitarioNF(undefined);
      setRateio(false);
      setCriterioRateio('');
      setCentroCusto('');
      setCentroCustoDescr('');
      // Mostrar seção de config se for Material de Consumo
      setShowConfigSection(isMaterialConsumo);
    }
  }, [isOpen, configExistente, isMaterialConsumo]);

  const quantidadeTotalAssociada = associacoesTemp.reduce((sum, assoc) => sum + assoc.quantidade, 0);
  const quantidadeRestante = item.quantidade - quantidadeTotalAssociada;

  const handleQuantidadeChange = (pedidoId: string, novaQuantidade: number) => {
    setAssociacoesTemp(prev => {
      const existingIndex = prev.findIndex(a => a.pedidoId === pedidoId);

      if (novaQuantidade <= 0) {
        return prev.filter(a => a.pedidoId !== pedidoId);
      }

      const ordem = ordensDisponiveis.find(o => o.id === pedidoId);
      if (!ordem) return prev;

      const valorUnitario = typeof ordem.valor_unitario === 'number'
        ? ordem.valor_unitario
        : parseFloat(ordem.valor_unitario || '0');

      const novaAssociacao = {
        pedidoId,
        quantidade: Math.min(novaQuantidade, ordem.quantidade_disponivel, quantidadeRestante + (existingIndex >= 0 ? prev[existingIndex].quantidade : 0)),
        valorUnitario
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = novaAssociacao;
        return updated;
      }

      return [...prev, novaAssociacao];
    });
  };

  const getQuantidadeAssociada = (pedidoId: string) => {
    return associacoesTemp.find(a => a.pedidoId === pedidoId)?.quantidade || 0;
  };

  const handleMultiploCompras = (ordem: OrdemCompraDisponivel) => {
    setSelectedOrdem(ordem);
    setShowMultiploModal(true);
  };

  const handleSelectCentroCusto = (centro: { cod_ccusto: string; descr: string }) => {
    setCentroCusto(centro.cod_ccusto);
    setCentroCustoDescr(centro.descr);
  };

  const confirmarAssociacoes = () => {
    if (associacoesTemp.length === 0 || quantidadeRestante !== 0) return;

    // Validar configuração se for Material de Consumo
    if (isMaterialConsumo) {
      if (rateio && !criterioRateio) {
        toast.error('Critério de Rateio é obrigatório quando Rateio está marcado');
        return;
      }
      if (!rateio && !centroCusto) {
        toast.error('Centro de Custo é obrigatório para Material de Consumo');
        return;
      }
    }

    // Validar Meia Nota
    if (meiaNota && (!precoUnitarioNF || precoUnitarioNF <= 0)) {
      toast.error('Preço Unitário é obrigatório quando Meia Nota está marcado');
      return;
    }

    const associacoesFormatadas = associacoesTemp.map(assoc => ({
      pedidoId: assoc.pedidoId,
      quantidade: assoc.quantidade,
      valorUnitario: assoc.valorUnitario
    }));

    const configExtra: ConfiguracaoExtra = {
      meiaNota,
      precoUnitarioNF: meiaNota ? precoUnitarioNF : undefined,
      rateio: rateio ? 'S' : 'N',
      criterioRateio: rateio ? criterioRateio : undefined,
      centroCusto: !rateio ? centroCusto : undefined
    };

    onConfirm(associacoesFormatadas, configExtra);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <style>{`
        /* Remover setas dos inputs numéricos */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Ordens Disponíveis
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {item.produtoDescricao} - Quantidade: {item.quantidade}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Carregando ordens...</span>
            </div>
          ) : ordensDisponiveis.length === 0 ? (
            <div className="text-center py-8">
              <Package size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhuma ordem encontrada para este produto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordensDisponiveis.map((ordem) => (
                <div key={ordem.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {ordem.codigo_requisicao}
                          </p>
                          <p className="text-sm text-gray-500">
                            {ordem.fornecedor} • Filial: {ordem.filial}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Disponível: {ordem.quantidade_disponivel}</p>
                          <p className="text-sm font-medium text-green-600">
                            R$ {typeof ordem.valor_unitario === 'number'
                              ? ordem.valor_unitario.toFixed(2)
                              : parseFloat(ordem.valor_unitario || '0').toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* Múltiplo de Compras */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMultiploCompras(ordem)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <Calculator size={16} className="mr-1" />
                        Múltiplo
                      </Button>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center border border-gray-300 rounded-md">
                        <button
                          onClick={() => handleQuantidadeChange(ordem.id, getQuantidadeAssociada(ordem.id) - 1)}
                          className="p-1 hover:bg-gray-100 disabled:opacity-50"
                          disabled={getQuantidadeAssociada(ordem.id) <= 0}
                        >
                          <Minus size={16} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          max={Math.min(ordem.quantidade_disponivel, quantidadeRestante + getQuantidadeAssociada(ordem.id))}
                          value={getQuantidadeAssociada(ordem.id)}
                          onChange={(e) => handleQuantidadeChange(ordem.id, parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-1 text-center border-0 bg-transparent focus:outline-none text-base font-medium"
                        />

                        <button
                          onClick={() => handleQuantidadeChange(ordem.id, getQuantidadeAssociada(ordem.id) + 1)}
                          className="p-1 hover:bg-gray-100 disabled:opacity-50"
                          disabled={getQuantidadeAssociada(ordem.id) >= Math.min(ordem.quantidade_disponivel, quantidadeRestante + getQuantidadeAssociada(ordem.id))}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumo */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-700 rounded-lg">
            <h5 className="font-medium mb-2">Resumo</h5>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Total NFe:</span>
                <span className="font-medium ml-2">{item.quantidade}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Associado:</span>
                <span className="font-medium ml-2 text-blue-600">{quantidadeTotalAssociada}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Restante:</span>
                <span className={`font-medium ml-2 ${quantidadeRestante === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {quantidadeRestante}
                </span>
              </div>
            </div>
          </div>

          {/* Seção de Configuração (Rateio/Meia Nota) */}
          <div className="mt-4 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowConfigSection(!showConfigSection)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-gray-500" />
                <span className="font-medium text-sm">Configurações Adicionais</span>
                {isMaterialConsumo && (
                  <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                    Material de Consumo
                  </span>
                )}
              </div>
              <ChevronDown size={16} className={`text-gray-500 transition-transform ${showConfigSection ? 'rotate-180' : ''}`} />
            </button>

            {showConfigSection && (
              <div className="p-4 space-y-4 bg-white dark:bg-zinc-800">
                {/* Meia Nota */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="meiaNota"
                    checked={meiaNota}
                    onCheckedChange={(checked) => {
                      setMeiaNota(!!checked);
                      if (checked) {
                        setPrecoUnitarioNF(item.valorUnitario);
                      } else {
                        setPrecoUnitarioNF(undefined);
                      }
                    }}
                  />
                  <div className="flex-1">
                    <Label htmlFor="meiaNota" className="text-sm font-medium cursor-pointer">
                      Meia Nota
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Quantidade = pedido, preço diferente da NF
                    </p>
                    {meiaNota && (
                      <div className="mt-2">
                        <Label className="text-xs text-gray-600">Preço Unitário Real:</Label>
                        <input
                          type="number"
                          step="0.01"
                          min={item.valorUnitario}
                          value={precoUnitarioNF || ''}
                          onChange={(e) => setPrecoUnitarioNF(parseFloat(e.target.value) || undefined)}
                          className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-zinc-700 focus:ring-1 focus:ring-blue-500"
                          placeholder={`Mínimo: ${item.valorUnitario.toFixed(2)}`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Rateio */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="rateio"
                    checked={rateio}
                    onCheckedChange={(checked) => {
                      setRateio(!!checked);
                      if (checked) {
                        setCentroCusto('');
                        setCentroCustoDescr('');
                      } else {
                        setCriterioRateio('');
                      }
                    }}
                  />
                  <div className="flex-1">
                    <Label htmlFor="rateio" className="text-sm font-medium cursor-pointer">
                      Rateio
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Distribuir custo entre centros
                    </p>
                  </div>
                </div>

                {/* Critério de Rateio (quando rateio marcado) */}
                {rateio && (
                  <div className="ml-7">
                    <Label className={`text-sm ${isMaterialConsumo ? 'font-medium' : ''}`}>
                      Critério de Rateio {isMaterialConsumo && <span className="text-red-500">*</span>}
                    </Label>
                    <Select value={criterioRateio} onValueChange={setCriterioRateio}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QTD_FUNC">Por Qtd. Funcionários</SelectItem>
                        <SelectItem value="METROS">Por Metragem</SelectItem>
                        <SelectItem value="IGUAL">Divisão Igual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Centro de Custo (quando rateio NÃO marcado) */}
                {!rateio && (
                  <div className="ml-7">
                    <Label className={`text-sm ${isMaterialConsumo ? 'font-medium' : ''}`}>
                      Centro de Custo {isMaterialConsumo && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={centroCusto ? `${centroCusto} - ${centroCustoDescr}` : ''}
                        readOnly
                        placeholder="Selecione..."
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-zinc-700 cursor-pointer"
                        onClick={() => setShowCentroCustoModal(true)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCentroCustoModal(true)}
                      >
                        <Search size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600">
          <Button variant="outline" onClick={onClose}>
            <X size={16} className="mr-2" />
            Cancelar
          </Button>

          <div className="flex items-center space-x-3">
            {quantidadeRestante > 0 && (
              <span className="text-sm text-red-600">
                Faltam {quantidadeRestante} unidades para associar
              </span>
            )}
            <Button
              onClick={confirmarAssociacoes}
              disabled={quantidadeRestante !== 0 || associacoesTemp.length === 0}
              className={quantidadeRestante === 0 && associacoesTemp.length > 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-400 cursor-not-allowed text-white'
              }
            >
              <CheckCircle size={16} className="mr-2" />
              {quantidadeRestante === 0
                ? `Confirmar Associações (${associacoesTemp.length})`
                : `Pendente (${quantidadeTotalAssociada}/${item.quantidade})`
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Múltiplo de Compras */}
      {showMultiploModal && selectedOrdem && (
        <MultiploComprasModal
          isOpen={showMultiploModal}
          onClose={() => {
            setShowMultiploModal(false);
            setSelectedOrdem(null);
          }}
          ordem={selectedOrdem}
          onConfirm={async () => {
            setShowMultiploModal(false);
            setSelectedOrdem(null);
            // Recarregar ordens após alteração
            await carregarOrdensDisponiveis();
          }}
        />
      )}

      {/* Modal de Centro de Custo */}
      {showCentroCustoModal && (
        <CentroCustoModal
          isOpen={showCentroCustoModal}
          onClose={() => setShowCentroCustoModal(false)}
          onSelect={handleSelectCentroCusto}
        />
      )}
    </div>
  );
};