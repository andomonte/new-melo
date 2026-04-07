// src/pages/cadastros/cfop/CfopForm.tsx

import React, { useState } from 'react';
import FormInput from '@/components/common/FormInput'; // Certifique-se que o caminho está correto
import { FormComponentProps } from '@/components/common/genericCrudPage/GenericFormModal';
import { Cfop, checkCfopExists } from '@/data/cfop/cfop';
import { useToast } from '@/hooks/use-toast';

export const CfopForm: React.FC<FormComponentProps<Cfop>> = ({
  formData,
  onFormChange,
  errors,
}) => {
  const [cfopError, setCfopError] = useState<string>('');
  const [isCheckingCfop, setIsCheckingCfop] = useState(false);
  const { toast } = useToast();

  // Função genérica para notificar o componente pai sobre mudanças no formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof Cfop, e.target.value);
  };

  // Função para validar CFOP em tempo real
  const validarCfop = async (cfop: string) => {
    if (!cfop || cfop.length !== 4) {
      setCfopError('');
      return;
    }

    // Se estamos editando (formData.cfop já existe), não validar duplicação
    if (formData.cfop && formData.cfop === cfop) {
      setCfopError('');
      return;
    }

    setIsCheckingCfop(true);
    try {
      const exists = await checkCfopExists(cfop);
      if (exists) {
        setCfopError('Este CFOP já está cadastrado no sistema');
        toast({
          title: 'CFOP Duplicado',
          description: 'Este CFOP já está cadastrado no sistema',
          variant: 'destructive',
        });
      } else {
        setCfopError('');
      }
    } catch (error) {
      console.error('Erro ao verificar CFOP:', error);
      toast({
        title: 'Erro de Validação',
        description: 'Erro ao verificar se o CFOP já existe',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingCfop(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput
        name="cfop"
        label="CFOP"
        value={formData.cfop || ''}
        onChange={handleInputChange}
        onBlur={(e) => validarCfop(e.target.value)}
        error={cfopError || errors.cfop}
        required
        maxLength={4}
        // Conforme a documentação, desabilitamos a chave primária na edição
        type={''}
      />
      <FormInput
        name="descr"
        label="Descrição"
        value={formData.descr || ''}
        onChange={handleInputChange}
        error={errors.descr}
        required
        maxLength={255}
        // Faz o campo ocupar duas colunas
        className="md:col-span-2"
        type={''}
      />
      <FormInput
        name="cfopinverso"
        label="CFOP Inverso"
        value={formData.cfopinverso || ''}
        onChange={handleInputChange}
        error={errors.cfopinverso}
        maxLength={4}
        type={''}
        placeholder="Opcional"
      />
      <FormInput
        name="excecao"
        label="Exceção (S/N)"
        value={formData.excecao || ''}
        onChange={handleInputChange}
        error={errors.excecao}
        maxLength={1}
        type={''}
      />
      {isCheckingCfop && (
        <div className="md:col-span-2 text-blue-500 text-sm">
          Verificando CFOP...
        </div>
      )}
    </div>
  );
};
