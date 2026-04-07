import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const {
    descricao = '',
    pagina = 0,
    tamanhoPagina = 10,
    order_by = null,
    order = null,
  } = req.body ?? {};

  const termo = String(descricao).trim();
  const offset = Number(pagina) * Number(tamanhoPagina);

  // somente números com até 5 dígitos => busca por CODCLI
  const buscarSomenteCodcli = /^\d{1,5}$/.test(termo);

  // prefix search
  const likeSufixo = `${termo}%`;

  // --------- ORDER BY dinâmico (com tratamento de vazios/nulos) ----------
  // ATENÇÃO: use o nome correto da coluna de fantasia no seu BD (aqui está `c.nomefant`)
  const ORDERABLE: Record<string, string> = {
    codigo: 'c.codcli',
    nome: `NULLIF(btrim(c.nome), '')`,
    documento: `NULLIF(btrim(c.cpfcgc::text), '')`,
    nomefantasia: `NULLIF(btrim(c.nomefant), '')`, // troque p/ c.nomefantasia se esse for o nome real
    // saldo disponível = (limite - débito) + crédito temporário
    saldo: `(COALESCE(c.limite, 0) - COALESCE(c.debito, 0) + COALESCE(cred.temp_credito, 0))`,
  };

  const orderByKey = String(order_by ?? '').toLowerCase(); // ex.: "nomefantasia"
  const baseExpr = ORDERABLE[orderByKey] ?? `NULLIF(btrim(c.nome), '')`; // fallback: nome (com NULLIF)
  const dir = String(order ?? '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const nulls = dir === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST';

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    let result, totalQuery;

    if (buscarSomenteCodcli) {
      // ====== SOMENTE CODCLI (prefixo) ======
      result = await client.query(
        `
        WITH cred AS (
          SELECT
            ct.codcli,
            GREATEST(SUM(GREATEST(ct.limite - ct.limite_usado, 0)), 0) AS temp_credito
          FROM dbclien_creditotmp ct
          WHERE COALESCE(ct.status, '') <> 'F'
            AND ct.datavencimento >= NOW()
          GROUP BY ct.codcli
        )
        SELECT
          c.*,
          (
            EXISTS (SELECT 1 FROM kickback k WHERE k.codcli = c.codcli)
            AND
            EXISTS (SELECT 1 FROM cliente_kickback ck WHERE ck.codcli = c.codcli)
          ) AS kickback,
          COALESCE(c.limite, 0)                           AS limite_total,
          COALESCE(c.debito, 0)                           AS debito_atual,
          (COALESCE(c.limite, 0) - COALESCE(c.debito, 0)) AS limite_base,
          COALESCE(cred.temp_credito, 0)                  AS credito_temporario_disponivel,
          ((COALESCE(c.limite, 0) - COALESCE(c.debito, 0)) + COALESCE(cred.temp_credito, 0)) AS limite_disponivel
        FROM dbclien c
        LEFT JOIN cred ON cred.codcli = c.codcli
        WHERE c.codcli::text ILIKE $1
        ORDER BY ${baseExpr} ${dir} ${nulls}, c.nome ASC
        OFFSET $2 LIMIT $3
        `,
        [likeSufixo, offset, tamanhoPagina],
      );

      totalQuery = await client.query(
        `SELECT COUNT(*) FROM dbclien WHERE codcli::text ILIKE $1`,
        [likeSufixo],
      );
    } else {
      // ====== NOME, CPFCGC e CODCLI (prefixo) ======
      result = await client.query(
        `
        WITH cred AS (
          SELECT
            ct.codcli,
            GREATEST(SUM(GREATEST(ct.limite - ct.limite_usado, 0)), 0) AS temp_credito
          FROM dbclien_creditotmp ct
          WHERE COALESCE(ct.status, '') <> 'F'
            AND ct.datavencimento >= NOW()
          GROUP BY ct.codcli
        )
        SELECT
          c.*,
          (
            EXISTS (SELECT 1 FROM kickback k WHERE k.codcli = c.codcli)
            AND
            EXISTS (SELECT 1 FROM cliente_kickback ck WHERE ck.codcli = c.codcli)
          ) AS kickback,
          COALESCE(c.limite, 0)                           AS limite_total,
          COALESCE(c.debito, 0)                           AS debito_atual,
          (COALESCE(c.limite, 0) - COALESCE(c.debito, 0)) AS limite_base,
          COALESCE(cred.temp_credito, 0)                  AS credito_temporario_disponivel,
          ((COALESCE(c.limite, 0) - COALESCE(c.debito, 0)) + COALESCE(cred.temp_credito, 0)) AS limite_disponivel
        FROM dbclien c
        LEFT JOIN cred ON cred.codcli = c.codcli
        WHERE c.nome         ILIKE $1
           OR c.cpfcgc::text ILIKE $2
           OR c.codcli::text ILIKE $3
        ORDER BY ${baseExpr} ${dir} ${nulls}, c.nome ASC
        OFFSET $4 LIMIT $5
        `,
        [likeSufixo, likeSufixo, likeSufixo, offset, tamanhoPagina],
      );

      totalQuery = await client.query(
        `
        SELECT COUNT(*)
        FROM dbclien
        WHERE nome         ILIKE $1
           OR cpfcgc::text ILIKE $2
           OR codcli::text ILIKE $3
        `,
        [likeSufixo, likeSufixo, likeSufixo],
      );
    }

    const dataFormatada = result.rows.map((item: Record<string, any>) => {
      const formatado: Record<string, any> = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          formatado[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formatado);
    });

    const total = Number(totalQuery.rows[0].count);
    res.status(200).json({ data: dataFormatada, total });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do cliente' });
  } finally {
    if (client) client.release();
  }
}
