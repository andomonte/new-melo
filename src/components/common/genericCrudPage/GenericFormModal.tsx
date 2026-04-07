// Local sugerido: src/components/common/Modals/GenericFormModal.tsx

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import ModalFormulario from '@/components/common/modalform'; // Seu componente base de modal
import { useToast } from '@/hooks/use-toast';
import Carregamento from '@/utils/carregamento';

/**
 * Props que o SEU componente de formulário (ex: FormacaoPrecoForm) deverá receber.
 * O GenericFormModal vai fornecer essas props para ele.
 */
export interface FormComponentProps<T> {
  formData: T;
  onFormChange: (fieldName: keyof T, value: any) => void;
  errors: { [key: string]: string };
}

interface GenericFormModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: T) => Promise<void>;
  title: string;
  initialData: T | null; // Se for null, é um cadastro. Se tiver dados, é edição.
  validationSchema: z.Schema<T>;
  // O componente que contém os campos <FormInput />
  FormComponent: React.ComponentType<FormComponentProps<T>>;
  isSaving: boolean;
  isLoading?: boolean; // Para exibir loading enquanto busca os dados para edição
}

export function GenericFormModal<T extends object>({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialData,
  validationSchema,
  FormComponent,
  isSaving,
  isLoading,
}: GenericFormModalProps<T>) {
  const [formData, setFormData] = useState<T | null>(initialData);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  useEffect(() => {
    // Quando o modal abre ou os dados iniciais mudam, atualiza o estado do formulário.
    if (isOpen) {
      setFormData(initialData);
      setErrors({}); // Limpa os erros ao abrir
    }
  }, [initialData, isOpen]);

  const handleFormChange = (fieldName: keyof T, value: any) => {
    setFormData((prev) => (prev ? { ...prev, [fieldName]: value } : null));
    // Limpa o erro do campo quando o usuário começa a digitar
    if (errors[fieldName as string]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName as string];
        return newErrors;
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData) return;

    try {
      // 1. Validação com Zod
      validationSchema.parse(formData);
      setErrors({});

      // 2. Submissão (chama a função que veio via props)
      await onSubmit(formData);

      onClose(); // Fecha o modal em caso de sucesso
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Erros de validação
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0)
            fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        // Erros da API
        const errorMessage =
          (error as any)?.response?.data?.error ||
          'Ocorreu um erro desconhecido.';
        toast({ description: errorMessage, variant: 'destructive' });
      }
    }
  };

  // O conteúdo do formulário que será renderizado dentro do ModalFormulario
  const renderTabContent = () => {
    if (isLoading) return <Carregamento texto="Carregando dados..." />;
    if (!formData) return null; // Não renderiza nada se não houver dados

    return (
      <FormComponent
        formData={formData}
        onFormChange={handleFormChange}
        errors={errors}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <ModalFormulario
      titulo={title}
      tabs={[{ name: 'Dados Gerais', key: 'dadosGerais' }]} // Simplificado, pode ser ajustado
      activeTab="dadosGerais"
      setActiveTab={() => {}}
      renderTabContent={renderTabContent}
      handleSubmit={handleSubmit}
      handleClear={() => setFormData(initialData)} // Botão Limpar reseta para os dados iniciais
      onClose={onClose}
      isSaving={isSaving}
      isFormValid={!!formData && !isLoading}
    />
  );
}
