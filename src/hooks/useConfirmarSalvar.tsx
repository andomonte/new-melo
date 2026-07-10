import React, { useState, useCallback } from 'react';
import ConfirmationModal from '@/components/common/ConfirmationModal';

interface OpcoesConfirmarSalvar {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
}

/**
 * Padrão de confirmação antes de salvar nos formulários de cadastro
 * (novo e edição). Uso:
 *
 *   const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();
 *   // no botão/handler de salvar:
 *   onSubmit={() => pedirConfirmacao(handleSubmit)}
 *   // no JSX:
 *   {ConfirmacaoSalvarModal}
 *
 * A ação só é executada quando o usuário confirma. Para validar antes de
 * perguntar (RHF), chame pedirConfirmacao dentro do callback de sucesso do
 * handleSubmit.
 */
export function useConfirmarSalvar(opcoes?: OpcoesConfirmarSalvar) {
  const [acaoPendente, setAcaoPendente] = useState<(() => void) | null>(null);

  // Recebe a ação de salvar e abre o modal; nada é executado até confirmar.
  const pedirConfirmacao = useCallback((acao: () => void) => {
    setAcaoPendente(() => acao);
  }, []);

  const fechar = useCallback(() => setAcaoPendente(null), []);

  const confirmar = useCallback(() => {
    // Executa FORA do updater do setState (evita disparo duplo no StrictMode)
    const acao = acaoPendente;
    setAcaoPendente(null);
    acao?.();
  }, [acaoPendente]);

  const ConfirmacaoSalvarModal = (
    <ConfirmationModal
      isOpen={!!acaoPendente}
      onClose={fechar}
      onConfirm={confirmar}
      title={opcoes?.title ?? 'Confirmar'}
      message={opcoes?.message ?? 'Deseja realmente salvar os dados informados?'}
      type={opcoes?.type ?? 'info'}
      confirmText={opcoes?.confirmText ?? 'Sim, salvar'}
      cancelText={opcoes?.cancelText ?? 'Cancelar'}
    />
  );

  return { pedirConfirmacao, ConfirmacaoSalvarModal };
}

export default useConfirmarSalvar;
