// pages/api/vendas/dbOracle/buscarCliente.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { Sequelize, QueryTypes } from 'sequelize';
const oracledb = require('oracledb');

let _oraSequelize: Sequelize | null = null;
async function getOracleSequelize() {
  if (!_oraSequelize) {
    await oracledb.initOracleClient({
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4', // ajuste se necessário
    });
    const url = process.env.DATABASE_URL2;
    if (!url) throw new Error('DATABASE_URL2 ausente.');
    _oraSequelize = new Sequelize(url, { logging: false });
  }
  return _oraSequelize!;
}

function upperKeys(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial)
    return res.status(400).json({ error: 'Filial não informada no cookie' });

  const {
    descricao = '',
    pagina = 0,
    tamanhoPagina = 10,
    order_by = null,
    order = null,
  } = (req.body ?? {}) as {
    descricao?: string;
    pagina?: number;
    tamanhoPagina?: number;
    order_by?: string | null;
    order?: 'asc' | 'desc' | null;
  };

  const termo = String(descricao).trim();
  const likePrefix = `${termo}%`;
  const offset = Number(pagina) * Number(tamanhoPagina);
  const limitTo = offset + Number(tamanhoPagina);

  // somente números com até 5 dígitos => busca por CODCLI
  const buscarSomenteCodcli = /^\d{1,5}$/.test(termo);

  // Mapeamento idêntico ao PG (usar alias b. no ORDER externo)
  const ORDERABLE: Record<string, string> = {
    codigo: 'b.CODCLI',
    nome: `NULLIF(TRIM(b.NOME), '')`,
    documento: `NULLIF(TRIM(TO_CHAR(b.CPFCGC)), '')`,
    nomefantasia: `NULLIF(TRIM(b.NOMEFANT), '')`, // use NOMEFANT (como no seu Oracle)
    saldo: `(NVL(b.LIMITE_TOTAL, 0) - NVL(b.DEBITO_ATUAL, 0) + NVL(b.CREDITO_TEMPORARIO_DISPONIVEL, 0))`,
  };

  const key = String(order_by ?? '').toLowerCase();
  const baseExpr = ORDERABLE[key] ?? `NULLIF(TRIM(b.NOME), '')`;
  const dir = String(order ?? '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const nulls = dir === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST';

  try {
    const ora = await getOracleSequelize();

    // Subconsulta base que replica exatamente o SELECT do PG (c.* + calculados)
    // Obs.: não projetamos colunas técnicas de ordenação; só o que o PG devolve.
    const baseSelect = `
      SELECT
        c.*,
        CASE
          WHEN EXISTS (SELECT 1 FROM KICKBACK k WHERE k.CODCLI = c.CODCLI)
           AND EXISTS (SELECT 1 FROM CLIENTE_KICKBACK ck WHERE ck.CODCLI = c.CODCLI)
          THEN 1 ELSE 0
        END AS KICKBACK,

        NVL(c.LIMITE, 0)                            AS LIMITE_TOTAL,
        NVL(c.DEBITO, 0)                            AS DEBITO_ATUAL,
        (NVL(c.LIMITE, 0) - NVL(c.DEBITO, 0))       AS LIMITE_BASE,
        NVL((
          SELECT GREATEST(SUM(GREATEST(ct.LIMITE - ct.LIMITE_USADO, 0)), 0)
          FROM DBCLIEN_CREDITOTMP ct
          WHERE ct.CODCLI = c.CODCLI
            AND NVL(ct.STATUS, '') <> 'F'
            AND ct.DATAVENCIMENTO >= SYSDATE
        ), 0)                                       AS CREDITO_TEMPORARIO_DISPONIVEL,
        ((NVL(c.LIMITE, 0) - NVL(c.DEBITO, 0))
           + NVL((
               SELECT GREATEST(SUM(GREATEST(ct.LIMITE - ct.LIMITE_USADO, 0)), 0)
               FROM DBCLIEN_CREDITOTMP ct
               WHERE ct.CODCLI = c.CODCLI
                 AND NVL(ct.STATUS, '') <> 'F'
                 AND ct.DATAVENCIMENTO >= SYSDATE
             ), 0)
        )                                           AS LIMITE_DISPONIVEL
      FROM DBCLIEN c
      WHERE
        ${
          buscarSomenteCodcli
            ? `TO_CHAR(c.CODCLI) LIKE :DESC`
            : `c.NOME LIKE :D1 OR TO_CHAR(c.CPFCGC) LIKE :D2 OR TO_CHAR(c.CODCLI) LIKE :D3`
        }
    `;

    // Paginação por ROW_NUMBER() com a mesma ordenação do PG
    const paginatedSql = `
      SELECT * FROM (
        SELECT b.*, ROW_NUMBER() OVER (ORDER BY ${baseExpr} ${dir} ${nulls}, b.NOME ASC) AS RN
        FROM (
          ${baseSelect}
        ) b
      )
      WHERE RN > :OFF AND RN <= :TO
    `;

    const replacements: Record<string, any> = buscarSomenteCodcli
      ? { DESC: likePrefix, OFF: offset, TO: limitTo }
      : {
          D1: likePrefix,
          D2: likePrefix,
          D3: likePrefix,
          OFF: offset,
          TO: limitTo,
        };

    const rows = (await ora.query(paginatedSql, {
      replacements,
      type: QueryTypes.SELECT,
    })) as Record<string, any>[];

    // total
    const totalSql = buscarSomenteCodcli
      ? `SELECT COUNT(*) AS TOTAL FROM DBCLIEN c WHERE TO_CHAR(c.CODCLI) LIKE :DESC`
      : `SELECT COUNT(*) AS TOTAL FROM DBCLIEN c
         WHERE c.NOME LIKE :D1 OR TO_CHAR(c.CPFCGC) LIKE :D2 OR TO_CHAR(c.CODCLI) LIKE :D3`;

    const totalRow = (await ora.query(totalSql, {
      replacements: buscarSomenteCodcli
        ? { DESC: likePrefix }
        : { D1: likePrefix, D2: likePrefix, D3: likePrefix },
      type: QueryTypes.SELECT,
    })) as any[];

    const total = Number((totalRow?.[0] as any)?.TOTAL ?? 0);

    // Saída com chaves em CAIXA ALTA (igual ao PG)
    const data = rows.map(upperKeys);
    return res.status(200).json({ data, total });
  } catch (e: any) {
    console.error('Erro ao buscar clientes (Oracle):', e);
    return res
      .status(500)
      .json({ error: 'Erro ao buscar dados do cliente (Oracle)' });
  }
}
