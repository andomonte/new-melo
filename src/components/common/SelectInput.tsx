import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import React from 'react';

interface SelectInputProps {
  name: string;
  options: { value: string; label: string }[];
  label?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export default function SelectInput({
  name,
  options,
  label,
  defaultValue = '10',
  value,
  onValueChange,
  required,
  error,
  disabled,
}: SelectInputProps) {
  const currentValue = value !== undefined ? value : defaultValue;
  const isValidValue = options?.some((option) => option.value === currentValue);

  return (
    <div className="space-y-1 text-gray-700 dark:text-gray-200">
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <Select
        {...(value !== undefined ? { value } : { defaultValue })}
        name={name}
        onValueChange={onValueChange}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          id={name}
          disabled={disabled}
          className={cn(
            'w-full h-10 text-sm',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <SelectValue
            placeholder={isValidValue ? currentValue : 'Selecione'}
          />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white rounded-md shadow-md z-50">
          {options?.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="cursor-pointer px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 focus:bg-blue-100 dark:focus:bg-[#1f517c] focus:text-blue-600 dark:focus:text-blue-300"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
