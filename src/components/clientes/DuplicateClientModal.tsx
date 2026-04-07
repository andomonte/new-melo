/**
 * Modal de Cliente Duplicado
 * Exibido quando um CPF/CNPJ já cadastrado é detectado
 */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Building2,
  MapPin,
  User,
  FileEdit,
  Eye,
  X,
} from 'lucide-react';

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

interface DuplicateClientModalProps {
  /** Controla abertura do modal */
  open: boolean;

  /** Callback ao fechar modal */
  onClose: () => void;

  /** Dados do cliente existente */
  client: ExistingClient | null;

  /** Callback ao clicar em "Ir para Edição" (opcional) */
  onEdit?: (codigo: number) => void;

  /** Callback ao clicar em "Apenas Visualizar" (opcional) */
  onView?: (codigo: number) => void;

  /** Mostrar botão de visualização (padrão: true) */
  showViewButton?: boolean;

  /** Mostrar botão de edição (padrão: true) */
  showEditButton?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Modal que alerta sobre cliente duplicado
 *
 * @example
 * <DuplicateClientModal
 *   open={showModal}
 *   onClose={closeModal}
 *   client={duplicateClient}
 * />
 */
export function DuplicateClientModal({
  open,
  onClose,
  client,
  onEdit,
  onView,
  showViewButton = true,
  showEditButton = true,
}: DuplicateClientModalProps) {
  // Se não há cliente, não renderiza
  if (!client) {
    return null;
  }

  // ========== HANDLERS ==========
  const handleEdit = () => {
    if (onEdit) {
      onEdit(client.codigo);
    }
    onClose();
  };

  const handleView = () => {
    if (onView) {
      onView(client.codigo);
    }
    onClose();
  };

  // ========== FORMATTERS ==========
  const formatCpfCnpj = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length === 11) {
      // CPF: 123.456.789-00
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      // CNPJ: 12.345.678/0001-00
      return cleaned.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        '$1.$2.$3/$4-$5',
      );
    }

    return value;
  };

  const displayName = client.nome_fantasia || client.nome;
  const location = [client.cidade, client.uf].filter(Boolean).join(' - ');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Cliente já cadastrado!
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
                Este CPF/CNPJ já existe no sistema
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-4 py-4">
          {/* Alert */}
          <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
              Não é possível cadastrar um cliente com CPF/CNPJ já existente.
              Você pode editar o cadastro existente ou apenas visualizá-lo.
            </AlertDescription>
          </Alert>

          {/* Client Info Card */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="space-y-3">
              {/* Código */}
              <div className="flex items-start gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 dark:bg-blue-900/30">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    #{client.codigo}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Código do Cliente
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {client.codigo}
                  </p>
                </div>
              </div>

              {/* Nome */}
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Nome / Razão Social
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {displayName}
                  </p>
                  {client.nome_fantasia && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Razão: {client.nome}
                    </p>
                  )}
                </div>
              </div>

              {/* CPF/CNPJ */}
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    CPF/CNPJ
                  </p>
                  <p className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {formatCpfCnpj(client.cpf_cnpj)}
                  </p>
                </div>
              </div>

              {/* Localização */}
              {location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Localização
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {location}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-2">
          {/* Botão Cancelar/Fechar */}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 sm:flex-initial"
          >
            <X className="mr-2 h-4 w-4" />
            Fechar
          </Button>

          {/* Botão Visualizar */}
          {showViewButton &&
            (onView ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleView}
                className="flex-1 sm:flex-initial"
              >
                <Eye className="mr-2 h-4 w-4" />
                Visualizar
              </Button>
            ) : (
              <Link href={`/clientes/visualizar/${client.codigo}`} passHref>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial"
                  asChild
                >
                  <a>
                    <Eye className="mr-2 h-4 w-4" />
                    Visualizar
                  </a>
                </Button>
              </Link>
            ))}

          {/* Botão Editar */}
          {showEditButton &&
            (onEdit ? (
              <Button
                type="button"
                onClick={handleEdit}
                className="flex-1 sm:flex-initial"
              >
                <FileEdit className="mr-2 h-4 w-4" />
                Ir para Edição
              </Button>
            ) : (
              <Link href={`/clientes/editar/${client.codigo}`} passHref>
                <Button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial"
                  asChild
                >
                  <a>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Ir para Edição
                  </a>
                </Button>
              </Link>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export type { DuplicateClientModalProps, ExistingClient };
