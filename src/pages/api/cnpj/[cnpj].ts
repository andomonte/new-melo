import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/cnpj/:cnpj  → proxy server-side de consulta de CNPJ.
 * O navegador NÃO pode chamar as APIs direto (CORS em produção https); aqui é
 * server-to-server. Devolve sempre o shape da BrasilAPI (BrasilApiCnpjResponse).
 *
 * Estratégia (a BrasilAPI anda instável — 403 sem User-Agent, 504 intermitente):
 *   1) BrasilAPI (shape nativo) com User-Agent de navegador + 1 retry em 5xx.
 *   2) Fallback open.cnpja.com (200 confiável), mapeado para o mesmo shape.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, Accept: 'application/json' } as const;
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// open.cnpja.com → shape da BrasilAPI (só os campos que o front usa + extras).
function mapCnpja(j: any) {
  const tel = j?.phones?.[0] ? `${j.phones[0].area || ''}${j.phones[0].number || ''}` : '';
  return {
    cnpj: j?.taxId || '',
    razao_social: j?.company?.name || '',
    nome_fantasia: j?.alias || '',
    situacao_cadastral: String(j?.status?.id ?? ''),
    descricao_situacao_cadastral: j?.status?.text || '',
    logradouro: j?.address?.street || '',
    numero: j?.address?.number || '',
    complemento: j?.address?.details || '',
    bairro: j?.address?.district || '',
    municipio: j?.address?.city || '',
    uf: j?.address?.state || '',
    cep: j?.address?.zip || '',
    email: j?.emails?.[0]?.address || '',
    telefone: tel,
    porte: j?.company?.size?.text || '',
    natureza_juridica: j?.company?.nature?.text || '',
    cnae_fiscal: j?.mainActivity?.id ?? 0,
    cnae_fiscal_descricao: j?.mainActivity?.text || '',
    data_inicio_atividade: j?.founded || '',
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const cnpj = String(req.query.cnpj || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

  if (cnpj.length !== 14) {
    return res.status(400).json({ erro: 'CNPJ inválido. Deve conter 14 caracteres.' });
  }

  // 1) BrasilAPI (shape nativo)
  try {
    let r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: H,
      signal: AbortSignal.timeout(12000),
    });
    if (r.status >= 500) {
      await sleep(500);
      r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: H,
        signal: AbortSignal.timeout(12000),
      });
    }
    if (r.ok) return res.status(200).json(await r.json());
    if (r.status !== 404) {
      console.warn(`[api/cnpj] BrasilAPI ${r.status} p/ ${cnpj} — tentando fallback cnpja`);
    }
  } catch (e: any) {
    console.warn(`[api/cnpj] BrasilAPI falhou (${e?.message}) — tentando fallback cnpja`);
  }

  // 2) Fallback open.cnpja.com (mapeado para o shape da BrasilAPI)
  try {
    const r2 = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
      headers: H,
      signal: AbortSignal.timeout(15000),
    });
    if (r2.ok) return res.status(200).json(mapCnpja(await r2.json()));
    if (r2.status === 404) {
      return res.status(404).json({ erro: 'CNPJ não encontrado na base da Receita Federal' });
    }
    console.warn(`[api/cnpj] cnpja ${r2.status} p/ ${cnpj}`);
  } catch (e: any) {
    console.error(`[api/cnpj] cnpja falhou p/ ${cnpj}:`, e?.message);
  }

  return res
    .status(502)
    .json({ erro: 'Erro ao consultar CNPJ (BrasilAPI e fallback indisponíveis). Tente novamente.' });
}
