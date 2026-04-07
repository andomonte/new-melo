import React from 'react';
import { FileText, Upload } from 'lucide-react';

interface TelaSelecaoProps {
  onSelecionarRemessa: () => void;
  onSelecionarImportacao: () => void;
}

export function TelaSelecao({ onSelecionarRemessa, onSelecionarImportacao }: TelaSelecaoProps) {
  return (
    <div className="text-center py-12">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          O que você deseja fazer?
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Escolha entre gerar uma nova remessa ou importar um arquivo de retorno DDA
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Opção Gerar Remessa */}
        <div
          onClick={onSelecionarRemessa}
          className="cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-8 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Gerar Remessa de Cobrança
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm text-center">
              Criar e enviar arquivo de remessa para análise de crédito  
            </p>
          </div>
        </div>

        {/* Opção Importar Retorno DDA */}
        <div
          onClick={onSelecionarImportacao}
          className="cursor-pointer bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-200 dark:border-green-700 rounded-lg p-8 hover:border-green-300 dark:hover:border-green-600 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              Importar Retorno Cobrança
            </h3>
            <p className="text-green-700 dark:text-green-300 text-sm text-center">
              Processar arquivo de retorno bancário e importar títulos para contas a pagar
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Selecione uma das opções acima para continuar
        </p>
      </div>
    </div>
  );
}
