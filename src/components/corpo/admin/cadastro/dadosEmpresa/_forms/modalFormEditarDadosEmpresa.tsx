// src/components/corpo/admin/cadastro/dadosEmpresa/_forms/modalFormEditarDadosEmpresa.tsx

import React, { useEffect, useState, useRef } from 'react';
import { DadosEmpresa } from '@/data/dadosEmpresa/dadosEmpresas'; // Certifique-se de que este caminho está correto
import { X, Eye, EyeOff } from 'lucide-react';
import FormInput from '@/components/common/FormInput'; // RE-ADICIONADO: Para os campos normais
import FormInput2 from '@/components/common/FormInput2'; // RE-ADICIONADO: Para os campos normais

import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';
import type { CertificadoExtraido } from '@/utils/certificadoExtractor';
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
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [certificadoSenha, setCertificadoSenha] = useState('');
  const [isExtractingCertificado, setIsExtractingCertificado] = useState(false);
  const [mostrarSenhaCert, setMostrarSenhaCert] = useState(false);
  const [certificadoErro, setCertificadoErro] = useState<string | null>(null);
  const [certificadoExtraido, setCertificadoExtraido] =
    useState<CertificadoExtraido | null>(null);
  const senhaCertRef = useRef<HTMLInputElement>(null);

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
        current.cadeiaCrt !== initial.cadeiaCrt ||
        current.ambiente !== initial.ambiente;

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

  // 1) Seleção do arquivo: guarda o .pfx e pede/usa a senha para extrair.
  //    Fluxo: selecionar arquivo → (foca a senha) → extrair → depois Salvar.
  const handleCertificadoFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pfx')) {
      setCertificadoErro('Selecione um arquivo .pfx válido.');
      setCertificadoFile(null);
      return;
    }

    setCertificadoErro(null);
    setCertificadoExtraido(null);
    setCertificadoFile(file);

    // Se a senha já foi informada, extrai direto; senão foca o campo de senha.
    if (certificadoSenha) {
      extrairCertificado(file, certificadoSenha);
    } else {
      senhaCertRef.current?.focus();
    }
  };

  // 2) Extração de fato (usa o arquivo já selecionado + a senha).
  const extrairCertificado = async (file: File | null, senha: string) => {
    if (!file) {
      setCertificadoErro('Selecione o arquivo .pfx primeiro.');
      return;
    }
    if (!senha) {
      setCertificadoErro('Digite a senha do certificado.');
      senhaCertRef.current?.focus();
      return;
    }

    setCertificadoErro(null);
    setIsExtractingCertificado(true);
    try {
      // Extração NO SERVIDOR (node-forge) via endpoint.
      const buffer = await file.arrayBuffer();
      const pfxBase64 = Buffer.from(buffer).toString('base64');
      const resp = await fetch('/api/dadosEmpresa/extrair-certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfxBase64, senha }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.erro || 'Falha ao extrair o certificado.');
      }
      const extraido = {
        certificadoKey: data.certificadoKey,
        certificadoCrt: data.certificadoCrt,
        cadeiaCrt: data.cadeiaCrt,
      };
      setCertificadoExtraido(extraido);

      // Atualizar os dados da empresa com os valores extraídos (vão no Salvar).
      handleDadosEmpresaChange({
        ...dadosEmpresa,
        certificadoKey: extraido.certificadoKey,
        certificadoCrt: extraido.certificadoCrt,
        cadeiaCrt: extraido.cadeiaCrt,
      });
    } catch (error: any) {
      console.error('Erro ao extrair certificado:', error);
      // Mostra a causa REAL do backend (senha, formato, algoritmo...).
      // NÃO limpa o arquivo — permite corrigir a senha e tentar de novo.
      setCertificadoErro(
        error?.message ||
          'Erro ao extrair certificado. Verifique a senha e tente novamente.',
      );
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
                {/* Ambiente de emissão (parâmetro central de NF-e/NFC-e). */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ambiente NF-e / NFC-e
                  </label>
                  <select
                    name="ambiente"
                    value={dadosEmpresa.ambiente || '2'}
                    onChange={(e) =>
                      handleDadosEmpresaChange({
                        ...dadosEmpresa,
                        ambiente: e.target.value,
                      })
                    }
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="2">
                      2 · Homologação (teste, sem valor fiscal)
                    </option>
                    <option value="1">1 · Produção (valor fiscal)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Define o ambiente de TODAS as notas. Troque para Produção
                    quando for emitir de verdade.
                  </p>
                </div>
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
                      onChange={handleCertificadoFileSelect}
                      className="block w-full text-sm text-gray-500 dark:text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-[#347AB6] file:text-white
                        hover:file:bg-[#2a5a8a]"
                      disabled={isExtractingCertificado}
                    />
                  </div>
                  {/* Senha do certificado: input próprio (NÃO usa FormInput, que força
                      maiúsculas e quebraria senhas case-sensitive). Olho para visualizar
                      e autoComplete="new-password" para evitar autofill do navegador. */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Senha do Certificado
                    </label>
                    <div className="relative">
                      <input
                        ref={senhaCertRef}
                        name="certificadoSenha"
                        type={mostrarSenhaCert ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={certificadoSenha}
                        onChange={(e) => setCertificadoSenha(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            extrairCertificado(certificadoFile, certificadoSenha);
                          }
                        }}
                        placeholder={
                          certificadoFile
                            ? 'Digite a senha e pressione Enter para extrair'
                            : undefined
                        }
                        disabled={isExtractingCertificado}
                        className="normal-case block w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenhaCert((v) => !v)}
                        tabIndex={-1}
                        aria-label={
                          mostrarSenhaCert ? 'Ocultar senha' : 'Mostrar senha'
                        }
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        {mostrarSenhaCert ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    {error?.certificadoSenha && (
                      <p className="text-sm text-red-500">
                        {error.certificadoSenha}
                      </p>
                    )}
                  </div>
                  {/* Botão de extrair: aparece quando há arquivo selecionado e ainda
                      não foi extraído (ou após erro, para tentar de novo). */}
                  {certificadoFile && !certificadoExtraido && (
                    <button
                      type="button"
                      onClick={() =>
                        extrairCertificado(certificadoFile, certificadoSenha)
                      }
                      disabled={isExtractingCertificado}
                      className="px-4 py-2 rounded-md bg-[#347AB6] text-white text-sm font-semibold hover:bg-[#2a5a8a] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isExtractingCertificado
                        ? 'Extraindo...'
                        : 'Extrair certificado'}
                    </button>
                  )}
                  {isExtractingCertificado && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Extraindo certificado...
                    </div>
                  )}
                  {certificadoErro && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {certificadoErro}
                    </div>
                  )}
                  {certificadoExtraido && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      ✅ Certificado extraído com sucesso. Clique em{' '}
                      <b>Salvar</b> para gravar.
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
