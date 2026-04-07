import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  name: string;
  type?: string;
  required?: boolean;
  label?: string;
  defaultValue?: string | number;
  value?: string | number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      name,
      type,
      required,
      label,
      defaultValue,
      value,
      placeholder,
      onChange,
      onInput,
      className,
      error,
      disabled,
      maxLength,
      ...rest
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.toUpperCase();
      if (onChange) {
        onChange(e);
      }
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
          {...(value !== undefined ? { value } : { defaultValue })}
          placeholder={placeholder}
          onChange={handleChange}
          onInput={onInput}
          className={className}
          disabled={disabled}
          maxLength={maxLength || 255}
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
