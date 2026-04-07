// pages/admin/migrar-inscricoes.tsx

import React, { useState } from 'react';
import api from '@/components/services/api';

export default function MigrarInscricoes() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    registrosMigrados?: number;
    totalRegistros?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigrar = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await api.post('/api/inscricoesEstaduais/migrar-dados');
      setResult(response.data);
    } catch (err: any) {
      console.error('Erro ao migrar:', err);
      setError(
        err.response?.data?.details ||
          err.response?.data?.error ||
          'Erro ao migrar dados',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
          Migração de Inscrições Estaduais
        </h1>

        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">
            O que essa migração faz?
          </h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
            <li>Cria a tabela <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">db_ie</code> se não existir</li>
            <li>Copia dados de <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">dadosempresa</code> para <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">db_ie</code></li>
            <li>Campos copiados: CGC, Inscrição Estadual, Nome Contribuinte</li>
            <li>Se já existir, atualiza os dados</li>
          </ul>
        </div>

        <button
          onClick={handleMigrar}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Migrando dados...
            </span>
          ) : (
            'Iniciar Migração'
          )}
        </button>

        {result && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
              ✅ Migração Concluída!
            </h3>
            <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
              <p>
                <strong>Registros migrados:</strong>{' '}
                {result.registrosMigrados}
              </p>
              <p>
                <strong>Total de registros na db_ie:</strong>{' '}
                {result.totalRegistros}
              </p>
              <p className="mt-3 text-xs text-green-600 dark:text-green-400">
                Agora você pode usar o cadastro de armazéns normalmente!
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              ❌ Erro na Migração
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
