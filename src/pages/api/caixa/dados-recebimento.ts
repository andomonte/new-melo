import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { calcularJurosCaixa, type TituloJurosInput, type Feriados } from '@/lib/caixa/calcularJuros';

/**
 * Fase 0 do motor de recebimento do Caixa — porte de CAIXA.DADOS_RECEBIMENTO / CALULAR_JUROS.
 * Read-only: dado um (ou vários) título(s) + data de pagamento, devolve principal pendente,
 * dias de atraso, juros, tarifa e valor a receber. Validado 6/6 contra o Oracle desenv.
 *
 * POST { cod_receb: string | string[], dataPgto?: 'YYYY-MM-DD' }
 */

// dbcalc.TXCART ainda não foi migrado para o Postgres — valor validado no Oracle.
const TXCART_FALLBACK = 8;

// tipos de juros em dbfreceb (JUROS_RECEBIDO)
const TIPOS_JUROS = ['18', '20', '21', '22', '23', '25', '26'];

async function getTaxaJuros(client: any): Promise<number> {
  try {
    const r = await client.query('SELECT txcart FROM dbcalc LIMIT 1');
    const v = Number(r.rows?.[0]?.txcart);
    return Number.isFinite(v) && v > 0 ? v : TXCART_FALLBACK;
  } catch {
    return TXCART_FALLBACK;
  }
}

