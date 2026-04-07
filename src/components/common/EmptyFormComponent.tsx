import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';

export const EmptyFormComponent = <T,>({
  formData: _formData,
  onFormChange: _onFormChange,
  errors: _errors,
}: FormComponentProps<T>) => {
  // Componente vazio para telas somente leitura
  return null;
};

export default EmptyFormComponent;
