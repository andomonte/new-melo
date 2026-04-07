/**
 * Exemplo de Uso - Verificação de Cliente Duplicado
 *
 * Este arquivo demonstra como integrar a verificação de cliente existente
 * em um formulário de cadastro usando o hook useClientVerification e o DuplicateClientModal
 */

'use client';

import React, { useState } from 'react';
import { useClientVerification } from '@/hooks/useClientVerification';
import { DuplicateClientModal } from '@/components/clientes/DuplicateClientModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

// ============================================================================
// EXEMPLO 1: Formulário Simples com Verificação Automática
// ============================================================================

export function ClientFormExample() {
  const [cpfCnpj, setCpfCnpj] = useState('');

  // Hook de verificação
  const {
    verifyClient,
    duplicateClient,
    showModal,
    closeModal,
    isLoading,
    error,
  } = useClientVerification({
    onDuplicateFound: (client) => {
      console.log('Cliente duplicado encontrado:', client);
    },
    onAvailable: () => {
      console.log('CPF/CNPJ disponível para cadastro');
    },
  });

  // Handler do onBlur
  const handleCpfCnpjBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      verifyClient(value);
    }
  };

  return (
    <div className="space-y-4">
      {/* Campo CPF/CNPJ */}
      <div className="space-y-2">
        <Label htmlFor="cpf_cnpj">
          CPF/CNPJ *
          {isLoading && (
            <span className="ml-2 text-xs text-gray-500">Verificando...</span>
          )}
        </Label>
        <div className="relative">
          <Input
            id="cpf_cnpj"
            type="text"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            onBlur={handleCpfCnpjBlur}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            className={error ? 'border-red-500' : ''}
            disabled={isLoading}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Modal de Cliente Duplicado */}
      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
      />
    </div>
  );
}

// ============================================================================
// EXEMPLO 2: Com Callbacks Personalizados
// ============================================================================

export function ClientFormWithCallbacks() {
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [canSubmit, setCanSubmit] = useState(false);

  const { verifyClient, duplicateClient, showModal, closeModal, isLoading } =
    useClientVerification({
      onDuplicateFound: (client) => {
        setCanSubmit(false);
        alert(`Cliente ${client.nome} já cadastrado!`);
      },
      onAvailable: () => {
        setCanSubmit(true);
        console.log('CPF/CNPJ válido e disponível');
      },
      onError: (error) => {
        console.error('Erro ao verificar:', error);
        setCanSubmit(false);
      },
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      console.log('Enviando formulário...');
      // Lógica de submit
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
        <Input
          id="cpf_cnpj"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          onBlur={(e) => verifyClient(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={!canSubmit || isLoading}>
        {isLoading ? 'Verificando...' : 'Cadastrar Cliente'}
      </Button>

      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
      />
    </form>
  );
}

// ============================================================================
// EXEMPLO 3: Com Navegação Customizada
// ============================================================================

export function ClientFormWithCustomNavigation() {
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [redirect, setRedirect] = useState<string | null>(null);

  const { verifyClient, duplicateClient, showModal, closeModal, isLoading } =
    useClientVerification();

  const handleEdit = (codigo: number) => {
    setRedirect(`/clientes/editar/${codigo}`);
    // Aqui você pode usar router.push() do Next.js
    console.log(`Redirecionando para edição: ${codigo}`);
  };

  const handleView = (codigo: number) => {
    setRedirect(`/clientes/visualizar/${codigo}`);
    console.log(`Redirecionando para visualização: ${codigo}`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
        <Input
          id="cpf_cnpj"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          onBlur={(e) => verifyClient(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
        onEdit={handleEdit}
        onView={handleView}
      />

      {redirect && (
        <div className="text-sm text-gray-600">
          Redirecionando para: {redirect}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXEMPLO 4: Verificação Manual (sem autoVerify)
// ============================================================================

export function ClientFormManualVerification() {
  const [cpfCnpj, setCpfCnpj] = useState('');

  const { verifyClient, duplicateClient, showModal, closeModal, isLoading } =
    useClientVerification({
      autoVerify: false, // Desabilita verificação automática
    });

  const handleManualCheck = () => {
    if (cpfCnpj) {
      verifyClient(cpfCnpj);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
        <div className="flex gap-2">
          <Input
            id="cpf_cnpj"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            placeholder="Digite o CPF/CNPJ"
            disabled={isLoading}
          />
          <Button
            type="button"
            onClick={handleManualCheck}
            disabled={isLoading || !cpfCnpj}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </Button>
        </div>
      </div>

      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
      />
    </div>
  );
}

// ============================================================================
// EXEMPLO 5: Integração com React Hook Form
// ============================================================================

/**
 * Exemplo usando react-hook-form (descomentar se usar)
 *
 * import { useForm } from 'react-hook-form';
 * import { zodResolver } from '@hookform/resolvers/zod';
 * import { ClientCreateSchema } from '@/schemas/client.schemas';
 *
 * export function ClientFormWithReactHookForm() {
 *   const form = useForm({
 *     resolver: zodResolver(ClientCreateSchema),
 *   });
 *
 *   const {
 *     verifyClient,
 *     duplicateClient,
 *     showModal,
 *     closeModal,
 *     isLoading,
 *   } = useClientVerification({
 *     onDuplicateFound: (client) => {
 *       form.setError('cpf_cnpj', {
 *         type: 'manual',
 *         message: `CPF/CNPJ já cadastrado para ${client.nome}`,
 *       });
 *     },
 *   });
 *
 *   return (
 *     <form onSubmit={form.handleSubmit(onSubmit)}>
 *       <Input
 *         {...form.register('cpf_cnpj')}
 *         onBlur={(e) => verifyClient(e.target.value)}
 *       />
 *       <DuplicateClientModal
 *         open={showModal}
 *         onClose={closeModal}
 *         client={duplicateClient}
 *       />
 *     </form>
 *   );
 * }
 */
