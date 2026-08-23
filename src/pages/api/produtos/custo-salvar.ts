import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Salva o resultado de "Atualizar Custo da Mercadoria" (migração da procedure
 * Oracle TMP_PROD.PRODUTO_ATULIZA_CUSTO para o Postgres).
 *
 * Regras iguais ao Delphi/Oracle:
 *  - prfabr/preconf/precosnf sempre atualizados (arredondados a 2 casas);
 *  - cmercd/cmercf/cmerczf recebem Custo / Custo FE / Custo ZF calculados;
 *  - ipi/pis/cofins: valor -1 mantém o atual (decode(-1 -> mantém));
 *  - clasfiscal(NCM)/descr/codbar/aplic_extendida: null/'' mantém o atual.
 *
 * POST /api/produtos/custo-salvar
 * Body: { rows: [{ codprod, prBruto, prNF, prSNF, ncm, ipi, pis, cofins,
 *                   descr, custo, custoFE, custoZF, barras, aplicacao }] }
 */

function n(v: any): number {
  const f = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(f) ? 0 : f;
}

// remove caracteres de controle (equivale ao tira_caract_nfe, simplificado)
function limpaTexto(v: any): string {
  return String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .trim();
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const rows: unknown = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha para salvar' });
  }

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    let atualizados = 0;

    for (const row of rows as any[]) {
      const codprod = String(row?.codprod ?? '').trim();
      if (!codprod) continue;

      const sets: string[] = [
        'prfabr = ROUND($1::numeric, 2)',
        'preconf = ROUND($2::numeric, 2)',
        'precosnf = ROUND($3::numeric, 2)',
        'cmercd = $4',
        'cmercf = $5',
        'cmerczf = $6',
      ];
      const params: any[] = [
        n(row.prBruto),
        n(row.prNF),
        n(row.prSNF),
        n(row.custo),
        n(row.custoFE),
        n(row.custoZF),
      ];
      let i = params.length;

      // NCM (clasfiscal): só atualiza se veio valor
      const ncm = String(row.ncm ?? '').replace(/\D/g, '');
      if (ncm) {
        params.push(ncm);
        sets.push(`clasfiscal = $${++i}`);
      }
      // IPI/PIS/COFINS: -1 mantém
      if (n(row.ipi) !== -1 && row.ipi !== undefined && row.ipi !== null) {
        params.push(n(row.ipi));
        sets.push(`ipi = $${++i}`);
      }
      if (n(row.pis) !== -1 && row.pis !== undefined && row.pis !== null) {
        params.push(n(row.pis));
        sets.push(`pis = $${++i}`);
      }
      if (n(row.cofins) !== -1 && row.cofins !== undefined && row.cofins !== null) {
        params.push(n(row.cofins));
        sets.push(`cofins = $${++i}`);
      }
      // Descrição/Barras/Aplicação: só se veio texto
      const descr = limpaTexto(row.descr);
      if (descr) {
        params.push(descr);
        sets.push(`descr = $${++i}`);
      }
      const barras = String(row.barras ?? '').trim();
      if (barras) {
        params.push(barras);
        sets.push(`codbar = $${++i}`);
      }
      const aplic = limpaTexto(row.aplicacao);
      if (aplic) {
        params.push(aplic);
        sets.push(`aplic_extendida = $${++i}`);
      }

      params.push(codprod);
      const r = await client.query(
        `UPDATE dbprod SET ${sets.join(', ')} WHERE codprod = $${++i}`,
        params,
      );
      atualizados += r.rowCount || 0;
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Custos atualizados', atualizados });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro custo-salvar:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
