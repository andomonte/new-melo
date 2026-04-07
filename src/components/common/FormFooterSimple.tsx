import React from 'react';
import { DefaultButton, AuxButton } from './Buttons2';
import { Oval } from 'react-loader-spinner';

interface FormFooterSimpleProps {
  onSubmit: () => void;
  onClear: () => void;
  isSaving?: boolean;
}

const FormFooterSimple: React.FC<FormFooterSimpleProps> = ({
  onSubmit,
  onClear,
  isSaving,
}) => {
  return (
    <footer className="mt-0 flex justify-end space-x-4">
      <AuxButton onClick={onClear} text="Limpar" />
      <DefaultButton
        onClick={onSubmit}
        disabled={isSaving}
        className={` ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
        text={
          isSaving ? (
            <Oval
              height={40}
              width={40}
              color="currentColor"
              secondaryColor="currentColor"
              strokeWidth={4}
            />
          ) : (
            'Salvar'
          )
        }
      />
    </footer>
  );
};

export default FormFooterSimple;
