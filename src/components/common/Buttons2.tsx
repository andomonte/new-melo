import { Button } from '@/components/ui/button';
import React from 'react';
import { Oval } from 'react-loader-spinner'; // Importe o componente de carregamento

type buttonSize = 'default' | 'lg' | 'sm';

interface DefaultButtonProps {
  className?: string;
  text?: React.ReactNode; // Mudança aqui para React.ReactNode
  size?: buttonSize;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'cancel' | 'confirm';
  onClick?: () => void;
  icon?: React.ReactNode;
  type?: 'submit' | 'button';
  title?: string; // Adicione a propriedade title à interface
  isSaving?: boolean; // Adicione a prop isSaving
}

const variantClasses = {
  primary:
    'bg-[#347AB6] dark:bg-[#1f517c] hover:bg-blue-600 text-white dark:text-white',
  secondary:
    'bg-gray-300 hover:bg-gray-400 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
  destructive:
    'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800',
  cancel:
    'bg-red-200 hover:bg-red-300 text-red-700 dark:bg-red-700 dark:text-red-200 dark:hover:bg-red-600', // Vermelho mais claro
  confirm:
    'bg-green-500 hover:bg-green-600 text-white dark:bg-green-700 dark:hover:bg-green-800', // Verde
};

export const DefaultButton = ({
  className = '',
  text = 'Button',
  size = 'lg',
  disabled = false,
  onClick,
  icon,
  variant = 'primary',
  type = 'submit',
  title,
  isSaving, // Recebe a prop isSaving
}: DefaultButtonProps) => {
  const variantStyle = variantClasses[variant] || variantClasses.primary;
  const buttonContent = isSaving ? (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Oval
        height={20}
        width={20}
        color="currentColor"
        secondaryColor="currentColor"
        strokeWidth={2}
      />
    </div>
  ) : (
    text
  );

  return (
    <Button
      type={type}
      disabled={disabled || isSaving} // Desabilita o botão durante o salvamento
      className={` capitalize ${variantStyle} ${className}`}
      size={size}
      onClick={onClick}
      title={title}
      style={{ minWidth: '110px' }} // Define uma largura mínima para o botão
    >
      {icon && <span className=" flex justify-center">{icon}</span>}
      <div
        style={{
          width: '100%',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {buttonContent}
      </div>
    </Button>
  );
};

interface AuxButtonProps {
  className?: string;
  text?: string;
  size?: buttonSize;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
  variant?: 'secondary';
  title?: string;
}

export const AuxButton = ({
  className = '',
  text = 'Button',
  size = 'lg',
  disabled = false,
  onClick,
  type = 'submit',
  variant = 'secondary',
  title,
}: AuxButtonProps) => {
  const variantStyle = variantClasses[variant] || variantClasses.secondary;
  return (
    <Button
      type={type}
      disabled={disabled}
      className={`capitalize ${variantStyle} ${className}`}
      size={size}
      onClick={onClick}
      title={title}
    >
      {text}
    </Button>
  );
};
