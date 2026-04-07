// src/components/common/FormInputEditavel.tsx

import React, {
  useState,
  forwardRef,
  InputHTMLAttributes,
  ChangeEvent,
} from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PencilLine, Lock } from 'lucide-react'; // Importe os ícones que você quer usar

interface FormInputEditavelProps extends InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  name: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  error?: string;
  // Nova prop para o valor "salvo" do banco (booleano)
  isSaved?: boolean;
  // Nova prop para lidar com a mudança do valor quando a edição está ativa
  onEditChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Nova prop para lidar com o envio final do valor editado (ex: ao perder o foco)
  onSaveEdit?: (value: string | null) => void;
  // Prop para definir se o campo deve iniciar já editável (ex: se isSaved for false)
  initialEditable?: boolean;
}

const FormInputEditavel = forwardRef<HTMLInputElement, FormInputEditavelProps>(
  (
    {
      name,
      label,
      required,
      placeholder,
      className,
      error,
      isSaved = false, // Valor padrão para isSaved
      onEditChange,
      onSaveEdit,
      initialEditable = false, // Valor padrão para initialEditable
      type = 'text', // Define 'text' como tipo padrão, pode ser sobrescrito

      ...rest
    },
    ref,
  ) => {
    // Estado para controlar se o campo está em modo de edição
    const [isEditing, setIsEditing] = useState<boolean>(initialEditable);
    // Estado para o valor do input quando a edição está ativa
    const [inputValue, setInputValue] = useState<string>('');

    // Efeito para inicializar isEditing com base em initialEditable
    // e limpar inputValue quando a edição é desativada por fora.
    React.useEffect(() => {
      setIsEditing(initialEditable);
      if (!initialEditable) {
        setInputValue(''); // Garante que o input esteja limpo se começar desabilitado
      }
    }, [initialEditable]);

    const handleToggleEdit = () => {
      if (!isEditing) {
        // Se estava somente leitura e vai para edição
        setIsEditing(true);
        setInputValue(''); // Limpa o valor para nova digitação
      } else {
        // Se estava em edição e vai para somente leitura
        setIsEditing(false);
        setInputValue(''); // Limpa o valor digitado ao desativar a edição
        if (onSaveEdit) {
          onSaveEdit(null); // Indica que não houve um novo valor a ser salvo, apenas desativou a edição
        }
      }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      if (onEditChange) {
        onEditChange(e); // Passa o evento para o componente pai se necessário
      }
    };

    const handleInputBlur = () => {
      // Quando o campo perde o foco, se estiver editando,
      // podemos considerar o valor para ser "salvo"
      if (isEditing && onSaveEdit) {
        onSaveEdit(inputValue === '' ? null : inputValue);
      }
      // Reverter para modo de visualização após perder o foco, se for o caso
      // Mas vamos manter a edição ativa até o ícone ser clicado novamente para maior controle do usuário
      // setIsEditing(false); // Removido para manter a edição ativa até clique no ícone
    };

    // Determina o texto a ser exibido no input
    const displayValue = isEditing
      ? inputValue // Se está editando, mostra o valor que está sendo digitado
      : isSaved
      ? `***** ${name.toUpperCase()} SALVO E CRIPTOGRAFADO *****` // Se não está editando E está salvo no BD
      : ''; // Se não está editando E não está salvo no BD, mostra vazio para preencher

    const Icon = isEditing ? PencilLine : Lock;
    const iconColor = isEditing
      ? 'text-blue-500 hover:text-blue-600'
      : 'text-gray-400 hover:text-gray-500';

    return (
      <div className="space-y-1 text-gray-700 dark:text-gray-200">
        {label && (
          <Label htmlFor={name}>
            {label}
            {required && <span className="text-red-500"> *</span>}
          </Label>
        )}
        <div className="relative flex items-center">
          <Input
            id={name}
            name={name}
            type={isEditing ? type : 'text'} // Mostrar como texto se não estiver editando para exibir a mensagem
            value={displayValue} // Usamos 'value' para controle total
            onChange={handleInputChange}
            onBlur={handleInputBlur} // Lida com o foco para possível salvamento
            placeholder={isEditing ? placeholder : ''} // Apenas mostra placeholder se estiver editando
            className={`pr-10 ${className || ''}`} // Espaço para o ícone
            disabled={!isEditing} // Desabilita o input se não estiver em modo de edição
            ref={ref}
            readOnly={!isEditing} // Garante que o input não é editável quando desabilitado
            {...rest}
          />
          <button
            type="button"
            onClick={handleToggleEdit}
            className={`absolute right-3 cursor-pointer ${iconColor}`}
            title={
              isEditing
                ? `Clique para desativar edição de ${label}`
                : `Clique para habilitar edição de ${label}`
            }
          >
            <Icon size={20} />
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  },
);

FormInputEditavel.displayName = 'FormInputEditavel';

export default FormInputEditavel;
