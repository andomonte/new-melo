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
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { z } from 'zod';
import { transportadoraSchema } from './_forms/transportadoraSchema';

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

  const [modalConfirmAba, setModalConfirmAba] = useState(false);
  const [abaPendente, setAbaPendente] = useState<string | null>(null);

  const camposObrigatoriosPorAba: Record<string, string[]> = {
    dadosCadastrais: ['nome', 'cpfcgc'],
    dadosFinanceiros: [],
    calculoFrete: [],
  };

  const handleActiveTab = (tab: string) => {
    const camposAba = camposObrigatoriosPorAba[activeTab] || [];
    const camposPendentes = camposAba.filter((campo) => {
      const valor = (transportadora as any)[campo];
      return valor === undefined || valor === null || valor === '';
    });
    if (camposPendentes.length > 0) {
      setAbaPendente(tab);
      setModalConfirmAba(true);
      return;
    }
    setActiveTab(tab);
  };

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

  const [dadosOriginais, setDadosOriginais] = useState<Transportadora>({} as Transportadora);

  const handleClear = () => setTransportadora({ ...dadosOriginais });

  useEffect(() => {
    if (transportadoraId) {
      const fetchTransportadora = async () => {
        const transportadoraData = await getTransportadora(transportadoraId);
        setTransportadora(transportadoraData);
        setDadosOriginais(transportadoraData);
        setLoading(false);
      };
      fetchTransportadora();
    }
  }, [transportadoraId]);

  const handleSubmit = async () => {
    try {
      // Verificar duplicidade de CPF/CNPJ antes de salvar (conforme Delphi)
      if (transportadora.cpfcgc) {
        try {
          const dupResp = await fetch(`/api/transportadoras/verificar-duplicidade?cpfcgc=${encodeURIComponent(transportadora.cpfcgc)}&codtransp=${encodeURIComponent(transportadora.codtransp || '')}`);
          const dupData = await dupResp.json();
          if (dupData.existe) {
            toast({
              description: `CPF/CNPJ já cadastrado para a transportadora "${dupData.transportadora.nome}" (código: ${dupData.transportadora.codtransp}).`,
              variant: 'destructive',
            });
            return;
          }
        } catch (dupError) {
          console.error('Erro ao verificar duplicidade:', dupError);
        }
      }

      // Validar campos obrigatórios antes de enviar
      transportadoraSchema.parse(transportadora);

      await updateTransportadora(transportadora);

      setErrors({});
      setMensagemInfo('Transportadora atualizada com sucesso!');
      setOpenInfo(true);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) fieldErrors[String(err.path[0])] = err.message;
        });
        setErrors(fieldErrors);

        const firstField = String(error.errors[0]?.path[0] || '');
        const campoParaAba: Record<string, string> = {
          nome: 'dadosCadastrais', nomefant: 'dadosCadastrais', cpfcgc: 'dadosCadastrais',
          codtransp: 'dadosCadastrais', cep: 'dadosCadastrais', ender: 'dadosCadastrais',
          numero: 'dadosCadastrais', bairro: 'dadosCadastrais', cidade: 'dadosCadastrais',
          uf: 'dadosCadastrais', codpais: 'dadosCadastrais',
        };
        if (campoParaAba[firstField]) setActiveTab(campoParaAba[firstField]);
      } else {
        toast({
          description: 'Falha ao atualizar transportadora.',
          variant: 'destructive',
        });
      }
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
      <ConfirmationModal
        isOpen={modalConfirmAba}
        onClose={() => { setModalConfirmAba(false); setAbaPendente(null); }}
        onConfirm={() => { setModalConfirmAba(false); if (abaPendente) { setActiveTab(abaPendente); setAbaPendente(null); } }}
        title="Campos obrigatórios pendentes"
        message={`Existem campos obrigatórios não preenchidos na aba atual. Deseja prosseguir mesmo assim?`}
        type="warning"
        confirmText="Prosseguir"
        cancelText="Voltar e corrigir"
      />
    </div>
  );
}
