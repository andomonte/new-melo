import { Checkbox } from '@/components/ui/checkbox';
import React from 'react';

interface CheckInputProps {
  label: string;
  name: string;
  checked?: boolean;
  onChange: (e: { target: { name: string; checked: boolean } }) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const CheckInput: React.FC<CheckInputProps> = ({
  label,
  name,
  checked,
  onChange,
  error,
  required,
  disabled,
}) => {
  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id={name}
          checked={checked}
          onCheckedChange={(isChecked) =>
            onChange({ target: { name, checked: isChecked as boolean } })
          }
          className="mr-2 leading-tight"
          disabled={disabled}
        />
        <label
          htmlFor={name}
          className={`block text-gray-600 dark:text-gray-200 ${
            disabled ? 'text-gray-400' : ''
          }`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      </div>
      {error && <p className="text-red-500">{error}</p>}
    </>
  );
};

export default CheckInput;
