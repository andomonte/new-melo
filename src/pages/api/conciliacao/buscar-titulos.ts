import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/conciliacao/buscar-titulos?termo=&valor_cent=
 * Títulos EM ABERTO (saldo > 0, não cancelado, não recebido) para vínculo MANUAL na
 * conciliação. Busca por código/nome do cliente, nº do documento ou cod_receb. Se `valor_cent`
 * vier, os de saldo igual ao recebido aparecem primeiro.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  const termo = String(req.query.termo || '').trim();
  const valorCent = Number(req.query.valor_cent || 0);
  if (termo.length < 2) return res.status(200).json({ titulos: [] });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const like = `%${termo}%`;
    // saldo aberto = valor_pgto - (valor_rec - juros_recebido): valor_rec inclui o juros (fiel ao
    // Oracle CAIXA), então descontamos o juros p/ o título parcial-com-juros não sumir da busca.
    const r = await client.query(
      `SELECT r.cod_receb, r.codcli, c.nome AS nome_cliente, r.nro_doc,
              ROUND((COALESCE(r.valor_pgto,0)-COALESCE(r.valor_rec,0)+jr.juros_rec)*100)::bigint AS saldo_cent,
              to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc
         FROM dbreceb r
         LEFT JOIN dbclien c ON c.codcli = r.codcli
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(fr.valor),0) AS juros_rec FROM dbfreceb fr
            WHERE fr.cod_receb = r.cod_receb
              AND fr.tipo IN ('18','20','21','22','23','25','26','43') AND fr.sf <> 'C'
         ) jr ON TRUE
        WHERE r.rec IS DISTINCT FROM 'S' AND (r.cancel IS NULL OR r.cancel<>'S')
          AND (COALESCE(r.valor_pgto,0)-COALESCE(r.valor_rec,0)+jr.juros_rec) > 0
          AND (CAST(r.cod_receb AS TEXT) LIKE $1
               OR r.nro_doc ILIKE $1
               OR CAST(r.codcli AS TEXT) LIKE $1
               OR UPPER(c.nome) LIKE UPPER($1))
        ORDER BY (ROUND((COALESCE(r.valor_pgto,0)-COALESCE(r.valor_rec,0)+jr.juros_rec)*100) = $2) DESC, r.dt_venc
        LIMIT 30`,
      [like, valorCent || -1],
    );
    return res.status(200).json({
      titulos: r.rows.map((x: any) => ({
        cod_receb: String(x.cod_receb),
        codcli: String(x.codcli),
        nome_cliente: x.nome_cliente,
        nro_doc: x.nro_doc,
        saldoCentavos: Number(x.saldo_cent),
        dt_venc: x.dt_venc,
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar títulos:', error);
    return res.status(500).json({ erro: 'Erro ao buscar títulos', detalhes: error.message });
  } finally {
    client.release();
  }
}
