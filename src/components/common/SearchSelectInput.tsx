import { Label } from '@/components/ui/label';
import React from 'react';
import Select from 'react-select';

interface SearchSelectInputProps {
  name: string;
  options: { value: string | number; label: string }[];
  label?: string;
  defaultValue?: string | number;
  value?: string | number;
  onValueChange?: (value: string | number) => void;
  onInputChange?: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

const SearchSelectInput: React.FC<SearchSelectInputProps> = ({
  name,
  options,
  label,
  defaultValue,
  value,
  onValueChange,
  onInputChange,
  required,
  error,
  disabled,
}) => {
  return (
    <div className="text-gray-700 dark:text-gray-200 space-y-1">
      {label && (
        <Label htmlFor={name}>
          {label} {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <Select
        options={options}
        defaultValue={(options ?? []).find(
          (option) => option.value === defaultValue,
        )}
        onChange={(selectedOption) =>
          onValueChange?.(selectedOption?.value || '')
        }
        value={
          value !== undefined && options
            ? options.find((opt) => opt.value === value)
            : undefined
        }
        onInputChange={onInputChange}
        isDisabled={disabled}
        unstyled
        menuPlacement="auto"
        menuPosition="absolute"
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
        classNames={{
          control: ({ isFocused }) =>
            `flex items-center rounded-md border px-2 py-[6px] text-sm shadow-sm
             ${isFocused ? 'ring-1 ring-blue-500' : ''}
             bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600`,
          input: () => 'text-gray-900 dark:text-white px-1',
          singleValue: () => 'text-gray-900 dark:text-white',
          placeholder: () => 'text-gray-400 dark:text-zinc-500',
          menu: () =>
            'mt-1 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white z-50 shadow-md',
          option: ({ isFocused, isSelected }) =>
            `px-3 py-1 cursor-pointer rounded-sm ${
              isSelected
                ? 'bg-blue-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'
                : isFocused
                ? 'bg-gray-100 dark:bg-zinc-700'
                : 'bg-white dark:bg-zinc-800'
            }`,
        }}
      />
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default SearchSelectInput;
