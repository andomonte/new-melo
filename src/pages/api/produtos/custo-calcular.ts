import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { calcularCustoCompraPg } from '@/lib/impostos/dadosCustoCompra';

/**
 * Calcula Custo/CustoFE/CustoZF da tela "Atualizar Custo da Mercadoria" —
 * agora 100% Postgres (motor fiscal migrado de CALCULO_IMPOSTO/PRODUTO_CALCULA_
 * CUSTO em src/lib/impostos). Sem dependência de Oracle. Validado ponta-a-ponta
 * contra o Oracle (168/168 Custo/FE/ZF idênticos, incluindo ZERAR IPI/ST).
 *
 * POST /api/produtos/custo-calcular
 * Body: {
 *   params: { desconto, acrescimo, custoFin, verbaMkt, frete, zerarIpi, zerarSt, codCredor },
 *   rows:   [{ codprod, prNF, prSNF, ipi, pis, cofins }]
 * }
 * Retorna: { resultados: [{ codprod, custo, custoFE, custoZF }] }
 */

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

  const p = req.body?.params || {};
  const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha para calcular' });
  }

  const codCredor = String(p.codCredor ?? '').trim();
  if (!codCredor) {
    return res.status(400).json({ error: 'Informe o fornecedor (código do credor).' });
  }

  const params = {
    desconto: num(p.desconto),
    acrescimo: num(p.acrescimo),
    custoFin: num(p.custoFin),
    verbaMkt: num(p.verbaMkt),
    frete: num(p.frete),
  };
  const zerarSt = !!p.zerarSt;
  const zerarIpi = !!p.zerarIpi;

  const client = await getPgPool().connect();
  try {
    const resultados: Array<{
      codprod: string;
      custo: number;
      custoFE: number;
      custoZF: number;
      erro?: string;
    }> = [];

    for (const row of rows) {
      const codprod = String(row?.codprod ?? '').trim();
      if (!codprod) continue;
      const r = await calcularCustoCompraPg(
        client,
        codprod,
        codCredor,
        num(row.prNF),
        num(row.prSNF),
        params,
        zerarSt,
        zerarIpi,
        { ipi: row.ipi, pis: row.pis, cofins: row.cofins },
      );
      if ('erro' in r) {
        resultados.push({ codprod, custo: 0, custoFE: 0, custoZF: 0, erro: r.erro });
      } else {
        resultados.push({ codprod, custo: r.custo, custoFE: r.custoFE, custoZF: r.custoZF });
      }
    }

    res.status(200).json({ resultados });
  } catch (e: any) {
    console.error('Erro custo-calcular (motor Postgres):', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
