// src/pages/cadastro/dadosEmpresa/_forms/modalFormCadastrarDadosEmpresa.tsx

import React, { useState } from 'react';
import { DadosEmpresa } from '@/data/dadosEmpresa/dadosEmpresas';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormInput2 from '@/components/common/FormInput2';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';
import {
  extrairCertificado,
  CertificadoExtraido,
} from '@/utils/certificadoExtractor';
import InscricaoEstadualField from '@/components/common/InscricaoEstadualField';
import ModalAdicionarInscricaoEstadual from '@/components/common/ModalAdicionarInscricaoEstadual';
import { InscricaoEstadual } from '@/data/inscricoesEstaduais/inscricoesEstaduais';

interface ModalFormCadastrarDadosEmpresaProps {
  titulo: string;
  onClose: () => void;
  dadosEmpresa: Partial<DadosEmpresa>;
  isSaving?: boolean;
  error?: { [P in keyof DadosEmpresa]?: string };
  handleDadosEmpresaChange: (dadosEmpresa: Partial<DadosEmpresa>) => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
  inscricoesEstaduais: InscricaoEstadual[];
  setInscricoesEstaduais: (ies: InscricaoEstadual[]) => void;
}

const ModalFormCadastrarDadosEmpresa: React.FC<
  ModalFormCadastrarDadosEmpresaProps
