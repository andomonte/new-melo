import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import React from 'react';

interface FormInputProps {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  defaultValue?: string | number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}

const FormInputNumber: React.FC<FormInputProps> = ({
  name,
  type,
  required,
  label,
  defaultValue,
  placeholder,
  onChange,
  className,
  error,
  disabled,
  min,
  max,
}: FormInputProps) => {
  return (
    <div className="text-gray-700">
      <Label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label || name}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required
        onChange={onChange}
        className={className}
        disabled={disabled}
        min={min}
        max={max}
      />
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default FormInputNumber;
