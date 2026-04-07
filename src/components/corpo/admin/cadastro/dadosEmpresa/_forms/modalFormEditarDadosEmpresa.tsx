// src/components/corpo/admin/cadastro/dadosEmpresa/_forms/modalFormEditarDadosEmpresa.tsx

import React, { useEffect, useState, useRef } from 'react';
import { DadosEmpresa } from '@/data/dadosEmpresa/dadosEmpresas'; // Certifique-se de que este caminho está correto
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput'; // RE-ADICIONADO: Para os campos normais
import FormInput2 from '@/components/common/FormInput2'; // RE-ADICIONADO: Para os campos normais

import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';
import {
  extrairCertificado,
  CertificadoExtraido,
} from '@/utils/certificadoExtractor';
import InscricaoEstadualField from '@/components/common/InscricaoEstadualField';
import ModalAdicionarInscricaoEstadual from '@/components/common/ModalAdicionarInscricaoEstadual';
import { InscricaoEstadual } from '@/data/inscricoesEstaduais/inscricoesEstaduais';

interface FormDadosEmpresaContainerProps {
  titulo: string;
  onClose: () => void;
  dadosEmpresa: DadosEmpresa;
  isSaving?: boolean;
  error?: { [p: string]: string };
  handleDadosEmpresaChange: (dadosEmpresa: DadosEmpresa) => void;
  loading?: boolean;
  handleSubmit: (data: DadosEmpresa) => void;
  handleClear: () => void;
  inscricoesEstaduais: InscricaoEstadual[];
  setInscricoesEstaduais: (ies: InscricaoEstadual[]) => void;
}

