/**
 * POST /api/importacao/:id/calcular-custos
 * Calcula custos por item da DI (replica lógica Oracle ENTRADA_IMPORTACAO.ATUALIZAR_CUSTO)
 * Distribui despesas da DI proporcionalmente por item.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';

const round2 = (n: number) => Math.round(n * 100) / 100;

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
      SELECT * FROM dbent_importacao WHERE id = $1 FOR UPDATE
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
    const totalCif = parseFloat(String(cab.total_cif || 0));
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

    // 2. Calcular TxDolarMedio dos contratos = Σ(valor em R$) / Σ(valor em US$).
    // Tudo convertido para dólar (contratos podem estar em EUR/CNY): usa vl_reais e
    // vl_usd já calculados na aba Contratos. Para 100% USD, equivale a
    // Σ(taxa×vl_merc)/Σ(vl_merc) — o mesmo do Oracle ATUALIZAR_CUSTO.
    const contratosResult = await client.query(`
      SELECT taxa_dolar, vl_merc_dolar, vl_reais, vl_usd, taxa_usd, moeda
      FROM dbent_importacao_contratos
      WHERE id_importacao = $1
    `, [id]);

    let txDolarMedio = taxaDolar; // fallback se não houver contratos
    if (contratosResult.rows.length > 0) {
      let sumReais = 0;
      let sumUsd = 0;
      for (const c of contratosResult.rows) {
        const moeda = (c.moeda || 'USD').toUpperCase();
        const valor = parseFloat(String(c.vl_merc_dolar || 0));
        const taxaCambio = parseFloat(String(c.taxa_dolar || 0));
        const taxaUsd = c.taxa_usd != null ? parseFloat(String(c.taxa_usd)) : 0;
        const reais = c.vl_reais != null ? parseFloat(String(c.vl_reais)) : valor * taxaCambio;
        let usd: number | null = c.vl_usd != null ? parseFloat(String(c.vl_usd)) : null;
        if (usd == null) {
          usd = moeda === 'USD' ? valor : (taxaUsd > 0 ? reais / taxaUsd : null);
        }
        if (usd != null && usd > 0) {
          sumReais += reais;
          sumUsd += usd;
        }
      }
      if (sumUsd > 0) {
        txDolarMedio = sumReais / sumUsd;
      }
    }

    // 3. Despesas rateáveis.
    // Custo: todas as despesas EXCETO ICMS-ST (o ICMS-ST entra por item via icmsUnit).
    const despesaCusto = pisCofins + ii + ipi + anuencia + siscomex
      + round2(taxaDolar * contratoCambio)
      + despachante + freteorigemTotal + infraeroPorto
      + carreteiroEadi + carreteiroMelo + eadi;

    // NF (nota): inclui ICMS-ST e NÃO inclui Frete de Origem (igual Oracle vDESPESA_NOTA).
    const despesaNota = pisCofins + ii + ipi + icmsSt + anuencia + siscomex
      + round2(taxaDolar * contratoCambio)
      + despachante + infraeroPorto
      + carreteiroEadi + carreteiroMelo + eadi;

    // Banda "Imposto" (nível cabeçalho, 1× por DI — fiel ao Oracle ATUALIZAR_CUSTO):
    //   imp_perc      = ((THC + frete) / Total_Mercadoria) + 1   (fator de gross-up do CIF)
    //   imp_icms_perc = Icms_St / round(Total_Cif × Taxa_Dolar, 2)
    const impPerc = totalMercadoria > 0 ? (thc + frete) / totalMercadoria + 1 : 1;
    const baseIcmsImp = round2(totalCif * taxaDolar);
    const impIcmsPerc = baseIcmsImp > 0 ? icmsSt / baseIcmsImp : 0;

    console.log(`[calcular-custos] DI #${id}: TxDolarMedio=${txDolarMedio.toFixed(4)}, DespesaCusto=${despesaCusto.toFixed(2)}, DespesaNota=${despesaNota.toFixed(2)}, ImpPerc=${impPerc.toFixed(6)}, ImpIcmsPerc=${impIcmsPerc.toFixed(6)}`);

    // 4. Buscar itens com codprod
    const itensResult = await client.query(`
      SELECT id, codprod, qtd, proforma_unit, proforma_total, invoice_unit, invoice_total, id_fatura
      FROM dbent_importacao_it_ent
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

      // PIS/COFINS já está dentro de DespesaCusto (não soma de novo — igual Oracle, que
      // mantém PIS_COFINS_UNIT = 0 para não duplicar).
      const pisCofinsTotal = 0;
      const pisCofinsUnit = 0;

      // Custo final (REAL_UNIT + rateio de despesa de custo + ICMS-ST rateado)
      const custoUnitReal = realUnit + despesaUnit + icmsUnit + pisCofinsUnit;
      const custoTotalReal = custoUnitReal * qtd;
      const custoUnitDolar = txEfetiva > 0 ? custoUnitReal / txEfetiva : 0;

      // Banda "Imposto" por item (conferência fiscal do CIF — Oracle ATUALIZAR_CUSTO):
      //   imp_cif_unit  = invoice_total × imp_perc  (⚠ usa invoice_TOTAL da linha; US$)
      //   imp_cif_total = imp_cif_unit × taxa_dolar (R$)
      //   imp_icms_*    = sobre o CIF em R$
      const impCifUnit = invoiceTotal * impPerc;
      const impCifTotal = impCifUnit * taxaDolar;
      const impIcmsTotal = impCifTotal * impIcmsPerc;
      const impIcmsUnit = impIcmsTotal / qtd;

      // PIS/COFINS: perc = icms_perc; total/unit = 0 (já entra em despesaCusto — igual Oracle).
      const pisCofinsPerc = icmsPerc;

      // Banda "Nota de Entrada" (detalhe): base = PROFORMA grossada p/ CIF × taxa DÓLAR
      // DA DI, mais o rateio da DESPESA DA NOTA (com ICMS-ST, sem Frete de Origem).
      const nfCifUnit = proformaUnit * impPerc;
      const nfCifTotal = qtd * nfCifUnit;
      const nfRealUnit = nfCifUnit * taxaDolar;
      const nfRealTotal = qtd * nfRealUnit;
      const nfDespTotal = despesaPerc * despesaNota;
      const nfDespUnit = nfDespTotal / qtd;
      const nfTotal = nfRealTotal + nfDespTotal;
      const nfUnit = qtd > 0 ? nfTotal / qtd : 0;

      // 5. UPDATE item com campos calculados
      await client.query(`
        UPDATE dbent_importacao_it_ent SET
          real_unit = $2,
          real_total = $3,
          despesa_perc = $4,
          despesa_total = $5,
          despesa_unit = $6,
          icms_perc = $7,
          icms_total = $8,
          icms_unit = $9,
          pis_cofins_perc = $10,
          pis_cofins_total = $11,
          pis_cofins_unit = $12,
          custo_unit_real = $13,
          custo_total_real = $14,
          custo_unit_dolar = $15,
          tx_dolar_di = $16,
          tx_dolar_medio = $17,
          imp_perc = $18,
          imp_cif_unit = $19,
          imp_cif_total = $20,
          imp_icms_perc = $21,
          imp_icms_total = $22,
          imp_icms_unit = $23,
          nf_cif_unit = $24,
          nf_cif_total = $25,
          nf_real_unit = $26,
          nf_real_total = $27,
          nf_desp_unit = $28,
          nf_desp_total = $29,
          nf_unit = $30,
          nf_total = $31
        WHERE id = $1
      `, [
        item.id,
        realUnit, realTotal,
        despesaPerc, despesaTotal, despesaUnit,
        icmsPerc, icmsTotal, icmsUnit,
        pisCofinsPerc, pisCofinsTotal, pisCofinsUnit,
        custoUnitReal, custoTotalReal, custoUnitDolar,
        taxaDolar, txDolarMedio,
        impPerc, impCifUnit, impCifTotal, impIcmsPerc, impIcmsTotal, impIcmsUnit,
        nfCifUnit, nfCifTotal, nfRealUnit, nfRealTotal, nfDespUnit, nfDespTotal,
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
