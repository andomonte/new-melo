import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) return res.status(400).json({ error: 'Filial não informada' });

  const { chave } = req.query;
  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    if (chave) {
      const r = await client.query('SELECT chave, valor, tipo FROM tb_parametros WHERE chave = $1', [chave]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Parâmetro não encontrado' });
      const p = r.rows[0];
      return res.status(200).json({ chave: p.chave, valor: p.tipo === 'INT' ? Number(p.valor) : p.valor });
    }

    const r = await client.query('SELECT chave, valor, tipo, descricao FROM tb_parametros ORDER BY chave');
    const params: Record<string, any> = {};
    r.rows.forEach((p: any) => { params[p.chave] = p.tipo === 'INT' ? Number(p.valor) : p.valor; });
    return res.status(200).json(params);
  } catch (error) {
    console.error('Erro ao buscar parâmetros:', error);
    return res.status(500).json({ error: 'Erro ao buscar parâmetros' });
  } finally {
    if (client) client.release();
  }
}
