import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import React from 'react';

interface FormInputProps {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  defaultValue?: string|number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
}

const FormInput: React.FC<FormInputProps> = ({
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
}: FormInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.toUpperCase();
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="text-gray-700">
      <Label htmlFor={name} className="text-gray-700">{label || name}{required && <span className="text-red-500"> *</span>}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required
        onChange={handleChange}
        onInput={onInput}
        className={className}
        disabled={disabled}
        maxLength={maxLength || 255}
      />
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

export default FormInput;