import React, { useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import InfoModal from '@/components/common/infoModal';
import ModalFormulario from '@/components/common/modalform';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { CircleCheck } from 'lucide-react';
import { insertUsuario, UsuarioEdit } from '@/data/usuarios/usuarios';
import { getGroups, Grupos } from '@/data/grupos/grupos';
import DadosCadastrais from '@/components/corpo/admin/controleAcesso/usuarios/_forms/DadosCadastrais';
import { cadastroUsuarioSchema } from '@/data/usuarios/usuarioSchemas';
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const tabs = [{ name: 'Dados Cadastrais', key: 'dadosCadastrais' }];

export type CadUsuarioSearchOptions = 'grupo';

export default function CustomModal({ isOpen, onClose }: ModalProps) {
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

  const handleSubmit = () => {
    try {
      cadastroUsuarioSchema.parse(usuario);

      insertUsuario(usuario);

      setErrors({});

      setMensagemInfo('Usuário cadastrado com sucesso!');
      setOpenInfo(true);
    } catch (error) {
      toast({
        description: 'Falha ao cadastrar usuário.',
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
    <div>
      <ModalFormulario
        titulo="Cadastro de Usuário"
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={handleActiveTab}
        renderTabContent={renderTabContent}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        onClose={onClose}
        loading={loading}
      />
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
