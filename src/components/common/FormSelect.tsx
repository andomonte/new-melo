// src/components/common/FormSelect.tsx

import React from 'react';

// Interface para cada opção do select
interface Option {
  value: string | number;
  label: string;
}

// Props para o componente FormSelect
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string; // Rótulo visível acima do select
  name: string;  // Nome do campo (para HTML e validação)
  options: Option[]; // Array de opções para o select
  error?: string; // Mensagem de erro de validação (opcional)
  required?: boolean; // Indica se o campo é obrigatório (para estilização e validação visual)
}

const FormSelect: React.FC<FormSelectProps> = ({
  label,
  name,
  options,
  error,
  required = false,
  ...rest // Coleta todas as outras props padrão de um <select> (ex: value, onChange, disabled, etc.)
}) => {
  return (
    <div className="mb-4"> {/* Container do campo para espaçamento e erros */}
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>} {/* Rótulo e indicador de obrigatório */}
      </label>
      <select
        id={name}
        name={name}
        // Classes de estilização Tailwind CSS para o select
        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
          ${
            // Estilização condicional baseada na presença de erro
            error
              ? 'border-red-500 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' // Estilo de erro
              : 'border-gray-300 dark:border-gray-600 dark:bg-zinc-700 dark:text-gray-100' // Estilo normal
          }`}
        {...rest} // Aplica todas as props adicionais passadas (value, onChange, etc.)
      >
        {/* Renderiza as opções do select */}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Exibe a mensagem de erro, se houver */}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default FormSelect;