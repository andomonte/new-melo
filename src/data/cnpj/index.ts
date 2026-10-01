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

  // Passa pelo NOSSO servidor (proxy) em vez de chamar a brasilapi direto do
  // navegador — em produção (https) o browser bloqueia por CORS. Server-to-server
  // não tem CORS. Ver src/pages/api/cnpj/[cnpj].ts.
  const response = await fetch(`/api/cnpj/${cnpjLimpo}`);

  if (!response.ok) {
    let msg =
      response.status === 404
        ? 'CNPJ não encontrado na base da Receita Federal'
        : 'Erro ao consultar CNPJ. Tente novamente.';
    try {
      const j = await response.json();
      if (j?.erro) msg = j.erro;
    } catch {
      /* mantém msg padrão */
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data as BrasilApiCnpjResponse;
}
