import React, { useEffect, useState, useCallback } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import DadosFinanceiros from './_forms/DadosFinanceiros';
import CalculoFrete from './_forms/CalculoFrete';
import {
  Transportadora,
  getTransportadora,
  updateTransportadora,
} from '@/data/transportadoras/transportadoras';
import ModalFormulario from '@/components/common/modalform';
import InfoModal from '@/components/common/infoModal';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import Carregamento from '@/utils/carregamento';
import { CircleCheck } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  transportadoraId: string;
}

const tabs = [
  { name: 'Dados Cadastrais', key: 'dadosCadastrais' },
  { name: 'Dados Financeiros', key: 'dadosFinanceiros' },
  { name: 'Cálculo Frete', key: 'calculoFrete' },
];

export default function CustomModal({
  isOpen,
  onClose,
  onSuccess,
  transportadoraId,
}: ModalProps) {
  const [transportadora, setTransportadora] = useState({} as Transportadora);
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);

  const { toast } = useToast();

  const handleActiveTab = (tab: string) => setActiveTab(tab);

  const handleTransportadoraChange = useCallback(
    (field: string, value: any) => {
      setTransportadora((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    },
    [],
  );

  const handleClear = () => setTransportadora({} as Transportadora);

  useEffect(() => {
    if (transportadoraId) {
      const fetchTransportadora = async () => {
        const transportadoraData = await getTransportadora(transportadoraId);
        setTransportadora(transportadoraData);
        setLoading(false);
      };
      fetchTransportadora();
    }
  }, [transportadoraId]);

  const handleSubmit = async () => {
    try {
      await updateTransportadora(transportadora);

      setErrors({});
      setMensagemInfo('Transportadora atualizada com sucesso!');
      setOpenInfo(true); // abre o modal de info
    } catch (_error) {
      toast({
        description: 'Falha ao atualizar transportadora.',
        variant: 'destructive',
      });
    }
  };

  const handleCloseInfoModal = () => {
    setOpenInfo(false);
    onClose();
    onSuccess?.(); // <-- chama o onSuccess após fechamento
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dadosCadastrais':
        return (
          <DadosCadastrais
            transportadora={transportadora}
            handleTransportadoraChange={handleTransportadoraChange}
            error={errors}
          />
        );
      case 'dadosFinanceiros':
        return (
          <DadosFinanceiros
            transportadora={transportadora}
            handleTransportadoraChange={handleTransportadoraChange}
            error={errors}
          />
        );
      case 'calculoFrete':
        return (
          <CalculoFrete
            transportadora={transportadora}
            handleTransportadoraChange={handleTransportadoraChange}
            error={errors}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {transportadora?.codtransp === transportadoraId ? (
        <ModalFormulario
          titulo="Editar Transportadora"
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={handleActiveTab}
          renderTabContent={() => <div>{renderTabContent()}</div>}
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
