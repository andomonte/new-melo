// /src/components/corpo/vendas/centralVendas/ModalVerItensVenda.tsx

import React from 'react';
import { Venda, ItemVenda, ItemVendaSalva } from '@/data/vendas/vendas';
import { X } from 'lucide-react';

interface ModalVerItensVendaProps {
  isOpen: boolean;
  onClose: () => void;
  venda: Venda | null;
}

// Funções utilitárias para formatação de valores
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const ModalVerItensVenda: React.FC<ModalVerItensVendaProps> = ({
  isOpen,
  onClose,
  venda,
}) => {
  if (!isOpen || !venda) return null;

  // Acessando a propriedade correta 'dbitvenda' que vem da API.
  // Garante que 'itens' seja sempre um array para evitar erros de runtime.
  const itens = venda.dbitvenda || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[96vw] h-[90vh] flex flex-col p-6">
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Itens da Venda: {venda.codvenda}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Fechar modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Corpo - Tabela de Itens */}
        <div className="flex-grow overflow-hidden mt-6">
          {itens.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-300 py-10">
              <p>Nenhum item associado a esta venda.</p>
            </div>
          ) : (
            <div className="overflow-auto h-full pr-2">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Preço Unitário
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Desconto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total do Item
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                  {itens.map((item: ItemVenda | ItemVendaSalva) => {
                    // Cálculo seguro dos valores, usando Number para garantir
                    const quantidade = Number(item.qtd);
                    const precoUnitario = Number(item.prunit);
                    const desconto = Number(item.desconto || 0);
                    const totalItem = precoUnitario * quantidade - desconto;

                    // Dados do produto relacionados
                    const produto = item.dbprod;
                    // A imagem de origem só deve ser exibida se 'origem' existir no produto
                    const origemImagem =
                      produto?.origem === 'N'
                        ? '/images/brasil.png'
                        : '/images/importado.png';
                    const produtoQtest =
                      produto?.qtest != null ? Number(produto.qtest) : null;
                    const produtoPrVenda =
                      item?.prunit != null ? Number(item?.prunit) : null;
                    return (
                      <tr
                        key={`${item.codvenda}-${item.codprod}`}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                          <div className="flex items-center gap-3">
                            {produto?.origem && ( // Condicionalmente renderiza a imagem
                              <img
                                src={origemImagem}
                                alt="origem do produto"
                                className="w-6 h-auto object-contain"
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="text-gray-800 dark:text-gray-100 font-semibold text-base">
                                {produto?.descr ||
                                  item.descr ||
                                  'Produto sem descrição'}
                              </span>
                              <span className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                                Cód Prod: {item.codprod ?? '-'}
                                {' | '}
                                Estoque: {/* Usa produtoQtest aqui */}
                                {produtoQtest != null ? produtoQtest : '-'}
                                {' | '}
                                Marca: {produto?.dbmarcas?.descr || '-'}
                                {' | '}
                                {formatCurrency(produtoPrVenda)}{' '}
                                {/* Usa produtoPrVenda aqui */}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                          {quantidade ?? '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                          {formatCurrency(precoUnitario)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                          {desconto > 0 ? formatCurrency(desconto) : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-600 dark:text-blue-400 font-bold">
                          {formatCurrency(totalItem)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalVerItensVenda;
