/**
 * ClientForm - Formulário Completo de Cadastro de Clientes
 * Feature-Complete com todas as regras de negócio fiscais
 */

'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClientFormSchema } from '@/schemas/client.schemas';
import type { ClientForm as ClientFormData } from '@/schemas/client.schemas';
import { useClientVerification } from '@/hooks/useClientVerification';
import { DuplicateClientModal } from '@/components/clientes';

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Icons
import {
  User,
  FileText,
  MapPin,
  CreditCard,
  Copy,
  AlertCircle,
  Save,
  Shield,
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIPOS_CLIENTE = [
  { value: 'Revenda', label: 'Revenda' },
  { value: 'Financeiro', label: 'Financeiro' },
  { value: 'Produtor Rural', label: 'Produtor Rural' },
  { value: 'Solidário', label: 'Solidário' },
  { value: 'Exportador', label: 'Exportador' },
];

const SITUACOES_TRIBUTARIAS = [
  { value: 'Não Contribuinte', label: 'Não Contribuinte' },
  { value: 'Lucro Presumido', label: 'Lucro Presumido' },
  { value: 'Lucro Real', label: 'Lucro Real' },
  { value: 'Simples Nacional', label: 'Simples Nacional' },
];

const UFS = [
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
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ClientForm() {
  const [repeatAddress, setRepeatAddress] = useState(false);

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(ClientFormSchema),
    defaultValues: {
      client: {
        tipo_pessoa: 'F',
        cpf_cnpj: '',
        nome: '',
        nome_fantasia: '',
        email_principal: '',
        tipo_cliente: 'Revenda',
        situacao_tributaria: 'Não Contribuinte',
        classe_cliente: '',
        habilita_suframa: false,
        inscricao_suframa: '',
        inscricao_estadual: '',
        ativo: true,
      },
      endereco_principal: {
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: 'SP',
        cep: '',
        pais: 'Brasil',
      },
      endereco_cobranca: {
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: 'SP',
        cep: '',
        pais: 'Brasil',
      },
      dados_financeiros: {
        limite_credito: 0,
        aceita_atraso: false,
        icms: false,
      },
    },
  });

  // Client verification hook
  const {
    verifyClient,
    duplicateClient,
    showModal,
    closeModal,
    isLoading: isVerifying,
  } = useClientVerification();

  // Watch values
  const habilitaSuframa = watch('client.habilita_suframa');
  const tipoPessoa = watch('client.tipo_pessoa');

  // ========== HANDLERS ==========

  const handleCopyAddress = () => {
    const principal = getValues('endereco_principal');
    setValue('endereco_cobranca.logradouro', principal.logradouro);
    setValue('endereco_cobranca.numero', principal.numero);
    setValue('endereco_cobranca.complemento', principal.complemento || '');
    setValue('endereco_cobranca.bairro', principal.bairro);
    setValue('endereco_cobranca.cidade', principal.cidade);
    setValue('endereco_cobranca.uf', principal.uf);
    setValue('endereco_cobranca.cep', principal.cep);
    setValue('endereco_cobranca.pais', principal.pais || 'Brasil');
    setRepeatAddress(true);
  };

  const onSubmit = async (data: ClientFormData) => {
    try {
      console.log('Dados do formulário:', data);
      // TODO: Implementar chamada à API
      alert('Formulário válido! Dados no console.');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  // ========== RENDER ==========

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ====================================================================
          BLOCO 1: IDENTIFICAÇÃO
      ==================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Identificação
          </CardTitle>
          <CardDescription>Dados principais do cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de Pessoa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_pessoa">Tipo de Pessoa *</Label>
              <Controller
                name="client.tipo_pessoa"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Física</SelectItem>
                      <SelectItem value="J">Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client?.tipo_pessoa && (
                <p className="text-xs text-red-500">
                  {(errors.client.tipo_pessoa as any)?.message}
                </p>
              )}
            </div>

            {/* CPF/CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">
                {tipoPessoa === 'F' ? 'CPF' : 'CNPJ'} *
                {isVerifying && (
                  <span className="ml-2 text-xs text-gray-500">
                    Verificando...
                  </span>
                )}
              </Label>
              <Controller
                name="client.cpf_cnpj"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder={
                      tipoPessoa === 'F'
                        ? '000.000.000-00'
                        : '00.000.000/0000-00'
                    }
                    onBlur={(e) => {
                      field.onBlur();
                      verifyClient(e.target.value);
                    }}
                    disabled={isVerifying}
                  />
                )}
              />
              {errors.client?.cpf_cnpj && (
                <p className="text-xs text-red-500">
                  {errors.client.cpf_cnpj.message}
                </p>
              )}
            </div>
          </div>

          {/* Nome e Nome Fantasia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">
                {tipoPessoa === 'F' ? 'Nome Completo' : 'Razão Social'} *
              </Label>
              <Controller
                name="client.nome"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.client?.nome && (
                <p className="text-xs text-red-500">
                  {errors.client.nome.message}
                </p>
              )}
            </div>

            {tipoPessoa === 'J' && (
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Controller
                  name="client.nome_fantasia"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} value={field.value || ''} />
                  )}
                />
                {errors.client?.nome_fantasia && (
                  <p className="text-xs text-red-500">
                    {errors.client.nome_fantasia.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Email Principal */}
          <div className="space-y-2">
            <Label htmlFor="email_principal">Email Principal *</Label>
            <Controller
              name="client.email_principal"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  type="email"
                  placeholder="email@exemplo.com"
                />
              )}
            />
            {errors.client?.email_principal && (
              <p className="text-xs text-red-500">
                {errors.client.email_principal.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          BLOCO 2: CLASSIFICAÇÃO FISCAL
      ==================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Classificação Fiscal
          </CardTitle>
          <CardDescription>
            Informações tributárias e classificação do cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo de Cliente */}
            <div className="space-y-2">
              <Label htmlFor="tipo_cliente">Tipo de Cliente *</Label>
              <Controller
                name="client.tipo_cliente"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CLIENTE.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client?.tipo_cliente && (
                <p className="text-xs text-red-500">
                  {errors.client.tipo_cliente.message}
                </p>
              )}
            </div>

            {/* Situação Tributária */}
            <div className="space-y-2">
              <Label htmlFor="situacao_tributaria">Situação Tributária *</Label>
              <Controller
                name="client.situacao_tributaria"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUACOES_TRIBUTARIAS.map((sit) => (
                        <SelectItem key={sit.value} value={sit.value}>
                          {sit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client?.situacao_tributaria && (
                <p className="text-xs text-red-500">
                  {errors.client.situacao_tributaria.message}
                </p>
              )}
            </div>

            {/* Classe de Cliente */}
            <div className="space-y-2">
              <Label htmlFor="classe_cliente">Classe de Cliente</Label>
              <Controller
                name="client.classe_cliente"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Ex: Premium"
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          BLOCO 3: INSCRIÇÕES & SUFRAMA
      ==================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Inscrições e SUFRAMA
          </CardTitle>
          <CardDescription>
            Inscrições fiscais e incentivos SUFRAMA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Switch SUFRAMA */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="habilita_suframa" className="text-base">
                Habilita Incentivo SUFRAMA?
              </Label>
              <p className="text-sm text-gray-500">
                Ativa os benefícios fiscais da Zona Franca de Manaus
              </p>
            </div>
            <Controller
              name="client.habilita_suframa"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Campos condicionais SUFRAMA */}
          {habilitaSuframa && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Inscrição SUFRAMA e Inscrição Estadual são obrigatórias quando
                SUFRAMA está habilitado.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inscrição SUFRAMA */}
            <div className="space-y-2">
              <Label htmlFor="inscricao_suframa">
                Inscrição SUFRAMA {habilitaSuframa && '*'}
              </Label>
              <Controller
                name="client.inscricao_suframa"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    disabled={!habilitaSuframa}
                    placeholder={
                      habilitaSuframa
                        ? 'Digite a inscrição SUFRAMA'
                        : 'Desabilitado'
                    }
                  />
                )}
              />
              {errors.client?.inscricao_suframa && (
                <p className="text-xs text-red-500">
                  {errors.client.inscricao_suframa.message}
                </p>
              )}
            </div>

            {/* Inscrição Estadual */}
            <div className="space-y-2">
              <Label htmlFor="inscricao_estadual">
                Inscrição Estadual {habilitaSuframa && '*'}
              </Label>
              <Controller
                name="client.inscricao_estadual"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    disabled={!habilitaSuframa}
                    placeholder={
                      habilitaSuframa
                        ? 'Digite a inscrição estadual'
                        : 'Desabilitado'
                    }
                  />
                )}
              />
              {errors.client?.inscricao_estadual && (
                <p className="text-xs text-red-500">
                  {errors.client.inscricao_estadual.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          BLOCO 4: ENDEREÇO PRINCIPAL
      ==================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço Principal
          </CardTitle>
          <CardDescription>Endereço principal do cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CEP e Logradouro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cep_principal">CEP *</Label>
              <Controller
                name="endereco_principal.cep"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="00000-000" />
                )}
              />
              {errors.endereco_principal?.cep && (
                <p className="text-xs text-red-500">
                  {errors.endereco_principal.cep.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="logradouro_principal">Logradouro *</Label>
              <Controller
                name="endereco_principal.logradouro"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Rua, Avenida, etc." />
                )}
              />
              {errors.endereco_principal?.logradouro && (
                <p className="text-xs text-red-500">
                  {errors.endereco_principal.logradouro.message}
                </p>
              )}
            </div>
          </div>

          {/* Número e Complemento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_principal">Número *</Label>
              <Controller
                name="endereco_principal.numero"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.endereco_principal?.numero && (
                <p className="text-xs text-red-500">
                  {errors.endereco_principal.numero.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="complemento_principal">Complemento</Label>
              <Controller
                name="endereco_principal.complemento"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Apto, Sala, etc."
                  />
                )}
              />
            </div>
          </div>

          {/* Bairro, Cidade, UF */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bairro_principal">Bairro *</Label>
              <Controller
                name="endereco_principal.bairro"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.endereco_principal?.bairro && (
                <p className="text-xs text-red-500">
                  {errors.endereco_principal.bairro.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade_principal">Cidade *</Label>
              <Controller
                name="endereco_principal.cidade"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.endereco_principal?.cidade && (
                <p className="text-xs text-red-500">
                  {errors.endereco_principal.cidade.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="uf_principal">UF *</Label>
              <Controller
                name="endereco_principal.uf"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* País */}
          <div className="space-y-2">
            <Label htmlFor="pais_principal">País</Label>
            <Controller
              name="endereco_principal.pais"
              control={control}
              render={({ field }) => (
                <Input {...field} value={field.value || 'Brasil'} />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          BLOCO 5: ENDEREÇO DE COBRANÇA
      ==================================================================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Endereço de Cobrança
              </CardTitle>
              <CardDescription>
                Endereço para envio de cobranças
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAddress}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Repetir Endereço Principal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {repeatAddress && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Endereço copiado do endereço principal.
              </AlertDescription>
            </Alert>
          )}

          {/* CEP e Logradouro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cep_cobranca">CEP *</Label>
              <Controller
                name="endereco_cobranca.cep"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="00000-000" />
                )}
              />
              {errors.endereco_cobranca?.cep && (
                <p className="text-xs text-red-500">
                  {errors.endereco_cobranca.cep.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="logradouro_cobranca">Logradouro *</Label>
              <Controller
                name="endereco_cobranca.logradouro"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Rua, Avenida, etc." />
                )}
              />
              {errors.endereco_cobranca?.logradouro && (
                <p className="text-xs text-red-500">
                  {errors.endereco_cobranca.logradouro.message}
                </p>
              )}
            </div>
          </div>

          {/* Número e Complemento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_cobranca">Número *</Label>
              <Controller
                name="endereco_cobranca.numero"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.endereco_cobranca?.numero && (
                <p className="text-xs text-red-500">
                  {errors.endereco_cobranca.numero.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="complemento_cobranca">Complemento</Label>
              <Controller
                name="endereco_cobranca.complemento"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Apto, Sala, etc."
                  />
                )}
              />
            </div>
          </div>

          {/* Bairro, Cidade, UF */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bairro_cobranca">Bairro *</Label>
              <Controller
                name="endereco_cobranca.bairro"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.endereco_cobranca?.bairro && (
                <p className="text-xs text-red-500">
                  {errors.endereco_cobranca.bairro.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade_cobranca">Cidade *</Label>
              <Controller
                name="endereco_cobranca.cidade"
                control={control}
                render={({ field }) => <Input {...field} />}
              />
              {errors.endereco_cobranca?.cidade && (
                <p className="text-xs text-red-500">
                  {errors.endereco_cobranca.cidade.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="uf_cobranca">UF *</Label>
              <Controller
                name="endereco_cobranca.uf"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* País */}
          <div className="space-y-2">
            <Label htmlFor="pais_cobranca">País</Label>
            <Controller
              name="endereco_cobranca.pais"
              control={control}
              render={({ field }) => (
                <Input {...field} value={field.value || 'Brasil'} />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          DADOS FINANCEIROS (Simplificado)
      ==================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Dados Financeiros
          </CardTitle>
          <CardDescription>Informações financeiras do cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limite_credito">Limite de Crédito</Label>
              <Controller
                name="dados_financeiros.limite_credito"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    min="0"
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
                  />
                )}
              />
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Controller
                name="dados_financeiros.aceita_atraso"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="aceita_atraso" className="cursor-pointer">
                Aceita Atraso
              </Label>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Controller
                name="dados_financeiros.icms"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="icms" className="cursor-pointer">
                Contribuinte ICMS
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          FOOTER - BOTÕES DE AÇÃO
      ==================================================================== */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline">
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
        </Button>
      </div>

      {/* Modal de Cliente Duplicado */}
      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
      />
    </form>
  );
}

export default ClientForm;
