/**
 * Custo do PRODUTO IMPORTADO no Confirmar Preço — espelho da procedure Oracle
 * MARIOIMPRCUSTO, chamada por ENTRADASEFAZ.Confirmar_Preco logo depois do custo/média
 * dos itens (só para entrada gerada por importação).
 *
 * Para cada item da DI (dbent_importacao_it_ent) desta entrada:
 *   taxa = tx_dolar_medio da DI + 0,10
 *   estoque livre = qtest - qtdreservada (a quantidade desta entrada ainda está reservada)
 *   txdolarcompra = média ponderada (taxa × qtd do item + txdolarcompra atual × estoque livre)
 *                   / (qtd + estoque livre); sem taxa anterior ou sem estoque livre → taxa
 *   txdolarcompramedio = o mesmo valor
 *   prcomprasemst      = nf_cif_unit (custo CIF da nota)
 *   margem_min_venda   = nf_cif_unit         } o Oracle guarda estes valores nesses
 *   margem_med_venda   = custo_unit_dolar    } campos de margem do produto importado
 *   margem_ide_venda   = taxa                } (fiel ao MARIOIMPRCUSTO)
 *   dbprod_custo.prtransferencia_liquido = nf_cif_unit
 * e reprecifica a venda com a taxa nova.
 *
 * Como no Oracle, um produto que aparece em mais de um item da DI é processado item a
 * item (a média vai acumulando).
 */
import type { PoolClient } from 'pg';
import { recalcularPrecosProduto } from '@/lib/calcularPrecos';

const TX_DOLAR_ADICIONAL = 0.1;
const r = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

export async function aplicarCustoImportacao(
  client: PoolClient,
  codent: string,
  schema = process.env.DB_SCHEMA || 'db_manaus',
): Promise<{ itens: number }> {
  const itens = (
    await client.query(
      `SELECT y.codprod, y.custo_unit_dolar, y.tx_dolar_medio, y.qtd, y.nf_cif_unit
         FROM dbent e
         JOIN dbent_importacao_entrada z ON z.codent = e.codent
         JOIN dbent_importacao_it_ent y ON y.id_importacao = z.id_importacao AND y.id_fatura = z.id
         JOIN dbitent it ON it.codent = e.codent AND it.codprod = y.codprod
         JOIN dbprod p ON p.codprod = y.codprod
         JOIN dbmarcas m ON m.codmarca = p.codmarca
        WHERE e.codent = $1
        ORDER BY y.id`,
      [codent],
    )
  ).rows;
  if (itens.length === 0) return { itens: 0 };

  const reprecificar = new Set<string>();
  for (const y of itens) {
    const qtd = Number(y.qtd) || 0;
    const taxa = (Number(y.tx_dolar_medio) || 0) + TX_DOLAR_ADICIONAL;
    const prod = (
      await client.query(`SELECT txdolarcompra, qtest, qtdreservada FROM dbprod WHERE codprod = $1`, [y.codprod])
    ).rows[0];
    if (!prod) continue;

    const txAtual = Number(prod.txdolarcompra) || 0;
    const livre = (Number(prod.qtest) || 0) - (Number(prod.qtdreservada) || 0);
    let txMedio = taxa;
    if (txAtual > 0 && livre > 0) {
      txMedio = (taxa * qtd + txAtual * livre) / (qtd + livre);
      if (!(txMedio > 0)) txMedio = taxa;
    }
    const cif = r(Number(y.nf_cif_unit) || 0, 2);

    await client.query(
      `UPDATE dbprod SET txdolarcompra = $2, txdolarcompramedio = $2,
              prcomprasemst = $3, margem_min_venda = $3,
              margem_med_venda = $4, margem_ide_venda = $5
        WHERE codprod = $1`,
      [y.codprod, r(txMedio, 6), cif, r(Number(y.custo_unit_dolar) || 0, 2), r(taxa, 6)],
    );
    await client.query(`UPDATE dbprod_custo SET prtransferencia_liquido = $2 WHERE codprod = $1`, [y.codprod, cif]);
    reprecificar.add(y.codprod);
  }

  // Preço de venda com a taxa nova (POLITICA_PRECO_VENDA.ATUALIZAR_PRECO_MARGEM no Oracle).
  for (const codprod of reprecificar) {
    const p = (await client.query(`SELECT prcompra FROM dbprod WHERE codprod = $1`, [codprod])).rows[0];
    try {
      await recalcularPrecosProduto(client, { codprod, prcompra: Number(p?.prcompra) || 0 }, schema);
    } catch (e: any) {
      console.error(`⚠️ reprecificação (importado) falhou p/ ${codprod}:`, e?.message || e);
    }
  }
  return { itens: itens.length };
}
