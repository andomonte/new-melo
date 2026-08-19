import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/transferencia?dt1=&dt2=&status=&codent=
 * Lista as transferências (arm_transferencia) com a filial destino e a NF gerada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const { dt1, dt2, status, codent } = req.query;
  const client = await getPgPool().connect();
  try {
    const where: string[] = [];
    const params: any[] = [];
    if (dt1) { params.push(dt1); where.push(`t.tra_data >= $${params.length}::date`); }
    if (dt2) { params.push(dt2); where.push(`t.tra_data < ($${params.length}::date + 1)`); }
    if (status) { params.push(status); where.push(`t.tra_status = $${params.length}`); }
    if (codent) { params.push(codent); where.push(`t.tra_codent = $${params.length}`); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const r = await client.query(
      `SELECT t.tra_id, t.tra_data, t.tra_status, t.tra_cancel, t.tra_codent,
              t.tra_codcli_destino, t.tra_codfat, t.tra_vlr_frete,
              f.sigla, f.nomefant AS destino_nome, f.uf AS destino_uf,
              nfe.nrodoc_fiscal, nfe.status AS nfe_status,
              (SELECT count(*) FROM db_manaus.arm_it_transferencia i WHERE i.itt_tra_id = t.tra_id) AS qtd_itens
         FROM db_manaus.arm_transferencia t
         LEFT JOIN db_manaus.dbclien_filial f ON f.codcli = t.tra_codcli_destino
         LEFT JOIN db_manaus.dbfat_nfe nfe ON nfe.codfat = t.tra_codfat AND nfe.status='100'
         ${whereSQL}
        ORDER BY t.tra_id DESC
        LIMIT 100`,
      params,
    );
    return res.status(200).json({
      transferencias: r.rows.map((x) => ({
        tra_id: Number(x.tra_id),
        data: x.tra_data,
        status: x.tra_status,
        cancelada: x.tra_cancel === 'S',
        codent: x.tra_codent,
        destino: x.sigla,
        destino_nome: x.destino_nome,
        destino_uf: x.destino_uf,
        codfat: x.tra_codfat,
        nrodoc: x.nrodoc_fiscal,
        nfe_autorizada: x.nfe_status === '100',
        qtd_itens: Number(x.qtd_itens || 0),
        vlr_frete: Number(x.tra_vlr_frete || 0),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao listar transferências:', error);
    return res.status(500).json({ erro: 'Erro ao listar transferências', detalhes: error.message });
  } finally {
    client.release();
  }
}
