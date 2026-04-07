import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  defaultValue?: string | number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
  maxLength?: number;

  /** Se true, força o valor digitado para CAIXA ALTA */
  uppercase?: boolean;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      name,
      type,
      required,
      label,
      defaultValue,
      placeholder,
      onChange,
      onInput,
      className,
      error,
      disabled,
      maxLength,
      uppercase = false,
      ...rest
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (uppercase) {
        e.target.value = e.target.value.toUpperCase();
      }
      onChange?.(e);
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      if (uppercase) {
        e.currentTarget.value = e.currentTarget.value.toUpperCase();
      }
      onInput?.(e);
    };

    return (
      <div className="space-y-1 text-gray-700 dark:text-gray-200">
        {label && (
          <Label htmlFor={name}>
            {label}
            {required && <span className="text-red-500"> *</span>}
          </Label>
        )}

        <Input
          id={name}
          name={name}
          type={type}
          defaultValue={
            uppercase && typeof defaultValue === 'string'
              ? defaultValue.toUpperCase()
              : defaultValue
          }
          placeholder={placeholder}
          onChange={handleChange}
          onInput={handleInput}
          className={`${uppercase ? 'uppercase' : ''} ${className ?? ''}`}
          disabled={disabled}
          maxLength={maxLength ?? 255}
          ref={ref}
          {...rest}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  },
);

FormInput.displayName = 'FormInput';

export default FormInput;
