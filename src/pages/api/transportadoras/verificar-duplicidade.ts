import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { cpfcgc, codtransp } = req.query;

  if (!cpfcgc || typeof cpfcgc !== 'string' || !cpfcgc.trim()) {
    return res.status(400).json({ error: 'cpfcgc é obrigatório' });
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

    let query: string;
    let params: string[];

    if (codtransp && typeof codtransp === 'string' && codtransp.trim()) {
      // Edição: excluir o registro atual da verificação
      query = `SELECT codtransp, nome FROM dbtransp WHERE cpfcgc = $1 AND codtransp != $2 LIMIT 1`;
      params = [cpfcgc.trim(), codtransp.trim()];
    } else {
      // Cadastro: verificar qualquer registro com o mesmo CPF/CNPJ
      query = `SELECT codtransp, nome FROM dbtransp WHERE cpfcgc = $1 LIMIT 1`;
      params = [cpfcgc.trim()];
    }

    const result = await client.query(query, params);

    if (result.rows.length > 0) {
      const transportadora = result.rows[0];
      return res.status(200).json({
        existe: true,
        transportadora: {
          codtransp: transportadora.codtransp,
          nome: transportadora.nome,
        },
      });
    }

    return res.status(200).json({ existe: false });
  } catch (error: any) {
    console.error('Erro ao verificar duplicidade de transportadora:', error);
    return res.status(500).json({
      error: 'Erro ao verificar duplicidade',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
