import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, AlertTriangle } from 'lucide-react';
import { useGatekeeper } from '@/hooks/useGatekeeper';
import { RegistrationTab } from './tabs/RegistrationTab';
import { FinancialTab } from './tabs/FinancialTab';
import { CommercialTab } from './tabs/CommercialTab';
import { clientSchema, ClientFormValues } from './schema';
import {
  Cliente,
  insertCliente,
  updateCliente,
  getCliente,
} from '@/data/clientes/clientes';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TabNavigation from '@/components/common/TabNavigation';
import Carregamento from '@/utils/carregamento';
import FormFooter from '@/components/common/FormFooter2';

// Suprime warning do findDOMNode temporariamente
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('findDOMNode')) {
      return;
    }
    originalError(...args);
  };
}

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Cliente | null;
  onSuccess?: () => void;
}

const tabs = [
  { name: 'Dados Cadastrais', key: 'registration' },
  { name: 'Dados Financeiros', key: 'financial' },
  { name: 'Dados Comerciais', key: 'commercial' },
];

export default function ClientFormModal({
  isOpen,
  onClose,
  clientToEdit,
  onSuccess,
}: ClientFormModalProps) {
  const [activeTab, setActiveTab] = useState('registration');
  const [showGatekeeperModal, setShowGatekeeperModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const isEditing = !!clientToEdit;

  const methods = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      tipoPessoa: 'J',
      documento: '',
      isentoIE: false,
      isentoIM: false,
      isentoSuframa: false,
      enderecoCobrancaIgual: true,
      contatos: [],
      pessoasContato: [],
      vendedores: [],
      classePagamento: 'A',
      pais: 1058,
      limiteCredito: '0',
      credito: 'S',
      icms: 'N',
      aceitaAtraso: false,
      diasAtraso: '0',
      faixaFinanceira: '',
      banco: undefined,
      formaPagamento: '',
      bairro: '',
      nome: '',
      nomeFantasia: '',
      email: '',
      cep: '',
      endereco: '',
      cidade: '',
      uf: '',
      numero: '',
      complemento: '',
    },
    mode: 'onSubmit',
  });

  const { watch, handleSubmit, reset, formState } = methods;
  const documento = watch('documento');
  const { errors } = formState;

  // Gatekeeper hook - só verifica se NÃO estiver editando
  const { matches } = useGatekeeper(documento, !isEditing);

  // Reset form when opening/closing or changing edit mode
  useEffect(() => {
    const loadData = async () => {
      if (isOpen) {
        if (clientToEdit) {
          setIsLoadingData(true);
          try {
            const fullCliente = await getCliente(clientToEdit.codcli);

            // Função para normalizar tipos de contato (compatibilidade com dados antigos)
            const normalizarContatos = (contatos: any[]) => {
              if (!Array.isArray(contatos)) return [];
              return contatos.map((c) => ({
                ...c,
                // Converter tipo antigo 'phone' para 'celular'
                type: c.type === 'phone' ? 'celular' : c.type,
              }));
            };

            // Parse contatos se for string JSON
            // Suporta formato antigo (array) e novo (objeto com telefones, pessoas e vendedores)
            let contatosParsed: any[] = [];
            let pessoasContatoParsed: any[] = [];
            let vendedoresParsed: any[] = [];
            try {
              const parsed = fullCliente.contato
                ? JSON.parse(fullCliente.contato)
                : null;

              if (parsed) {
                // Novo formato: { telefones: [...], pessoas: [...], vendedores: [...] }
                if (parsed.telefones || parsed.pessoas || parsed.vendedores) {
                  contatosParsed = normalizarContatos(parsed.telefones || []);
                  pessoasContatoParsed = parsed.pessoas || [];
                  vendedoresParsed = parsed.vendedores || [];
                } else if (Array.isArray(parsed)) {
                  // Formato antigo: array direto de contatos
                  contatosParsed = normalizarContatos(parsed);
                }
              }
            } catch {
              contatosParsed = [];
              pessoasContatoParsed = [];
              vendedoresParsed = [];
            }

            reset({
              tipoPessoa: (fullCliente.tipo as 'F' | 'J' | 'E') || 'J',
              documento: fullCliente.cpfcgc || '',
              nome: (fullCliente.nome || '').trim().substring(0, 40),
              nomeFantasia: (fullCliente.nomefant || '')
                .trim()
                .substring(0, 30),
              email: fullCliente.email || '',
              tipoCliente:
                (fullCliente.tipocliente as 'R' | 'F' | 'L' | 'S' | 'X') ||
                null,
              situacaoTributaria: fullCliente.sit_tributaria
                ? (String(fullCliente.sit_tributaria) as '1' | '2' | '3' | '4')
                : null,
              tipoEmpresa:
                (fullCliente.tipoemp as 'EPP' | 'ME' | 'NL' | 'PF') || null,
              classeCliente: fullCliente.codcc || '',
              inscricaoEstadual:
                fullCliente.iest === 'ISENTO' ? 'ISENTO' : fullCliente.iest,
              isentoIE: fullCliente.iest === 'ISENTO',
              inscricaoMunicipal:
                fullCliente.imun === 'ISENTO' ? 'ISENTO' : fullCliente.imun,
              isentoIM: fullCliente.imun === 'ISENTO',
              suframa:
                fullCliente.isuframa === 'ISENTO'
                  ? 'ISENTO'
                  : fullCliente.isuframa,
              isentoSuframa: fullCliente.isuframa === 'ISENTO',
              cep: fullCliente.cep || '',
              endereco: fullCliente.ender || '',
              bairro: fullCliente.bairro || '',
              cidade: fullCliente.cidade || '',
              uf: fullCliente.uf || '',
              numero: fullCliente.numero || '',
              complemento: fullCliente.complemento || '',
              pais: Number(fullCliente.codpais) || 1058, // ✅ CORRIGIDO: Number()
              limiteCredito: String(fullCliente.limite || '0'),
              credito: (fullCliente.status as 'S' | 'N') || 'S',
              classePagamento:
                (fullCliente.claspgto as 'A' | 'B' | 'C' | 'X') || 'A',
              aceitaAtraso: (fullCliente.atraso || 0) > 0,
              diasAtraso: String(fullCliente.atraso || '0'),
              icms: (fullCliente.icms as 'S' | 'N') || 'N',
              faixaFinanceira: fullCliente.faixafin || '',
              banco: Number(fullCliente.banco) || undefined,
              formaPagamento: '',
              enderecoCobrancaIgual:
                fullCliente.ender === fullCliente.endercobr &&
                fullCliente.cep === fullCliente.cepcobr,
              endercobr: fullCliente.endercobr || '',
              numerocobr: fullCliente.numerocobr || '',
              bairrocobr: fullCliente.bairrocobr || '',
              cidadecobr: fullCliente.cidadecobr || '',
              ufcobr: fullCliente.ufcobr || '',
              cepcobr: fullCliente.cepcobr || '',
              complementocobr: fullCliente.complementocobr || '',
              referenciacobr: fullCliente.referenciacobr || '',
              acrescimo: String(fullCliente.acrescimo || 0),
              desconto: String(fullCliente.desconto || 0),
              obs: (fullCliente.obs || '').substring(0, 100),
              // Mapear local_entrega do banco para habilitarLocalEntrega do frontend
              habilitarLocalEntrega: fullCliente.local_entrega === 'S' || fullCliente.local_entrega === '1' ? '1' : '0',
              contatos: contatosParsed,
              pessoasContato: pessoasContatoParsed,
              vendedores_list:
                vendedoresParsed.length > 0
                  ? vendedoresParsed
                  : fullCliente.vendedores_list &&
                    fullCliente.vendedores_list.length > 0
                  ? fullCliente.vendedores_list
                  : fullCliente.codvend
                  ? [{ sellerId: fullCliente.codvend, segmentoId: '' }]
                  : [],
            });
          } catch (error) {
            console.error(
              'Erro ao carregar dados completos do cliente:',
              error,
            );
            toast.error(
              'Erro ao carregar dados completos. Algumas informações podem estar faltando.',
            );

            // Parse contatos fallback (com normalização de tipos antigos)
            let contatosParsedFallback: any[] = [];
            let pessoasContatoFallback: any[] = [];
            let vendedoresFallback: any[] = [];
            try {
              const parsed = clientToEdit.contato
                ? JSON.parse(clientToEdit.contato)
                : null;

              if (parsed) {
                if (parsed.telefones || parsed.pessoas || parsed.vendedores) {
                  contatosParsedFallback = (parsed.telefones || []).map((c: any) => ({ ...c, type: c.type === 'phone' ? 'celular' : c.type }));
                  pessoasContatoFallback = parsed.pessoas || [];
                  vendedoresFallback = parsed.vendedores || [];
                } else if (Array.isArray(parsed)) {
                  contatosParsedFallback = parsed.map((c: any) => ({ ...c, type: c.type === 'phone' ? 'celular' : c.type }));
                }
              }
            } catch {
              contatosParsedFallback = [];
              pessoasContatoFallback = [];
              vendedoresFallback = [];
            }

            // Fallback to passed data (partial)
            reset({
              tipoPessoa: (clientToEdit.tipo as 'F' | 'J' | 'E') || 'J',
              documento: clientToEdit.cpfcgc || '',
              nome: (clientToEdit.nome || '').trim().substring(0, 40),
              nomeFantasia: (clientToEdit.nomefant || '')
                .trim()
                .substring(0, 30),
              inscricaoEstadual:
                clientToEdit.iest === 'ISENTO' ? 'ISENTO' : clientToEdit.iest,
              isentoIE: clientToEdit.iest === 'ISENTO',
              inscricaoMunicipal:
                clientToEdit.imun === 'ISENTO' ? 'ISENTO' : clientToEdit.imun,
              isentoIM: clientToEdit.imun === 'ISENTO',
              suframa:
                clientToEdit.isuframa === 'ISENTO'
                  ? 'ISENTO'
                  : clientToEdit.isuframa,
              isentoSuframa: clientToEdit.isuframa === 'ISENTO',
              cep: clientToEdit.cep || '',
              endereco: clientToEdit.ender || '',
              bairro: clientToEdit.bairro || '',
              cidade: clientToEdit.cidade || '',
              uf: clientToEdit.uf || '',
              numero: clientToEdit.numero || '',
              complemento: clientToEdit.complemento || '',
              pais: Number(clientToEdit.codpais) || 1058, // ✅ CORRIGIDO: Number()
              limiteCredito: String(clientToEdit.limite || 0),
              classePagamento:
                (clientToEdit.claspgto as 'A' | 'B' | 'C' | 'X') || 'A',
              enderecoCobrancaIgual: true,
              acrescimo: String(clientToEdit.acrescimo || 0),
              desconto: String(clientToEdit.desconto || 0),
              obs: (clientToEdit.obs || '').substring(0, 100),
              // Mapear local_entrega do banco para habilitarLocalEntrega do frontend
              habilitarLocalEntrega: clientToEdit.local_entrega === 'S' || clientToEdit.local_entrega === '1' ? '1' : '0',
              contatos: contatosParsedFallback,
              pessoasContato: pessoasContatoFallback,
              vendedores_list:
                vendedoresFallback.length > 0
                  ? vendedoresFallback
                  : clientToEdit.vendedores_list &&
                    clientToEdit.vendedores_list.length > 0
                  ? clientToEdit.vendedores_list
                  : clientToEdit.codvend
                  ? [{ sellerId: clientToEdit.codvend, segmentoId: '' }]
                  : [],
            });
          } finally {
            setIsLoadingData(false);
          }
        } else {
          // Novo cadastro - limpa form
          reset({
            tipoPessoa: 'J',
            documento: '',
            isentoIE: false,
            isentoIM: false,
            isentoSuframa: false,
            enderecoCobrancaIgual: true,
            contatos: [],
            vendedores: [],
            vendedores_list: [],
            classePagamento: 'A',
            pais: 1058, // ✅ CORRIGIDO: number
            limiteCredito: '0',
            credito: 'S',
            icms: 'N',
            aceitaAtraso: false,
            diasAtraso: '0',
            faixaFinanceira: '',
            banco: undefined,
            formaPagamento: '',
          });
        }
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, clientToEdit]);

  const onSubmit = async (data: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditing && clientToEdit) {
        // updateCliente espera apenas Cliente, não (id, data)
        const clienteToUpdate: Cliente = {
          codcli: clientToEdit.codcli,
          cpfcgc: data.documento, // ✅ Mapear documento → cpfcgc
          nome: data.nome,
          nomefant: data.nomeFantasia || '',
          tipo: data.tipoPessoa,
          email: data.email || '',
          debito: clientToEdit.debito || 0,
          limite: Number(data.limiteCredito) || 0,
          claspgto: data.classePagamento || 'A',
          codigo_filial: clientToEdit.codigo_filial || 1,
          bairro: data.bairro || '',
          banco: String(data.banco || '').substring(0, 1),
          ender: data.endereco || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          cep: data.cep || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          codpais: data.pais,
          iest: data.inscricaoEstadual || '',
          imun: data.inscricaoMunicipal || '',
          isuframa: data.suframa || '',
          status: data.credito || 'S',
          icms: data.icms || 'N',
          atraso: Number(data.diasAtraso) || 0,
          faixafin: data.faixaFinanceira || '',
          obs: data.obs || '',
          contatos: data.contatos || [],
          pessoasContato: data.pessoasContato || [],
          vendedores_list: data.vendedores_list || [],
          // Campos de cobrança
          endercobr: data.enderecoCobrancaIgual
            ? data.endereco
            : data.endercobr,
          cidadecobr: data.enderecoCobrancaIgual
            ? data.cidade
            : data.cidadecobr,
          bairrocobr: data.enderecoCobrancaIgual
            ? data.bairro
            : data.bairrocobr,
          ufcobr: data.enderecoCobrancaIgual ? data.uf : data.ufcobr,
          cepcobr: data.enderecoCobrancaIgual ? data.cep : data.cepcobr,
          numerocobr: data.enderecoCobrancaIgual
            ? data.numero
            : data.numerocobr,
          complementocobr: data.enderecoCobrancaIgual
            ? data.complemento
            : data.complementocobr,
          referenciacobr: data.referenciacobr || '',
          // Campos comerciais
          acrescimo: Number(data.acrescimo) || 0,
          desconto: Number(data.desconto) || 0,
          // Local de Entrega - mapeia habilitarLocalEntrega para local_entrega no banco
          local_entrega: data.habilitarLocalEntrega === '1' ? 'S' : 'N',
        } as Cliente;

        await updateCliente(clienteToUpdate);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // insertCliente também precisa de campos obrigatórios
        const clienteToInsert: Cliente = {
          codcli: '', // Será gerado pela API
          cpfcgc: data.documento, // ✅ Mapear documento → cpfcgc
          nome: data.nome,
          nomefant: data.nomeFantasia || '',
          tipo: data.tipoPessoa,
          email: data.email || '',
          debito: 0,
          limite: Number(data.limiteCredito) || 0,
          claspgto: data.classePagamento || 'A',
          codigo_filial: 1,
          bairro: data.bairro || '',
          banco: String(data.banco || '').substring(0, 1),
          ender: data.endereco || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          cep: data.cep || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          codpais: data.pais,
          iest: data.inscricaoEstadual || '',
          imun: data.inscricaoMunicipal || '',
          isuframa: data.suframa || '',
          status: data.credito || 'S',
          icms: data.icms || 'N',
          atraso: Number(data.diasAtraso) || 0,
          faixafin: data.faixaFinanceira || '',
          obs: data.obs || '',
          contatos: data.contatos || [],
          pessoasContato: data.pessoasContato || [],
          vendedores_list: data.vendedores_list || [],
          // Campos de cobrança
          endercobr: data.enderecoCobrancaIgual
            ? data.endereco
            : data.endercobr,
          cidadecobr: data.enderecoCobrancaIgual
            ? data.cidade
            : data.cidadecobr,
          bairrocobr: data.enderecoCobrancaIgual
            ? data.bairro
            : data.bairrocobr,
          ufcobr: data.enderecoCobrancaIgual ? data.uf : data.ufcobr,
          cepcobr: data.enderecoCobrancaIgual ? data.cep : data.cepcobr,
          numerocobr: data.enderecoCobrancaIgual
            ? data.numero
            : data.numerocobr,
          complementocobr: data.enderecoCobrancaIgual
            ? data.complemento
            : data.complementocobr,
          referenciacobr: data.referenciacobr || '',
          // Campos comerciais
          acrescimo: Number(data.acrescimo) || 0,
          desconto: Number(data.desconto) || 0,
          // Local de Entrega - mapeia habilitarLocalEntrega para local_entrega no banco
          local_entrega: data.habilitarLocalEntrega === '1' ? 'S' : 'N',
        } as Cliente;

        await insertCliente(clienteToInsert);
        toast.success('Cliente cadastrado com sucesso!');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao processar solicitação';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async () => {
    console.log('🔘 Botão clicado!');

    // Tenta submeter
    try {
      await handleSubmit(
        (data: ClientFormValues) => {
          console.log('✅ Validação passou! Salvando...');
          onSubmit(data);
        },
        (errors) => {
          console.log('❌ Validação falhou!');
          console.log('Errors:', errors);

          // Determinar qual aba tem erro e navegar para ela
          const firstErrorField = Object.keys(errors)[0];
          const errorTab = getTabForField(firstErrorField);

          if (errorTab && errorTab !== activeTab) {
            setActiveTab(errorTab);
            console.log(`📍 Navegando para aba: ${errorTab}`);
          }

          // Após pequeno delay (para garantir que a aba mudou), focar no campo
          setTimeout(() => {
            const fieldElement = document.querySelector(
              `[name="${firstErrorField}"]`,
            ) as HTMLElement;
            if (fieldElement) {
              // Adicionar classe de erro visual
              const inputElement =
                fieldElement.tagName === 'INPUT' ||
                fieldElement.tagName === 'SELECT' ||
                fieldElement.tagName === 'TEXTAREA'
                  ? fieldElement
                  : (fieldElement.querySelector(
                      'input, select, textarea',
                    ) as HTMLElement);

              if (inputElement) {
                // Adicionar borda vermelha
                inputElement.style.borderColor = '#ef4444';
                inputElement.style.borderWidth = '2px';
                inputElement.style.boxShadow =
                  '0 0 0 3px rgba(239, 68, 68, 0.1)';

                // Focar e fazer scroll
                inputElement.focus();
                inputElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });

                // Piscar o campo para chamar atenção
                let blinkCount = 0;
                const blinkInterval = setInterval(() => {
                  inputElement.style.backgroundColor =
                    blinkCount % 2 === 0 ? '#fee2e2' : 'white';
                  blinkCount++;
                  if (blinkCount > 5) {
                    clearInterval(blinkInterval);
                    inputElement.style.backgroundColor = '#fee2e2'; // Mantém rosa claro
                  }
                }, 200);
              }
            }
          }, 150);

          // Mostrar erros para o usuário de forma amigável
          const errorMessages: string[] = [];

          Object.entries(errors).forEach(([field, error]) => {
            const fieldName = getFieldLabel(field);
            const message = formatErrorMessage(
              error?.message || 'Valor inválido',
            );
            errorMessages.push(`• ${fieldName}: ${message}`);
            console.log(`🔴 Campo "${field}":`, error);
          });

          // Toast com todos os erros
          toast.error(
            <div>
              <p className="font-semibold mb-2">Corrija os seguintes campos:</p>
              <div className="text-sm space-y-1">
                {errorMessages.map((msg, idx) => (
                  <div key={idx}>{msg}</div>
                ))}
              </div>
            </div>,
            { duration: 8000 },
          );
        },
      )();
    } catch (error) {
      console.error('💥 Erro no submit:', error);
    }
  };

  // Determina em qual aba está o campo
  const getTabForField = (field: string): string => {
    const registrationFields = [
      'tipoPessoa',
      'documento',
      'nome',
      'nomeFantasia',
      'email',
      'tipoCliente',
      'situacaoTributaria',
      'tipoEmpresa',
      'classeCliente',
      'inscricaoEstadual',
      'isentoIE',
      'inscricaoMunicipal',
      'isentoIM',
      'suframa',
      'isentoSuframa',
      'cep',
      'endereco',
      'numero',
      'complemento',
      'bairro',
      'cidade',
      'uf',
      'pais',
      'contatos',
      'enderecoCobrancaIgual',
      'endercobr',
      'numerocobr',
      'complementocobr',
      'bairrocobr',
      'cidadecobr',
      'ufcobr',
      'cepcobr',
      'referenciacobr',
    ];

    const financialFields = [
      'limiteCredito',
      'credito',
      'classePagamento',
      'aceitaAtraso',
      'diasAtraso',
      'icms',
      'faixaFinanceira',
      'banco',
      'formaPagamento',
      'vendedores_list',
    ];

    const commercialFields = [
      'acrescimo',
      'desconto',
      'precoVenda',
      'kickback',
      'descontoAplicado',
      'benmd',
      'habilitarLocalEntrega',
      'obs',
    ];

    if (registrationFields.includes(field)) return 'registration';
    if (financialFields.includes(field)) return 'financial';
    if (commercialFields.includes(field)) return 'commercial';

    return 'registration'; // default
  };

  // Formata mensagem de erro de forma mais amigável
  const formatErrorMessage = (message: string): string => {
    // Traduz mensagens comuns do Zod
    if (message.includes('Invalid enum value')) {
      const match = message.match(/Expected (.+), received '(.+)'/);
      if (match) {
        const expected = match[1].replace(/'/g, '');
        const received = match[2];
        return `Valor "${received}" é inválido. Escolha entre: ${expected}`;
      }
    }

    if (message.includes('String must contain at least')) {
      return 'Campo obrigatório';
    }

    return message;
  };

  // Helper para traduzir nomes de campos
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      nome: 'Nome/Razão Social',
      documento: 'CPF/CNPJ',
      email: 'E-mail',
      classePagamento: 'Classe de Pagamento',
      tipoPessoa: 'Tipo de Pessoa',
      tipoCliente: 'Tipo de Cliente',
      situacaoTributaria: 'Situação Tributária',
      tipoEmpresa: 'Tipo de Empresa',
      inscricaoEstadual: 'Inscrição Estadual',
      inscricaoMunicipal: 'Inscrição Municipal',
      cep: 'CEP',
      endereco: 'Endereço',
      bairro: 'Bairro',
      cidade: 'Cidade',
      uf: 'UF',
      limiteCredito: 'Limite de Crédito',
      credito: 'Crédito',
      icms: 'ICMS',
      faixaFinanceira: 'Faixa Financeira',
      banco: 'Banco',
      formaPagamento: 'Forma de Pagamento',
    };
    return labels[field] || field;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'registration':
        return <RegistrationTab />;
      case 'financial':
        return <FinancialTab />;
      case 'commercial':
        return <CommercialTab />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        <FormProvider {...methods}>
          {/* Cabeçalho */}
          <div className="flex-shrink-0">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800">
              <h4 className="text-lg font-bold text-blue-600 dark:text-blue-300">
                {isEditing
                  ? `Editar Cliente: ${clientToEdit?.codcli}`
                  : 'Cadastrar Novo Cliente'}
              </h4>
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-300 hover:text-red-500"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Gatekeeper Alert Modal */}
          <Dialog
            open={showGatekeeperModal}
            onOpenChange={setShowGatekeeperModal}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <AlertTriangle className="h-5 w-5" />
                  Documento Duplicado
                </DialogTitle>
                <DialogDescription>
                  Encontramos {matches.length}{' '}
                  {matches.length === 1 ? 'registro' : 'registros'} com este
                  CPF/CNPJ no sistema.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4">
                <div className="space-y-3">
                  {matches.map((match, idx) => (
                    <div
                      key={idx}
                      className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block bg-blue-600 dark:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                              {match.type}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              ID: {match.id}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {match.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Documento: {match.doc}
                          </p>
                        </div>

                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            if (match.type === 'CLIENTE') {
                              try {
                                setIsLoadingData(true);
                                const fullCliente = await getCliente(match.id);

                                // Parse contatos (com normalização de tipos antigos)
                                let contatosParsed: any[] = [];
                                let pessoasContatoParsed: any[] = [];
                                let vendedoresParsed: any[] = [];
                                try {
                                  const parsed = fullCliente.contato
                                    ? JSON.parse(fullCliente.contato)
                                    : null;

                                  if (parsed) {
                                    if (parsed.telefones || parsed.pessoas || parsed.vendedores) {
                                      contatosParsed = (parsed.telefones || []).map((c: any) => ({ ...c, type: c.type === 'phone' ? 'celular' : c.type }));
                                      pessoasContatoParsed = parsed.pessoas || [];
                                      vendedoresParsed = parsed.vendedores || [];
                                    } else if (Array.isArray(parsed)) {
                                      contatosParsed = parsed.map((c: any) => ({ ...c, type: c.type === 'phone' ? 'celular' : c.type }));
                                    }
                                  }
                                } catch {
                                  contatosParsed = [];
                                  pessoasContatoParsed = [];
                                  vendedoresParsed = [];
                                }

                                reset({
                                  tipoPessoa:
                                    (fullCliente.tipo as 'F' | 'J' | 'E') ||
                                    'J',
                                  documento: fullCliente.cpfcgc || '',
                                  nome: (fullCliente.nome || '')
                                    .trim()
                                    .substring(0, 40),
                                  nomeFantasia: (fullCliente.nomefant || '')
                                    .trim()
                                    .substring(0, 30),
                                  inscricaoEstadual:
                                    fullCliente.iest === 'ISENTO'
                                      ? 'ISENTO'
                                      : fullCliente.iest,
                                  isentoIE: fullCliente.iest === 'ISENTO',
                                  inscricaoMunicipal:
                                    fullCliente.imun === 'ISENTO'
                                      ? 'ISENTO'
                                      : fullCliente.imun,
                                  isentoIM: fullCliente.imun === 'ISENTO',
                                  suframa:
                                    fullCliente.isuframa === 'ISENTO'
                                      ? 'ISENTO'
                                      : fullCliente.isuframa,
                                  isentoSuframa:
                                    fullCliente.isuframa === 'ISENTO',
                                  cep: fullCliente.cep || '',
                                  endereco: fullCliente.ender || '',
                                  bairro: fullCliente.bairro || '',
                                  cidade: fullCliente.cidade || '',
                                  uf: fullCliente.uf || '',
                                  numero: fullCliente.numero || '',
                                  complemento: fullCliente.complemento || '',
                                  pais: Number(fullCliente.codpais) || 1058, // ✅ CORRIGIDO: Number()
                                  limiteCredito: String(
                                    fullCliente.limite || 0,
                                  ),
                                  classePagamento:
                                    (fullCliente.claspgto as
                                      | 'A'
                                      | 'B'
                                      | 'C'
                                      | 'X') || 'A',
                                  enderecoCobrancaIgual: true,
                                  acrescimo: String(fullCliente.acrescimo || 0),
                                  desconto: String(fullCliente.desconto || 0),
                                  obs: (fullCliente.obs || '').substring(
                                    0,
                                    100,
                                  ),
                                  contatos: contatosParsed,
                                  pessoasContato: pessoasContatoParsed,
                                  vendedores_list:
                                    vendedoresParsed.length > 0
                                      ? vendedoresParsed
                                      : fullCliente.vendedores_list &&
                                        fullCliente.vendedores_list.length > 0
                                      ? fullCliente.vendedores_list
                                      : fullCliente.codvend
                                      ? [{ sellerId: fullCliente.codvend, segmentoId: '' }]
                                      : [],
                                });

                                setShowGatekeeperModal(false);
                                toast.success(`Editando: ${fullCliente.nome}`);
                              } catch (error) {
                                console.error('Error loading client:', error);
                                toast.error('Erro ao carregar dados');
                              } finally {
                                setIsLoadingData(false);
                              }
                            } else {
                              const editUrl =
                                match.type === 'FORNECEDOR'
                                  ? `/admin/cadastros/fornecedores?edit=${match.id}`
                                  : `/admin/cadastros/transportadoras?edit=${match.id}`;
                              window.open(editUrl, '_blank');
                              setShowGatekeeperModal(false);
                            }
                          }}
                        >
                          {match.type === 'CLIENTE' ? 'Editar' : 'Abrir'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGatekeeperModal(false);
                    onClose();
                  }}
                >
                  Cancelar e Sair
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Conteúdo com scroll */}
          <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-zinc-900">
            <div className="p-6">
              <div className="shadow-md rounded-lg max-w-6xl mx-auto p-6 bg-white dark:bg-zinc-800">
                <TabNavigation
                  tabs={tabs}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
                <div className="mt-4">
                  {isLoadingData ? (
                    <div className="flex justify-center items-center h-64">
                      <Carregamento />
                    </div>
                  ) : (
                    <>
                      {renderTabContent()}
                      {/* Mostrar erros do campo ativo */}
                      {Object.keys(errors).length > 0 && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                          <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                            ⚠️ Campos com erro nesta aba:
                          </p>
                          <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                            {Object.entries(errors)
                              .filter(([field]) => {
                                const fieldTab = getTabForField(field);
                                return fieldTab === activeTab;
                              })
                              .map(([field, error]) => (
                                <li
                                  key={field}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-red-500">•</span>
                                  <span>
                                    <strong>{getFieldLabel(field)}:</strong>{' '}
                                    {formatErrorMessage(
                                      error?.message || 'Valor inválido',
                                    )}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-zinc-800 p-6">
            <FormFooter
              onSubmit={handleFormSubmit}
              onClear={onClose}
              isSaving={isSubmitting}
              hasChanges={true}
              submitText={isEditing ? 'Salvar Alterações' : 'Cadastrar'}
            />
          </div>
        </FormProvider>
      </div>
    </div>
  );
}