/** Feriados nacionais de DBFERIADO: fixos por dia/mês ('MM-DD'), móveis por data ('YYYY-MM-DD'). */
async function getFeriados(client: any): Promise<Feriados> {
  const fixos = new Set<string>();
  const moveis = new Set<string>();
  try {
    const r = await client.query(
      "SELECT fixo, to_char(data,'MM-DD') AS md, to_char(data,'YYYY-MM-DD') AS ymd FROM dbferiado WHERE tipo='N'",
    );
    for (const x of r.rows) {
      if (x.fixo === 'S') fixos.add(x.md);
      else moveis.add(x.ymd);
    }
  } catch {
    /* dbferiado ausente — carência só por fim de semana */
  }
  return { fixos, moveis };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  const { cod_receb, dataPgto } = req.body || {};
  const ids: string[] = Array.isArray(cod_receb)
    ? cod_receb.map(String)
    : cod_receb
    ? [String(cod_receb)]
    : [];
  if (ids.length === 0) {
    return res.status(400).json({ erro: 'Informe cod_receb (string ou array).' });
  }

  const dpg = (dataPgto ? String(dataPgto) : new Date().toISOString()).slice(0, 10);

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // 1) Títulos
    const tit = await client.query(
      `SELECT r.cod_receb, r.codcli, c.nome AS nome_cliente, r.nro_doc, r.cod_fat,
              r.valor_pgto, r.valor_rec,
              to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc,
              to_char(r.dt_pgto,'YYYY-MM-DD') AS dt_pgto,
              r.forma_fat, r.rec, r.cancel
       FROM dbreceb r
       LEFT JOIN dbclien c ON c.codcli = r.codcli
       WHERE r.cod_receb = ANY($1)`,
      [ids],
    );
    if (tit.rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhum título encontrado.' });
    }

    // 2) Agregados de juros (em lote)
    const [jpRes, jaRes, jlRes] = await Promise.all([
      client.query(
        `SELECT cod_receb, COALESCE(SUM(valor),0) AS juros_pago
         FROM dbfreceb
         WHERE cod_receb = ANY($1) AND tipo = ANY($2) AND sf <> 'C'
         GROUP BY cod_receb`,
        [ids, TIPOS_JUROS],
      ),
      client.query(
        `SELECT DISTINCT ON (rcj_cod_receb) rcj_cod_receb,
                (rcj_juros - rcj_juros_recebido) AS juros_aberto
         FROM fin_receb_controle_juros
         WHERE rcj_cod_receb = ANY($1)
         ORDER BY rcj_cod_receb, rcj_data DESC`,
        [ids],
      ),
      client.query(
        `SELECT lij_cod_receb, MIN(lij_taxa_liberada) AS taxa
         FROM fin_libera_juros
         WHERE lij_cod_receb = ANY($1) AND lij_utilizada = 0
         GROUP BY lij_cod_receb`,
        [ids],
      ),
    ]);
    const jurosPagoMap = new Map(jpRes.rows.map((r: any) => [r.cod_receb, Number(r.juros_pago)]));
    const jurosAbertoMap = new Map(jaRes.rows.map((r: any) => [r.rcj_cod_receb, Number(r.juros_aberto)]));
    const jurosLiberadoMap = new Map(jlRes.rows.map((r: any) => [r.lij_cod_receb, Number(r.taxa)]));

    // 3) Venda à vista (fatura das últimas 24h) — exceção de juros
    const fats = tit.rows.map((r: any) => r.cod_fat).filter(Boolean);
    let fatsRecentes = new Set<string>();
    if (fats.length) {
      try {
        const fr = await client.query(
          `SELECT cod_fat FROM dbfatura
           WHERE cod_fat = ANY($1) AND data >= (CURRENT_DATE - INTERVAL '1 day')`,
          [fats],
        );
        fatsRecentes = new Set(fr.rows.map((r: any) => String(r.cod_fat)));
      } catch {
        /* dbfatura ausente/coluna diferente — trata como sem venda à vista */
      }
    }

    // 4) Taxa + feriados
    const taxa = await getTaxaJuros(client);
    const feriados = await getFeriados(client);

    // 5) Calcula por título
    const titulos = tit.rows.map((r: any) => {
      const input: TituloJurosInput = {
        valorPgto: Number(r.valor_pgto || 0),
        valorRec: Number(r.valor_rec || 0),
        dtVenc: r.dt_venc,
        dtPgto: r.dt_pgto,
        formaFat: r.forma_fat,
        jurosPago: jurosPagoMap.get(r.cod_receb) ?? 0,
        jurosAberto: jurosAbertoMap.get(r.cod_receb) ?? 0,
        jurosLiberado: jurosLiberadoMap.get(r.cod_receb) ?? -1,
        vendaAVista: r.cod_fat ? fatsRecentes.has(String(r.cod_fat)) : false,
      };
      const calc = calcularJurosCaixa(input, dpg, taxa, feriados);
      return {
        cod_receb: r.cod_receb,
        codcli: r.codcli,
        nome_cliente: r.nome_cliente,
        nro_doc: r.nro_doc,
        cod_fat: r.cod_fat,
        dt_venc: r.dt_venc,
        dt_pgto: r.dt_pgto,
        forma_fat: r.forma_fat,
        rec: r.rec,
        cancel: r.cancel,
        valor_pgto: Number(r.valor_pgto || 0),
        valor_rec: Number(r.valor_rec || 0),
        ...calc,
      };
    });

    const totais = titulos.reduce(
      (acc, t) => {
        acc.principal += t.principalPendente;
        acc.juros += t.juros;
        acc.tarifa += t.tarifa;
        acc.aReceber += t.valorReceber;
        return acc;
      },
      { principal: 0, juros: 0, tarifa: 0, aReceber: 0 },
    );

    return res.status(200).json({
      dataPgto: dpg,
      taxaJuros: taxa,
      taxaFonte: taxa === TXCART_FALLBACK ? 'fallback (dbcalc não migrado)' : 'dbcalc.txcart',
      titulos,
      totais: {
        principal: Math.round(totais.principal * 100) / 100,
        juros: Math.round(totais.juros * 100) / 100,
        tarifa: Math.round(totais.tarifa * 100) / 100,
        aReceber: Math.round(totais.aReceber * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error('Erro em dados-recebimento:', error);
    return res.status(500).json({ erro: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}
