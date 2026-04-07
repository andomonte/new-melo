import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React from 'react';

interface SelectInputProps {
  name: string;
  options: { value: string; label: string }[];
  label?: string;
  defaultValue?: string;
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
  onValueChange,
  required,
  error,
  disabled,
}: SelectInputProps) {
  const isValidDefaultValue = options?.some(
    (option) => option.value === defaultValue,
  );

  return (
    <div className="space-y-1 text-gray-700 dark:text-gray-200">
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <Select
        defaultValue={defaultValue}
        name={name}
        onValueChange={onValueChange}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          id={name}
          disabled={disabled}
          className="w-56 h-9 pr-2 px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 truncate"
        >
          <SelectValue
            placeholder={isValidDefaultValue ? defaultValue : 'Selecione'}
            className="truncate"
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
