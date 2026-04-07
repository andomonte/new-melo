// src/components/ui/textarea.tsx
import { Label } from '@/components/ui/label';
import React from 'react';

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ id, name, label, required, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1 text-gray-700 dark:text-gray-200">
        {label && (
          <Label htmlFor={id || name}>
            {label}
            {required && <span className="text-red-500"> *</span>}
          </Label>
        )}
        <textarea
          id={id || name}
          name={name}
          ref={ref}
          className={`w-full px-2 py-1 border rounded bg-white dark:bg-zinc-900 dark:text-white resize-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea };
