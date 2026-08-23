import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/transferencia/entrada/[codent]/produtos
 * Produtos de uma Entrada para transferir (porte de TRANSFERENCIA_ENTRADA.Navega_TransfEntrada).
 * qtd_disponivel = quant (recebido) − qtd_transferido (já destinado).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const codent = String(req.query.codent || '').trim();
  if (!codent) return res.status(400).json({ erro: 'Informe codent.' });

  const client = await getPgPool().connect();
  try {
    // a entrada existe?
    const ent = await client.query(
      `SELECT codent, dtent FROM dbent WHERE codent = $1`,
      [codent],
    );
    if (ent.rows.length === 0) {
      return res.status(404).json({ erro: 'Entrada não encontrada.', code: 'ENTRADA_NAO_ENCONTRADA' });
    }

    const r = await client.query(
      `SELECT i.codprod,
              p.ref,
              p.descr,
              p.unimed,
              m.descr AS marca,
              i.quant AS qtd_entrada,
              COALESCE(i.qtd_transferido, 0) AS qtd_transferido,
              (COALESCE(i.quant,0) - COALESCE(i.qtd_transferido,0)) AS qtd_disponivel,
              COALESCE(i.prtransferencia_bruto, i.prunit, 0) AS pr_transf,
              i.prunit
         FROM dbitent i
         LEFT JOIN dbprod p ON p.codprod = i.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
        WHERE i.codent = $1
        ORDER BY p.descr`,
      [codent],
    );

    return res.status(200).json({
      codent,
      dtent: ent.rows[0].dtent,
      itens: r.rows.map((x) => ({
        codprod: x.codprod,
        ref: x.ref,
        descr: x.descr,
        unimed: x.unimed,
        marca: x.marca,
        qtd_entrada: Number(x.qtd_entrada || 0),
        qtd_transferido: Number(x.qtd_transferido || 0),
        qtd_disponivel: Number(x.qtd_disponivel || 0),
        pr_transf: Number(x.pr_transf || 0),
        prunit: Number(x.prunit || 0),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao listar produtos da entrada:', error);
    return res.status(500).json({ erro: 'Erro ao listar produtos da entrada', detalhes: error.message });
  } finally {
    client.release();
  }
}
