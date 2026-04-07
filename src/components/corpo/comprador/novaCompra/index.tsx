import React, { useState } from 'react';
import { NovaRequisicaoModal } from '../RequisicoesCompra/components/NovaRequisicaoModal';
import { PlusIcon } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';

export default function NovaCompraPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Nova Requisição de Compra
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Crie uma nova requisição de compra para o seu departamento.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
            <PlusIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Criar Nova Requisição
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Clique no botão abaixo para abrir o formulário de nova requisição de compra.
              Você poderá adicionar produtos, definir fornecedor e preencher todas as informações necessárias.
            </p>
          </div>

          <DefaultButton 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3"
            text="Nova Requisição"
            icon={<PlusIcon className="w-5 h-5 mr-2" />}
          />
        </div>
      </div>

      <NovaRequisicaoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          // Opcional: redirecionar para a lista de requisições
          // router.push('/compras/requisicoes-compra');
        }}
      />
    </div>
  );
}
