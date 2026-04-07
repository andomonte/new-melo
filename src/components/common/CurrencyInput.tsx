// src/components/common/CurrencyInput.tsx
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: number | undefined) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  name,
  value,
  onChange,
  error,
  placeholder = 'R$ 0,00',
  disabled = false,
  className,
}) => {
  const [localInput, setLocalInput] = useState(value);

  useEffect(() => {
    if (!value || value.includes('R$')) {
      setLocalInput(value);
    } else {
      const parsed = parseFloat(value.replace('.', '').replace(',', '.'));
      if (!isNaN(parsed)) {
        const formatted = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsed);
        setLocalInput(formatted);
      } else {
        setLocalInput('');
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value);
  };

  const handleBlur = () => {
    const cleaned = localInput.replace(/[^\d,]/g, '').replace(',', '.');
    const numericVal = parseFloat(cleaned);

    if (!isNaN(numericVal)) {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericVal);

      setLocalInput(formatted);
      onChange(numericVal);
    } else {
      setLocalInput('');
      onChange(undefined);
    }
  };

  return (
    <div className={`space-y-1 text-gray-700 dark:text-gray-200 ${className}`}>
      {label && <Label htmlFor={name}>{label}</Label>}
      <Input
        id={name}
        name={name}
        type="text"
        value={localInput}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default CurrencyInput;