const ModalFormEditarDadosEmpresa: React.FC<FormDadosEmpresaContainerProps> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  dadosEmpresa,
  isSaving,
  error,
  handleDadosEmpresaChange,
  loading = false,
  inscricoesEstaduais,
  setInscricoesEstaduais,
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const initialDadosEmpresaRef = useRef<DadosEmpresa | null>(null);

  const [loadingCep, setLoadingCep] = useState(false);

  // Estados para upload de certificado
  const [_certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [certificadoSenha, setCertificadoSenha] = useState('');
  const [isExtractingCertificado, setIsExtractingCertificado] = useState(false);
  const [certificadoExtraido, setCertificadoExtraido] =
    useState<CertificadoExtraido | null>(null);

  // Estados para modal de inscrição estadual
  const [showModalInscricaoEstadual, setShowModalInscricaoEstadual] =
    useState(false);

  const handleDeleteIE = (index: number) => {
    const updatedIEs = inscricoesEstaduais.filter((_, i) => i !== index);
    setInscricoesEstaduais(updatedIEs);
  };

  const handleSaveEditIE = (ie: InscricaoEstadual, index: number) => {
    const updatedIEs = [...inscricoesEstaduais];
    updatedIEs[index] = ie;
    setInscricoesEstaduais(updatedIEs);
  };

  useEffect(() => {
    if (dadosEmpresa.cgc && !initialDadosEmpresaRef.current) {
      initialDadosEmpresaRef.current = JSON.parse(JSON.stringify(dadosEmpresa));
      setHasChanges(false);
    }

    if (initialDadosEmpresaRef.current) {
      const current = { ...dadosEmpresa };
      const initial = initialDadosEmpresaRef.current;

      // Comparar valores normais
      const changesMade =
        current.cgc !== initial.cgc ||
        current.nomecontribuinte !== initial.nomecontribuinte ||
        current.inscricaoestadual !== initial.inscricaoestadual ||
        current.municipio !== initial.municipio ||
        current.uf !== initial.uf ||
        current.cep !== initial.cep ||
        current.logradouro !== initial.logradouro ||
        current.numero !== initial.numero ||
        current.complemento !== initial.complemento ||
        current.bairro !== initial.bairro ||
        current.contato !== initial.contato ||
        current.telefone !== initial.telefone ||
        current.email !== initial.email ||
        current.inscricaomunicipal !== initial.inscricaomunicipal ||
        current.codigoconvenio !== initial.codigoconvenio ||
        current.codigonatureza !== initial.codigonatureza ||
        current.codigofinalidade !== initial.codigofinalidade ||
        current.suframa !== initial.suframa ||
        current.certificadoKey !== initial.certificadoKey ||
        current.certificadoCrt !== initial.certificadoCrt ||
        current.cadeiaCrt !== initial.cadeiaCrt;

      setHasChanges(changesMade);
    }
  }, [dadosEmpresa]);

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`,
      );
      if (!response.ok) {
        throw new Error('Falha ao buscar CEP');
      }
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado.');
      }

      handleDadosEmpresaChange({
        ...dadosEmpresa,
        logradouro: data.logradouro || null,
        bairro: data.bairro || null,
        municipio: data.localidade || null,
        uf: data.uf || null,
        cep: cleanCep,
      });
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
      handleDadosEmpresaChange({
        ...dadosEmpresa,
        logradouro: null,
        bairro: null,
        municipio: null,
        uf: null,
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue: string | null = value === '' ? null : value;

    // Para campos normais (não FormInputEditavel que gerencia seu próprio state)
    // Atualiza o estado principal 'dadosEmpresa' diretamente
    if (name !== 'token' && name !== 'certificado') {
      handleDadosEmpresaChange({
        ...dadosEmpresa,
        [name]: finalValue,
      });

      if (name === 'cep') {
        handleDadosEmpresaChange({
          ...dadosEmpresa,
          cep: finalValue,
          logradouro: null,
          bairro: null,
          municipio: null,
          uf: null,
        });

        if (value.replace(/\D/g, '').length === 8) {
          fetchAddressByCep(value);
        }
      }
    }
    // A função handleChange do FormInputEditavel não é diretamente ligada a essa,
    // mas sim às props onEditChange e onSaveEdit.
    // No entanto, para fins de tipagem e evitar warnings, vamos manter as verificações
    // para token/certificado, embora eles serão atualizados por 'onEditChange'/'onSaveEdit'
    // dos FormInputEditavel.
  };

  // Função para lidar com upload de certificado
  const handleCertificadoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pfx')) {
      alert('Por favor, selecione um arquivo .pfx');
      return;
    }

    if (!certificadoSenha) {
      alert('Por favor, digite a senha do certificado');
      return;
    }

    setCertificadoFile(file);
    setIsExtractingCertificado(true);

    try {
      const buffer = await file.arrayBuffer();
      const certificadoExtraido = extrairCertificado(
        Buffer.from(buffer),
        certificadoSenha,
      );
      setCertificadoExtraido(certificadoExtraido);

      // Atualizar os dados da empresa com os valores extraídos
      handleDadosEmpresaChange({
        ...dadosEmpresa,
        certificadoKey: certificadoExtraido.certificadoKey,
        certificadoCrt: certificadoExtraido.certificadoCrt,
        cadeiaCrt: certificadoExtraido.cadeiaCrt,
      });
    } catch (error) {
      console.error('Erro ao extrair certificado:', error);
      alert(
        'Erro ao extrair certificado. Verifique a senha e tente novamente.',
      );
      setCertificadoFile(null);
    } finally {
      setIsExtractingCertificado(false);
    }
  };

  // Função de submissão simplificada
  const handleFormSubmit = () => {
    handleSubmit(dadosEmpresa);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[96vw] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Cabeçalho fixo */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">{titulo}</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter
              onSubmit={handleFormSubmit}
              onClear={handleClear}
              isSaving={isSaving}
              hasChanges={hasChanges}
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {/* Conteúdo com scroll */}
        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          {loading || loadingCep ? (
            <Carregamento />
          ) : (
            <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 mx-auto">
              {/* --- CAMPOS GERAIS (USANDO FormInput) --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <FormInput
                  autoComplete="off"
                  name="cgc"
                  type="text"
                  label="CGC"
                  value={dadosEmpresa.cgc || ''}
                  onChange={handleChange}
                  error={error?.cgc}
                  required
                  disabled={true}
                />
                <FormInput
                  autoComplete="off"
                  name="nomecontribuinte"
                  type="text"
                  label="Nome do Contribuinte"
                  value={dadosEmpresa.nomecontribuinte || ''}
                  onChange={handleChange}
                  error={error?.nomecontribuinte}
                  required
                />
                <div className="col-span-1">
                  <InscricaoEstadualField
                    inscricoes={inscricoesEstaduais}
                    label="Inscrição Estadual"
                    onFieldClick={() => setShowModalInscricaoEstadual(true)}
                    disabled={
                      !dadosEmpresa.cgc || dadosEmpresa.cgc.trim() === ''
                    }
                    error={error?.inscricaoestadual}
                  />
                </div>
                <FormInput
                  autoComplete="off"
                  name="contato"
                  type="text"
                  label="Contato"
                  value={dadosEmpresa.contato || ''}
                  onChange={handleChange}
                  error={error?.contato}
                />
                <FormInput
                  autoComplete="off"
                  name="telefone"
                  type="text"
                  label="Telefone"
                  value={dadosEmpresa.telefone || ''}
                  onChange={handleChange}
                  error={error?.telefone}
                />
                <FormInput2
                  autoComplete="off"
                  name="email"
                  type="email"
                  label="Email"
                  value={dadosEmpresa.email || ''}
                  onChange={handleChange}
                  error={error?.email}
                />
                <FormInput
                  autoComplete="off"
                  name="inscricaomunicipal"
                  type="text"
                  label="Inscrição Municipal"
                  value={dadosEmpresa.inscricaomunicipal || ''}
                  onChange={handleChange}
                  error={error?.inscricaomunicipal}
                />
                <FormInput
                  autoComplete="off"
                  name="codigoconvenio"
                  type="text"
                  label="Código Convênio"
                  value={dadosEmpresa.codigoconvenio || ''}
                  onChange={handleChange}
                  error={error?.codigoconvenio}
                />
                <FormInput
                  autoComplete="off"
                  name="codigonatureza"
                  type="text"
                  label="Código Natureza"
                  value={dadosEmpresa.codigonatureza || ''}
                  onChange={handleChange}
                  error={error?.codigonatureza}
                />
                <FormInput
                  autoComplete="off"
                  name="codigofinalidade"
                  type="text"
                  label="Código Finalidade"
                  value={dadosEmpresa.codigofinalidade || ''}
                  onChange={handleChange}
                  error={error?.codigofinalidade}
                />
                <FormInput
                  autoComplete="off"
                  name="suframa"
                  type="text"
                  label="Suframa"
                  value={dadosEmpresa.suframa || ''}
                  onChange={handleChange}
                  error={error?.suframa}
                />
              </div>
              {/* Campo de Upload de Certificado */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-4">
                  <h5 className="text-lg font-semibold text-[#347AB6] dark:text-gray-200">
                    Certificado Digital
                  </h5>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Arquivo .pfx
                    </label>
                    <input
                      type="file"
                      accept=".pfx"
                      onChange={handleCertificadoUpload}
                      className="block w-full text-sm text-gray-500 dark:text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-[#347AB6] file:text-white
                        hover:file:bg-[#2a5a8a]"
                      disabled={isExtractingCertificado}
                    />
                  </div>
                  <FormInput
                    autoComplete="off"
                    name="certificadoSenha"
                    type="password"
                    label="Senha do Certificado"
                    value={certificadoSenha}
                    onChange={(e) => setCertificadoSenha(e.target.value)}
                    error={error?.certificadoSenha}
                    disabled={isExtractingCertificado}
                  />
                  {isExtractingCertificado && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Extraindo certificado...
                    </div>
                  )}
                  {certificadoExtraido && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Certificado extraído com sucesso!
                    </div>
                  )}
                </div>
              </div>
              <hr className="my-8 border-gray-300 dark:border-gray-600" />
              {/* --- CAMPOS DE ENDEREÇO (USANDO FormInput) --- */}
              <h5 className="text-lg font-semibold text-[#347AB6] dark:text-gray-200 mb-4">
                Dados de Endereço{' '}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <FormInput
                  autoComplete="off"
                  name="cep"
                  type="text"
                  label="CEP"
                  value={dadosEmpresa.cep || ''}
                  onChange={handleChange}
                  error={error?.cep}
                  maxLength={9}
                />
                <FormInput
                  autoComplete="off"
                  name="logradouro"
                  type="text"
                  label="Logradouro"
                  value={dadosEmpresa.logradouro || ''}
                  onChange={handleChange}
                  error={error?.logradouro}
                  disabled={loadingCep}
                />
                <FormInput
                  autoComplete="off"
                  name="numero"
                  type="text"
                  label="Número"
                  value={dadosEmpresa.numero || ''}
                  onChange={handleChange}
                  error={error?.numero}
                />
                <FormInput
                  autoComplete="off"
                  name="complemento"
                  type="text"
                  label="Complemento"
                  value={dadosEmpresa.complemento || ''}
                  onChange={handleChange}
                  error={error?.complemento}
                />
                <FormInput
                  autoComplete="off"
                  name="bairro"
                  type="text"
                  label="Bairro"
                  value={dadosEmpresa.bairro || ''}
                  onChange={handleChange}
                  error={error?.bairro}
                  disabled={loadingCep}
                />
                <FormInput
                  autoComplete="off"
                  name="municipio"
                  type="text"
                  label="Município"
                  value={dadosEmpresa.municipio || ''}
                  onChange={handleChange}
                  error={error?.municipio}
                  disabled={loadingCep}
                />
                <FormInput
                  autoComplete="off"
                  name="uf"
                  type="text"
                  label="UF"
                  value={dadosEmpresa.uf || ''}
                  onChange={handleChange}
                  error={error?.uf}
                  maxLength={2}
                  disabled={loadingCep}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para adicionar/editar inscrição estadual */}
      {showModalInscricaoEstadual && (
        <ModalAdicionarInscricaoEstadual
          cgc={dadosEmpresa.cgc || ''}
          nomeContribuinte={dadosEmpresa.nomecontribuinte || ''}
          existingInscricoes={inscricoesEstaduais}
          onClose={() => setShowModalInscricaoEstadual(false)}
          onAdd={(novaIE) => {
            setInscricoesEstaduais([...inscricoesEstaduais, novaIE]);
          }}
          onEdit={handleSaveEditIE}
          onDelete={handleDeleteIE}
        />
      )}
    </div>
  );
};

export default ModalFormEditarDadosEmpresa;
