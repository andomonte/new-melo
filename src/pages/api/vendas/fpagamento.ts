// pages/api/venda/fpagamento.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

/* ---------------- Logger ---------------- */
function mkLogger(tag: string) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) => console.log(`[${tag}] [${traceId}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[${tag}] [${traceId}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
      if (e?.code) console.error('code:', e.code);
      if (e?.detail) console.error('detail:', e.detail);
      if (e?.hint) console.error('hint:', e.hint);
    }
  };
  return { traceId, log, err };
}

/* ---------------- Handler ---------------- */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { traceId, err: logErr } = mkLogger('fpagamento');

  // precisa do cookie de filial, igual aos outros endpoints
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res
      .status(400)
      .json({ ok: false, error: 'Filial não informada no cookie', traceId });
  }

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    if (req.method !== 'GET') {
      return res
        .status(405)
        .json({ ok: false, error: 'Method not allowed', traceId });
    }

    // ⬇️ AJUSTE SOMENTE ESTE TRECHO CASO SUA TABELA/VISÃO TENHA OUTRO NOME/colunas
    // Exemplo: tabela "venda_fpagamento" com colunas "id" e "descricao"
    const SQL = `
      SELECT id, descricao
      FROM dbtipo_documento
      WHERE descricao IS NOT NULL AND descricao <> ''
      ORDER BY descricao ASC
    `;

    const r = await client.query(SQL);

    const data = (r.rows ?? []).map((row: any) => ({
      id: String(row.id ?? ''),
      descricao: String(row.descricao ?? ''),
    }));

    return res.status(200).json({
      ok: true,
      data,
      count: data.length,
      traceId,
    });
  } catch (e: any) {
    logErr('falha geral', e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'Erro no fpagamento', traceId });
  } finally {
    try {
      client?.release();
    } catch {}
  }
}
