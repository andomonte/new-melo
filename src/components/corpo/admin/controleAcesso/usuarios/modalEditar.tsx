import React, { useEffect, useState, useCallback } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import ModalForm from '@/components/common/modalform';
import InfoModal from '@/components/common/infoModal';
import { z } from 'zod';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Carregamento from '@/utils/carregamento';
import { CircleCheck } from 'lucide-react';
import {
  getUsuario,
  updateUsuario,
  UsuarioEdit,
} from '@/data/usuarios/usuarios';
import { getGroups, Grupos } from '@/data/grupos/grupos';
import { cadastroUsuarioSchema } from '@/data/usuarios/usuarioSchemas';
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  usuarioId: string;
}

const tabs = [{ name: 'Dados Cadastrais', key: 'dadosCadastrais' }];

export type CadUsuarioSearchOptions = 'grupo';

export default function CustomModal({
  isOpen,
  usuarioId,
  onClose,
}: ModalProps) {
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [usuario, setUsuario] = useState({} as UsuarioEdit);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [options, setOptions] = useState({
    grupos: {} as Grupos,
  });
  const [searchOptions, setSearchOptions] = useState({
    grupo: '',
  });
  const { toast } = useToast();

  const handleUsuarioChange = (field: keyof UsuarioEdit, value: any) => {
    setUsuario((prevUsuario: UsuarioEdit) => ({
      ...prevUsuario,
      [field]: value,
    }));

    setErrors((prevErrors) => {
      const updated = { ...prevErrors };
      delete updated[field];
      return updated;
    });
  };

  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const handleClear = () => {
    setUsuario({} as UsuarioEdit);
  };

  const handleSearchOptionsChange = useDebouncedCallback(
    (option: CadUsuarioSearchOptions, value: string) => {
      setSearchOptions((prevState) => ({
        ...prevState,
        [option]: value,
      }));
    },
    300,
  );

  const handleGrupos = useCallback(async () => {
    const grupos = await getGroups({
      page: 1,
      perPage: 999,
      search: searchOptions.grupo,
    });
    setOptions((prevState) => ({
      ...prevState,
      grupos,
    }));
    setLoading(false);
  }, [searchOptions.grupo]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const grupos = await getGroups({
          page: 1,
          perPage: 999,
          search: searchOptions.grupo,
        });
        setOptions((prevState) => ({
          ...prevState,
          grupos,
        }));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (searchOptions.grupo) {
      handleGrupos();
    } else {
      fetchInitialData();
    }
  }, [searchOptions, handleGrupos]);

  useEffect(() => {
    if (usuarioId) {
      const fetchUsuario = async () => {
        const usuarioData = await getUsuario(usuarioId as string);
        setUsuario(usuarioData);

        const grupos = await getGroups({
          page: 1,
          perPage: 999,
          search: searchOptions.grupo,
        });
        setOptions((prevState) => ({
          ...prevState,
          grupos,
        }));

        setLoading(false);
      };
      fetchUsuario();
    }
  }, [usuarioId, searchOptions.grupo]);

  const handleSubmit = () => {
    try {
      cadastroUsuarioSchema.parse(usuario);

      updateUsuario(usuarioId, usuario);

      setErrors({});
      setMensagemInfo('Usuário atualizado com sucesso!');
      setOpenInfo(true);
    } catch (error) {
      console.log('error', error);

      toast({
        description: 'Falha ao atualizar usuário.',
        variant: 'destructive',
      });
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path[0]] = error.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dadosCadastrais':
        return (
          <DadosCadastrais
            usuario={usuario}
            handleUsuarioChange={handleUsuarioChange}
            options={options}
            handleSearchOptionsChange={handleSearchOptionsChange}
            error={errors}
            isEdit
          />
        );
      default:
        return null;
    }
  };
  const handleCloseInfoModal = () => {
    setOpenInfo(false);
    onClose();
  };
  if (!isOpen) return null;
  return (
    <div className="fixed  inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {usuario?.login_user_login === usuarioId ? (
        <ModalForm
          titulo="Editar Usuário"
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={handleActiveTab}
          renderTabContent={() => <>{renderTabContent()}</>}
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          onClose={onClose}
          loading={loading}
        />
      ) : (
        <Carregamento />
      )}
      <InfoModal
        isOpen={openInfo}
        onClose={handleCloseInfoModal}
        title="INFORMAÇÃO IMPORTANTE"
        icon={<CircleCheck className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />
      <Toaster />
    </div>
  );
}
