/**
 * POST /api/importacao/:id/gerar-entradas
 * Gera registros em dbnfe_ent (mesma tabela das NFes) a partir da DI.
 * Cada fatura vira um registro na tela "Entrada por XML/NFe",
 * com associações pré-preenchidas, seguindo o mesmo fluxo das NFes.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';
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
      FROM db_manaus.dbent_importacao
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
      FROM db_manaus.dbnfe_ent
    `);
    let nextCodNfe = parseInt(maxResult.rows[0].next_id);

    // 3. Buscar faturas
    const faturasResult = await client.query(`
      SELECT id, cod_credor, fornecedor_nome, codent
      FROM db_manaus.dbent_importacao_entrada
      WHERE id_importacao = $1
      ORDER BY id
    `, [id]);

    if (faturasResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Nenhuma fatura encontrada na DI' });
    }

    const nfesCriadas: { faturaId: number; codnfe_ent: string; itensProcessados: number }[] = [];

    for (const fatura of faturasResult.rows) {
      if (fatura.codent) {
        console.log(`[gerar-entradas] Fatura ${fatura.id} já tem entrada: ${fatura.codent}, pulando`);
        continue;
      }

      // Buscar itens da fatura com custos calculados
      const itensResult = await client.query(`
        SELECT id, codprod, descricao, qtd, custo_unit_dolar, custo_unit_real,
               custo_total_real, id_orc, invoice_total
        FROM db_manaus.dbent_importacao_it_ent
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
        INSERT INTO db_manaus.dbnfe_ent (
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
        INSERT INTO db_manaus.dbnfe_ent_emit (
          codnfe_ent, cpf_cnpj, xnome
        ) VALUES ($1, $2, $3)
      `, [
        codnfe,
        fatura.cod_credor || '',
        (fatura.fornecedor_nome || '').substring(0, 60),
      ]);

      // 7. INSERT em dbnfe_ent_det (itens) + nfe_item_associacao + nfe_item_pedido_associacao
      let nitem = 1;
      for (const item of itensResult.rows) {
        const qtd = parseFloat(String(item.qtd || 0));
        const custoUnitReal = parseFloat(String(item.custo_unit_real || 0));
        const custoTotalReal = parseFloat(String(item.custo_total_real || 0));

        // dbnfe_ent_det (vuncom e vprod são integer - guardar em centavos como o sistema faz)
        await client.query(`
          INSERT INTO db_manaus.dbnfe_ent_det (
            codnfe_ent, nitem, cprod, xprod, qcom, vuncom, vprod
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          codnfe,
          String(nitem),
          item.codprod,
          (item.descricao || '').substring(0, 120),
          qtd,
          Math.round(custoUnitReal * 100),
          Math.round(custoTotalReal * 100),
        ]);

        // nfe_item_associacao (pré-preenchida com codprod da DI)
        const assocResult = await client.query(`
          INSERT INTO db_manaus.nfe_item_associacao (
            nfe_id, nfe_item_id, produto_cod, quantidade_associada,
            valor_unitario, preco_real, status, created_at, quantidade_nf, preco_unitario_nf
          ) VALUES ($1, $2, $3, $4, $5, $5, 'ASSOCIADO', NOW(), $4, $5)
          RETURNING id
        `, [
          codnfe,
          nitem,
          item.codprod,
          qtd,
          custoUnitReal,
        ]);

        const assocId = assocResult.rows[0].id;

        // nfe_item_pedido_associacao (vincular ao pedido se tiver id_orc)
        if (item.id_orc) {
          await client.query(`
            INSERT INTO db_manaus.nfe_item_pedido_associacao (
              nfe_associacao_id, nfe_id, req_id, quantidade, valor_unitario, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            assocId,
            codnfe,
            item.id_orc,
            qtd,
            custoUnitReal,
          ]);
        }

        nitem++;
      }

      // 8. UPDATE codent na fatura da DI (guarda o codnfe_ent)
      await client.query(`
        UPDATE db_manaus.dbent_importacao_entrada SET codent = $1 WHERE id = $2
      `, [codnfe, fatura.id]);

      nfesCriadas.push({ faturaId: fatura.id, codnfe_ent: codnfe, itensProcessados: itensResult.rows.length });
      console.log(`[gerar-entradas] NFe ${codnfe} criada para fatura ${fatura.id}: ${itensResult.rows.length} itens`);
    }

    if (nfesCriadas.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Nenhuma fatura elegível para gerar entrada' });
    }

    // 9. Atualizar itr_quantidade_atendida nos pedidos (igual fluxo nacional)
    // Buscar todas as associacoes com pedidos criadas nesta operacao
    const pedidosAssociados = new Map<string, number>(); // key: "orcId|codprod", value: qtd total

    for (const fatura of faturasResult.rows) {
      if (fatura.codent) continue; // ja tinha entrada antes

      const itensResult = await client.query(`
        SELECT codprod, qtd, id_orc
        FROM db_manaus.dbent_importacao_it_ent
        WHERE id_importacao = $1 AND id_fatura = $2 AND codprod IS NOT NULL AND id_orc IS NOT NULL
        ORDER BY id
      `, [id, fatura.id]);

      for (const item of itensResult.rows) {
        const key = `${item.id_orc}|${item.codprod}`;
        const qtdAtual = pedidosAssociados.get(key) || 0;
        pedidosAssociados.set(key, qtdAtual + parseFloat(String(item.qtd || 0)));
      }
    }

    if (pedidosAssociados.size > 0) {
      // Atualizar quantidade atendida para cada par OC/produto
      for (const [key, quantidade] of pedidosAssociados) {
        const [pedidoId, produtoCod] = key.split('|');
        await client.query(`
          UPDATE db_manaus.cmp_it_requisicao ri
          SET itr_quantidade_atendida = COALESCE(itr_quantidade_atendida, 0) + $1
          FROM db_manaus.cmp_ordem_compra o
          WHERE o.orc_id = $2
            AND ri.itr_req_id = o.orc_req_id
            AND ri.itr_req_versao = o.orc_req_versao
            AND ri.itr_codprod = $3
        `, [quantidade, pedidoId, produtoCod]);
      }

      // Auto-finalizar ordens totalmente atendidas
      const pedidosDistintos = new Set<string>();
      for (const key of pedidosAssociados.keys()) {
        pedidosDistintos.add(key.split('|')[0]);
      }

      for (const pedidoId of pedidosDistintos) {
        const ordemResult = await client.query(
          `SELECT orc_id, orc_req_id, orc_req_versao, orc_status
           FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1`,
          [pedidoId]
        );
        if (ordemResult.rows.length === 0 || ordemResult.rows[0].orc_status !== 'A') continue;

        const ordem = ordemResult.rows[0];
        const pendentesResult = await client.query(
          `SELECT COUNT(*) as count FROM db_manaus.cmp_it_requisicao
           WHERE itr_req_id = $1 AND itr_req_versao = $2
             AND (itr_quantidade - COALESCE(itr_quantidade_atendida, 0) - COALESCE(itr_quantidade_fechada, 0)) > 0`,
          [ordem.orc_req_id, ordem.orc_req_versao]
        );

        if (Number(pendentesResult.rows[0].count) === 0) {
          await client.query(
            `UPDATE db_manaus.cmp_ordem_compra SET orc_status = 'F' WHERE orc_id = $1`,
            [pedidoId]
          );
          await registrarHistoricoOrdem(client, {
            orcId: Number(pedidoId),
            previousStatus: 'A',
            newStatus: 'F',
            userId: 'SISTEMA',
            userName: 'Sistema (Importação DI)',
            reason: `Ordem fechada automaticamente - todos os itens atendidos via importação DI #${id}`,
            comments: {
              tipo: 'FINALIZACAO',
              motivo: 'auto_importacao_di',
              importacao_id: id
            }
          });
          console.log(`[gerar-entradas] Ordem ${pedidoId} fechada automaticamente`);
        }
      }

      console.log(`[gerar-entradas] ${pedidosAssociados.size} itens de pedido atualizados (itr_quantidade_atendida)`);
    }

    // 10. UPDATE status da DI para 'E' (Entrada Gerada)
    await client.query(`
      UPDATE db_manaus.dbent_importacao SET status = 'E', updated_at = NOW() WHERE id = $1
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
