import axios, { AxiosInstance } from 'axios';

/**
 * Cliente para integração com a API do Asaas
 * Documentação: https://docs.asaas.com
 */

interface AsaasConfig {
  apiKey: string;
  environment?: 'production' | 'sandbox';
}

interface AsaasCustomer {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

interface AsaasPayment {
  customer: string; // ID do cliente no Asaas
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  discount?: {
    value?: number;
    dueDateLimitDays?: number;
    type?: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
    type?: 'PERCENTAGE';
  };
  fine?: {
    value: number;
    type?: 'FIXED' | 'PERCENTAGE';
  };
  postalService?: boolean;
}

interface AsaasPaymentResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue: number;
  dueDate: string;
  description: string;
  externalReference: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  invoiceNumber: string;
  status: string;
  nossoNumero?: string;
  barCode?: string;
  digitableLine?: string;
}

class AsaasClient {
  private api: AxiosInstance;
  private environment: 'production' | 'sandbox';

  constructor(config: AsaasConfig) {
    this.environment = config.environment || 'sandbox';
    
    const baseURL = this.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.api = axios.create({
      baseURL,
      headers: {
        'access_token': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Criar ou atualizar cliente
   */
  async createOrUpdateCustomer(customerData: AsaasCustomer): Promise<any> {
    try {
      // Tentar buscar cliente existente pelo CPF/CNPJ
      const existing = await this.api.get('/customers', {
        params: { cpfCnpj: customerData.cpfCnpj }
      });

      if (existing.data.data && existing.data.data.length > 0) {
        // Cliente já existe, atualizar
        const customerId = existing.data.data[0].id;
        const response = await this.api.put(`/customers/${customerId}`, customerData);
        return response.data;
      }
    } catch (error) {
      // Cliente não existe, criar novo
    }

    // Criar novo cliente
    const response = await this.api.post('/customers', customerData);
    return response.data;
  }

  /**
   * Gerar cobrança (boleto, pix, etc)
   */
  async createPayment(paymentData: AsaasPayment): Promise<AsaasPaymentResponse> {
    const response = await this.api.post('/payments', paymentData);
    return response.data;
  }

  /**
   * Consultar cobrança
   */
  async getPayment(paymentId: string): Promise<AsaasPaymentResponse> {
    const response = await this.api.get(`/payments/${paymentId}`);
    return response.data;
  }

  /**
   * Cancelar cobrança
   */
  async deletePayment(paymentId: string): Promise<void> {
    await this.api.delete(`/payments/${paymentId}`);
  }

  /**
   * Gerar boleto completo (cliente + cobrança)
   */
  async gerarBoleto(dados: {
    cliente: {
      nome: string;
      cpfCnpj: string;
      email?: string;
      telefone?: string;
      celular?: string;
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cep?: string;
    };
    cobranca: {
      valor: number;
      vencimento: string; // YYYY-MM-DD
      descricao?: string;
      referencia?: string;
      multa?: number; // percentual
      juros?: number; // percentual ao mês
    };
  }): Promise<{
    sucesso: boolean;
    cobrancaId: string;
    clienteId: string;
    linhaDigitavel?: string;
    codigoBarras?: string;
    urlBoleto?: string;
    urlFatura: string;
    vencimento: string;
    valor: number;
    status: string;
  }> {
    try {
      // 1. Criar/atualizar cliente
      console.log('🔄 [Asaas] Criando/atualizando cliente...');
      const cliente = await this.createOrUpdateCustomer({
        name: dados.cliente.nome,
        cpfCnpj: dados.cliente.cpfCnpj,
        email: dados.cliente.email,
        phone: dados.cliente.telefone,
        mobilePhone: dados.cliente.celular,
        address: dados.cliente.endereco,
        addressNumber: dados.cliente.numero,
        complement: dados.cliente.complemento,
        province: dados.cliente.bairro,
        postalCode: dados.cliente.cep?.replace(/\D/g, ''),
        externalReference: dados.cobranca.referencia,
      });

      console.log('✅ [Asaas] Cliente criado/atualizado:', cliente.id);

      // 2. Criar cobrança
      console.log('🔄 [Asaas] Gerando boleto...');
      const cobranca = await this.createPayment({
        customer: cliente.id,
        billingType: 'BOLETO',
        value: dados.cobranca.valor,
        dueDate: dados.cobranca.vencimento,
        description: dados.cobranca.descricao,
        externalReference: dados.cobranca.referencia,
        fine: dados.cobranca.multa ? {
          value: dados.cobranca.multa,
          type: 'PERCENTAGE'
        } : undefined,
        interest: dados.cobranca.juros ? {
          value: dados.cobranca.juros,
          type: 'PERCENTAGE'
        } : undefined,
      });

      console.log('✅ [Asaas] Boleto gerado:', cobranca.id);

      return {
        sucesso: true,
        cobrancaId: cobranca.id,
        clienteId: cliente.id,
        linhaDigitavel: cobranca.digitableLine,
        codigoBarras: cobranca.barCode,
        urlBoleto: cobranca.bankSlipUrl,
        urlFatura: cobranca.invoiceUrl,
        vencimento: cobranca.dueDate,
        valor: cobranca.value,
        status: cobranca.status,
      };
    } catch (error: any) {
      console.error('❌ [Asaas] Erro ao gerar boleto:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.description || error.message);
    }
  }
}

// Instância singleton
let asaasClient: AsaasClient | null = null;

export function getAsaasClient(): AsaasClient {
  if (!asaasClient) {
    const apiKey = process.env.ASAAS_API_KEY;
    const environment = process.env.ASAAS_ENVIRONMENT as 'production' | 'sandbox' || 'sandbox';

    if (!apiKey) {
      throw new Error('ASAAS_API_KEY não configurada no .env');
    }

    asaasClient = new AsaasClient({ apiKey, environment });
  }

  return asaasClient;
}

export type { AsaasCustomer, AsaasPayment, AsaasPaymentResponse };