> = ({
  titulo,
  isSaving,
  handleSubmit,
  handleClear,
  onClose,
  dadosEmpresa,
  error,
  handleDadosEmpresaChange,
  loading = false,
  inscricoesEstaduais,
  setInscricoesEstaduais,
}) => {
  const [loadingCep, setLoadingCep] = useState(false);
  // Removido showToken e showCertificado useState

  // Estados para upload de certificado
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [certificadoSenha, setCertificadoSenha] = useState('');
  const [isExtractingCertificado, setIsExtractingCertificado] = useState(false);
  const [certificadoExtraido, setCertificadoExtraido] =
    useState<CertificadoExtraido | null>(null);

  // Estados para modal de inscrição estadual
  const [showModalInscricaoEstadual, setShowModalInscricaoEstadual] =
    useState(false);

  const hasChangesForCadastro =
    !!dadosEmpresa.cgc || !!dadosEmpresa.nomecontribuinte;

  const handleDeleteIE = (index: number) => {
    const updatedIEs = inscricoesEstaduais.filter((_, i) => i !== index);
    setInscricoesEstaduais(updatedIEs);
  };

  const handleSaveEditIE = (ie: InscricaoEstadual, index: number) => {
    const updatedIEs = [...inscricoesEstaduais];
    updatedIEs[index] = ie;
    setInscricoesEstaduais(updatedIEs);
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      handleDadosEmpresaChange({
        ...dadosEmpresa,
        cep: cep,
        logradouro: '',
        bairro: '',
        municipio: '',
        uf: '',
      });
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
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        municipio: data.localidade || '',
        uf: data.uf || '',
        cep: cleanCep,
      });
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
      handleDadosEmpresaChange({
        ...dadosEmpresa,
        logradouro: '',
        bairro: '',
        municipio: '',
        uf: '',
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue = value;

    const updatedDadosEmpresa: Partial<DadosEmpresa> = {
      ...dadosEmpresa,
      [name]: finalValue,
    };
    handleDadosEmpresaChange(updatedDadosEmpresa);

    if (name === 'cep') {
      handleDadosEmpresaChange({
        // Limpa campos de endereço antes da busca para evitar dados inconsistentes
        ...dadosEmpresa,
        cep: finalValue,
        logradouro: '',
        bairro: '',
        municipio: '',
        uf: '',
      });
      if (value.replace(/\D/g, '').length === 8) {
        fetchAddressByCep(value);
      }
    }
  };

  const handleCertificadoUpload = async (file: File) => {
    if (!file) return;

    setIsExtractingCertificado(true);
    try {
      // Converter File para Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('Extraindo certificado com senha:', certificadoSenha);
      const extraido = await extrairCertificado(buffer, certificadoSenha);
      console.log('Certificado extraído:', {
        certificadoKey: extraido.certificadoKey.substring(0, 50) + '...',
        certificadoCrt: extraido.certificadoCrt.substring(0, 50) + '...',
        cadeiaCrt: extraido.cadeiaCrt.substring(0, 50) + '...',
      });
      setCertificadoExtraido(extraido);

      // Atualiza os dados da empresa com os dados extraídos
      const novosDados = {
        ...dadosEmpresa,
        certificadoKey: extraido.certificadoKey,
        certificadoCrt: extraido.certificadoCrt,
        cadeiaCrt: extraido.cadeiaCrt,
      };
      console.log('Atualizando dadosEmpresa com certificado:', {
        certificadoKey: novosDados.certificadoKey.substring(0, 50) + '...',
        certificadoCrt: novosDados.certificadoCrt.substring(0, 50) + '...',
        cadeiaCrt: novosDados.cadeiaCrt.substring(0, 50) + '...',
      });
      handleDadosEmpresaChange(novosDados);
    } catch (error) {
      console.error('Erro ao extrair certificado:', error);
      alert('Erro ao extrair certificado. Verifique se a senha está correta.');
    } finally {
      setIsExtractingCertificado(false);
    }
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
              onSubmit={handleSubmit}
              onClear={handleClear}
              isSaving={isSaving}
              hasChanges={hasChangesForCadastro}
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
              {/* --- CAMPOS GERAIS DA EMPRESA --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <FormInput
                  autoComplete="off"
                  name="cgc"
                  type="text"
                  label="CGC"
                  defaultValue={dadosEmpresa.cgc || ''}
                  onChange={handleChange}
                  error={error?.cgc}
                  required
                />
                <FormInput
                  autoComplete="off"
                  name="nomecontribuinte"
                  type="text"
                  label="Nome do Contribuinte"
                  defaultValue={dadosEmpresa.nomecontribuinte || ''}
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
                  name="inscricaomunicipal"
                  type="text"
                  label="Inscrição Municipal"
                  defaultValue={dadosEmpresa.inscricaomunicipal || ''}
                  onChange={handleChange}
                  error={error?.inscricaomunicipal}
                />
                <FormInput
                  autoComplete="off"
                  name="contato"
                  type="text"
                  label="Contato"
                  defaultValue={dadosEmpresa.contato || ''}
                  onChange={handleChange}
                  error={error?.contato}
                />
                <FormInput
                  autoComplete="off"
                  name="telefone"
                  type="text"
                  label="Telefone"
                  defaultValue={dadosEmpresa.telefone || ''}
                  onChange={handleChange}
                  error={error?.telefone}
                />
                <FormInput2
                  autoComplete="off"
                  name="email"
                  type="email"
                  label="Email"
                  defaultValue={dadosEmpresa.email || ''}
                  onChange={handleChange}
                  error={error?.email}
                />
                <FormInput
                  autoComplete="off"
                  name="codigoconvenio"
                  type="text"
                  label="Código Convênio"
                  defaultValue={dadosEmpresa.codigoconvenio || ''}
                  onChange={handleChange}
                  error={error?.codigoconvenio}
                />
                <FormInput
                  autoComplete="off"
                  name="codigonatureza"
                  type="text"
                  label="Código Natureza"
                  defaultValue={dadosEmpresa.codigonatureza || ''}
                  onChange={handleChange}
                  error={error?.codigonatureza}
                />
                <FormInput
                  autoComplete="off"
                  name="codigofinalidade"
                  type="text"
                  label="Código Finalidade"
                  defaultValue={dadosEmpresa.codigofinalidade || ''}
                  onChange={handleChange}
                  error={error?.codigofinalidade}
                />
                <FormInput
                  autoComplete="off"
                  name="suframa"
                  type="text"
                  label="Suframa"
                  defaultValue={dadosEmpresa.suframa || ''}
                  onChange={handleChange}
                  error={error?.suframa}
                />
              </div>

              <hr className="my-8 border-gray-300 dark:border-gray-600" />

              {/* --- CAMPOS DE ENDEREÇO --- */}
              <h5 className="text-lg font-semibold text-[#347AB6] dark:text-gray-200 mb-4">
                Dados de Endereço
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <FormInput
                  autoComplete="off"
                  name="cep"
                  type="text"
                  label="CEP"
                  defaultValue={dadosEmpresa.cep || ''}
                  onChange={handleChange}
                  error={error?.cep}
                  maxLength={9}
                  required
                />
                <FormInput
                  autoComplete="off"
                  name="logradouro"
                  type="text"
                  label="Logradouro"
                  defaultValue={dadosEmpresa.logradouro || ''}
                  onChange={handleChange}
                  error={error?.logradouro}
                  disabled={loadingCep}
                  required
                />
                <FormInput
                  autoComplete="off"
                  name="numero"
                  type="text"
                  label="Número"
                  defaultValue={dadosEmpresa.numero || ''}
                  onChange={handleChange}
                  error={error?.numero}
                  required
                />
                <FormInput
                  autoComplete="off"
                  name="complemento"
                  type="text"
                  label="Complemento"
                  defaultValue={dadosEmpresa.complemento || ''}
                  onChange={handleChange}
                  error={error?.complemento}
                />
                <FormInput
                  autoComplete="off"
                  name="bairro"
                  type="text"
                  label="Bairro"
                  defaultValue={dadosEmpresa.bairro || ''}
                  onChange={handleChange}
                  error={error?.bairro}
                  disabled={loadingCep}
                  required
                />
                <FormInput
                  autoComplete="off"
                  name="municipio"
                  type="text"
                  label="Município"
                  defaultValue={dadosEmpresa.municipio || ''}
                  onChange={handleChange}
                  error={error?.municipio}
                  disabled={loadingCep}
                  required
                />
                <FormInput
                  autoComplete="off"
                  name="uf"
                  type="text"
                  label="UF"
                  defaultValue={dadosEmpresa.uf || ''}
                  onChange={handleChange}
                  error={error?.uf}
                  maxLength={2}
                  disabled={loadingCep}
                  required
                />
              </div>

              <hr className="my-8 border-gray-300 dark:border-gray-600" />

              {/* --- CAMPO DE UPLOAD DE CERTIFICADO --- */}
              <h5 className="text-lg font-semibold text-[#347AB6] dark:text-gray-200 mb-4">
                Dados de Segurança
              </h5>
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
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setCertificadoFile(file);
                        // Não extrair automaticamente mais - aguardar senha
                      }}
                      className="block w-full text-sm text-gray-500 dark:text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-[#347AB6] file:text-white
                        hover:file:bg-[#2a5a8a]"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Selecione um arquivo .pfx para extrair automaticamente os
                      dados do certificado
                    </p>
                    {isExtractingCertificado && (
                      <p className="text-sm text-blue-600 mt-1">
                        Extraindo certificado...
                      </p>
                    )}
                    {certificadoExtraido && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-800">
                          Certificado extraído com sucesso!
                        </p>
                        <p className="text-xs text-green-600">
                          Chave privada, certificado e cadeia de certificação
                          prontos.
                        </p>
                      </div>
                    )}
                  </div>
                  {certificadoFile && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Senha do Certificado
                      </label>
                      <input
                        type="password"
                        value={certificadoSenha}
                        onChange={(e) => setCertificadoSenha(e.target.value)}
                        placeholder="Digite a senha do certificado"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          certificadoFile &&
                          certificadoSenha &&
                          handleCertificadoUpload(certificadoFile)
                        }
                        disabled={
                          !certificadoFile ||
                          !certificadoSenha ||
                          isExtractingCertificado
                        }
                        className="mt-2 px-4 py-2 bg-[#347AB6] text-white rounded-md hover:bg-[#2a5a8a] disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isExtractingCertificado
                          ? 'Extraindo...'
                          : 'Extrair Certificado'}
                      </button>
                    </div>
                  )}
                </div>
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

export default ModalFormCadastrarDadosEmpresa;
