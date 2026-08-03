import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  descricao_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  porte: string;
  natureza_juridica: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  data_inicio_atividade: string;
}

/**
 * Consulta dados de CNPJ na BrasilAPI (gratuita).
 * Retorna razão social, fantasia, endereço completo, email, telefone.
 */
export async function buscaCnpj(cnpj: string): Promise<BrasilApiCnpjResponse> {
  // Mantém letras (CNPJ alfanumérico) — 12 alfanuméricos + 2 dígitos (DV).
  const cnpjLimpo = limparDocumentoAlfa(cnpj);

  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ inválido. Deve conter 14 caracteres.');
  }

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('CNPJ não encontrado na base da Receita Federal');
    }
    throw new Error('Erro ao consultar CNPJ. Tente novamente.');
  }

  const data = await response.json();
  return data as BrasilApiCnpjResponse;
}
