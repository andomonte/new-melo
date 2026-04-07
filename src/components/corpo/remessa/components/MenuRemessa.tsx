import React from 'react';

interface MenuRemessaProps {
  onGerarArquivo: () => void;
  onConsultarArquivos: () => void;
}

export function MenuRemessa({ onGerarArquivo, onConsultarArquivos }: MenuRemessaProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div
        onClick={onGerarArquivo}
        className="cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow transition-all duration-150"
      >
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Gerar Arquivo de Remessa
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Consultar os dados e gerar o arquivo de remessa (download ou envio por email).
        </p>
      </div>

      <div
        onClick={onConsultarArquivos}
        className="cursor-pointer bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900/20 dark:to-zinc-800/20 border-2 border-gray-200 dark:border-zinc-600 rounded-lg p-6 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow transition-all duration-150"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Consultar Arquivos Gerados
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ver histórico de arquivos de remessa já gerados e baixá-los novamente.
        </p>
      </div>
    </div>
  );
}
