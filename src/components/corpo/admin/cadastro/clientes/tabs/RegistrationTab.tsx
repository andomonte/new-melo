import React, { useEffect, useState, useRef } from 'react';
import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2, AlertTriangle, Phone, Smartphone, Building2, MessageCircle, Mail, User, Briefcase, Cake } from 'lucide-react';
import InputMask from 'react-input-mask';
import { CountryCombobox } from '@/components/common/CountryCombobox';
import { buscaCep } from '@/data/cep';
import { buscaCnpj } from '@/data/cnpj';
import { toast } from 'sonner';

interface RegistrationTabProps {
  isChecking?: boolean;
  duplicateFound?: boolean;
  onCepBlur?: () => void;
}

interface ClasseCliente {
  codcc: string;
  descr: string;
}

export function RegistrationTab({
  isChecking,
  duplicateFound,
  onCepBlur,
}: RegistrationTabProps) {
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext();
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [classesCliente, setClassesCliente] = useState<ClasseCliente[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Buscar classes de cliente da API
  useEffect(() => {
    async function fetchClassesCliente() {
      try {
        const response = await fetch('/api/cClientes/get?perPage=999');
        if (response.ok) {
          const data = await response.json();
          // Limpa espaços dos códigos vindos do banco
          const classes = (data.data || []).map((c: ClasseCliente) => ({
            ...c,
            codcc: String(c.codcc || '').trim(),
            descr: String(c.descr || '').trim(),
          }));
          setClassesCliente(classes);
        }
      } catch (error) {
        console.error('Erro ao carregar classes de cliente:', error);
      } finally {
        setLoadingClasses(false);
      }
    }

    fetchClassesCliente();
  }, []);

  // Watchers
  const tipoPessoa = watch('tipoPessoa');
  const isentoIE = watch('isentoIE');
  const isentoIM = watch('isentoIM');
  const isentoSuframa = watch('isentoSuframa');
  const enderecoCobrancaIgual = watch('enderecoCobrancaIgual');

  // Field Array for Contacts (telefones/emails)
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contatos',
  });

  // Field Array for Pessoas de Contato
  const {
    fields: pessoasFields,
    append: appendPessoa,
    remove: removePessoa,
  } = useFieldArray({
    control,
    name: 'pessoasContato',
  });

  // CNPJ Handler — consulta BrasilAPI e preenche campos automaticamente
  const handleDocumentoBlur = async () => {
    const tipoPessoa = getValues('tipoPessoa');
    if (tipoPessoa !== 'J') return;

    const doc = getValues('documento');
    if (!doc) return;

    const cleanDoc = doc.replace(/\D/g, '');
    if (cleanDoc.length !== 14) return;

    setLoadingCnpj(true);
    try {
      const data = await buscaCnpj(cleanDoc);
      if (data) {
        // Preenche campos com dados oficiais
        if (data.razao_social) setValue('nome', data.razao_social.substring(0, 40));
        if (data.nome_fantasia) setValue('nomeFantasia', data.nome_fantasia.substring(0, 30));
        if (data.email) setValue('email', data.email.toLowerCase());
        if (data.logradouro) setValue('endereco', data.logradouro);
        if (data.numero) setValue('numero', data.numero);
        if (data.complemento) setValue('complemento', data.complemento);
        if (data.bairro) setValue('bairro', data.bairro);
        if (data.municipio) setValue('cidade', data.municipio);
        if (data.uf) setValue('uf', data.uf);
        if (data.cep) setValue('cep', data.cep.replace(/\D/g, ''));
        setValue('pais', '1058'); // Brasil

        toast.success('Dados do CNPJ preenchidos automaticamente!', {
          description: `${data.razao_social} - ${data.descricao_situacao_cadastral || ''}`,
          duration: 4000,
        });
      }
    } catch (error: any) {
      // Não bloqueia — só não preenche
      console.warn('CNPJ não encontrado na BrasilAPI:', error.message);
    } finally {
      setLoadingCnpj(false);
    }
  };

  // CEP Handler
  const handleCepBlur = async () => {
    const cep = getValues('cep');
    if (!cep) return;

    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const data = await buscaCep(cleanCep);
      if (data) {
        setValue('endereco', data.logradouro);
        setValue('bairro', data.bairro);
        setValue('cidade', data.localidade);
        setValue('uf', data.uf);
        setValue('pais', '1058'); // Default to Brasil if found via CEP
        // Focus number field if possible (optional, requires ref)
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP');
      console.error(error);
    } finally {
      setLoadingCep(false);
      onCepBlur?.();
    }
  };

  // Quando tipo pessoa = Física: auto-marca isentos e situação tributária "Não contribuinte"
  const tipoPessoaAnterior = useRef(tipoPessoa);
  useEffect(() => {
    // Só aplica quando o usuário MUDA para Física (não no carregamento inicial da edição)
    if (tipoPessoa === 'F' && tipoPessoaAnterior.current !== 'F') {
      setValue('isentoIE', true);
      setValue('inscricaoEstadual', 'ISENTO');
      setValue('isentoIM', true);
      setValue('inscricaoMunicipal', 'ISENTO');
      setValue('isentoSuframa', true);
      setValue('suframa', 'ISENTO');
      setValue('situacaoTributaria', '1'); // 1 = Não Contribuinte
      setValue('tipoEmpresa', 'PF'); // PF = Pessoa Física
    }
    tipoPessoaAnterior.current = tipoPessoa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPessoa, setValue]);

  // Effects for Isento Logic
  useEffect(() => {
    if (isentoIE) setValue('inscricaoEstadual', 'ISENTO');
    else if (watch('inscricaoEstadual') === 'ISENTO')
      setValue('inscricaoEstadual', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isentoIE, setValue]);

  useEffect(() => {
    if (isentoIM) setValue('inscricaoMunicipal', 'ISENTO');
    else if (watch('inscricaoMunicipal') === 'ISENTO')
      setValue('inscricaoMunicipal', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isentoIM, setValue]);

  useEffect(() => {
    if (isentoSuframa) setValue('suframa', 'ISENTO');
    else if (watch('suframa') === 'ISENTO') setValue('suframa', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isentoSuframa, setValue]);

  // Mask Logic
  const getMask = () => {
    if (tipoPessoa === 'F') return '999.999.999-99';
    if (tipoPessoa === 'J') return '99.999.999/9999-99';
    return ''; // No mask for Exterior or others
  };

  return (
    <div className="form-compact space-y-3">
      {/* Identificação Section Title */}
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2 border-b pb-2">
        Identificação
      </h3>

      <div className="grid grid-cols-4 gap-3">
        {/* Tipo Pessoa */}
        <div>
          <Label>Tipo Pessoa</Label>
          <Controller
            control={control}
            name="tipoPessoa"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">F - Física</SelectItem>
                  <SelectItem value="J">J - Jurídica</SelectItem>
                  <SelectItem value="E">E - Exterior</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Documento */}
        <div className="relative">
          <Label>
            {tipoPessoa === 'J'
              ? 'CNPJ'
              : tipoPessoa === 'F'
              ? 'CPF'
              : 'Documento'}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <div className="relative">
            <Controller
              control={control}
              name="documento"
              render={({ field: { ref, ...fieldProps } }) =>
                tipoPessoa === 'E' ? (
                  <Input
                    {...fieldProps}
                    ref={ref}
                    placeholder="Documento Internacional"
                  />
                ) : (
                  <Input
                    {...fieldProps}
                    ref={ref}
                    value={fieldProps.value || ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      let formatted = raw;
                      if (tipoPessoa === 'J') {
                        // CNPJ: 00.000.000/0000-00
                        formatted = raw.slice(0, 14)
                          .replace(/^(\d{2})(\d)/, '$1.$2')
                          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                          .replace(/\.(\d{3})(\d)/, '.$1/$2')
                          .replace(/(\d{4})(\d)/, '$1-$2');
                      } else {
                        // CPF: 000.000.000-00
                        formatted = raw.slice(0, 11)
                          .replace(/^(\d{3})(\d)/, '$1.$2')
                          .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                          .replace(/\.(\d{3})(\d)/, '.$1-$2');
                      }
                      fieldProps.onChange(formatted);
                    }}
                    className={duplicateFound ? 'border-amber-500 bg-amber-50' : ''}
                    placeholder={tipoPessoa === 'J' ? '00.000.000/0000-00' : '000.000.000-00'}
                  />
                )
              }
            />

            {loadingCnpj ? (
              <div className="absolute right-3 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              </div>
            ) : isChecking ? (
              <div className="absolute right-3 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="absolute right-1 top-1 flex gap-1">
                {watch('documento')?.replace(/\D/g, '').length > 0 && (
                  <button
                    type="button"
                    onClick={() => setValue('documento', '')}
                    className="px-1 py-0.5 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                    title="Limpar documento"
                  >
                    ✕
                  </button>
                )}
                {tipoPessoa === 'J' && (
                  <button
                    type="button"
                    onClick={handleDocumentoBlur}
                    className="px-1.5 py-0.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    title="Buscar dados do CNPJ na Receita Federal"
                  >
                    Buscar
                  </button>
                )}
              </div>
            )}
          </div>
          {duplicateFound && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Documento duplicado detectado
            </p>
          )}
          {errors.documento && (
            <p className="text-xs text-red-500 mt-1">
              {errors.documento.message as string}
            </p>
          )}
        </div>

        {/* Nome / Razão Social */}
        <div className="col-span-2">
          <Label>
            Nome / Razão Social
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            {...register('nome')}
            className={
              errors.nome
                ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20 focus-visible:ring-red-500'
                : ''
            }
          />
          {errors.nome && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {errors.nome.message as string}
            </p>
          )}
        </div>

        {/* Fantasia */}
        <div className="col-span-2">
          <Label>Nome Fantasia</Label>
          <Input {...register('nomeFantasia')} />
        </div>

        {/* Email */}
        <div className="col-span-2">
          <Label>Email</Label>
          <Input
            {...register('email')}
            type="email"
            placeholder="email@exemplo.com"
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">
              {errors.email.message as string}
            </p>
          )}
        </div>
      </div>

      {/* Classificação Tributária e Comercial Section */}
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2 border-b pb-2">
        Classificação
      </h3>

      <div className="grid grid-cols-4 gap-3">
        {/* Tipo Cliente */}
        <div className={errors.tipoCliente ? 'field-error' : ''}>
          <Label>Tipo Cliente <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="tipoCliente"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">R - Revenda</SelectItem>
                  <SelectItem value="F">F - Cliente Fin</SelectItem>
                  <SelectItem value="L">L - Prod. Rural</SelectItem>
                  <SelectItem value="S">S - Solidário</SelectItem>
                  <SelectItem value="X">X - Exportador</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.tipoCliente && <p className="text-xs text-red-500 mt-0.5">{errors.tipoCliente.message as string}</p>}
        </div>

        {/* Situação Tributária */}
        <div className={errors.situacaoTributaria ? 'field-error' : ''}>
          <Label>Situação Tributária <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="situacaoTributaria"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">NC - Não Contribuinte</SelectItem>
                  <SelectItem value="2">LP - Lucro Presumido</SelectItem>
                  <SelectItem value="3">LR - Lucro Real</SelectItem>
                  <SelectItem value="4">SN - Simples Nacional</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.situacaoTributaria && <p className="text-xs text-red-500 mt-0.5">{errors.situacaoTributaria.message as string}</p>}
        </div>

        {/* Tipo Empresa */}
        <div className={errors.tipoEmpresa ? 'field-error' : ''}>
          <Label>Tipo Empresa <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="tipoEmpresa"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EPP">EPP - Empresa de Pequeno Porte</SelectItem>
                  <SelectItem value="ME">ME - Microempresa</SelectItem>
                  <SelectItem value="NL">NL - Normal</SelectItem>
                  <SelectItem value="PF">PF - Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.tipoEmpresa && <p className="text-xs text-red-500 mt-0.5">{errors.tipoEmpresa.message as string}</p>}
        </div>

        {/* Classe Cliente */}
        <div className={errors.classeCliente ? 'field-error' : ''}>
          <Label>Classe Cliente <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="classeCliente"
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                value={field.value || ''}
                disabled={loadingClasses}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingClasses ? 'Carregando...' : 'Selecione'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classesCliente.map((classe) => (
                    <SelectItem key={classe.codcc} value={classe.codcc}>
                      {classe.codcc} - {classe.descr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.classeCliente && <p className="text-xs text-red-500 mt-0.5">{errors.classeCliente.message as string}</p>}
        </div>
      </div>

      {/* Observações */}
      <div className="mt-4">
        <Label>Observações</Label>
        <Input
          {...register('obs')}
          placeholder="Observações gerais sobre o cliente"
        />
      </div>

      {/* Fiscal Info Section Title */}
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2 border-b pb-2">
        Inscrições Fiscais
      </h3>

      <div className="grid grid-cols-4 gap-3">
        {/* IE */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Inscrição Estadual</Label>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isentoIE"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="chk-ie"
                  />
                )}
              />
              <Label
                htmlFor="chk-ie"
                className="text-xs font-normal text-gray-500"
              >
                Isento
              </Label>
            </div>
          </div>
          <Input
            {...register('inscricaoEstadual')}
            disabled={isentoIE}
            className={isentoIE ? 'bg-gray-100 text-gray-500' : ''}
          />
        </div>

        {/* IM */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Inscrição Municipal</Label>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isentoIM"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="chk-im"
                  />
                )}
              />
              <Label
                htmlFor="chk-im"
                className="text-xs font-normal text-gray-500"
              >
                Isento
              </Label>
            </div>
          </div>
          <Input
            {...register('inscricaoMunicipal')}
            disabled={isentoIM}
            className={isentoIM ? 'bg-gray-100 text-gray-500' : ''}
          />
        </div>

        {/* Suframa */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Suframa</Label>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isentoSuframa"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="chk-suf"
                  />
                )}
              />
              <Label
                htmlFor="chk-suf"
                className="text-xs font-normal text-gray-500"
              >
                Isento
              </Label>
            </div>
          </div>
          <Input
            {...register('suframa')}
            disabled={isentoSuframa}
            className={isentoSuframa ? 'bg-gray-100 text-gray-500' : ''}
          />
        </div>
      </div>

      {/* Endereço Section Title */}
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2 border-b pb-2">
        Endereço
      </h3>

      <div className="grid grid-cols-4 gap-3">
        <div className="relative">
          <Label>CEP</Label>
          <div className="relative">
            <Controller
              control={control}
              name="cep"
              render={({ field: { ref, onBlur, ...fieldProps } }) => (
                <Input
                  {...fieldProps}
                  ref={ref}
                  value={fieldProps.value || ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                    const formatted = raw.replace(/^(\d{5})(\d)/, '$1-$2');
                    fieldProps.onChange(formatted);
                  }}
                  onBlur={() => {
                    onBlur();
                    handleCepBlur();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCepBlur();
                    }
                  }}
                  placeholder="00000-000"
                />
              )}
            />
            {loadingCep ? (
              <div className="absolute right-2 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCepBlur}
                className="absolute right-1 top-1 px-1.5 py-0.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                title="Buscar endereço pelo CEP"
              >
                Buscar
              </button>
            )}
          </div>
        </div>
        <div className="col-span-2">
          <Label>Logradouro</Label>
          <Input {...register('endereco')} />
        </div>
        <div>
          <Label>Número</Label>
          <Input {...register('numero')} name="numero" />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input {...register('complemento')} />
        </div>
        <div>
          <Label>Referência</Label>
          <Input {...register('referencia')} placeholder="Ponto de referência" />
        </div>
        <div className={errors.bairro ? 'field-error' : ''}>
          <Label>Bairro <span className="text-red-500">*</span></Label>
          <Input {...register('bairro')} />
          {errors.bairro && <p className="text-xs text-red-500 mt-0.5">{errors.bairro.message as string}</p>}
        </div>
        <div className={errors.cidade ? 'field-error' : ''}>
          <Label>Cidade <span className="text-red-500">*</span></Label>
          <Input {...register('cidade')} />
          {errors.cidade && <p className="text-xs text-red-500 mt-0.5">{errors.cidade.message as string}</p>}
        </div>
        <div className={errors.uf ? 'field-error' : ''}>
          <Label>UF <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="uf"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'AC',
                    'AL',
                    'AP',
                    'AM',
                    'BA',
                    'CE',
                    'DF',
                    'ES',
                    'GO',
                    'MA',
                    'MT',
                    'MS',
                    'MG',
                    'PA',
                    'PB',
                    'PR',
                    'PE',
                    'PI',
                    'RJ',
                    'RN',
                    'RS',
                    'RO',
                    'RR',
                    'SC',
                    'SP',
                    'SE',
                    'TO',
                  ].map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.uf && <p className="text-xs text-red-500 mt-0.5">{errors.uf.message as string}</p>}
        </div>
        <div className={errors.pais ? 'field-error' : ''}>
          <Label>País <span className="text-red-500">*</span></Label>
          <Controller
            control={control}
            name="pais"
            render={({ field }) => (
              <CountryCombobox
                value={field.value}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
          {errors.pais && <p className="text-xs text-red-500 mt-0.5">País é obrigatório</p>}
        </div>
      </div>

      {/* Endereço de Cobrança Section */}
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-4 mb-2 border-b pb-2">
        Endereço de Cobrança
      </h3>

      <div className="flex items-center gap-2 mb-4">
        <Controller
          control={control}
          name="enderecoCobrancaIgual"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              id="chk-endereco-cobranca"
            />
          )}
        />
        <Label htmlFor="chk-endereco-cobranca" className="font-normal cursor-pointer">
          Endereço de cobrança igual ao endereço principal
        </Label>
      </div>

      {!enderecoCobrancaIgual && (
        <div className="grid grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-md border">
          <div>
            <Label>CEP</Label>
            <Controller
              control={control}
              name="cepcobr"
              render={({ field: { ref, ...fieldProps } }) => (
                <Input
                  {...fieldProps}
                  ref={ref}
                  value={fieldProps.value || ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                    const formatted = raw.replace(/^(\d{5})(\d)/, '$1-$2');
                    fieldProps.onChange(formatted);
                  }}
                  placeholder="00000-000"
                />
              )}
            />
          </div>
          <div className="col-span-2">
            <Label>Logradouro</Label>
            <Input {...register('endercobr')} />
          </div>
          <div>
            <Label>Número</Label>
            <Input {...register('numerocobr')} />
          </div>
          <div>
            <Label>Complemento</Label>
            <Input {...register('complementocobr')} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input {...register('bairrocobr')} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input {...register('cidadecobr')} />
          </div>
          <div>
            <Label>UF</Label>
            <Controller
              control={control}
              name="ufcobr"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
                    ].map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Referência</Label>
            <Input {...register('referenciacobr')} placeholder="Ponto de referência" />
          </div>
        </div>
      )}

      {/* Contatos Section - Compacto */}
      <div className="flex flex-row items-center justify-between mt-6 mb-3 border-b pb-2">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          Telefones e Contatos
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: 'celular', value: '', obs: '' })}
        >
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      {/* Grid compacto de contatos */}
      <div className="space-y-2">
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
            Nenhum contato adicionado. Clique em "Adicionar" para incluir telefones ou emails.
          </p>
        ) : (
          <div className="grid gap-2">
            {fields.map((field, index) => {
              const tipoAtual = watch(`contatos.${index}.type`);
              const getIcon = (tipo: string) => {
                switch (tipo) {
                  case 'celular': return <Smartphone size={14} className="text-green-600" />;
                  case 'fixo': return <Phone size={14} className="text-blue-600" />;
                  case 'comercial': return <Building2 size={14} className="text-orange-600" />;
                  case 'whatsapp': return <MessageCircle size={14} className="text-green-500" />;
                  case 'email': return <Mail size={14} className="text-red-500" />;
                  default: return <Phone size={14} />;
                }
              };
              const isPhone = ['celular', 'fixo', 'comercial', 'whatsapp'].includes(tipoAtual);

              return (
                <div
                  key={field.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-zinc-700"
                >
                  {/* Ícone do tipo */}
                  <div className="flex-shrink-0 w-6 flex justify-center">
                    {getIcon(tipoAtual)}
                  </div>

                  {/* Tipo */}
                  <Controller
                    control={control}
                    name={`contatos.${index}.type`}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-8 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="celular">Celular</SelectItem>
                          <SelectItem value="fixo">Fixo</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />

                  {/* Valor com máscara condicional */}
                  {isPhone ? (
                    <Controller
                      control={control}
                      name={`contatos.${index}.value`}
                      render={({ field: { ref, ...fieldProps } }) => (
                        <InputMask
                          {...fieldProps}
                          mask={tipoAtual === 'celular' || tipoAtual === 'whatsapp'
                            ? '(99) 99999-9999'
                            : '(99) 9999-9999'}
                          maskChar="_"
                        >
                          {(inputProps: any) => (
                            <Input
                              {...inputProps}
                              ref={ref}
                              className="h-8 flex-1 text-sm"
                              placeholder={tipoAtual === 'celular' || tipoAtual === 'whatsapp'
                                ? '(00) 00000-0000'
                                : '(00) 0000-0000'}
                            />
                          )}
                        </InputMask>
                      )}
                    />
                  ) : (
                    <Input
                      {...register(`contatos.${index}.value`)}
                      className="h-8 flex-1 text-sm"
                      placeholder="email@exemplo.com"
                    />
                  )}

                  {/* Observação */}
                  <Input
                    {...register(`contatos.${index}.obs`)}
                    className="h-8 w-[120px] text-xs"
                    placeholder="Obs (opcional)"
                  />

                  {/* Botão remover */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pessoas de Contato Section - Compacto */}
      <div className="flex flex-row items-center justify-between mt-6 mb-3 border-b pb-2">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          Pessoas de Contato
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendPessoa({ nome: '', cargo: '', telefone: '', email: '', aniversario: '' })}
        >
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      {/* Grid compacto de pessoas */}
      <div className="space-y-2">
        {pessoasFields.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
            Nenhuma pessoa de contato cadastrada.
          </p>
        ) : (
          <div className="grid gap-2">
            {pessoasFields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-zinc-700"
              >
                {/* Ícone */}
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <User size={14} className="text-blue-600" />
                </div>

                {/* Nome */}
                <div className="flex-1 min-w-[150px]">
                  <Input
                    {...register(`pessoasContato.${index}.nome`)}
                    className="h-8 text-sm"
                    placeholder="Nome *"
                  />
                </div>

                {/* Cargo */}
                <div className="w-[120px]">
                  <div className="relative">
                    <Briefcase size={12} className="absolute left-2 top-2.5 text-gray-400" />
                    <Input
                      {...register(`pessoasContato.${index}.cargo`)}
                      className="h-8 text-xs pl-7"
                      placeholder="Cargo"
                    />
                  </div>
                </div>

                {/* Telefone */}
                <div className="w-[130px]">
                  <Controller
                    control={control}
                    name={`pessoasContato.${index}.telefone`}
                    render={({ field: { ref, ...fieldProps } }) => (
                      <div className="relative">
                        <Phone size={12} className="absolute left-2 top-2.5 text-gray-400" />
                        <InputMask
                          {...fieldProps}
                          mask="(99) 99999-9999"
                          maskChar="_"
                        >
                          {(inputProps: any) => (
                            <Input
                              {...inputProps}
                              ref={ref}
                              className="h-8 text-xs pl-7"
                              placeholder="Telefone"
                            />
                          )}
                        </InputMask>
                      </div>
                    )}
                  />
                </div>

                {/* Email */}
                <div className="w-[160px]">
                  <div className="relative">
                    <Mail size={12} className="absolute left-2 top-2.5 text-gray-400" />
                    <Input
                      {...register(`pessoasContato.${index}.email`)}
                      className="h-8 text-xs pl-7"
                      placeholder="Email"
                    />
                  </div>
                </div>

                {/* Aniversário */}
                <div className="w-[80px]">
                  <div className="relative">
                    <Cake size={12} className="absolute left-2 top-2.5 text-gray-400" />
                    <Controller
                      control={control}
                      name={`pessoasContato.${index}.aniversario`}
                      render={({ field: { ref, ...fieldProps } }) => (
                        <InputMask {...fieldProps} mask="99/99" maskChar="_">
                          {(inputProps: any) => (
                            <Input
                              {...inputProps}
                              ref={ref}
                              className="h-8 text-xs pl-7"
                              placeholder="DD/MM"
                            />
                          )}
                        </InputMask>
                      )}
                    />
                  </div>
                </div>

                {/* Botão remover */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                  onClick={() => removePessoa(index)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
