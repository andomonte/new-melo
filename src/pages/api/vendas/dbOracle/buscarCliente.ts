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

// Lê a lista de colunas reais da tabela DBCLIEN (evita problemas com c.*)
async function getDbclienColumns(ora: Sequelize): Promise<string[]> {
  const rows = (await ora.query(
    `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'DBCLIEN' ORDER BY COLUMN_ID`,
    { type: QueryTypes.SELECT },
  )) as Array<{ COLUMN_NAME: string }>;
  return rows.map((r) => r.COLUMN_NAME); // UPPER
}

// Converte chaves para UPPERCASE
function upperKeys(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
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
    order_by?: string | null; // 'codigo' | 'nome' | 'documento' | 'nomefantasia' | 'saldo'
    order?: 'asc' | 'desc' | null;
  };

  const termo = String(descricao).trim();
  const likePrefix = `${termo}%`;
  const page = Number(pagina) || 0;
  const pageSize = Number(tamanhoPagina) || 10;
  const off = page * pageSize;
  const to = off + pageSize;

  // somente números com até 5 dígitos => busca por CODCLI
  const buscarSomenteCodcli = /^\d{1,5}$/.test(termo);

  try {
    const ora = await getOracleSequelize();

    // 1) Colunas reais da tabela
    const cols = await getDbclienColumns(ora); // ex.: ["CODCLI","NOME","NOMEFANT","CPFCGC",...]
    if (!cols.length) {
      return res
        .status(500)
        .json({ error: 'Tabela DBCLIEN sem colunas visíveis.' });
    }

    const innerColList = cols.map((c) => `c.${c}`).join(', ');

    // Flags de existência
    const hasNOME = cols.includes('NOME');
    const hasCPFCGC = cols.includes('CPFCGC');
    const hasNOMEFAN = cols.includes('NOMEFANT'); // ajuste se seu campo for NOMEFANTASIA

    // 2) Subselect base (b1) com aliases CURTOS (≤ 30) para evitar ORA-00972
    // KICK, LIM_TOT, DEB_ATU, LIM_BASE, CTD, LIM_DISP
    const baseSelect = `
      SELECT
        ${innerColList},
        CASE
          WHEN EXISTS (SELECT 1 FROM KICKBACK k WHERE k.CODCLI = c.CODCLI)
           AND EXISTS (SELECT 1 FROM CLIENTE_KICKBACK ck WHERE ck.CODCLI = c.CODCLI)
          THEN 1 ELSE 0
        END AS KICK,
        NVL(c.LIMITE, 0)                      AS LIM_TOT,
        NVL(c.DEBITO, 0)                      AS DEB_ATU,
        (NVL(c.LIMITE, 0) - NVL(c.DEBITO, 0)) AS LIM_BASE,
        NVL((
          SELECT GREATEST(SUM(GREATEST(ct.LIMITE - ct.LIMITE_USADO, 0)), 0)
          FROM DBCLIEN_CREDITOTMP ct
          WHERE ct.CODCLI = c.CODCLI
            AND NVL(ct.STATUS, '') <> 'F'
            AND ct.DATAVENCIMENTO >= SYSDATE
        ), 0)                                 AS CTD,
        ((NVL(c.LIMITE, 0) - NVL(c.DEBITO, 0)) + NVL((
          SELECT GREATEST(SUM(GREATEST(ct.LIMITE - ct.LIMITE_USADO, 0)), 0)
          FROM DBCLIEN_CREDITOTMP ct
          WHERE ct.CODCLI = c.CODCLI
            AND NVL(ct.STATUS, '') <> 'F'
            AND ct.DATAVENCIMENTO >= SYSDATE
        ), 0))                                AS LIM_DISP
      FROM DBCLIEN c
      WHERE ${
        buscarSomenteCodcli
          ? `TO_CHAR(c.CODCLI) LIKE :DESC`
          : [
              hasNOME ? `c.NOME LIKE :D1` : '1=0',
              hasCPFCGC ? `TO_CHAR(c.CPFCGC) LIKE :D2` : '1=0',
              `TO_CHAR(c.CODCLI) LIKE :D3`,
            ].join(' OR ')
      }
    `;

    // 3) Ordenação idêntica à do PG (com aliases curtos)
    const ORDERABLE: Record<string, string> = {
      codigo: 'b.CODCLI',
      nome: hasNOME ? `NULLIF(TRIM(b.NOME), '')` : 'b.CODCLI',
      documento: hasCPFCGC ? `NULLIF(TRIM(TO_CHAR(b.CPFCGC)), '')` : 'b.CODCLI',
      nomefantasia: hasNOMEFAN ? `NULLIF(TRIM(b.NOMEFANT), '')` : 'b.CODCLI',
      // saldo = LIM_TOT - DEB_ATU + CTD
      saldo: `(NVL(b.LIM_TOT, 0) - NVL(b.DEB_ATU, 0) + NVL(b.CTD, 0))`,
    };

    const key = String(order_by ?? '').toLowerCase();
    const baseExpr =
      ORDERABLE[key] ?? (hasNOME ? `NULLIF(TRIM(b.NOME), '')` : 'b.CODCLI');
    const dir = String(order ?? '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const nulls = dir === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST';
    const tieBreaker = hasNOME ? 'b.NOME ASC' : 'b.CODCLI ASC';

    // 4) Paginação com ROW_NUMBER()
    const paginatedSql = `
      SELECT * FROM (
        SELECT b.*, ROW_NUMBER() OVER (ORDER BY ${baseExpr} ${dir} ${nulls}, ${tieBreaker}) AS RN
        FROM (
          ${baseSelect}
        ) b
      )
      WHERE RN > :OFF AND RN <= :TO
    `;

    // Binds
    const repl: Record<string, any> = buscarSomenteCodcli
      ? { DESC: likePrefix, OFF: off, TO: to }
      : {
          ...(hasNOME ? { D1: likePrefix } : {}),
          ...(hasCPFCGC ? { D2: likePrefix } : {}),
          D3: likePrefix,
          OFF: off,
          TO: to,
        };

    const rows = (await ora.query(paginatedSql, {
      replacements: repl,
      type: QueryTypes.SELECT,
    })) as Record<string, any>[];

    // 5) total
    const totalSql = buscarSomenteCodcli
      ? `SELECT COUNT(*) AS TOTAL FROM DBCLIEN c WHERE TO_CHAR(c.CODCLI) LIKE :DESC`
      : `SELECT COUNT(*) AS TOTAL FROM DBCLIEN c WHERE ${[
          hasNOME ? `c.NOME LIKE :D1` : '1=0',
          hasCPFCGC ? `TO_CHAR(c.CPFCGC) LIKE :D2` : '1=0',
          `TO_CHAR(c.CODCLI) LIKE :D3`,
        ].join(' OR ')}`;

    const totalRow = (await ora.query(totalSql, {
      replacements: buscarSomenteCodcli
        ? { DESC: likePrefix }
        : {
            ...(hasNOME ? { D1: likePrefix } : {}),
            ...(hasCPFCGC ? { D2: likePrefix } : {}),
            D3: likePrefix,
          },
      type: QueryTypes.SELECT,
    })) as any[];

    const total = Number((totalRow?.[0] as any)?.TOTAL ?? 0);

    // 6) Payload 100% IDÊNTICO AO PG:
    //    - UPPERCASE keys
    //    - Renomear aliases curtos para os nomes do PG
    const data = rows.map((r) => {
      const u = upperKeys(r);
      // RN não deve ir
      delete u.RN;
      // Mapeia aliases curtos -> nomes do PG
      // (mantém os originais de DBCLIEN como já voltavam no PG)
      if ('KICK' in u) u.KICKBACK = u.KICK;
      if ('LIM_TOT' in u) u.LIMITE_TOTAL = u.LIM_TOT;
      if ('DEB_ATU' in u) u.DEBITO_ATUAL = u.DEB_ATU;
      if ('LIM_BASE' in u) u.LIMITE_BASE = u.LIM_BASE;
      if ('CTD' in u) u.CREDITO_TEMPORARIO_DISPONIVEL = u.CTD;
      if ('LIM_DISP' in u) u.LIMITE_DISPONIVEL = u.LIM_DISP;

      // remover aliases curtos para não “poluir” o payload
      delete u.KICK;
      delete u.LIM_TOT;
      delete u.DEB_ATU;
      delete u.LIM_BASE;
      delete u.CTD;
      delete u.LIM_DISP;

      return u;
    });

    return res.status(200).json({ data, total });
  } catch (e: any) {
    console.error('Erro ao buscar clientes (Oracle):', e);
    return res
      .status(500)
      .json({ error: 'Erro ao buscar dados do cliente (Oracle)' });
  }
}
