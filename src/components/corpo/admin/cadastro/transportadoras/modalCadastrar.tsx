import React, { useState, useCallback } from 'react';
import DadosCadastrais from './_forms/DadosCadastrais';
import DadosFinanceiros from './_forms/DadosFinanceiros';
import CalculoFrete from './_forms/CalculoFrete';
import {
  Transportadora,
  insertTransportadora,
} from '@/data/transportadoras/transportadoras';
import ModalFormulario from '@/components/common/modalform';
import InfoModal from '@/components/common/infoModal';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { CircleCheck } from 'lucide-react';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { campoParaAba } from './_forms/campoParaAba';
import { z } from 'zod';
import { transportadoraSchema } from './_forms/transportadoraSchema';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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
}: ModalProps) {
  const [transportadora, setTransportadora] = useState({} as Transportadora);
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { toast } = useToast();

  const [modalConfirmAba, setModalConfirmAba] = useState(false);
  const [abaPendente, setAbaPendente] = useState<string | null>(null);

  const camposObrigatoriosPorAba: Record<string, string[]> = {
    dadosCadastrais: ['nome', 'cpfcgc', 'nomefant', 'ender', 'numero', 'bairro', 'cidade', 'uf', 'codpais', 'cep'],
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

  const handleClear = () => {
    setTransportadora({} as Transportadora);
  };

  const handleSubmit = async () => {
    try {
      // Verificar duplicidade de CPF/CNPJ antes de salvar (conforme Delphi)
      if (transportadora.cpfcgc) {
        try {
          const dupResp = await fetch(`/api/transportadoras/verificar-duplicidade?cpfcgc=${encodeURIComponent(transportadora.cpfcgc)}`);
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

      await insertTransportadora(transportadora);
      setErrors({});
      setMensagemInfo('Transportadora cadastrada com sucesso!');
      setOpenInfo(true);
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        toast({
          description: 'Falha ao cadastrar transportadora.',
          variant: 'destructive',
        });
      }

      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) fieldErrors[err.path[0]] = err.message;
        });

        // Ordenar erros pela sequência das abas
        const tabOrder = ['dadosCadastrais', 'dadosFinanceiros', 'calculoFrete'];
        const sortedErrors = [...error.errors].sort((a, b) => {
          const tabA = tabOrder.indexOf(campoParaAba[String(a.path[0])] || '');
          const tabB = tabOrder.indexOf(campoParaAba[String(b.path[0])] || '');
          return tabA - tabB;
        });
        const firstError = sortedErrors[0];
        const fieldWithError = firstError.path[0];
        const abaDoErro = campoParaAba[fieldWithError as string];

        if (abaDoErro) {
          setActiveTab(abaDoErro);
          setTimeout(() => {
            const el = document.getElementById(fieldWithError as string);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (el as HTMLInputElement).focus();
            }
          }, 100);
        }

        setErrors(fieldErrors);
      }
    }
  };

  const handleCloseInfoModal = () => {
    setOpenInfo(false);
    onClose();
    onSuccess?.(); // <-- chama onSuccess após o fechamento do modal de sucesso
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
    <div>
      <ModalFormulario
        titulo="Cadastro de Transportadora"
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={handleActiveTab}
        renderTabContent={renderTabContent}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        onClose={onClose}
        loading={false}
      />
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
        message={`Existem campos obrigatórios não preenchidos na aba "${tabs.find((t) => t.key === activeTab)?.name || activeTab}". Deseja prosseguir mesmo assim?`}
        type="warning"
        confirmText="Prosseguir"
        cancelText="Voltar e corrigir"
      />
    </div>
  );
}
