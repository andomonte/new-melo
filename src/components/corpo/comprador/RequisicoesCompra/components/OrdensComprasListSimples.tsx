import React from 'react';

interface OrdensComprasListSimplesProps {
  className?: string;
}

export default function OrdensComprasListSimples({
  className = '',
}: OrdensComprasListSimplesProps) {
  
  // Dados mockados para evitar problemas de hooks
  const mockOrdens = [
    {
      orc_id: 1,
      orc_req_id: 12002010058,
      orc_req_versao: 1,
      orc_data: '2024-01-15',
      orc_status: 'P',
      orc_valor_total: 1500.00,
      req_id_composto: 'REQ-2024-001',
      req_status: 'A',
      fornecedor_nome: 'Fornecedor ABC',
      comprador_nome: 'João Silva'
    },
    {
      orc_id: 2,
      orc_req_id: 12002010060,
      orc_req_versao: 1,
      orc_data: '2024-01-16',
      orc_status: 'A',
      orc_valor_total: 2300.50,
      req_id_composto: 'REQ-2024-002',
      req_status: 'A',
      fornecedor_nome: 'Fornecedor XYZ',
      comprador_nome: 'Maria Santos'
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Ordens de Compra
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ordem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Requisição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Comprador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {mockOrdens.map((ordem) => (
                  <tr key={ordem.orc_id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {String(ordem.orc_id).padStart(6, '0')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {ordem.req_id_composto}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {new Date(ordem.orc_data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        ordem.orc_status === 'A' ? 'bg-green-100 text-green-800' :
                        ordem.orc_status === 'B' ? 'bg-yellow-100 text-yellow-800' :
                        ordem.orc_status === 'C' ? 'bg-red-100 text-red-800' :
                        ordem.orc_status === 'F' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {ordem.orc_status === 'A' ? 'Aberta' :
                         ordem.orc_status === 'B' ? 'Bloqueada' :
                         ordem.orc_status === 'C' ? 'Cancelada' :
                         ordem.orc_status === 'F' ? 'Fechada' : ordem.orc_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {ordem.fornecedor_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {ordem.comprador_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      R$ {ordem.orc_valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            <strong>Modo de Desenvolvimento:</strong> Esta é uma versão simplificada da listagem de ordens. 
            A versão completa com filtros e ações será ativada após os testes.
          </p>
        </div>
      </div>
    </div>
  );
}