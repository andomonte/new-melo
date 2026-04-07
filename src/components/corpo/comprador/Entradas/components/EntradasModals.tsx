/**
 * Componente que agrupa todos os modais da tela de Entradas
 */

import React from 'react';
import { NovaEntradaModal } from './NovaEntradaModal';
import { EditEntradaModal } from './EditEntradaModal';
import { ViewEntradaModal } from './ViewEntradaModal';
import { EntradaItensModal } from './EntradaItensModal';
import { GerarEntradaChaveModal } from './GerarEntradaChaveModal';
import { EntradaDTO } from '../types';

interface EntradasModalsProps {
  // Nova Entrada
  isNewOpen: boolean;
  onNewClose: () => void;
  onNewSuccess: () => void;
  actionLoading: boolean;

  // Gerar Entrada por Chave
  isGerarOpen: boolean;
  onGerarClose: () => void;
  onGerarSuccess: () => void;

  // Editar
  editItem: EntradaDTO | null;
  onEditClose: () => void;
  onEditSuccess: () => void;

  // Visualizar
  viewItem: EntradaDTO | null;
  onViewClose: () => void;

  // Ver Itens
  itensItem: EntradaDTO | null;
  onItensClose: () => void;
}

export const EntradasModals: React.FC<EntradasModalsProps> = ({
  isNewOpen,
  onNewClose,
  onNewSuccess,
  actionLoading,
  isGerarOpen,
  onGerarClose,
  onGerarSuccess,
  editItem,
  onEditClose,
  onEditSuccess,
  viewItem,
  onViewClose,
  itensItem,
  onItensClose,
}) => {
  return (
    <>
      {isNewOpen && (
        <NovaEntradaModal
          isOpen={isNewOpen}
          onClose={onNewClose}
          onSuccess={onNewSuccess}
          loading={actionLoading}
        />
      )}

      {isGerarOpen && (
        <GerarEntradaChaveModal
          isOpen={isGerarOpen}
          onClose={onGerarClose}
          onSuccess={onGerarSuccess}
        />
      )}

      {editItem && (
        <EditEntradaModal
          isOpen={!!editItem}
          entrada={editItem}
          onClose={onEditClose}
          onSuccess={onEditSuccess}
          loading={actionLoading}
        />
      )}

      {viewItem && (
        <ViewEntradaModal
          isOpen={!!viewItem}
          entrada={viewItem}
          onClose={onViewClose}
        />
      )}

      {itensItem && (
        <EntradaItensModal
          isOpen={!!itensItem}
          entrada={itensItem}
          onClose={onItensClose}
        />
      )}
    </>
  );
};
