import { NextApiRequest, NextApiResponse } from 'next';
import oracledb from 'oracledb';

/**
 * PONTE TEMPORÁRIA (Fase 1) — calcula Custo/CustoFE/CustoZF chamando a procedure
 * Oracle TMP_PROD.PRODUTO_CALCULA_CUSTO (motor fiscal CALCULO_IMPOSTO). Será
 * substituída pela conta migrada em Postgres nas Fases 2/3. Enquanto isso,
 * garante paridade EXATA com o Delphi.
 *
 * POST /api/produtos/custo-calcular
 * Body: {
 *   params: { desconto, acrescimo, custoFin, verbaMkt, frete, zerarIpi, zerarSt, codCredor },
 *   rows:   [{ codprod, prNF, prSNF, ipi, pis, cofins }]
 * }
 * Retorna: { resultados: [{ codprod, custo, custoFE, custoZF }] }
 */

// candidatos de instant client (dev). Em produção o Oracle já é acessível.
const LIB_DIRS = [
  'C:\\oracle\\instantclient\\instantclient_23_4',
  'C:\\oracle\\instantclient_23_8',
];

let clientInit = false;
function initClient() {
  if (clientInit) return;
  for (const libDir of LIB_DIRS) {
    try {
      oracledb.initOracleClient({ libDir });
      clientInit = true;
      return;
    } catch (e: any) {
      if (String(e.message).includes('already been initialized')) {
        clientInit = true;
        return;
      }
    }
  }
  // segue sem init explícito (thin/prod já configurado)
  clientInit = true;
}

function parseOracleUrl(url: string) {
  const m = url.match(/^oracle:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!m) throw new Error('DATABASE_URL2 (Oracle) em formato inesperado');
  return {
    user: m[1],
    password: m[2],
    connectString: `${m[3]}:${m[4]}/${m[5]}`,
  };
}

function num(v: any, def = 0): number {
  const f = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(f) ? def : f;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (!process.env.DATABASE_URL2) {
    return res.status(503).json({ error: 'Cálculo indisponível: Oracle não configurado (ponte temporária).' });
  }

  const params = req.body?.params || {};
  const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha para calcular' });
  }

  let conn: any;
  try {
    initClient();
    conn = await oracledb.getConnection(parseOracleUrl(process.env.DATABASE_URL2));

    const desconto = num(params.desconto);
    const acrescimo = num(params.acrescimo);
    const custoFin = num(params.custoFin);
    const verbaMkt = num(params.verbaMkt);
    const frete = num(params.frete);
    const zerarIpi = params.zerarIpi ? 'S' : 'N';
    const zerarSt = params.zerarSt ? 'S' : 'N';
    const codCredor = String(params.codCredor ?? '').trim();

    const resultados: Array<{ codprod: string; custo: number; custoFE: number; custoZF: number }> = [];

    for (const row of rows) {
      const codprod = String(row?.codprod ?? '').trim();
      if (!codprod) continue;
      const bind = {
        vDesconto: desconto,
        vAcrescimo: acrescimo,
        vCustoFin: custoFin,
        vVerba_Tmk: verbaMkt,
        vZerar_Ipi: zerarIpi,
        vZerar_St: zerarSt,
        vCodCredor: codCredor,
        vFrete: frete,
        vPrUnitNF: num(row.prNF),
        vPrUnitSNF: num(row.prSNF),
        vCodProd: codprod,
        vIPI: num(row.ipi, -1),
        vPIS: num(row.pis, -1),
        vCOFINS: num(row.cofins, -1),
        vVlrCusto: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        vVlrCustoFE: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        vVlrCustoZF: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };
      const r = await conn.execute(
        `BEGIN TMP_PROD.PRODUTO_CALCULA_CUSTO(
            vDesconto=>:vDesconto, vAcrescimo=>:vAcrescimo, vCustoFin=>:vCustoFin,
            vVerba_Tmk=>:vVerba_Tmk, vZerar_Ipi=>:vZerar_Ipi, vZerar_St=>:vZerar_St,
            vCodCredor=>:vCodCredor, vFrete=>:vFrete, vPrUnitNF=>:vPrUnitNF,
            vPrUnitSNF=>:vPrUnitSNF, vCodProd=>:vCodProd,
            vVlrCusto=>:vVlrCusto, vVlrCustoFE=>:vVlrCustoFE, vVlrCustoZF=>:vVlrCustoZF,
            vIPI=>:vIPI, vPIS=>:vPIS, vCOFINS=>:vCOFINS); END;`,
        bind as any,
      );
      const out: any = (r as any).outBinds || {};
      resultados.push({
        codprod,
        custo: Number(out.vVlrCusto) || 0,
        custoFE: Number(out.vVlrCustoFE) || 0,
        custoZF: Number(out.vVlrCustoZF) || 0,
      });
    }

    res.status(200).json({ resultados });
  } catch (e: any) {
    console.error('Erro custo-calcular (ponte Oracle):', e);
    res.status(500).json({ error: `Falha no cálculo (ponte Oracle): ${e.message}` });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        /* ignore */
      }
    }
  }
}
