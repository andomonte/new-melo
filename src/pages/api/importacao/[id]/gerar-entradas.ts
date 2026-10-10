/**
 * POST /api/importacao/:id/gerar-entradas
 * Gera registros em dbnfe_ent (mesma tabela das NFes) a partir da DI.
 * Cada fatura vira um registro na tela "Entrada por XML/NFe",
 * com associações pré-preenchidas, seguindo o mesmo fluxo das NFes.
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

    // 1. Validar DI status='N'
    const cabResult = await client.query(`
      SELECT id, nro_di, status
      FROM dbent_importacao
      WHERE id = $1
      FOR UPDATE
    `, [id]);

    if (cabResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Importação #${id} não encontrada` });
    }

    const cab = cabResult.rows[0];

    if (cab.status !== 'N') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Importação não pode gerar entradas (status: ${cab.status})` });
    }

    // 2. Buscar próximo codnfe_ent
    const maxResult = await client.query(`
      SELECT COALESCE(MAX(codnfe_ent::int), 0) + 1 as next_id
      FROM dbnfe_ent
    `);
    let nextCodNfe = parseInt(maxResult.rows[0].next_id);

    // 3. Buscar faturas
    const faturasResult = await client.query(`
      SELECT id, cod_credor, fornecedor_nome, codent
      FROM dbent_importacao_entrada
      WHERE id_importacao = $1
      ORDER BY id
    `, [id]);

    if (faturasResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Nenhuma fatura encontrada na DI' });
    }

    const nfesCriadas: { faturaId: number; codnfe_ent: string; itensProcessados: number }[] = [];

    // Produto importado (Delphi ENTRADA_IMPORTACAO / doc COMPRAS_INTERNACIONAIS_LEGADO):
    // o dbprod guarda prcompra em DÓLAR (CUSTO_UNIT_DOLAR), dolar='S' e
    // txdolarcompra = taxa usada (tx_dolar_medio + 0.10); o custo real em BRL é
    // prcompra*txdolarcompra. Então a base de custo da entrada é o custo em USD, e
    // ao final marcamos dolar/txdolarcompra nos produtos desta DI.
    const codprodsImport = new Set<string>();
    let txEfetiva = 0;

    for (const fatura of faturasResult.rows) {
      if (fatura.codent) {
        console.log(`[gerar-entradas] Fatura ${fatura.id} já tem entrada: ${fatura.codent}, pulando`);
        continue;
      }

      // Buscar itens da fatura com custos calculados
      const itensResult = await client.query(`
        SELECT id, codprod, descricao, qtd, custo_unit_dolar, custo_unit_real,
               custo_total_real, id_orc, invoice_total, tx_dolar_medio
        FROM dbent_importacao_it_ent
        WHERE id_importacao = $1 AND id_fatura = $2 AND codprod IS NOT NULL
        ORDER BY id
      `, [id, fatura.id]);

      if (itensResult.rows.length === 0) continue;

      // Validar custos calculados
      const semCusto = itensResult.rows.filter(i => !i.custo_unit_dolar);
      if (semCusto.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Fatura ${fatura.id} tem ${semCusto.length} item(ns) sem custo calculado. Execute "Calcular Custos" primeiro.`,
        });
      }

      // 4. Gerar codnfe_ent (varchar 9, sequencial)
      const codnfe = String(nextCodNfe).padStart(9, '0').slice(-9);
      nextCodNfe++;

      // Gerar chave fake para importação (prefixo IMP, 44 chars para compatibilidade)
      const chaveImp = `IMP${String(id).padStart(6, '0')}${String(fatura.id).padStart(6, '0')}${Date.now().toString().slice(-29).padStart(29, '0')}`;

      // Calcular valor total
      let valorTotal = 0;
      for (const item of itensResult.rows) {
        valorTotal += parseFloat(String(item.custo_total_real || 0));
      }

      // 5. INSERT em dbnfe_ent
      await client.query(`
        INSERT INTO dbnfe_ent (
          codnfe_ent, chave, nnf, serie, demi, dtimport, vnf, vprod,
          exec, natop, infcpl, xnemp
        ) VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4, $4,
          'C', 'ENTRADA_IMPORTACAO', $5, $6)
      `, [
        codnfe,
        chaveImp,
        fatura.id, // nnf = id da fatura
        valorTotal,
        `IMPORTACAO:${id}:${fatura.id}`, // metadata para gerar-por-chave
        (fatura.fornecedor_nome || '').substring(0, 30),
      ]);

      // 6. INSERT em dbnfe_ent_emit (emitente = fornecedor)
      await client.query(`
        INSERT INTO dbnfe_ent_emit (
          codnfe_ent, cpf_cnpj, xnome
        ) VALUES ($1, $2, $3)
      `, [
        codnfe,
        fatura.cod_credor || '',
        (fatura.fornecedor_nome || '').substring(0, 60),
      ]);

      // 7. Agrega itens por (codprod, id_orc) antes de gravar.
      //    Uma DI pode ter o MESMO produto em várias adições; o dbitent tem PK
      //    (codent, codprod, codreq), então linhas repetidas precisam virar UMA
      //    (soma qtd, custo ponderado), senão a geração da entrada estoura a PK.
      //    vuncom/vprod gravados em VALOR REAL (numeric) — NÃO em centavos: o motor
      //    de custo usa dbnfe_ent_det.vuncom direto como prunit (igual ao nacional,
      //    onde vuncom é o preço real do XML).
      //    Base de custo = CUSTO EM DÓLAR (prcompra do importado é em USD). O valor
      //    real em BRL vem depois por prcompra*txdolarcompra.
      const grupos = new Map<string, { codprod: string; descricao: string; idOrc: number | null; qtd: number; total: number }>();
      for (const item of itensResult.rows) {
        const qtd = parseFloat(String(item.qtd || 0));
        const total = parseFloat(String(item.custo_unit_dolar || 0)) * qtd; // custo em USD
        const idOrc = item.id_orc ? Number(item.id_orc) : null;
        const key = `${item.codprod}|${idOrc ?? 0}`;
        const g = grupos.get(key);
        if (g) {
          g.qtd += qtd;
          g.total += total;
        } else {
          grupos.set(key, { codprod: item.codprod, descricao: item.descricao || '', idOrc, qtd, total });
        }
        // produto importado: coleta p/ marcar dolar='S' + txdolarcompra no final
        codprodsImport.add(item.codprod);
        if (!txEfetiva && item.tx_dolar_medio) txEfetiva = parseFloat(String(item.tx_dolar_medio)) + 0.10;
      }

      let nitem = 1;
      for (const g of grupos.values()) {
        const custoUnitUsd = g.qtd > 0 ? g.total / g.qtd : 0;

        await client.query(`
          INSERT INTO dbnfe_ent_det (
            codnfe_ent, nitem, cprod, xprod, qcom, vuncom, vprod
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          codnfe,
          String(nitem),
          g.codprod,
          g.descricao.substring(0, 120),
          g.qtd,
          custoUnitUsd,
          g.total,
        ]);

        // nfe_item_associacao (pré-preenchida com codprod da DI)
        const assocResult = await client.query(`
          INSERT INTO nfe_item_associacao (
            nfe_id, nfe_item_id, produto_cod, quantidade_associada,
            valor_unitario, preco_real, status, created_at, quantidade_nf, preco_unitario_nf
          ) VALUES ($1, $2, $3, $4, $5, $5, 'ASSOCIADO', NOW(), $4, $5)
          RETURNING id
        `, [
          codnfe,
          nitem,
          g.codprod,
          g.qtd,
          custoUnitUsd,
        ]);

        const assocId = assocResult.rows[0].id;

        // nfe_item_pedido_associacao (vincular ao pedido se tiver id_orc)
        if (g.idOrc) {
          await client.query(`
            INSERT INTO nfe_item_pedido_associacao (
              nfe_associacao_id, nfe_id, req_id, quantidade, valor_unitario, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            assocId,
            codnfe,
            g.idOrc,
            g.qtd,
            custoUnitUsd,
          ]);
        }

        nitem++;
      }

      // 8. UPDATE codent na fatura da DI (guarda o codnfe_ent)
      await client.query(`
        UPDATE dbent_importacao_entrada SET codent = $1 WHERE id = $2
      `, [codnfe, fatura.id]);

      nfesCriadas.push({ faturaId: fatura.id, codnfe_ent: codnfe, itensProcessados: itensResult.rows.length });
      console.log(`[gerar-entradas] NFe ${codnfe} criada para fatura ${fatura.id}: ${itensResult.rows.length} itens`);
    }

    if (nfesCriadas.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Nenhuma fatura elegível para gerar entrada' });
    }

    // 9. (itr_quantidade_atendida + auto-finalização de ordens) — NÃO é feito aqui.
    //    Este endpoint só cria o STAGING (dbnfe_ent). Atualizar a quantidade
    //    atendida do pedido neste ponto fazia a contagem em DOBRO: o
    //    `entradas/gerar-por-chave` (que cria o dbent de fato) revalidava o saldo
    //    do pedido já reduzido e barrava com "quantidade insuficiente". A
    //    atualização/finalização passou a ser feita só lá, por fatura, no momento
    //    em que a entrada é realmente gerada (igual ao fluxo nacional).

    // 9b. Produto importado: marca dolar='S' e grava a taxa usada (tx_dolar_medio+0.10).
    //     Assim a média (confirmar-preço) pondera prcompra em USD×USD e o custo real
    //     volta por prcompra*txdolarcompra — fiel ao Delphi ENTRADA_IMPORTACAO.
    if (codprodsImport.size > 0 && txEfetiva > 0) {
      await client.query(`
        UPDATE dbprod SET txdolarcompra = $1, dolar = 'S' WHERE codprod = ANY($2)
      `, [txEfetiva, Array.from(codprodsImport)]);
      console.log(`[gerar-entradas] ${codprodsImport.size} produto(s) marcados dolar='S' txdolarcompra=${txEfetiva}`);
    }

    // 10. UPDATE status da DI para 'E' (Entrada Gerada)
    await client.query(`
      UPDATE dbent_importacao SET status = 'E', updated_at = NOW() WHERE id = $1
    `, [id]);

    await client.query('COMMIT');

    const totalItens = nfesCriadas.reduce((s, n) => s + n.itensProcessados, 0);
    console.log(`[gerar-entradas] DI #${id}: ${nfesCriadas.length} NFes criadas na tela de Entrada XML (${totalItens} itens)`);

    return res.status(200).json({
      success: true,
      message: `${nfesCriadas.length} entrada(s) criada(s) na tela de Entrada por XML/NFe. Processe-as para gerar as entradas de estoque.`,
      nfes: nfesCriadas,
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('[gerar-entradas] Erro:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao gerar entradas',
    });
  } finally {
    if (client) client.release();
  }
}
