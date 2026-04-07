// src/pages/cadastro/dadosEmpresa/modalCadastrarDadosEmpresa.tsx

import React, { useState, useEffect } from 'react';
import InfoModal from '@/components/common/infoModal';
import ModalFormCadastrarDadosEmpresa from './_forms/modalFormCadastrarDadosEmpresa';
import {
  DadosEmpresa,
} from '@/data/dadosEmpresa/dadosEmpresas';
import { InscricaoEstadual, getInscricoesEstaduaisByCgc } from '@/data/inscricoesEstaduais/inscricoesEstaduais';
import api from '@/components/services/api';
import { z } from 'zod';
import { CircleCheck } from 'lucide-react';
import { cadastroDadosEmpresaSchema } from '@/data/dadosEmpresa/dadosEmpresasSchema';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  footer?: React.ReactNode;
}

export default function CadastrarDadosEmpresaModal({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [dadosEmpresa, setDadosEmpresa] = useState<Partial<DadosEmpresa>>({
    cgc: '',
    inscricaoestadual: '',
    nomecontribuinte: '',
    municipio: '',
    uf: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    contato: '',
    telefone: '',
    email: '',
    inscricaoestadual_07: '',
    inscricaomunicipal: '',
    codigoconvenio: '',
    codigonatureza: '',
    codigofinalidade: '',
    suframa: '',
    certificadoKey: '', // Campo para chave privada do certificado
    certificadoCrt: '', // Campo para certificado
    cadeiaCrt: '', // Campo para cadeia de certificados
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
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

  // ALTERADO AQUI: Tipo do parâmetro mudado para Partial<DadosEmpresa>
  const handleDadosEmpresaChange = (
    updatedDadosEmpresa: Partial<DadosEmpresa>,
  ) => {
    setDadosEmpresa(updatedDadosEmpresa);
  };

  const handleClear = () => {
    setDadosEmpresa({
      cgc: '',
      inscricaoestadual: '',
      nomecontribuinte: '',
      municipio: '',
      uf: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      contato: '',
      telefone: '',
      email: '',
      inscricaoestadual_07: '',
      inscricaomunicipal: '',
      codigoconvenio: '',
      codigonatureza: '',
      codigofinalidade: '',
      suframa: '',
      certificadoKey: '',
      certificadoCrt: '',
      cadeiaCrt: '',
    });
    setInscricoesEstaduais([]);
    setErrors({});
  };

  const handleFechar = () => {
    handleClear();
    onClose();
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrors({});
    try {
      console.log('Enviando dadosEmpresa:', dadosEmpresa);
      console.log('Enviando inscricoesEstaduais:', inscricoesEstaduais);
      // Fazendo o parse para validar, o ZodError pegará campos ausentes.
      // A validação Zod é feita sobre o objeto dadosEmpresa, que é Partial.
      // Se o schema esperar campos não opcionais, ele validará a ausência.
      // Se precisar de DadosEmpresa completo para insertDadosEmpresa, o cast 'as DadosEmpresa' ainda é necessário.
      cadastroDadosEmpresaSchema.parse(dadosEmpresa);

      // Envia tanto os dados da empresa quanto as inscrições estaduais
      await api.post('/api/dadosEmpresa/add', {
        ...dadosEmpresa,
        inscricoesEstaduais,
      });

      setMensagemInfo('Dados da Empresa cadastrados com sucesso!');
      handleClear();
      setOpenInfo(true);
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
        toast({
          title: 'Erro ao Cadastrar',
          description:
            'Falha ao cadastrar dados da empresa. ' + (e as Error).message,
          variant: 'destructive',
        });
        console.error('Erro ao cadastrar dados da empresa:', e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-xl p-4">
        {/* Usando a prop 'titulo' aqui, como no seu Armazém */}
        <ModalFormCadastrarDadosEmpresa
          titulo="Cadastrar Dados da Empresa"
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          handleDadosEmpresaChange={handleDadosEmpresaChange}
          onClose={handleFechar}
          dadosEmpresa={dadosEmpresa} // Passa o estado de dadosEmpresa (que é Partial)
          error={errors}
          isSaving={isSaving}
          inscricoesEstaduais={inscricoesEstaduais}
          setInscricoesEstaduais={setInscricoesEstaduais}
        />
      </div>

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
      <Toaster />
    </div>
  );
}