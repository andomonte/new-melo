import React, { useState } from 'react';
import { Produto } from '@/data/produtos/produtos';

interface ReferenciaItem {
  id: string;
  codigo: string;
  referencia: string;
  marca: string;
}

interface ReferenciaFabricaProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

const ReferenciaFabrica: React.FC<ReferenciaFabricaProps> = ({
  produto: _produto,
  handleProdutoChange: _handleProdutoChange,
  error,
}) => {
  const [referencias, setReferencias] = useState<ReferenciaItem[]>([
    {
      id: '1',
      codigo: 'REF001',
      referencia: 'Referência Exemplo 1',
      marca: 'Marca A',
    },
    {
      id: '2',
      codigo: 'REF002',
      referencia: 'Referência Exemplo 2',
      marca: 'Marca B',
    },
  ]);

  const [novaReferencia, setNovaReferencia] = useState({
    codigo: '',
    referencia: '',
    marca: '',
  });

  const handleNovaReferenciaChange = (campo: string, valor: string) => {
    setNovaReferencia((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const adicionarReferencia = () => {
    if (
      novaReferencia.codigo &&
      novaReferencia.referencia &&
      novaReferencia.marca
    ) {
      const novaRef: ReferenciaItem = {
        id: Date.now().toString(),
        ...novaReferencia,
      };
      setReferencias((prev) => [...prev, novaRef]);
      setNovaReferencia({ codigo: '', referencia: '', marca: '' });
    }
  };

  const removerReferencia = (id: string) => {
    setReferencias((prev) => prev.filter((ref) => ref.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {/* Campos para adicionar nova referência */}
        <div className="grid grid-cols-3 gap-4">
          <input
            className="w-full p-2 border rounded"
            type="text"
            placeholder="Código"
            value={novaReferencia.codigo}
            onChange={(e) =>
              handleNovaReferenciaChange('codigo', e.target.value)
            }
          />
          <input
            className="w-full p-2 border rounded"
            type="text"
            placeholder="Referência"
            value={novaReferencia.referencia}
            onChange={(e) =>
              handleNovaReferenciaChange('referencia', e.target.value)
            }
          />
          <input
            className="w-full p-2 border rounded"
            type="text"
            placeholder="Marca"
            value={novaReferencia.marca}
            onChange={(e) =>
              handleNovaReferenciaChange('marca', e.target.value)
            }
          />
        </div>

        {error?.referencia && (
          <span className="text-red-500 text-sm">{error.referencia}</span>
        )}

        <div className="flex flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={adicionarReferencia}
            disabled={
              !novaReferencia.codigo ||
              !novaReferencia.referencia ||
              !novaReferencia.marca
            }
            className="bg-[#347AB6] dark:bg-[#1f517c] text-white px-4 py-2 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="flex justify-center text-gray-700">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referência
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Marca
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {referencias.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  Nenhuma referência cadastrada
                </td>
              </tr>
            ) : (
              referencias.map((ref) => (
                <tr key={ref.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{ref.codigo}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {ref.referencia}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{ref.marca}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => removerReferencia(ref.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReferenciaFabrica;
