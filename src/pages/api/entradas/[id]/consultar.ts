import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

/**
 * GET /api/entradas/[id]/consultar?tipo=conhecimento|pedidos|notas
 *
 * Consultas read-only da entrada (paridade Delphi "Entradas de produtos"):
 *  - conhecimento: CTe vinculado (dbconhecimentoent por codtransp+nrocon)
 *  - pedidos: ordens de compra dos itens (dbitent.codreq -> cmp_ordem_compra)
 *  - notas: NFe(s) da entrada (dbnfe_ent por chave)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id, tipo } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID da entrada é obrigatório' });
  }
  const t = String(tipo || '');

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const ent = (
      await client.query(
        `SELECT codent, chave, codtransp, nrocon, temcon FROM dbent WHERE codent = $1`,
        [id],
      )
    ).rows[0];
    if (!ent) return res.status(404).json({ error: 'Entrada não encontrada' });

    if (t === 'conhecimento') {
      if ((ent.temcon ?? 'N') !== 'S' || !ent.codtransp || !ent.nrocon) {
        return res.status(200).json({ success: true, tipo: t, data: [] });
      }
      const rows = (
        await client.query(
          `SELECT c.codtransp, c.nrocon, c.serie, c.cfop, c.icms, c.baseicms,
                  c.totalcon, c.totaltransp, c.stcon, c.dtcon, c.cif, c.tipocon,
                  tr.nome AS transportadora
             FROM dbconhecimentoent c
             LEFT JOIN dbtransp tr ON tr.codtransp = c.codtransp
            WHERE c.codtransp = $1 AND c.nrocon = $2`,
          [ent.codtransp, ent.nrocon],
        )
      ).rows;
      return res.status(200).json({ success: true, tipo: t, data: rows });
    }

    if (t === 'notas') {
      const rows = (
        await client.query(
          `SELECT n.nnf, n.serie, n.chave, n.demi, n.vprod, n.vnf,
                  e.xnome AS emitente, e.cpf_cnpj AS cnpj_emitente
             FROM dbnfe_ent n
             LEFT JOIN dbnfe_ent_emit e ON e.codnfe_ent = n.codnfe_ent
            WHERE n.chave = $1`,
          [ent.chave],
        )
      ).rows;
      return res.status(200).json({ success: true, tipo: t, data: rows });
    }

    if (t === 'pedidos') {
      const rows = (
        await client.query(
          `SELECT ie.codreq,
                  o.orc_data,
                  o.orc_status,
                  COUNT(*)::int AS itens,
                  SUM(COALESCE(ie.quant,0)) AS qtd_total,
                  ROUND(SUM(COALESCE(ie.quant,0) * COALESCE(ie.prunit,0)), 2) AS valor_total
             FROM dbitent ie
             LEFT JOIN cmp_ordem_compra o ON o.orc_id::text = ie.codreq
            WHERE ie.codent = $1
            GROUP BY ie.codreq, o.orc_data, o.orc_status
            ORDER BY ie.codreq`,
          [id],
        )
      ).rows;
      return res.status(200).json({ success: true, tipo: t, data: rows });
    }

    return res.status(400).json({ error: 'tipo inválido (conhecimento|pedidos|notas)' });
  } catch (error) {
    console.error('Erro na consulta da entrada:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Erro interno' });
  } finally {
    if (client) client.release();
  }
}
