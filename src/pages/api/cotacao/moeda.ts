/**
 * GET /api/cotacao/moeda?moeda=EUR&data=YYYY-MM-DD
 *
 * Cotação (moeda -> BRL) na data informada, para qualquer moeda (USD, EUR, CNY...),
 * usada para converter contratos de câmbio quando o documento NÃO foi encontrado no
 * Contas a Pagar.
 *
 * Ordem: tabela cotacao_moeda (cache) -> BACEN PTAX (último dia útil <= data) -> 404.
 * USD usa CotacaoDolarPeriodo; demais usam CotacaoMoedaPeriodo(moeda=@moeda).
 * Em qualquer falha externa devolve 404 para a tela cair no preenchimento manual.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

/** 'YYYY-MM-DD' -> 'MM-DD-YYYY' (formato do olinda/PTAX). */
function toUsDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

function addDaysIso(iso: string, days: number): string {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function buscarPtax(
  moeda: string,
  dataIso: string,
): Promise<{ taxa: number; taxaCompra: number } | null> {
  const ini = toUsDate(addDaysIso(dataIso, -10)); // janela cobre fim de semana/feriado
  const fim = toUsDate(dataIso);

  const url =
    moeda === 'USD'
      ? `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
        `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
        `?@dataInicial='${ini}'&@dataFinalCotacao='${fim}'` +
        `&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`
      : `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
        `CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
        `?@moeda='${moeda}'&@dataInicial='${ini}'&@dataFinalCotacao='${fim}'` +
        `&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const json = await resp.json();
    const row = json?.value?.[0];
    if (!row || !row.cotacaoVenda) return null;
    return {
      taxa: Number(row.cotacaoVenda),
      taxaCompra: Number(row.cotacaoCompra) || Number(row.cotacaoVenda),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback para moedas que o PTAX não publica (ex.: CNY). AwesomeAPI devolve a
 * cotação de mercado (moeda -> BRL): ask = venda, bid = compra. Histórico por data.
 */
async function buscarAwesome(
  moeda: string,
  dataIso: string,
): Promise<{ taxa: number; taxaCompra: number } | null> {
  const ini = addDaysIso(dataIso, -10).replace(/-/g, ''); // YYYYMMDD
  const fim = dataIso.replace(/-/g, '');
  const token = process.env.AWESOMEAPI_TOKEN ? `&token=${process.env.AWESOMEAPI_TOKEN}` : '';
  const url =
    `https://economia.awesomeapi.com.br/json/daily/${moeda}-BRL/` +
    `?start_date=${ini}&end_date=${fim}${token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const arr = await resp.json();
    // Array em ordem decrescente: o 1º é a cotação mais recente <= data final.
    const row = Array.isArray(arr) ? arr[0] : null;
    const venda = row ? Number(row.ask) : 0;
    if (!venda || isNaN(venda)) return null;
    return { taxa: venda, taxaCompra: Number(row.bid) || venda };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const moeda = String(req.query.moeda || 'USD').toUpperCase().slice(0, 5);
  const data = String(req.query.data || '');
  if (!/^[A-Z]{3}$/.test(moeda)) {
    return res.status(400).json({ message: 'Parâmetro "moeda" inválido (ex.: USD, EUR, CNY)' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ message: 'Parâmetro "data" inválido (use YYYY-MM-DD)' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  try {
    // 1) Cache local
    const cache = await pool.query(
      'SELECT taxa, taxa_compra, fonte FROM cotacao_moeda WHERE moeda = $1 AND data = $2',
      [moeda, data],
    );
    if (cache.rows.length > 0) {
      const r = cache.rows[0];
      return res.status(200).json({
        found: true,
        moeda,
        data,
        taxa: parseFloat(String(r.taxa)),
        taxa_compra: r.taxa_compra != null ? parseFloat(String(r.taxa_compra)) : null,
        fonte: r.fonte || 'CACHE',
      });
    }

    // 2) BACEN PTAX (fonte oficial) -> 3) AwesomeAPI (mercado, cobre moedas sem PTAX)
    const ptax = await buscarPtax(moeda, data);
    let taxa = 0;
    let taxaCompra = 0;
    let fonte = '';
    if (ptax && ptax.taxa > 0) {
      taxa = ptax.taxa; taxaCompra = ptax.taxaCompra; fonte = 'PTAX';
    } else {
      const aw = await buscarAwesome(moeda, data);
      if (aw && aw.taxa > 0) {
        taxa = aw.taxa; taxaCompra = aw.taxaCompra; fonte = 'AWESOME';
      }
    }

    if (taxa > 0) {
      try {
        await pool.query(
          `INSERT INTO cotacao_moeda (moeda, data, taxa, taxa_compra, fonte)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (moeda, data) DO UPDATE SET taxa = EXCLUDED.taxa,
             taxa_compra = EXCLUDED.taxa_compra, fonte = EXCLUDED.fonte`,
          [moeda, data, taxa, taxaCompra, fonte],
        );
      } catch { /* cache best-effort */ }

      return res.status(200).json({ found: true, moeda, data, taxa, taxa_compra: taxaCompra, fonte });
    }

    // Nada -> 200 com found:false (não é erro). A tela cai no preenchimento manual.
    return res.status(200).json({
      found: false,
      moeda,
      data,
      message: `Cotação ${moeda} não encontrada para a data. Informe a taxa manualmente.`,
    });
  } catch (error: any) {
    console.error('Erro ao buscar cotação da moeda:', error);
    return res.status(500).json({ message: error.message || 'Erro ao buscar cotação' });
  }
}
