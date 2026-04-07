import React from 'react';

interface GruposProdutoTableProps {
  gruposProduto?: any[];
}

const GruposProdutoTable: React.FC<GruposProdutoTableProps> = ({ gruposProduto }) => {
  return (
    <div className="flex justify-center text-gray-700">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
        <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Código</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Exclusivo</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
        </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        { gruposProduto && gruposProduto.length > 0 ? (
          gruposProduto.map((grupo, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap">{grupo.codgpp}</td>
              <td className="px-6 py-4 whitespace-nowrap">{grupo.descr}</td>
              <td className="px-6 py-4 whitespace-nowrap">{grupo.exclusivo}</td>
              <td className="px-6 py-4 whitespace-nowrap">{grupo.acoes}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-6 py-4 whitespace-nowrap text-center" colSpan={3}>Vendedor não possui grupos de produto.</td>
          </tr>
        )}
        </tbody>
      </table>
    </div>
  );
}

export default GruposProdutoTable;