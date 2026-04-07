/**
 * POST /api/importacao/:id/calcular-custos
 * Calcula custos por item da DI (replica lógica Oracle ENTRADA_IMPORTACAO.ATUALIZAR_CUSTO)
 * Distribui despesas da DI proporcionalmente por item.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const id = parseInt(req.query.id as string, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Ler cabeçalho da DI
    const cabResult = await client.query(`
      SELECT * FROM db_manaus.dbent_importacao WHERE id = $1 FOR UPDATE
    `, [id]);

    if (cabResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Importação #${id} não encontrada` });
    }

    const cab = cabResult.rows[0];

    if (cab.status !== 'N') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Importação não pode ser calculada (status: ${cab.status})` });
    }

    const taxaDolar = parseFloat(String(cab.taxa_dolar || 0));
    const totalMercadoria = parseFloat(String(cab.total_mercadoria || 0));
    const frete = parseFloat(String(cab.frete || 0));
    const thc = parseFloat(String(cab.thc || 0));
    const pisCofins = parseFloat(String(cab.pis_cofins || 0));
    const ii = parseFloat(String(cab.ii || 0));
    const ipi = parseFloat(String(cab.ipi || 0));
    const icmsSt = parseFloat(String(cab.icms_st || 0));
    const anuencia = parseFloat(String(cab.anuencia || 0));
    const siscomex = parseFloat(String(cab.siscomex || 0));
    const contratoCambio = parseFloat(String(cab.contrato_cambio || 0));
    const despachante = parseFloat(String(cab.despachante || 0));
    const freteorigemTotal = parseFloat(String(cab.freteorigem_total || 0));
    const infraeroPorto = parseFloat(String(cab.infraero_porto || 0));
    const carreteiroEadi = parseFloat(String(cab.carreteiro_eadi || 0));
    const carreteiroMelo = parseFloat(String(cab.carreteiro_melo || 0));
    const eadi = parseFloat(String(cab.eadi || 0));

    // 2. Calcular TxDolarMedio dos contratos: SUM(taxa * vl_merc) / SUM(vl_merc)
    const contratosResult = await client.query(`
      SELECT taxa_dolar, vl_merc_dolar
      FROM db_manaus.dbent_importacao_contratos
      WHERE id_importacao = $1
    `, [id]);

    let txDolarMedio = taxaDolar; // fallback se não houver contratos
    if (contratosResult.rows.length > 0) {
      let sumTaxaVlMerc = 0;
      let sumVlMerc = 0;
      for (const c of contratosResult.rows) {
        const taxa = parseFloat(String(c.taxa_dolar || 0));
        const vlMerc = parseFloat(String(c.vl_merc_dolar || 0));
        sumTaxaVlMerc += taxa * vlMerc;
        sumVlMerc += vlMerc;
      }
      if (sumVlMerc > 0) {
        txDolarMedio = sumTaxaVlMerc / sumVlMerc;
      }
    }

    // 3. Calcular DespesaCusto total
    const despesaCusto = pisCofins + ii + ipi + anuencia + siscomex
      + (taxaDolar * contratoCambio)
      + despachante + freteorigemTotal + infraeroPorto
      + carreteiroEadi + carreteiroMelo + eadi;

    console.log(`[calcular-custos] DI #${id}: TxDolarMedio=${txDolarMedio.toFixed(4)}, DespesaCusto=${despesaCusto.toFixed(2)}`);

    // 4. Buscar itens com codprod
    const itensResult = await client.query(`
      SELECT id, codprod, qtd, proforma_unit, proforma_total, invoice_unit, invoice_total, id_fatura
      FROM db_manaus.dbent_importacao_it_ent
      WHERE id_importacao = $1 AND codprod IS NOT NULL
      ORDER BY id
    `, [id]);

    if (itensResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Nenhum item com produto associado para calcular' });
    }

    let itensCalculados = 0;

    for (const item of itensResult.rows) {
      const qtd = parseFloat(String(item.qtd || 0));
      if (qtd === 0) continue;

      const proformaUnit = parseFloat(String(item.proforma_unit || 0));
      const proformaTotal = parseFloat(String(item.proforma_total || 0));
      const invoiceTotal = parseFloat(String(item.invoice_total || 0));

      // Taxa efetiva = TxDolarMedio + 0.10 (adicional segurança)
      const txEfetiva = txDolarMedio + 0.10;

      // Valores em reais
      const realUnit = proformaUnit * txEfetiva;
      const realTotal = proformaTotal * txEfetiva;

      // Rateio de despesas
      const despesaPerc = totalMercadoria > 0 ? invoiceTotal / totalMercadoria : 0;
      const despesaTotal = despesaPerc * despesaCusto;
      const despesaUnit = despesaTotal / qtd;

      // ICMS rateado
      const icmsPerc = totalMercadoria > 0 ? invoiceTotal / totalMercadoria : 0;
      const icmsTotal = icmsSt * icmsPerc;
      const icmsUnit = icmsTotal / qtd;

      // PIS/COFINS rateado
      const pisCofinsTotal = pisCofins * (totalMercadoria > 0 ? invoiceTotal / totalMercadoria : 0);
      const pisCofinsUnit = pisCofinsTotal / qtd;

      // Custo final
      const custoUnitReal = realUnit + despesaUnit + icmsUnit + pisCofinsUnit;
      const custoTotalReal = custoUnitReal * qtd;
      const custoUnitDolar = txEfetiva > 0 ? custoUnitReal / txEfetiva : 0;

      // Valores para NF
      const nfCifUnit = totalMercadoria > 0
        ? proformaUnit * ((thc + frete) / totalMercadoria + 1)
        : proformaUnit;
      const nfUnit = qtd > 0
        ? (nfCifUnit * taxaDolar * qtd + despesaTotal) / qtd
        : 0;
      const nfTotal = nfUnit * qtd;

      // 5. UPDATE item com campos calculados
      await client.query(`
        UPDATE db_manaus.dbent_importacao_it_ent SET
          real_unit = $2,
          real_total = $3,
          despesa_perc = $4,
          despesa_total = $5,
          despesa_unit = $6,
          icms_perc = $7,
          icms_total = $8,
          icms_unit = $9,
          pis_cofins_total = $10,
          custo_unit_real = $11,
          custo_total_real = $12,
          custo_unit_dolar = $13,
          tx_dolar_di = $14,
          tx_dolar_medio = $15,
          nf_unit = $16,
          nf_total = $17
        WHERE id = $1
      `, [
        item.id,
        realUnit, realTotal,
        despesaPerc, despesaTotal, despesaUnit,
        icmsPerc, icmsTotal, icmsUnit,
        pisCofinsTotal,
        custoUnitReal, custoTotalReal, custoUnitDolar,
        taxaDolar, txDolarMedio,
        nfUnit, nfTotal,
      ]);

      itensCalculados++;
    }

    await client.query('COMMIT');

    console.log(`[calcular-custos] DI #${id}: ${itensCalculados} itens calculados`);

    return res.status(200).json({
      success: true,
      message: `Custos calculados para ${itensCalculados} itens`,
      stats: {
        itens_calculados: itensCalculados,
        tx_dolar_medio: txDolarMedio,
        despesa_custo_total: despesaCusto,
      },
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[calcular-custos] Erro:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao calcular custos',
    });
  } finally {
    if (client) client.release();
  }
}
