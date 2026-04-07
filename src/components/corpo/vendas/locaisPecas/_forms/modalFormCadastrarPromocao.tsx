// src/pages/_forms/modalFormCadastrarPromocao.tsx

import React, { useRef, useEffect } from 'react'; // Importe useRef e useEffect
import { TiShoppingCart } from 'react-icons/ti';
import { Promocao, ItemPromocao } from '@/data/promocoes/promocoes';
import { X, Plus, Pencil } from 'lucide-react';
import FormInput from '@/components/common/FormInput'; // Certifique-se de que este FormInput suporta `ref`
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';
import SearchSelectInput from '@/components/common/SearchSelectInput';

import ModalViewPromocaoItems from './ModalViewPromocaoItems';

interface ModalFormCadastrarPromocaoProps {
  titulo: string;
  handleSubmit: () => void;
  handleClear: () => void;
  handlePromocaoChange: (updatedFields: Partial<Promocao>) => void;
  onClose: () => void;
  promocao: Promocao;
  error: { [key: string]: string };
  isSaving: boolean;
  loading?: boolean;
  isFormValid: boolean;
  onOpenAdicionarItensModal: (maxQuantity?: number | null) => void;
  itensAdicionados: ItemPromocao[];
  onRemoveItemPromocao: (codigo: string) => void;
  houveAlteracoesNosItens?: boolean;
  onChangeItensAdicionados?: (novosItens: ItemPromocao[]) => void;
}

