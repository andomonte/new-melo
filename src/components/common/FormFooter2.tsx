import React from 'react';
import { DefaultButton, AuxButton } from './Buttons2';
import { Loader2 } from 'lucide-react';

interface FormFooterProps {
  onSubmit: () => void;
  onClear: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
  submitText?: string;
}

const FormFooter: React.FC<FormFooterProps> = ({
  onSubmit,
  onClear,
  isSaving,
  hasChanges,
  submitText = 'Salvar',
}) => {
  return (
    <footer className="mt-0 flex justify-end space-x-4">
      <AuxButton onClick={onClear} text="Limpar" />
      <DefaultButton
        onClick={onSubmit}
        disabled={!hasChanges || isSaving}
        className={` ${
          !hasChanges || isSaving ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        text={
          isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : submitText
        }
      />
    </footer>
  );
};

export default FormFooter;
