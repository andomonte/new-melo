// components/TableProd.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { FaPlus } from 'react-icons/fa';

interface ProdutoDisplay {
  // Renomeie para ProdutoApiDisplay ou remova essa interface e use ProdutoAPI diretamente se for o mesmo
  codprod: string; // <-- AGORA EM MINÚSCULAS
  descr: string; // <-- AGORA EM MINÚSCULAS
  marca: string; // <-- AGORA EM MINÚSCULAS
  qtest: number; // <-- AGORA EM MINÚSCULAS (corresponde a qtest de ProdutoAPI)
  prvenda: number; // <-- AGORA EM MINÚSCULAS (corresponde a prvenda de ProdutoAPI)
  ref: string; // <-- AGORA EM MINÚSCULAS
  codgpe?: string;
  dolar?: string; // Adicione se necessário
}

interface TableProdProps {
  listaProd: ProdutoDisplay[]; // AGORA ProdutoDisplay deve ser compatível com o que vem da API
  produtoSelecionado: (index: number) => void;
  onAddProduct: (product: ProdutoDisplay) => void;
}

const TableProd: React.FC<TableProdProps> = ({
  listaProd,
  produtoSelecionado,
  onAddProduct,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Código
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Descrição
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Marca
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estoque
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Preço
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ação
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {listaProd.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
              >
                Nenhum produto para exibir.
              </td>
            </tr>
          ) : (
            listaProd.map((produto, index) => (
              <tr key={produto.codprod} className="hover:bg-gray-100">
                {' '}
                {/* Use codprod */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {produto.codprod}
                </td>{' '}
                {/* Use codprod */}
                <td
                  className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 cursor-pointer hover:underline"
                  onClick={() => produtoSelecionado(index)}
                >
                  {produto.descr} {/* Use descr */}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {produto.marca}
                </td>{' '}
                {/* Use marca */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {produto.qtest}
                </td>{' '}
                {/* Use qtest */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  R$ {produto.prvenda?.toFixed(2).replace('.', ',')}
                </td>{' '}
                {/* Use prvenda */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAddProduct(produto)}
                    title="Adicionar ao Carrinho"
                  >
                    <FaPlus className="h-4 w-4 text-green-500" />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TableProd;
