import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ error: 'ID Obrigatório.' });
    return;
  }

  try {
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT p.*,
        COALESCE(m.descr, '') as marca_nome,
        COALESCE(gf.descr, '') as grupo_funcao_nome,
        COALESCE(gp.descr, '') as grupo_produto_nome,
        COALESCE((
          SELECT SUM(cap.arp_qtest)
          FROM cad_armazem_produto cap
          WHERE cap.arp_codprod = p.codprod
            AND COALESCE(cap.arp_bloqueado, 'N') <> 'S'
        ), 0) as estoque_disponivel
      FROM dbprod p
      LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
      LEFT JOIN dbgpfunc gf ON gf.codgpf = p.codgpf
      LEFT JOIN dbgpprod gp ON gp.codgpp = p.codgpp
      WHERE p.codprod = $1`,
      [id as string]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }

    res.status(200).setHeader('Content-Type', 'application/json').json(result.rows[0]);
  } catch (errors) {
    console.log((errors as Error).message);
    res.status(500).json((errors as Error).message);
  }
}