const ModalFormCadastrarPromocao: React.FC<ModalFormCadastrarPromocaoProps> = ({
  titulo,
  handleSubmit,
  handleClear,
  handlePromocaoChange,
  onClose,
  itensAdicionados,
  promocao,
  error,
  isSaving,
  loading = false,
  isFormValid,
  onOpenAdicionarItensModal,
  onChangeItensAdicionados,
}) => {
  const [isViewItemsModalOpen, setIsViewItemsModalOpen] = React.useState(false);
  // Inicialize o estado do checkbox com base na existência de qtde_maxima_total
  const [isEstoqueControlActive, setIsEstoqueControlActive] = React.useState(
    promocao.qtde_maxima_total !== undefined &&
      promocao.qtde_maxima_total !== null,
  );
  const [itensEditados, setItensEditados] = React.useState<ItemPromocao[]>([]);

  useEffect(() => {
    setItensEditados(itensAdicionados);
  }, [itensAdicionados]);

  useEffect(() => {
    if (promocao && promocao.tipo_promocao !== 'PROD') {
      handlePromocaoChange({ tipo_promocao: 'PROD' });
    }
  }, [handlePromocaoChange, promocao]);
  // Crie uma referência para o input qtde_maxima_total
  const qtdeMaximaTotalRef = useRef<HTMLInputElement>(null);

  // Sincronize o estado local do checkbox com a prop promocao.qtde_maxima_total
  React.useEffect(() => {
    setIsEstoqueControlActive(
      promocao.qtde_maxima_total !== undefined &&
        promocao.qtde_maxima_total !== null,
    );
  }, [promocao.qtde_maxima_total]);

  // Use useEffect para focar no input quando isEstoqueControlActive se torna true
  useEffect(() => {
    if (isEstoqueControlActive && qtdeMaximaTotalRef.current) {
      qtdeMaximaTotalRef.current.focus();
    }
  }, [isEstoqueControlActive]); // Execute este efeito sempre que isEstoqueControlActive mudar

  const tipoDescontoOptions = [
    { value: 'PERC', label: '% Percentual' },
    { value: 'VALO', label: 'Valor Fixo' },
    { value: 'PREF', label: 'Preço Final' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo - Replicando o padrão FormBancoContainer */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">{titulo}</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter
              onSubmit={handleSubmit}
              onClear={handleClear}
              isSaving={isSaving}
              hasChanges={isFormValid}
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
              disabled={isSaving}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          {loading ? (
            <Carregamento />
          ) : (
            <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 w-full mx-auto">
              {/* Grid geral responsivo */}
              {/* Agrupamento para Nome + Datas */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Nome da Promoção (40%) */}
                <div className="w-full ">
                  <FormInput
                    autoComplete="off"
                    name="nome_promocao"
                    type="text"
                    label="Nome da Promoção"
                    defaultValue={promocao.nome_promocao || ''}
                    onChange={(e) =>
                      handlePromocaoChange({ nome_promocao: e.target.value })
                    }
                    error={error.nome_promocao}
                    required
                    disabled={isSaving}
                    maxLength={100}
                  />
                </div>

                {/* Data de Início (30%) */}
                <div className="w-full ">
                  <label htmlFor="data_inicio" className="text-sm font-medium">
                    Data de Início <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="data_inicio"
                    className="mt-1 w-full rounded-md shadow-sm p-2 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500"
                    value={
                      promocao.data_inicio
                        ? promocao.data_inicio.slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      handlePromocaoChange({ data_inicio: e.target.value })
                    }
                    disabled={isSaving}
                    required
                  />
                </div>

                {/* Data de Fim (30%) */}
                <div className="w-full ">
                  <label htmlFor="data_fim" className="text-sm font-medium">
                    Data de Fim <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="data_fim"
                    className="mt-1 w-full rounded-md shadow-sm p-2 border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500"
                    value={
                      promocao.data_fim ? promocao.data_fim.slice(0, 16) : ''
                    }
                    onChange={(e) =>
                      handlePromocaoChange({ data_fim: e.target.value })
                    }
                    disabled={isSaving}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Qtde Máxima Total + checkbox */}
                <div className="w-full">
                  <label className="text-sm font-medium">
                    Quantidade Total
                  </label>
                  <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden h-[42px]">
                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          qtde_maxima_total: Math.max(
                            (promocao.qtde_maxima_total || 0) - 1,
                            0,
                          ),
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      -
                    </button>

                    <input
                      type="text"
                      className="w-full h-full text-center appearance-none bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 outline-none "
                      value={
                        promocao.qtde_maxima_total !== null &&
                        promocao.qtde_maxima_total !== undefined
                          ? promocao.qtde_maxima_total.toString()
                          : ''
                      }
                      onChange={(e) => {
                        const onlyNumbers = e.target.value.replace(/\D/g, '');
                        handlePromocaoChange({
                          qtde_maxima_total: onlyNumbers
                            ? parseInt(onlyNumbers, 10)
                            : null,
                        });
                      }}
                      onFocus={(e) => {
                        // Permite foco e seleciona tudo se houver valor
                        setTimeout(() => {
                          if (e.target.value) e.target.select();
                        }, 0);
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          qtde_maxima_total:
                            (promocao.qtde_maxima_total || 0) + 1,
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {error.qtde_maxima_total && (
                    <p className="text-sm text-red-600 mt-1">
                      {error.qtde_maxima_total}
                    </p>
                  )}
                </div>

                <div className="w-full">
                  <label className="text-sm font-medium">
                    Qtde. Máxima por Cliente
                  </label>
                  <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden h-[42px]">
                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          qtde_maxima_por_cliente: Math.max(
                            (promocao.qtde_maxima_por_cliente || 0) - 1,
                            0,
                          ),
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      -
                    </button>

                    <input
                      type="text"
                      className="w-full h-full text-center appearance-none bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 outline-none "
                      value={
                        promocao.qtde_maxima_por_cliente !== null &&
                        promocao.qtde_maxima_por_cliente !== undefined
                          ? promocao.qtde_maxima_por_cliente.toString()
                          : ''
                      }
                      onChange={(e) => {
                        const onlyNumbers = e.target.value.replace(/\D/g, '');
                        handlePromocaoChange({
                          qtde_maxima_por_cliente: onlyNumbers
                            ? parseInt(onlyNumbers, 10)
                            : null,
                        });
                      }}
                      onFocus={(e) => {
                        setTimeout(() => {
                          if (e.target.value) e.target.select();
                        }, 0);
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          qtde_maxima_por_cliente:
                            (promocao.qtde_maxima_por_cliente || 0) + 1,
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {error.qtde_maxima_por_cliente && (
                    <p className="text-sm text-red-600 mt-1">
                      {error.qtde_maxima_por_cliente}
                    </p>
                  )}
                </div>

                <div className="w-full">
                  <label className="text-sm font-medium">
                    Qtde. Mínima Ativação
                  </label>
                  <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden h-[42px]">
                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          qtde_minima_ativacao: Math.max(
                            (promocao.qtde_minima_ativacao || 0) - 1,
                            0,
                          ),
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      -
                    </button>

                    <input
                      type="text"
                      className="w-full h-full text-center appearance-none bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 outline-none "
                      value={
                        promocao.qtde_minima_ativacao !== null &&
                        promocao.qtde_minima_ativacao !== undefined
                          ? promocao.qtde_minima_ativacao.toString()
                          : ''
                      }
                      onChange={(e) => {
                        const onlyNumbers = e.target.value.replace(/\D/g, '');
                        handlePromocaoChange({
                          qtde_minima_ativacao: onlyNumbers
                            ? parseInt(onlyNumbers, 10)
                            : undefined,
                        });
                      }}
                      onFocus={(e) => {
                        setTimeout(() => {
                          if (e.target.value) e.target.select();
                        }, 0);
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          qtde_minima_ativacao:
                            (promocao.qtde_minima_ativacao || 0) + 1,
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {error.qtde_minima_ativacao && (
                    <p className="text-sm text-red-600 mt-1">
                      {error.qtde_minima_ativacao}
                    </p>
                  )}
                </div>

                <div className=" w-full">
                  {/* Tipo de Desconto */}
                  <SearchSelectInput
                    name="tipo_desconto"
                    label="Tipo de Desconto"
                    options={tipoDescontoOptions}
                    value={promocao.tipo_desconto}
                    onValueChange={(value) =>
                      handlePromocaoChange({
                        tipo_desconto: value as 'PERC' | 'VALO' | 'PREF',
                      })
                    }
                    error={error.tipo_desconto}
                    required
                    disabled={isSaving}
                  />
                </div>

                <div className="w-full">
                  <label className="text-sm font-medium">
                    Valor do Desconto
                  </label>
                  <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden h-[42px]">
                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          valor_desconto: Math.max(
                            (promocao.valor_desconto || 0) - 1,
                            0,
                          ),
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      -
                    </button>

                    <input
                      type="text"
                      className="w-full h-full text-center appearance-none bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 outline-none "
                      value={
                        promocao.valor_desconto !== null &&
                        promocao.valor_desconto !== undefined
                          ? promocao.valor_desconto.toString()
                          : ''
                      }
                      onChange={(e) => {
                        const onlyNumbers = e.target.value.replace(
                          /[^\d.]/g,
                          '',
                        );
                        handlePromocaoChange({
                          valor_desconto: onlyNumbers
                            ? parseFloat(onlyNumbers)
                            : undefined,
                        });
                      }}
                      onFocus={(e) => {
                        setTimeout(() => {
                          if (e.target.value) e.target.select();
                        }, 0);
                      }}
                    />

                    <span className="px-2 text-sm text-gray-500 dark:text-gray-300">
                      {promocao.tipo_desconto === 'PERC' ? '%' : 'R$'}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handlePromocaoChange({
                          valor_desconto: (promocao.valor_desconto || 0) + 1,
                        })
                      }
                      className="w-10 h-full bg-gray-200 dark:bg-zinc-900 hover:bg-gray-300 dark:hover:bg-zinc-600 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {error.valor_desconto && (
                    <p className="text-sm text-red-600 mt-1">
                      {error.valor_desconto}
                    </p>
                  )}
                </div>

                <div className="w-full">
                  {/* Simula a altura do label dos inputs */}
                  <div className="text-sm font-medium h-[20px]">&nbsp;</div>

                  <div className="flex items-center gap-3 h-[42px]">
                    {promocao.tipo_promocao === 'PROD' && (
                      <>
                        {/* Botão azul - sem contador */}
                        <button
                          type="button"
                          onClick={() =>
                            onOpenAdicionarItensModal(
                              promocao.qtde_maxima_total,
                            )
                          }
                          disabled={isSaving}
                          title="Adicionar itens à promoção"
                          className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800 flex items-center justify-center h-[42px] relative"
                        >
                          <TiShoppingCart className="h-5 w-5" />
                          <Plus className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-white border border-gray-400 dark:border-gray-600 rounded-full bg-blue-600 dark:bg-blue-700" />
                        </button>

                        {/* Botão verde - com contador e Pencil */}
                        {itensAdicionados.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsViewItemsModalOpen(true)}
                            disabled={isSaving}
                            title="Ver itens adicionados"
                            className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:bg-green-700 dark:hover:bg-green-800 flex items-center justify-center h-[42px] relative"
                          >
                            <Pencil className="h-4 w-4 ml-1" />
                            <span className="absolute -top-1 -left-0.5 h-4 w-4 text-white text-xs flex items-center justify-center border border-gray-400 dark:border-gray-600 rounded-full bg-red-600 dark:bg-red-700">
                              {itensAdicionados.length}
                            </span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Descrição e Observações - responsivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Descrição */}
                <div>
                  <label
                    htmlFor="descricao_promocao"
                    className="text-sm font-medium"
                  >
                    Descrição
                  </label>
                  <textarea
                    id="descricao_promocao"
                    rows={3}
                    className="mt-1 block w-full rounded-md shadow-sm p-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                    value={promocao.descricao_promocao || ''}
                    onChange={(e) =>
                      handlePromocaoChange({
                        descricao_promocao: e.target.value,
                      })
                    }
                    disabled={isSaving}
                    maxLength={255}
                  />
                  {error.descricao_promocao && (
                    <p className="mt-1 text-sm text-red-600">
                      {error.descricao_promocao}
                    </p>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label htmlFor="observacoes" className="text-sm font-medium">
                    Observações
                  </label>
                  <textarea
                    id="observacoes"
                    rows={3}
                    className="mt-1 block w-full rounded-md shadow-sm p-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                    value={promocao.observacoes || ''}
                    onChange={(e) =>
                      handlePromocaoChange({ observacoes: e.target.value })
                    }
                    disabled={isSaving}
                    maxLength={500}
                  />
                  {error.observacoes && (
                    <p className="mt-1 text-sm text-red-600">
                      {error.observacoes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para visualizar e remover itens */}
      {isViewItemsModalOpen && (
        <ModalViewPromocaoItems
          itens={itensEditados}
          onClose={() => setIsViewItemsModalOpen(false)}
          onConfirm={(novosItens) => {
            setItensEditados(novosItens); // Atualiza visualmente
            onChangeItensAdicionados?.(novosItens); // ✅ Atualiza o estado real no componente pai
            setIsViewItemsModalOpen(false); // Fecha o modal
          }}
        />
      )}
    </div>
  );
};

export default ModalFormCadastrarPromocao;
