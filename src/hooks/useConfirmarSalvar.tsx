import React, { useState, useCallback } from 'react';
import ConfirmationModal from '@/components/common/ConfirmationModal';

interface OpcoesConfirmarSalvar {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  /** Executada quando o usuário CANCELA (botão cancelar/fechar). */
  onCancel?: () => void;
  /** Alerta de um botão só (esconde o Cancelar). Use com confirmText: 'OK'. */
  somenteOk?: boolean;
}

/**
 * Padrão único de confirmação/alerta estilizado (ConfirmationModal) para os
 * formulários. Substitui window.confirm/alert.
 *
 * Uso básico (confirmação de salvar):
 *   const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
 *     title: 'Confirmar cadastro', message: 'Deseja salvar?'
 *   });
 *   onSubmit={() => pedirConfirmacao(handleSubmit)}
 *   {ConfirmacaoSalvarModal}
 *
 * Alerta/confirmação com mensagem própria (sobrescreve as opções):
 *   pedirConfirmacao(acaoAoConfirmar, {
 *     title: 'Atenção', message: '...', type: 'warning',
 *     confirmText: 'Sim', cancelText: 'Não', onCancel: () => {...},
 *   });
 *
 * A ação só roda ao confirmar. Pode-se encadear (a ação de um pode abrir
 * outro pedirConfirmacao — o mesmo modal é reaproveitado).
 */
export function useConfirmarSalvar(opcoes?: OpcoesConfirmarSalvar) {
  const [estado, setEstado] = useState<{
    acao: () => void;
    override?: OpcoesConfirmarSalvar;
  } | null>(null);

  // Recebe a ação e (opcionalmente) opções que sobrescrevem as padrão.
  const pedirConfirmacao = useCallback(
    (acao: () => void, override?: OpcoesConfirmarSalvar) => {
      setEstado({ acao, override });
    },
    [],
  );

  const fechar = useCallback(() => {
    const oc = estado?.override?.onCancel ?? opcoes?.onCancel;
    setEstado(null);
    oc?.();
  }, [estado, opcoes]);

  const confirmar = useCallback(() => {
    const a = estado?.acao;
    setEstado(null);
    a?.();
  }, [estado]);

  // Opções efetivas: padrão do hook + sobrescritas da chamada
  const ef: OpcoesConfirmarSalvar = { ...opcoes, ...estado?.override };

  const ConfirmacaoSalvarModal = (
    <ConfirmationModal
      isOpen={!!estado}
      onClose={fechar}
      onConfirm={confirmar}
      title={ef.title ?? 'Confirmar'}
      message={ef.message ?? 'Deseja realmente salvar os dados informados?'}
      type={ef.type ?? 'info'}
      confirmText={ef.confirmText ?? (ef.somenteOk ? 'OK' : 'Sim, salvar')}
      cancelText={ef.cancelText ?? 'Cancelar'}
      hideCancel={ef.somenteOk}
    />
  );

  // `aberto` permite a tela desativar navegação por teclado enquanto a
  // confirmação está na frente (evita o Enter da lista disparar junto).
  return { pedirConfirmacao, ConfirmacaoSalvarModal, aberto: !!estado };
}

export default useConfirmarSalvar;
