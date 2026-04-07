import React from 'react';

interface ComprasTabsProps {
  activeComprasTab: string;
  setActiveComprasTab: (tab: string) => void;
}

const ComprasTabs: React.FC<ComprasTabsProps> = ({ activeComprasTab, setActiveComprasTab }) => {
  const renderTabContent = () => {
    switch (activeComprasTab) {
      case "ultimosMeses":
        return (
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prazo Médio</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-gray-700">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">01/01/2023</td>
              <td className="px-6 py-4 whitespace-nowrap">R$ 100,00</td>
              <td className="px-6 py-4 whitespace-nowrap">30</td>
            </tr>
            </tbody>
          </table>
        );
      case "titulosVencer":
        return (
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Vencimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-gray-700">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">01/02/2023</td>
              <td className="px-6 py-4 whitespace-nowrap">R$ 200,00</td>
            </tr>
            </tbody>
          </table>
        );
      case "titulosVencidos":
        return (
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Vencimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
            </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-gray-700">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">01/01/2023</td>
              <td className="px-6 py-4 whitespace-nowrap">R$ 300,00</td>
            </tr>
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <nav className="flex space-x-4 border-b-2 mt-4 mb-4 text-[#347AB6]">
        <button
          onClick={() => setActiveComprasTab('ultimosMeses')}
          className={`px-4 py-2 ${activeComprasTab === 'ultimosMeses' ? 'border-b-4 border-[#347AB6] dark:border-blue-900 font-bold' : ''}`}
        >
          3 (Três) Últimos Meses de Compras
        </button>
        <button
          onClick={() => setActiveComprasTab('titulosVencer')}
          className={`px-4 py-2 ${activeComprasTab === 'titulosVencer' ? 'border-b-4 border-[#347AB6] dark:border-blue-900 font-bold' : ''}`}
        >
          Títulos à Vencer
        </button>
        <button
          onClick={() => setActiveComprasTab('titulosVencidos')}
          className={`px-4 py-2 ${activeComprasTab === 'titulosVencidos' ? 'border-b-4 border-[#347AB6] dark:border-blue-900 font-bold' : ''}`}
        >
          Títulos Vencidos
        </button>
      </nav>
      <div>{renderTabContent()}</div>
    </div>
  );
};

export default ComprasTabs;