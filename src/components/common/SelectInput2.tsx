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
  label?: string;
  options: { value: string; label: string }[];
  value: string; // <-- valor controlado
  onValueChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function SelectInput({
  name,
  options,
  label,
  value,
  onValueChange,
  required,
  error,
  disabled,
}: SelectInputProps) {
  return (
    <div className="space-y-1 text-gray-700 dark:text-gray-200">
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <Select
        value={value}
        name={name}
        onValueChange={onValueChange}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          id={name}
          disabled={disabled}
          // Substitua a className existente por esta:
          className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:ring-blue-400 uppercase"
        >
          <SelectValue placeholder={'Selecione...'} />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white rounded-md shadow-md z-50">
          {options.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="cursor-pointer px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 focus:bg-blue-100 dark:focus:bg-[#1f517c] focus:text-blue-600 dark:focus:text-blue-300 uppercase"
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
