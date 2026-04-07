/**
 * Página de Cadastro de Cliente
 * Formulário completo 100% feature-complete
 */

import React from 'react';
import { ClientForm } from '@/components/clientes';

export default function CadastroClientePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Cadastro de Cliente
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Preencha todos os campos obrigatórios para cadastrar um novo cliente
          no sistema
        </p>
      </div>

      <ClientForm />
    </div>
  );
}
