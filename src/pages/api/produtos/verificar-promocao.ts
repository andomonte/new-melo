import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod } = req.query;

  if (!codprod || typeof codprod !== 'string') {
    return res.status(400).json({ error: 'codprod é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT p.nome_promocao
       FROM dbpromocao_item pi
       JOIN dbpromocao p ON p.id_promocao = pi.id_promocao
       WHERE pi.codprod = $1
         AND p.ativa = TRUE
       LIMIT 1`,
      [codprod]
    );

    if (result.rows.length > 0) {
      res.status(200).json({
        emPromocao: true,
        nomePromocao: result.rows[0].nome_promocao,
      });
    } else {
      res.status(200).json({ emPromocao: false });
    }
  } catch (error: any) {
    console.error('Erro ao verificar promoção:', error);
    res.status(200).json({ emPromocao: false });
  } finally {
    client.release();
  }
}
