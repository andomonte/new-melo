// src/pages/cadastro/dadosEmpresa/modalEditarDadosEmpresa.tsx

import React, { useEffect, useState } from 'react';
import InfoModal from '@/components/common/infoModal';
// InfoModalError é o mesmo componente InfoModal, mas com outro nome para clareza
import InfoModalError from '@/components/common/infoModal';
// Importações de dados e schema para DadosEmpresa
import {
  DadosEmpresa,
} from '@/data/dadosEmpresa/dadosEmpresas'; // CORRIGIDO
import { InscricaoEstadual, getInscricoesEstaduaisByCgc } from '@/data/inscricoesEstaduais/inscricoesEstaduais';
import api from '@/components/services/api';
import { edicaoDadosEmpresaSchema } from '@/data/dadosEmpresa/dadosEmpresasSchema'; // CORRIGIDO
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
// Caminho para o componente de formulário de edição específico de DadosEmpresa
import ModalFormEditarDadosEmpresa from './_forms/modalFormEditarDadosEmpresa'; // CORRIGIDO
import { CircleCheck, AlertTriangle } from 'lucide-react';
import Carregamento from '@/utils/carregamento';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  dadosEmpresa: DadosEmpresa | null; // A prop agora é 'dadosEmpresa'
  onSuccess?: () => void;
}

