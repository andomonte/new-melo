import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, ...props }) => {
  return (
    <div className="flex flex-col mb-4">
      <label className="mb-1 font-semibold text-sm">{label}</label>
      <input
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-300 dark:bg-zinc-800 dark:text-white"
        {...props}
      />
    </div>
  );
};

export default Input;
