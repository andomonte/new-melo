import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

/**
 * Casa o CNPJ da NFe (emitente ou transportadora) com o cadastro de credores
 * (dbcredor), normalizando a pontuação — espelha o CON_FORNECEDOR/CON_TRANSP do
 * Delphi. Retorna todos os credores com aquele CNPJ:
 *   - 0 registros  -> não existe no cadastro (oferecer cadastrar)
 *   - 1 registro   -> vincular automaticamente
 *   - N registros  -> usuário escolhe
 *
 * GET /api/entrada-xml/credor-por-cnpj?cnpj=04.618.302/0001-89
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const cnpj = limparDocumentoAlfa((req.query.cnpj as string) ?? '');
  const tipo = (req.query.tipo as string) ?? '';
  // CPF tem 11, CNPJ tem 14 — abaixo disso não é documento válido para casar.
  if (cnpj.length < 11) {
    return res.status(200).json({ data: [] });
  }

  // Transportadora vive em dbtransp (codtransp/cpfcgc/ender); fornecedor em dbcredor.
  const isTransp = tipo === 'transportadora';

  let client;
  try {
    client = await pool.connect();
    const query = isTransp
      ? `
      SELECT
        codtransp AS cod_credor, nome, nomefant AS nome_fant, cpfcgc AS cpf_cgc,
        iest, uf, cidade, ender AS endereco, tipo
      FROM db_manaus.dbtransp
      WHERE regexp_replace(upper(COALESCE(cpfcgc, '')), '[^0-9A-Z]', '', 'g') = $1
      ORDER BY codtransp
      LIMIT 50`
      : `
      SELECT
        cod_credor, nome, nome_fant, cpf_cgc, iest, uf, cidade, endereco, tipo
      FROM db_manaus.dbcredor
      WHERE regexp_replace(upper(COALESCE(cpf_cgc, '')), '[^0-9A-Z]', '', 'g') = $1
      ORDER BY cod_credor
      LIMIT 50`;

    const result = await client.query(query, [cnpj]);

    return res.status(200).json({ data: result.rows });
  } catch (err) {
    console.error('Erro em credor-por-cnpj:', err);
    return res.status(500).json({ error: 'Falha ao buscar credor por CNPJ.' });
  } finally {
    if (client) client.release();
  }
}
