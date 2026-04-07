import React, { useState, useEffect } from 'react';
import ModalForm from '@/components/common/modalform';
import RequisitionHeader from './RequisitionHeader';
import RequisitionItems from './RequisitionItems';
import { useRequisitionForm } from '../hooks/useRequisitionForm';
import { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RequisitionModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const { submit, reset, saving } = useRequisitionForm(onSuccess ?? (() => {}));
  const [activeStep, setActiveStep] = useState<'header' | 'items'>('header');
  const [requisitionHeader, setRequisitionHeader] =
    useState<Partial<RequisitionDTO> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      reset();
      setActiveStep('header');
      setRequisitionHeader(null);
    }
  }, [isOpen, reset]);

  // Se não estiver aberto, não renderiza nada
  if (!isOpen) {
    return null;
  }

  const handleHeaderSubmit = async (data: Partial<RequisitionDTO>) => {
    const success = await submit();
    if (success) {
      setRequisitionHeader(data);
      setActiveStep('items');
      toast({
        title: 'Cabeçalho salvo com sucesso!',
        description: 'Agora, adicione os itens.',
      });
    } else {
      toast({ title: 'Erro ao salvar cabeçalho', variant: 'destructive' });
    }
  };

  const handleFinalSubmit = async () => {
    // A lógica final para submeter a requisição com os itens virá aqui.
    console.log('Submetendo requisição final:', requisitionHeader);
    onSuccess?.();
    onClose();
  };

  return (
    <ModalForm
      titulo="Nova Requisição de Compra"
      onClose={onClose}
      loading={saving}
      footer={null}
      tabs={[]}
      activeTab=""
      setActiveTab={() => {}}
      handleSubmit={() => {}} // CORREÇÃO: Propriedade obrigatória adicionada
      handleClear={() => {}} // CORREÇÃO: Propriedade obrigatória adicionada
      renderTabContent={() => (
        <>
          {activeStep === 'header' && (
            <RequisitionHeader
              onSave={handleHeaderSubmit}
              onCancel={onClose}
              isLoading={saving}
            />
          )}
          {activeStep === 'items' && requisitionHeader && (
            <RequisitionItems
              headerData={requisitionHeader}
              onBack={() => setActiveStep('header')}
              onSubmit={handleFinalSubmit}
            />
          )}
        </>
      )}
    />
  );
}
