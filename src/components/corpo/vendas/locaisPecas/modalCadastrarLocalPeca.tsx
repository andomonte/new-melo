import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  NovoLocalPeca,
  insertLocalPeca,
  updateLocalPeca,
  AtualizarLocalPeca,
} from '@/data/locaisPecas/locaisPecas';
import { localPecaSchema } from '@/data/locaisPecas/locaisPecasSchema';
import ModalFormCadastrarLocalPeca from './_forms/modalFormCadastrarLocalPeca';
import InfoModal from '@/components/common/infoModal';
import { CircleCheckBig } from 'lucide-react';

interface ArmazemOption {
  id_armazem: number;
  nome: string;
  filial: string;
  ativo: boolean;
}

interface CadastrarLocalPecaModalProps {
  isOpen: boolean;
  onClose: () => void;
  localPecaToEdit?: NovoLocalPeca;
  onSuccess?: (data: NovoLocalPeca) => void;
}

const CadastrarLocalPecaModal: React.FC<CadastrarLocalPecaModalProps> = ({
  isOpen,
  onClose,
  localPecaToEdit,
  onSuccess,
}) => {
  const [formTouched, setFormTouched] = useState(false);
  const [localPeca, setLocalPeca] = useState<NovoLocalPeca>(() => {
    if (localPecaToEdit) {
      return { ...localPecaToEdit };
    } else {
      return {
        id_local: '',
        id_armazem: 0,
        descricao: '',
        tipo_local: '',
        capacidade: null,
        unidade: '',
      };
    }
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [armazens, setArmazens] = useState<ArmazemOption[]>([]);
  const [loadingArmazens, setLoadingArmazens] = useState(false);

  // Estados para InfoModal
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [infoModalIcon, setInfoModalIcon] = useState<React.ReactElement | null>(
    null,
  );
  const [savedLocalPecaData, setSavedLocalPecaData] =
    useState<NovoLocalPeca | null>(null);

  const fetchArmazens = useCallback(async () => {
    setLoadingArmazens(true);
    try {
      const response = await fetch('/api/locaisPecas/armazens');
      if (!response.ok) {
        throw new Error('Erro ao buscar armazéns');
      }
      const data = await response.json();
      setArmazens(data.data || []);
    } catch (error) {
      console.error('🚨 Erro ao buscar armazéns:', error);
      toast.error('Não foi possível carregar os armazéns');
    } finally {
      setLoadingArmazens(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchArmazens();
      // Reset form se não estiver editando
      if (!localPecaToEdit) {
        setLocalPeca({
          id_local: '',
          id_armazem: 0,
          descricao: '',
          tipo_local: '',
          capacidade: null,
          unidade: '',
        });
        setFormTouched(false);
      }
      setErrors({});
      setIsFormValid(false);
    }
  }, [isOpen, localPecaToEdit, fetchArmazens]);

  useEffect(() => {
    if (!formTouched && !localPecaToEdit) {
      setIsFormValid(false);
      return;
    }

    const result = localPecaSchema.safeParse(localPeca);
    if (!result.success) {
      const fieldErrors: { [key: string]: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path && err.path.length > 0) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      setIsFormValid(false);
    } else {
      setErrors({});
      setIsFormValid(true);
    }
  }, [localPeca, formTouched, localPecaToEdit]);

  const handleLocalPecaChange = useCallback(
    (updatedFields: Partial<NovoLocalPeca>) => {
      setFormTouched(true);
      setLocalPeca((prev) => ({ ...prev, ...updatedFields }));
    },
    [],
  );

  const handleClear = useCallback(() => {
    setLocalPeca({
      id_local: '',
      id_armazem: 0,
      descricao: '',
      tipo_local: '',
      capacidade: null,
      unidade: '',
    });
    setErrors({});
    setIsFormValid(false);
    setFormTouched(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSaving(true);
    setFormTouched(true);

    const combinedErrors: { [key: string]: string } = {};
    let formHasErrors = false;

    const result = localPecaSchema.safeParse(localPeca);
    if (!result.success) {
      result.error.errors.forEach((err) => {
        if (err.path && err.path.length > 0) {
          combinedErrors[err.path[0].toString()] = err.message;
        }
      });
      formHasErrors = true;
    }

    if (formHasErrors) {
      setErrors(combinedErrors);
      setIsSaving(false);
      toast.error('Verifique os campos destacados.');
      return;
    }

    const validatedData = result.data!;

    try {
      if (localPecaToEdit) {
        // Modo edição - usar updateLocalPeca
        const dataParaAtualizar: AtualizarLocalPeca = {
          id_local: validatedData.id_local,
          id_armazem: validatedData.id_armazem,
          descricao: validatedData.descricao,
          tipo_local: validatedData.tipo_local,
          capacidade: validatedData.capacidade,
          unidade: validatedData.unidade,
        };
        await updateLocalPeca(dataParaAtualizar);
      } else {
        // Modo criação - usar insertLocalPeca
        await insertLocalPeca(validatedData);
      }

      setSavedLocalPecaData(validatedData);
      setMensagemInfo(
        localPecaToEdit
          ? 'Local de peça atualizado com sucesso!'
          : 'Local de peça cadastrado com sucesso!',
      );
      setInfoModalIcon(<CircleCheckBig className="text-green-500 w-6 h-6" />);
      setOpenInfo(true);
    } catch (error) {
      console.error('🚨 Erro ao salvar local de peça:', error);
      toast.error(`Erro ao salvar local de peça: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }, [localPeca, localPecaToEdit]);

  const handleCloseModal = useCallback(() => {
    if (!localPecaToEdit) {
      handleClear();
    }
    onClose();
  }, [localPecaToEdit, handleClear, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <ModalFormCadastrarLocalPeca
        titulo={
          localPecaToEdit ? 'Editar Local de Peça' : 'Cadastrar Local de Peça'
        }
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        handleLocalPecaChange={handleLocalPecaChange}
        onClose={handleCloseModal}
        localPeca={localPeca}
        error={errors}
        isSaving={isSaving}
        isFormValid={isFormValid}
        armazens={armazens}
        loadingArmazens={loadingArmazens}
        isEditMode={!!localPecaToEdit}
      />

      {/* InfoModal para exibir mensagens de sucesso */}
      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          if (onSuccess && savedLocalPecaData) {
            onSuccess(savedLocalPecaData);
          }
          setSavedLocalPecaData(null);
          onClose();
        }}
        title="INFORMAÇÃO"
        icon={infoModalIcon === null ? undefined : infoModalIcon}
        content={mensagemInfo}
      />

      <Toaster />
    </>
  );
};

export default CadastrarLocalPecaModal;
