import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/conciliacao/a-identificar?termo=&bucket=
 *
 * Worklist consolidada (transitória) dos recebimentos que caíram no banco mas ainda não foram
 * identificados — de TODOS os lotes. Traz o envelhecimento (aging) para priorizar os mais antigos.
 * Buckets: 0-7 | 8-30 | 31-60 | +60 dias.
 */
const BUCKETS = ['0-7', '8-30', '31-60', '+60'] as const;
type Bucket = (typeof BUCKETS)[number];
const bucketDeDias = (d: number): Bucket => (d <= 7 ? '0-7' : d <= 30 ? '8-30' : d <= 60 ? '31-60' : '+60');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  const termo = String(req.query.termo || '').trim();
  const bucket = String(req.query.bucket || '').trim();

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const params: any[] = [];
    let filtroTermo = '';
    if (termo.length >= 2) {
      params.push(`%${termo}%`);
      filtroTermo = ` AND (l.lin_historico ILIKE $1 OR l.lin_pagador_doc ILIKE $1 OR l.lin_pagador_nome ILIKE $1)`;
    }
    const r = await client.query(
      `SELECT l.lin_id, to_char(l.lin_data,'YYYY-MM-DD') AS data, l.lin_historico, l.lin_valor_cent,
              l.lin_pagador_doc, l.lin_pagador_tipo, l.lin_pagador_nome, l.lin_lote_id,
              lo.lot_banco, lo.lot_conta, lo.lot_arquivo_nome,
              (CURRENT_DATE - l.lin_data)::int AS dias
         FROM conc_linha l
         JOIN conc_lote lo ON lo.lot_id = l.lin_lote_id
        WHERE l.lin_status = 'a_identificar' AND l.lin_categoria = 'recebimento'
          ${filtroTermo}
        ORDER BY l.lin_data ASC, l.lin_valor_cent DESC
        LIMIT 1000`,
      params,
    );

    const todas = r.rows.map((x: any) => {
      const dias = Number(x.dias ?? 0);
      return {
        lin_id: Number(x.lin_id),
        data: x.data,
        historico: x.lin_historico,
        valorCentavos: Number(x.lin_valor_cent),
        pagador: { documento: x.lin_pagador_doc, tipo: x.lin_pagador_tipo, nome: x.lin_pagador_nome },
        lote_id: Number(x.lin_lote_id),
        banco: x.lot_banco,
        conta: x.lot_conta,
        arquivo: x.lot_arquivo_nome,
        dias,
        bucket: bucketDeDias(dias),
      };
    });

    // Resumo por bucket (contagem + soma) para os chips de aging.
    const resumo: Record<string, { qtd: number; totalCentavos: number }> = {};
    for (const b of BUCKETS) resumo[b] = { qtd: 0, totalCentavos: 0 };
    for (const l of todas) {
      resumo[l.bucket].qtd += 1;
      resumo[l.bucket].totalCentavos += l.valorCentavos;
    }

    const linhas = bucket && BUCKETS.includes(bucket as Bucket) ? todas.filter((l) => l.bucket === bucket) : todas;
    return res.status(200).json({
      total: todas.length,
      totalCentavos: todas.reduce((s, l) => s + l.valorCentavos, 0),
      resumo,
      linhas,
    });
  } catch (error: any) {
    console.error('Erro ao listar a identificar:', error);
    return res.status(500).json({ erro: 'Erro ao listar', detalhes: error.message });
  } finally {
    client.release();
  }
}
