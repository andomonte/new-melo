/**
 * Hook customizado para verificação de cliente existente
 * Verifica se um CPF/CNPJ já está cadastrado no sistema
 */

import { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface ExistingClient {
  codigo: number;
  nome: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  cidade: string | null;
  uf: string | null;
}

interface UseClientVerificationOptions {
  /** Callback executado quando um cliente duplicado é encontrado */
  onDuplicateFound?: (client: ExistingClient) => void;

  /** Callback executado quando CPF/CNPJ está disponível */
  onAvailable?: () => void;

  /** Callback executado em caso de erro */
  onError?: (error: Error) => void;

  /** Habilitar verificação automática (padrão: true) */
  autoVerify?: boolean;
}

interface UseClientVerificationReturn {
  /** Indica se está carregando */
  isLoading: boolean;

  /** Cliente duplicado encontrado (se houver) */
  duplicateClient: ExistingClient | null;

  /** Indica se deve mostrar o modal */
  showModal: boolean;

  /** Função para verificar CPF/CNPJ */
  verifyClient: (cpfCnpj: string) => Promise<void>;

  /** Função para fechar o modal */
  closeModal: () => void;

  /** Função para limpar o estado */
  reset: () => void;

  /** Erro (se houver) */
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook para verificar se um cliente já existe no sistema
 *
 * @param options - Opções de configuração
 * @returns Objeto com estado e funções de controle
 *
 * @example
 * const { verifyClient, duplicateClient, showModal, closeModal } = useClientVerification({
 *   onDuplicateFound: (client) => console.log('Cliente encontrado:', client),
 * });
 *
 * // No onBlur do input
 * <input onBlur={(e) => verifyClient(e.target.value)} />
 */
export function useClientVerification(
  options: UseClientVerificationOptions = {},
): UseClientVerificationReturn {
  const { onDuplicateFound, onAvailable, onError, autoVerify = true } = options;

  // ========== STATE ==========
  const [isLoading, setIsLoading] = useState(false);
  const [duplicateClient, setDuplicateClient] = useState<ExistingClient | null>(
    null,
  );
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ========== VERIFY CLIENT ==========
  const verifyClient = useCallback(
    async (cpfCnpj: string) => {
      // Reseta estados anteriores
      setError(null);
      setDuplicateClient(null);
      setShowModal(false);

      // Validação básica
      if (!cpfCnpj || !cpfCnpj.trim()) {
        return;
      }

      // Remove caracteres especiais para validação de tamanho
      const cleaned = cpfCnpj.replace(/\D/g, '');

      // Deve ter 11 (CPF) ou 14 (CNPJ) dígitos
      if (cleaned.length !== 11 && cleaned.length !== 14) {
        return;
      }

      // Se autoVerify está desabilitado, não verifica
      if (!autoVerify) {
        return;
      }

      try {
        setIsLoading(true);

        // Chamar API route ao invés de Server Action
        const response = await fetch('/api/clientes/verify-existence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpfCnpj }),
        });

        if (!response.ok) {
          throw new Error('Erro ao verificar cliente');
        }

        const result = await response.json();

        if (result.exists && result.client) {
          // Cliente duplicado encontrado
          setDuplicateClient(result.client);
          setShowModal(true);

          // Callback
          onDuplicateFound?.(result.client);
        } else {
          // CPF/CNPJ disponível
          onAvailable?.();
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Erro ao verificar cliente');
        setError(error.message);
        onError?.(error);
        console.error('Erro na verificação de cliente:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [autoVerify, onDuplicateFound, onAvailable, onError],
  );

  // ========== CLOSE MODAL ==========
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // ========== RESET ==========
  const reset = useCallback(() => {
    setIsLoading(false);
    setDuplicateClient(null);
    setShowModal(false);
    setError(null);
  }, []);

  return {
    isLoading,
    duplicateClient,
    showModal,
    verifyClient,
    closeModal,
    reset,
    error,
  };
}

// ============================================================================
// EXPORT TYPE (para uso em componentes)
// ============================================================================

export type {
  ExistingClient,
  UseClientVerificationOptions,
  UseClientVerificationReturn,
};
