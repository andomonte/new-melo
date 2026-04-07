import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID da transportadora é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const query = `
      SELECT 
        codtransp,
        COALESCE(nome, '') as nome,
        COALESCE(nomefant, '') as nomefant,
        COALESCE(cpfcgc, '') as cpfcgc,
        COALESCE(tipo, '') as tipo,
        data_cad,
        COALESCE(ender, '') as ender,
        COALESCE(bairro, '') as bairro,
        COALESCE(cidade, '') as cidade,
        COALESCE(uf, '') as uf,
        COALESCE(iest, '') as iest,
        COALESCE(isuframa, '') as isuframa,
        COALESCE(imun, '') as imun,
        COALESCE(tipoemp, '') as tipoemp,
        COALESCE(contatos, '') as contatos,
        COALESCE(cc, '') as cc,
        COALESCE(n_agencia, '') as n_agencia,
        COALESCE(banco, '') as banco,
        COALESCE(cod_ident, '') as cod_ident,
        COALESCE(cep, '') as cep,
        COALESCE(codbairro, '') as codbairro,
        COALESCE(codmunicipio, '') as codmunicipio,
        COALESCE(numero, '') as numero,
        COALESCE(referencia, '') as referencia,
        CAST(COALESCE(codpais, 0) AS INTEGER) AS codpais,
        COALESCE(complemento, '') as complemento,
        COALESCE(codunico, '') as codunico
      FROM dbtransp
      WHERE codtransp = $1;
    `;

    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transportadora não encontrada' });
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(result.rows[0]));
  } catch (error: any) {
    console.error('Erro ao buscar transportadora:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao buscar transportadora.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