export default function EditarDadosEmpresaModal({
  isOpen,
  dadosEmpresa: dadosEmpresaProp, // Renomeado para evitar conflito com o estado
  onSuccess,
  onClose,
}: ModalProps) {
  const [dadosEmpresa, setDadosEmpresa] = useState<Partial<DadosEmpresa>>(
    dadosEmpresaProp || {},
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [openInfoError, setOpenInfoError] = useState(false);
  const [mensagemInfoError, setMensagemInfoError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [inscricoesEstaduais, setInscricoesEstaduais] = useState<InscricaoEstadual[]>([]);
  const { toast } = useToast();

  // Buscar inscrições estaduais existentes quando o CGC mudar
  useEffect(() => {
    const fetchInscricoes = async () => {
      if (!dadosEmpresa.cgc || dadosEmpresa.cgc.trim() === '') {
        setInscricoesEstaduais([]);
        return;
      }

      try {
        const ies = await getInscricoesEstaduaisByCgc(dadosEmpresa.cgc);
        setInscricoesEstaduais(ies);
      } catch (err) {
        console.error('Erro ao buscar inscrições estaduais:', err);
        setInscricoesEstaduais([]);
      }
    };

    fetchInscricoes();
  }, [dadosEmpresa.cgc]);

  const handleClear = () => {
    // Reseta para o estado inicial dos dados da empresa recebidos pela prop
    setDadosEmpresa(
      dadosEmpresaProp
        ? {
            ...dadosEmpresaProp,
            // Garante que todas as propriedades da interface DadosEmpresa
            // estejam presentes no reset, mesmo que null.
            // Isso evita "undefined" ao copiar.
            cgc: dadosEmpresaProp.cgc || '',
            inscricaoestadual: dadosEmpresaProp.inscricaoestadual || null,
            nomecontribuinte: dadosEmpresaProp.nomecontribuinte || '',
            municipio: dadosEmpresaProp.municipio || null,
            uf: dadosEmpresaProp.uf || null,
            cep: dadosEmpresaProp.cep || null,
            logradouro: dadosEmpresaProp.logradouro || null,
            numero: dadosEmpresaProp.numero || null,
            complemento: dadosEmpresaProp.complemento || null,
            bairro: dadosEmpresaProp.bairro || null,
            contato: dadosEmpresaProp.contato || null,
            telefone: dadosEmpresaProp.telefone || null,
            email: dadosEmpresaProp.email || null,
            inscricaoestadual_07: dadosEmpresaProp.inscricaoestadual_07 || null,
            inscricaomunicipal: dadosEmpresaProp.inscricaomunicipal || null,
            codigoconvenio: dadosEmpresaProp.codigoconvenio || null,
            codigonatureza: dadosEmpresaProp.codigonatureza || null,
            codigofinalidade: dadosEmpresaProp.codigofinalidade || null,
            suframa: dadosEmpresaProp.suframa || null,
            id_token: dadosEmpresaProp.id_token || null,
            token: dadosEmpresaProp.token || null,
            certificadoKey: dadosEmpresaProp.certificadoKey || null,
            certificadoCrt: dadosEmpresaProp.certificadoCrt || null,
            cadeiaCrt: dadosEmpresaProp.cadeiaCrt || null,
          }
        : {
            // Estado inicial vazio ou nulo se dadosEmpresaProp for nulo
            cgc: '',
            inscricaoestadual: null,
            nomecontribuinte: '',
            municipio: null,
            uf: null,
            cep: null,
            logradouro: null,
            numero: null,
            complemento: null,
            bairro: null,
            contato: null,
            telefone: null,
            email: null,
            inscricaoestadual_07: null,
            inscricaomunicipal: null,
            codigoconvenio: null,
            codigonatureza: null,
            codigofinalidade: null,
            suframa: null,
            id_token: null,
            token: null,
            certificadoKey: null,
            certificadoCrt: null,
            cadeiaCrt: null,
          },
    );
    setErrors({});
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrors({}); // Limpa erros anteriores

    try {
      console.log('Enviando dadosEmpresa:', dadosEmpresa);
      console.log('Enviando inscricoesEstaduais:', inscricoesEstaduais);
      // Valida os dados da empresa com o schema Zod
      edicaoDadosEmpresaSchema.parse(dadosEmpresa);

      if (dadosEmpresa.cgc) {
        // Envia tanto os dados da empresa quanto as inscrições estaduais
        await api.put('/api/dadosEmpresa/edit', {
          ...dadosEmpresa,
          inscricoesEstaduais,
        });
        setMensagemInfo('Dados da Empresa atualizados com sucesso!');
        setOpenInfo(true);
      } else {
        toast({
          title: 'Erro de Validação',
          description: 'CGC da empresa inválido para edição.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        e.errors.forEach((error) => {
          if (error.path.length > 0) {
            fieldErrors[error.path[0]] = error.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          title: 'Erro de Validação',
          description: 'Verifique os campos do formulário.',
          variant: 'destructive',
        });
      } else {
        console.error('Erro ao atualizar os dados da empresa:', e);
        setMensagemInfoError(
          'Ocorreu um erro ao tentar atualizar os dados da empresa. Por favor, tente novamente ou entre em contato com o suporte técnico.',
        );
        setOpenInfoError(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Efeito para atualizar o estado 'dadosEmpresa' quando 'dadosEmpresaProp' muda
  useEffect(() => {
    if (dadosEmpresaProp) {
      setDadosEmpresa({
        ...dadosEmpresaProp,
        // Garante que todas as propriedades da interface DadosEmpresa
        // estejam presentes, mesmo que sejam null na prop.
        cgc: dadosEmpresaProp.cgc || '',
        inscricaoestadual: dadosEmpresaProp.inscricaoestadual || null,
        nomecontribuinte: dadosEmpresaProp.nomecontribuinte || '',
        municipio: dadosEmpresaProp.municipio || null,
        uf: dadosEmpresaProp.uf || null,
        cep: dadosEmpresaProp.cep || null,
        logradouro: dadosEmpresaProp.logradouro || null,
        numero: dadosEmpresaProp.numero || null,
        complemento: dadosEmpresaProp.complemento || null,
        bairro: dadosEmpresaProp.bairro || null,
        contato: dadosEmpresaProp.contato || null,
        telefone: dadosEmpresaProp.telefone || null,
        email: dadosEmpresaProp.email || null,
        inscricaoestadual_07: dadosEmpresaProp.inscricaoestadual_07 || null,
        inscricaomunicipal: dadosEmpresaProp.inscricaomunicipal || null,
        codigoconvenio: dadosEmpresaProp.codigoconvenio || null,
        codigonatureza: dadosEmpresaProp.codigonatureza || null,
        codigofinalidade: dadosEmpresaProp.codigofinalidade || null,
        suframa: dadosEmpresaProp.suframa || null,
        id_token: dadosEmpresaProp.id_token || null,
        token: dadosEmpresaProp.token || null,
        certificadoKey: dadosEmpresaProp.certificadoKey || null,
        certificadoCrt: dadosEmpresaProp.certificadoCrt || null,
        cadeiaCrt: dadosEmpresaProp.cadeiaCrt || null,
      });
      setErrors({});
    } else {
      // Reseta para um objeto vazio ou com valores padrão se dadosEmpresaProp for nulo
      setDadosEmpresa({
        cgc: '',
        inscricaoestadual: null,
        nomecontribuinte: '',
        municipio: null,
        uf: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        contato: null,
        telefone: null,
        email: null,
        inscricaoestadual_07: null,
        inscricaomunicipal: null,
        codigoconvenio: null,
        codigonatureza: null,
        codigofinalidade: null,
        suframa: null,
        id_token: null,
        token: null,
        certificadoKey: null,
        certificadoCrt: null,
        cadeiaCrt: null,
      });
    }
  }, [dadosEmpresaProp]);

  if (!isOpen) return null;

  const handleDadosEmpresaChange = (updatedDadosEmpresa: DadosEmpresa) => {
    setDadosEmpresa(updatedDadosEmpresa);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      {/* Verifica se dadosEmpresaProp existe antes de renderizar o formulário */}
      {dadosEmpresaProp && dadosEmpresa.cgc ? ( // Usa cgc como um identificador para verificar se há dados
        <ModalFormEditarDadosEmpresa
          titulo="Editar Dados da Empresa"
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          handleDadosEmpresaChange={handleDadosEmpresaChange}
          onClose={onClose}
          loading={false} // Mantido 'false' se Carregamento estiver fora
          dadosEmpresa={dadosEmpresa as DadosEmpresa} // Passa o estado atualizado
          error={errors}
          isSaving={isSaving}
          inscricoesEstaduais={inscricoesEstaduais}
          setInscricoesEstaduais={setInscricoesEstaduais}
        />
      ) : (
        <Carregamento /> // Exibe Carregamento enquanto dadosEmpresaProp não estiver pronto
      )}
      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          onSuccess?.();
          onClose();
        }}
        title="INFORMAÇÃO IMPORTANTE"
        icon={<CircleCheck className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />
      <InfoModalError
        isOpen={openInfoError}
        onClose={() => {
          setOpenInfoError(false);
          onClose();
        }}
        title="ALGO DEU ERRADO"
        icon={<AlertTriangle className="text-red-500 w-6 h-6" />}
        content={mensagemInfoError}
      />
      <Toaster />
    </div>
  );
}