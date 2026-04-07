// src/pages/cadastro/armazens/modalCadastrarArmazem.tsx

import React, { useState } from 'react';
import InfoModal from '@/components/common/infoModal';
// Caminho para o componente de formulário dentro de _forms
import ModalFormCadastrarArmazem from './_forms/modalFormCadastrarArmazem';
// Importações de dados e schema para Armazém
import { Armazem, insertArmazem } from '@/data/armazem/armazens';
import { z } from 'zod';
import { CircleCheck } from 'lucide-react';
import { cadastroArmazemSchema } from '@/data/armazem/armazensSchema';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  footer?: React.ReactNode;
}

export default function CadastrarArmazemModal({
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  // O estado agora é para Armazem
  const [armazem, setArmazem] = useState<Partial<Armazem>>({
    nome: '',
    filial: '',
    ativo: true, // Ou false, dependendo do padrão
    // --- APENAS A NOVA COLUNA ADICIONADA AQUI ---
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cep: null,
    municipio: null,
    uf: null,
    inscricaoestadual: null, // <-- APENAS ESTA LINHA FOI ADICIONADA
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Função para lidar com a mudança dos dados do armazém
  const handleArmazemChange = (updatedArmazem: Armazem) => {
    setArmazem(updatedArmazem);
  };

  const handleClear = () => {
    setArmazem({
      nome: '',
      filial: '',
      ativo: true,
      // --- APENAS A NOVA COLUNA ADICIONADA AQUI ---
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cep: null,
      municipio: null,
      uf: null,

      inscricaoestadual: null, // <-- APENAS ESTA LINHA FOI ADICIONADA
    });
    setErrors({}); // Limpar erros também
  };

  const handleFechar = () => {
    handleClear(); // Limpa o formulário antes de fechar
    onClose();
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrors({}); // Limpa erros anteriores ao tentar submeter
    try {
      // Valida o armazém com o schema Zod (Certifique-se que 'armazem' contém os campos esperados pelo schema)
      cadastroArmazemSchema.parse(armazem);

      // Chama a função de inserção do Armazém
      // Mantendo o cast original, conforme seu pedido de não alterar o que já estava lá.
      await insertArmazem(
        armazem as { nome: string; filial?: string; ativo?: boolean },
      );

      setMensagemInfo('Armazém cadastrado com sucesso!');
      handleClear(); // Limpa o formulário após sucesso

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
          description: 'Verifique os campos do formulário.',
          variant: 'destructive',
        });
      } else {
        toast({
          description: 'Falha ao cadastrar armazém. ' + (e as Error).message,
          variant: 'destructive',
        });
        console.error('Erro ao cadastrar armazém:', e); // Log para depuração
      }
    } finally {
      setIsSaving(false); // Define isSaving como false quando o salvamento termina
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-xl p-4">
        {/* Passando os props corretamente para ModalFormCadastrarArmazem */}
        <ModalFormCadastrarArmazem
          titulo="Cadastrar Armazém"
          handleSubmit={handleSubmit}
          handleClear={handleClear}
          handleArmazemChange={handleArmazemChange}
          onClose={handleFechar}
          armazem={armazem as Armazem}
          error={errors}
          isSaving={isSaving}
        />
      </div>

      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          onSuccess?.(); // ✅ chama a função de sucesso do pai (index)
          onClose(); // Fecha o modal principal
        }}
        title="INFORMAÇÃO IMPORTANTE"
        icon={<CircleCheck className="text-green-500 w-6 h-6" />}
        content={mensagemInfo}
      />
      <Toaster />
    </div>
  );
}
