import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export interface DocumentoMatch {
  type: string; // CLIENTE | FORNECEDOR | TRANSPORTADORA
  id: string;
  name: string;
  doc: string;
}

interface Props {
  open: boolean;
  matches: DocumentoMatch[];
  onClose: () => void;
  /** Ação ao clicar no botão de um registro */
  onAction: (match: DocumentoMatch) => void;
  /** Texto do botão de cada registro (padrão: Abrir) */
  actionLabel?: (match: DocumentoMatch) => string;
  descricao?: string;
}

/**
 * Modal padrão de "Documento Duplicado" — mesmo visual usado no cadastro de cliente.
 * Lista os registros (Cliente/Fornecedor/Transportadora) encontrados com o mesmo CPF/CNPJ.
 */
export function DocumentoDuplicadoModal({
  open,
  matches,
  onClose,
  onAction,
  actionLabel,
  descricao,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-zinc-900"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <AlertTriangle className="h-5 w-5" />
            Documento Duplicado
          </DialogTitle>
          <DialogDescription>
            {descricao ||
              `Encontramos ${matches.length} ${
                matches.length === 1 ? 'registro' : 'registros'
              } com este CPF/CNPJ no sistema.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-3">
            {matches.map((match, idx) => (
              <div
                key={idx}
                className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block bg-blue-600 dark:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {match.type}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ID: {match.id}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {match.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Documento: {match.doc}
                    </p>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onAction(match)}
                  >
                    {actionLabel ? actionLabel(match) : 'Abrir'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="destructive" size="sm" onClick={onClose}>
            Cancelar e Sair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentoDuplicadoModal;
