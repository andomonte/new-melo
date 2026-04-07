/**
 * Constantes e tipos para o modal de conferir itens
 */

import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  MinusCircle,
  PlusCircle,
} from 'lucide-react';

// Tipos de status dos itens
export type StatusItem = 'PENDENTE' | 'OK' | 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'ERRADO';

// Status que podem ser conferidos (sem PENDENTE)
export type StatusConferido = 'OK' | 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'ERRADO';

// Configuracao visual de cada status
export interface StatusConfig {
  label: string;
  color: string;
  icon: React.ReactNode;
}

export const STATUS_CONFIG: Record<StatusItem, StatusConfig> = {
  PENDENTE: {
    label: 'Pendente',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    icon: React.createElement(MinusCircle, { className: 'w-4 h-4' }),
  },
  OK: {
    label: 'OK',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: React.createElement(CheckCircle, { className: 'w-4 h-4' }),
  },
  FALTA: {
    label: 'Falta',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: React.createElement(AlertTriangle, { className: 'w-4 h-4' }),
  },
  EXCESSO: {
    label: 'Excesso',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: React.createElement(PlusCircle, { className: 'w-4 h-4' }),
  },
  DANIFICADO: {
    label: 'Danificado',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: React.createElement(XCircle, { className: 'w-4 h-4' }),
  },
  ERRADO: {
    label: 'Errado',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: React.createElement(XCircle, { className: 'w-4 h-4' }),
  },
};

// Lista de status para select
export const STATUS_OPTIONS: { value: StatusItem; label: string }[] = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'OK', label: 'OK' },
  { value: 'FALTA', label: 'Falta' },
  { value: 'EXCESSO', label: 'Excesso' },
  { value: 'DANIFICADO', label: 'Danificado' },
  { value: 'ERRADO', label: 'Errado' },
];

// Tipo do armazem
export interface Armazem {
  arm_id: number;
  arm_descricao: string;
  arm_status: string;
  arm_municipio: string | null;
  arm_uf: string | null;
}

// Tipo do item de entrada para recebimento
export interface ItemEntradaRecebimento {
  id: number;
  entrada_item_id: number;
  produto_cod: string;
  produto_nome: string;
  qtd_esperada: number;
  qtd_recebida: number | null;
  status_item: StatusItem;
  observacao: string | null;
  unidade: string;
}

// Tipo do item local com estado editavel
export interface ItemLocal extends ItemEntradaRecebimento {
  qtdRecebidaLocal: number;
  statusLocal: StatusItem;
  observacaoLocal: string;
  modificado: boolean;
  salvando: boolean;
  armazemId: number | null;
}

// Tipo da entrada para receber
export interface EntradaParaReceber {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_entrada: string;
  status: string;
  status_label: string;
  recebedor_nome?: string;
  inicio_recebimento?: string;
  preco_confirmado?: boolean;
  data_confirmacao_preco?: string;
}

// Tipo do resumo
export interface ResumoItens {
  total: number;
  ok: number;
  falta: number;
  excesso: number;
  danificado: number;
  errado: number;
  pendente: number;
}

// Props do modal principal
export interface ModalConferirItensProps {
  isOpen: boolean;
  onClose: () => void;
  entrada: EntradaParaReceber;
  matricula: string;
  onFinalizar: (observacao?: string) => void;
}

// Armazem padrao
export const ARMAZEM_PADRAO_ID = 1001; // GERAL
