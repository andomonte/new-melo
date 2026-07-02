import React from 'react';
import { CreditoTemporarioContent } from './CreditoTemporarioContent';

/**
 * Página de Crédito Temporário (acessada pelo menu Cadastro).
 * Reutiliza o mesmo conteúdo do modal aberto pelo Zoom do cliente.
 */
const CreditoTemporarioPage = () => {
  return (
    <div className="h-full flex flex-col flex-grow border border-gray-300 bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 overflow-auto">
        <div className="mb-4">
          <h1 className="text-base font-semibold text-black dark:text-white">
            Crédito Temporário
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Libere um limite de crédito temporário para clientes, com data de
            vencimento.
          </p>
        </div>
        <CreditoTemporarioContent />
      </main>
    </div>
  );
};

export default CreditoTemporarioPage;
