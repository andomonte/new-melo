/**
 * Painel de seção reutilizável
 * Segue o padrão visual do sistema (border, header cinza, conteúdo)
 */

import React from 'react';

interface SectionPanelProps {
  titulo: string;
  children: React.ReactNode;
  className?: string;
  gridCols?: string;
}

export const SectionPanel: React.FC<SectionPanelProps> = ({
  titulo,
  children,
  className = '',
  gridCols = 'grid-cols-4',
}) => (
  <div className="border border-gray-200 dark:border-zinc-700 rounded-lg">
    <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 rounded-t-lg">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{titulo}</h3>
    </div>
    <div className={`p-4 grid ${gridCols} gap-4 ${className}`}>
      {children}
    </div>
  </div>
);

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
    {children}
  </div>
);
