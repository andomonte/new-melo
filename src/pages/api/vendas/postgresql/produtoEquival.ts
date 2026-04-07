import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERRO: FILIAL NÃO INFORMADA NO COOKIE.');
    return res.status(400).json({ error: 'FILIAL NÃO INFORMADA NO COOKIE' });
  }

  let client: PoolClient | undefined;
  const { CODGPE, PRVENDA } = req.body as {
    CODGPE?: string;
    PRVENDA?: string | number;
  };

  let tipoCliente = '0';
  if (PRVENDA != null) tipoCliente = String(PRVENDA);

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const querySql = `
      SELECT
          p.ref,
          p.codgpe,
          p.codprod,
          p.descr,
          p.qtest,
          (p.qtest - p.qtdreservada) AS qtddisponivel,
          m.descr AS "MARCA",
          fp."PRECOVENDA"
      FROM dbprod p
      JOIN dbmarcas m
        ON m.codmarca = p.codmarca
      JOIN dbformacaoprvenda fp
        ON p.codprod = fp."CODPROD"
      WHERE
          fp."PRECOVENDA" > 0
        AND fp."TIPOPRECO" = $2
        AND p.codgpe ILIKE $1
        -- ====== REGRAS NOVAS ======
        AND COALESCE(p.inf, '') <> 'D'       -- não pode estar marcado como 'descontinuado'
        AND COALESCE(p.excluido, 0) <> 1     -- não pode estar excluído
        -- ===========================
      ORDER BY qtddisponivel DESC;
    `;

    // Observação: se quiser "contém", use `%${CODGPE ?? ''}%`. Mantive como você enviou (sem %).
    const params = [String(CODGPE ?? ''), tipoCliente];

    const result = await client.query(querySql, params);
    const rows = result.rows;

    const payload = rows.map((item) => {
      const upper: Record<string, any> = {};
      for (const k in item) upper[k.toUpperCase()] = (item as any)[k];
      return serializeBigInt(upper);
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('ERRO INESPERADO NO API ROUTE:', error);
    res.status(500).json({ error: 'ERRO AO BUSCAR DADOS DO PRODUTO' });
  } finally {
    if (client) client.release();
  }
}
