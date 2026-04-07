import { Button } from '@/components/ui/button';
import React from 'react';

type buttonSize = 'default' | 'lg' | 'sm';

interface DefaultButtonProps {
  className?: string;
  text?: string;
  size?: buttonSize;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'cancel' | 'confirm';
  onClick?: () => void;
  icon?: React.ReactNode;
  type?: 'submit' | 'button';
  title?: string; // Adicione a propriedade title à interface
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
  title, // Use a propriedade title
}: DefaultButtonProps) => {
  const variantStyle = variantClasses[variant] || variantClasses.primary;
  return (
    <Button
      type={type}
      disabled={disabled}
      className={`capitalize ${variantStyle} ${className}`}
      size={size}
      onClick={onClick}
      title={title} // Passa a propriedade title para o Button
    >
      <div className="flex justify-center items-center w-full gap-2 ml-2">
        {text}
        {icon && <span className="mr-2">{icon}</span>}
      </div>
    </Button>
  );
};

export const AuxButton = ({
  className = '',
  text = 'Button',
  size = 'lg',
  disabled = false,
  onClick,
  type = 'submit',
  variant = 'secondary',
  title, // Use a propriedade title
}: DefaultButtonProps) => {
  const variantStyle = variantClasses[variant] || variantClasses.secondary;
  return (
    <Button
      type={type}
      disabled={disabled}
      className={`capitalize ${variantStyle} ${className}`}
      size={size}
      onClick={onClick}
      title={title} // Passa a propriedade title para o Button
    >
      {text}
    </Button>
  );
};
