import React from 'react';
import { DefaultButton, AuxButton } from './Buttons';

interface FormFooterProps {
  onSubmit: () => void;
  onClear: () => void;
}

const FormFooter: React.FC<FormFooterProps> = ({ onSubmit, onClear }) => {
  return (
    <footer className="mt-0 flex justify-end space-x-4">
      <AuxButton onClick={onClear} text="Limpar" />
      <DefaultButton onClick={onSubmit} text="Salvar" />
    </footer>
  );
};

export default FormFooter;
