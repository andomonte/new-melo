import { Label } from '@/components/ui/label';
import React from 'react';
import Select from 'react-select';

interface MultiSearchSelectInputProps {
  name: string;
  options: { value: string | number; label: string }[];
  label?: string;
  defaultValue?: (string | number)[];
  onValueChange?: (value: (string | number)[]) => void;
  onInputChange?: (value: string) => void;
  required?: boolean;
  error?: string;
}

const MultiSearchSelectInput: React.FC<MultiSearchSelectInputProps> = ({
  name,
  options,
  label,
  defaultValue,
  onValueChange,
  onInputChange,
  required,
  error,
}: MultiSearchSelectInputProps) => {
  return (
    <div className="text-gray-700  dark:text-gray-200">
      <Label htmlFor={name}>
        {label || name}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Select
        isMulti
        options={options}
        onChange={(selectedOptions) =>
          onValueChange?.(
            selectedOptions
              ? selectedOptions.map((option) => option.value)
              : [],
          )
        }
        onInputChange={onInputChange}
        defaultValue={options.filter((option) =>
          defaultValue?.includes(option.value),
        )}
        classNames={{
          control: () =>
            'bg-white dark:bg-zinc-800 dark:text-white border border-gray-300 dark:border-zinc-600 rounded-md min-h-[38px]',
          input: () => 'text-gray-800 dark:text-white',
          menu: () => 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-white',
          option: ({ isFocused }) =>
            `px-2 py-1 cursor-pointer ${
              isFocused ? 'bg-gray-100 dark:bg-zinc-700' : ''
            }`,
          multiValue: () =>
            'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-white rounded px-1 py-0.5',
          multiValueLabel: () => 'text-sm',
          multiValueRemove: () =>
            'text-blue-700 dark:text-white hover:text-red-500',
        }}
        theme={(theme) => ({
          ...theme,
          borderRadius: 6,
          colors: {
            ...theme.colors,
            neutral0: 'transparent',
            primary25: '#e2e8f0', // hover claro
            primary: '#3b82f6', // azul principal
          },
        })}
      />

      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default MultiSearchSelectInput;
