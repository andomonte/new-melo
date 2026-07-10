import React, { useState, useCallback, useEffect } from 'react';
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
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import { campoParaAba } from './_forms/campoParaAba';
import { z } from 'zod';
import { cadastroTransportadoraSchema } from './_forms/transportadoraSchema';
import { buscaCnpj } from '@/data/cnpj';
import {
  DocumentoDuplicadoModal,
  DocumentoMatch,
} from '@/components/common/DocumentoDuplicadoModal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Quando o documento já existe como transportadora, abre para edição */
  onEditarTransportadora?: (codtransp: string) => void;
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
  onEditarTransportadora,
}: ModalProps) {
  const [transportadora, setTransportadora] = useState({} as Transportadora);
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [activeTab, setActiveTab] = useState('dadosCadastrais');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [dupMatches, setDupMatches] = useState<DocumentoMatch[]>([]);
  const [showDup, setShowDup] = useState(false);

  const { toast } = useToast();
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Confirmar cadastro',
    message: 'Deseja realmente cadastrar esta transportadora?',
  });

  // Sempre abrir o cadastro em branco (evita trazer dados de uma abertura anterior)
  useEffect(() => {
    if (isOpen) {
      setTransportadora({ tipo: 'J' } as Transportadora);
      setErrors({});
      setActiveTab('dadosCadastrais');
      setShowDup(false);
      setDupMatches([]);
    }
  }, [isOpen]);

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
    setTransportadora({ tipo: 'J' } as Transportadora);
  };

  const setCampo = useCallback(
    (field: string, value: any) => {
      if (value !== undefined && value !== null && String(value) !== '') {
        handleTransportadoraChange(field, value);
      }
    },
    [handleTransportadoraChange],
  );

  // Reaproveita dados de um Cliente/Fornecedor existente para a Transportadora
  const preencherDeOrigem = useCallback(
    async (tipoOrigem: 'CLIENTE' | 'FORNECEDOR', id: string) => {
      const url =
        tipoOrigem === 'CLIENTE'
          ? `/api/clientes/get/${id}`
          : `/api/fornecedores/get/${id}`;
      const r = await fetch(url);
      if (!r.ok) return;
      const d = await r.json();
      setCampo('nome', d.nome);
      setCampo('nomefant', tipoOrigem === 'CLIENTE' ? d.nomefant : d.nome_fant);
      setCampo('tipo', d.tipo); // cliente/fornecedor já usam 'J'/'F'
      setCampo('ender', tipoOrigem === 'CLIENTE' ? d.ender : d.endereco);
      setCampo('numero', d.numero);
      setCampo('complemento', d.complemento);
      setCampo('bairro', d.bairro);
      setCampo('cidade', d.cidade);
      setCampo('uf', d.uf);
      setCampo('cep', d.cep);
      setCampo('codpais', d.codpais);
      setCampo('iest', d.iest);
      setCampo('isuframa', d.isuframa);
      setCampo('imun', d.imun);
      setCampo('referencia', d.referencia);
      setCampo('codmunicipio', d.codmunicipio);
      setCampo('codbairro', d.codbairro);
      toast({
        description: `Dados do ${
          tipoOrigem === 'CLIENTE' ? 'cliente' : 'fornecedor'
        } carregados. Revise e salve como transportadora.`,
      });
    },
    [setCampo, toast],
  );

  // Busca CNPJ na BrasilAPI e preenche (igual ao cliente/fornecedor)
  const preencherDeCnpj = useCallback(
    async (digits: string) => {
      try {
        const d = await buscaCnpj(digits);
        setCampo('nome', d.razao_social?.substring(0, 50));
        setCampo('nomefant', d.nome_fantasia?.substring(0, 40));
        setCampo('ender', d.logradouro);
        setCampo('numero', d.numero);
        setCampo('complemento', d.complemento);
        setCampo('bairro', d.bairro);
        setCampo('cidade', d.municipio);
        setCampo('uf', d.uf);
        if (d.cep) setCampo('cep', d.cep.replace(/\D/g, ''));
        handleTransportadoraChange('codpais', 1058);
        toast({ description: `CNPJ preenchido: ${d.razao_social}` });
      } catch {
        /* CNPJ não encontrado — apenas não preenche */
      }
    },
    [setCampo, handleTransportadoraChange, toast],
  );

  // Ao sair do campo CNPJ/CPF: duplicidade (cliente/fornecedor/transportadora) + auto-preenche
  const buscarPorDocumento = useCallback(async () => {
    const tipo = transportadora.tipo || 'J';
    const digits = String(transportadora.cpfcgc || '').replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) return;
    try {
      const resp = await fetch(`/api/global/check-document?doc=${digits}`);
      const data = resp.ok ? await resp.json() : { matches: [] };
      const matches: DocumentoMatch[] = data.matches || [];
      if (matches.length > 0) {
        setDupMatches(matches);
        setShowDup(true);
        return;
      }
      if (digits.length === 14 && tipo === 'J') {
        await preencherDeCnpj(digits);
      }
    } catch {
      /* silencioso */
    }
  }, [transportadora.tipo, transportadora.cpfcgc, preencherDeCnpj]);

  const handleDupAction = useCallback(
    async (match: DocumentoMatch) => {
      setShowDup(false);
      if (match.type === 'TRANSPORTADORA') {
        onEditarTransportadora?.(String(match.id).trim());
      } else {
        await preencherDeOrigem(
          match.type as 'CLIENTE' | 'FORNECEDOR',
          String(match.id).trim(),
        );
      }
    },
    [onEditarTransportadora, preencherDeOrigem],
  );

  const handleSubmit = async () => {
    try {
      // Verificar duplicidade de CPF/CNPJ antes de salvar (conforme Delphi)
      if (transportadora.cpfcgc) {
        try {
          const dupResp = await fetch(`/api/transportadoras/verificar-duplicidade?cpfcgc=${encodeURIComponent(transportadora.cpfcgc)}`);
          const dupData = await dupResp.json();
          if (dupData.existe) {
            // Não bloqueia: transportadoras podem compartilhar o mesmo CNPJ
            // (ex.: "CLIENTE RETIRA" usa o CNPJ da própria empresa). Apenas avisa.
            toast({
              description: `Atenção: o CPF/CNPJ também está cadastrado na transportadora "${dupData.transportadora.nome}" (código: ${dupData.transportadora.codtransp}).`,
            });
          }
        } catch (dupError) {
          console.error('Erro ao verificar duplicidade:', dupError);
        }
      }

      // Validar campos obrigatórios antes de enviar
      cadastroTransportadoraSchema.parse(transportadora);

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
            onDocumentoBlur={buscarPorDocumento}
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
        handleSubmit={() => pedirConfirmacao(handleSubmit)}
        handleClear={handleClear}
        onClose={onClose}
        loading={false}
      />
      {ConfirmacaoSalvarModal}
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

      {/* Documento duplicado (mesmo visual do cadastro de cliente/fornecedor) */}
      <DocumentoDuplicadoModal
        open={showDup}
        matches={dupMatches}
        onClose={() => setShowDup(false)}
        onAction={handleDupAction}
        actionLabel={(m) => (m.type === 'TRANSPORTADORA' ? 'Abrir' : 'Usar dados')}
      />
    </div>
  );
}
