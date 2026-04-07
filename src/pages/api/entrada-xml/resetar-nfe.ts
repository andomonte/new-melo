import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { recalcularPrecosProduto } from '@/lib/calcularPrecos';

/**
 * ENDPOINT DE TESTE - Resetar NFe COMPLETO
 *
 * Remove TODOS os dados associados a uma NFe para permitir reprocessamento.
 * ATENÇÃO: Não usar em produção! Apenas para testes.
 *
 * Dados removidos/revertidos:
 * - Associações de itens (nfe_item_associacao, nfe_item_pedido_associacao)
 * - Entrada de estoque (entradas_estoque, entrada_itens, entrada_operacoes)
 * - Quantidade atendida nas OCs (cmp_it_requisicao.itr_quantidade_atendida)
 * - Estoque geral (dbprod.qtest, qtdreservada)
 * - Estoque por armazém (cad_armazem_produto.arp_qtest)
 * - Romaneio/Alocação (dbitent_armazem)
 * - Pagamentos (dbpgto, ordem_pagamento_conta, ordem_pagamento_parcelas)
 * - Configuração de pagamento NFe (dbnfe_ent.pagamento_configurado)
 * - Configuração de pagamento OCs (cmp_ordem_compra.orc_pagamento_configurado)
 * - Histórico (dbnfe_ent_historico)
 * - Status da NFe (dbnfe_ent.exec -> 'N')
 */

interface ResetarNfeResponse {
  success: boolean;
  message: string;
  dadosRemovidos?: {
    associacoes: number;
    associacoesPedidos: number;
    entradas: number;
    itensEntrada: number;
    operacoes: number;
    operacoesLog: number;
    romaneio: number;
    quantidadeAtendidaResetada: number;
    estoqueRevertido: number;
    estoqueArmazemRevertido: number;
    pagamentos: number;
    historico: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResetarNfeResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId } = req.body;

  if (!nfeId) {
    return res.status(400).json({
      error: 'NFE ID é obrigatório'
    });
  }

  console.log(`\n🔴 ===== RESETANDO NFe ${nfeId} (TESTE) =====`);
  console.log(`⚠️ ATENÇÃO: Esta operação remove TODOS os dados associados à NFe!`);

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Iniciar transação
    await client.query('BEGIN');

    // Verificar se NFe existe
    const nfeResult = await client.query(`
      SELECT codnfe_ent, nnf as numero_nf, exec as status
      FROM dbnfe_ent
      WHERE codnfe_ent = $1
    `, [nfeId]);

    if (nfeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'NFe não encontrada'
      });
    }

    const nfe = nfeResult.rows[0];
    console.log(`📄 NFe encontrada: NF ${nfe.numero_nf}, Status: ${nfe.status}`);

    const dadosRemovidos = {
      associacoes: 0,
      associacoesPedidos: 0,
      entradas: 0,
      itensEntrada: 0,
      operacoes: 0,
      operacoesLog: 0,
      romaneio: 0,
      quantidadeAtendidaResetada: 0,
      estoqueRevertido: 0,
      estoqueArmazemRevertido: 0,
      pagamentos: 0,
      historico: 0
    };

    // 1. Buscar entradas geradas para esta NFe
    const entradasResult = await client.query(`
      SELECT id, numero_entrada
      FROM entradas_estoque
      WHERE nfe_id = $1
    `, [nfeId]);

    const entradaIds = entradasResult.rows.map(e => e.id);
    console.log(`📦 Entradas encontradas: ${entradaIds.length}`);

    // 2. Buscar itens das entradas para reverter estoque e quantidade atendida
    const numerosEntrada = entradasResult.rows.map(e => e.numero_entrada);

    if (entradaIds.length > 0) {
      const itensEntradaResult = await client.query(`
        SELECT ei.produto_cod, ei.quantidade, ei.req_id, ei.valor_unitario
        FROM entrada_itens ei
        WHERE ei.entrada_id = ANY($1)
      `, [entradaIds]);

      // 2.1 Reverter custo medio e estoque (dbprod)
      // Agrupar quantidades por produto (pode ter o mesmo produto em mais de uma linha)
      const produtoQtdMap = new Map<string, number>();
      for (const item of itensEntradaResult.rows) {
        const qtd = parseFloat(item.quantidade) || 0;
        produtoQtdMap.set(item.produto_cod, (produtoQtdMap.get(item.produto_cod) || 0) + qtd);
      }

      for (const [produtoCod, qtdEntradaTotal] of produtoQtdMap) {
        // Buscar dados atuais do produto
        const prodResult = await client.query(`
          SELECT qtest, prcustoatual, prcompra, dolar, txdolarcompra
          FROM dbprod WHERE codprod = $1
        `, [produtoCod]);

        if (prodResult.rows.length > 0) {
          const prod = prodResult.rows[0];
          const estoqueAtual = parseFloat(prod.qtest || 0);
          const custoAtual = parseFloat(prod.prcustoatual || 0);

          // Buscar custo de entrada para este produto (media ponderada se repetido)
          const itensDesteProd = itensEntradaResult.rows.filter(i => i.produto_cod === produtoCod);
          let custoEntradaPonderado = 0;
          let qtdTotal = 0;
          for (const it of itensDesteProd) {
            const q = parseFloat(it.quantidade) || 0;
            const v = parseFloat(it.valor_unitario) || 0;
            custoEntradaPonderado += q * v;
            qtdTotal += q;
          }
          custoEntradaPonderado = qtdTotal > 0 ? custoEntradaPonderado / qtdTotal : 0;

          // Reverter custo medio: custoAnterior = (custoAtual * estoqueAtual - qtdEntrada * custoEntrada) / (estoqueAtual - qtdEntrada)
          const estoqueAnterior = estoqueAtual - qtdEntradaTotal;
          let custoAnterior = custoAtual;
          if (estoqueAnterior > 0) {
            custoAnterior = (custoAtual * estoqueAtual - qtdEntradaTotal * custoEntradaPonderado) / estoqueAnterior;
            if (custoAnterior < 0) custoAnterior = 0;
          }

          console.log(`Revertendo custo produto ${produtoCod}: ${custoAtual.toFixed(2)} -> ${custoAnterior.toFixed(2)}`);

          // Atualizar custo e estoque
          await client.query(`
            UPDATE dbprod
            SET prcustoatual = $1,
                qtest = GREATEST(COALESCE(qtest, 0) - $2, 0),
                qtdreservada = GREATEST(COALESCE(qtdreservada, 0) - $2, 0)
            WHERE codprod = $3
          `, [custoAnterior, qtdEntradaTotal, produtoCod]);

          // Recalcular precos de venda com o custo revertido
          await recalcularPrecosProduto(client, {
            codprod: produtoCod,
            prcustoatual: custoAnterior,
            prcompra: parseFloat(prod.prcompra || 0),
            dolar: prod.dolar || 'N',
            txdolarcompra: parseFloat(prod.txdolarcompra || 0),
          });

          dadosRemovidos.estoqueRevertido++;
        }
      }
      console.log(`Estoque e custo revertidos para ${dadosRemovidos.estoqueRevertido} produtos`);

      // 2.2 Reverter quantidade atendida nas OCs
      for (const item of itensEntradaResult.rows) {
        if (item.req_id) {
          const quantidade = parseFloat(item.quantidade) || 0;
          // Buscar qual OC está associada a esta requisição
          const ocResult = await client.query(`
            UPDATE cmp_it_requisicao ri
            SET itr_quantidade_atendida = GREATEST(COALESCE(itr_quantidade_atendida, 0) - $1, 0)
            FROM cmp_ordem_compra o
            WHERE o.orc_id = $2
              AND ri.itr_req_id = o.orc_req_id
              AND ri.itr_req_versao = o.orc_req_versao
              AND ri.itr_codprod = $3
          `, [quantidade, item.req_id, item.produto_cod]);

          if (ocResult.rowCount && ocResult.rowCount > 0) {
            dadosRemovidos.quantidadeAtendidaResetada++;
          }
        }
      }
      console.log(`📋 Quantidade atendida resetada em ${dadosRemovidos.quantidadeAtendidaResetada} itens de OC`);

      // 2.3 Reverter estoque por armazém (cad_armazem_produto) e deletar romaneio (dbitent_armazem)
      if (numerosEntrada.length > 0) {
        // Primeiro, buscar as alocações para reverter o estoque por armazém
        const alocacoesResult = await client.query(`
          SELECT da.codprod, da.arm_id, da.qtd
          FROM dbitent_armazem da
          WHERE da.codent = ANY($1)
        `, [numerosEntrada]);

        // Reverter estoque em cad_armazem_produto
        for (const aloc of alocacoesResult.rows) {
          const quantidade = parseFloat(aloc.qtd) || 0;
          if (quantidade > 0 && aloc.arm_id) {
            await client.query(`
              UPDATE cad_armazem_produto
              SET arp_qtest = GREATEST(COALESCE(arp_qtest, 0) - $1, 0)
              WHERE arp_arm_id = $2 AND arp_codprod = $3
            `, [quantidade, aloc.arm_id, aloc.codprod]);
            dadosRemovidos.estoqueArmazemRevertido++;
          }
        }
        console.log(`📦 Estoque por armazém revertido: ${dadosRemovidos.estoqueArmazemRevertido} registros`);

        // Agora deletar o romaneio
        const romaneioResult = await client.query(`
          DELETE FROM dbitent_armazem
          WHERE codent = ANY($1)
        `, [numerosEntrada]);
        dadosRemovidos.romaneio = romaneioResult.rowCount || 0;
        console.log(`🗑️ Romaneio removido: ${dadosRemovidos.romaneio} registros`);
      }

      // 2.4 Deletar log de operações de entrada
      const logResult = await client.query(`
        DELETE FROM entrada_operacoes_log
        WHERE entrada_id = ANY($1)
      `, [entradaIds]);
      dadosRemovidos.operacoesLog = logResult.rowCount || 0;
      console.log(`🗑️ Log de operações removido: ${dadosRemovidos.operacoesLog} registros`);

      // 2.5 Deletar operações de entrada
      const opResult = await client.query(`
        DELETE FROM entrada_operacoes
        WHERE entrada_id = ANY($1)
      `, [entradaIds]);
      dadosRemovidos.operacoes = opResult.rowCount || 0;
      console.log(`🗑️ Operações removidas: ${dadosRemovidos.operacoes}`);

      // 2.6 Deletar itens de entrada
      const itResult = await client.query(`
        DELETE FROM entrada_itens
        WHERE entrada_id = ANY($1)
      `, [entradaIds]);
      dadosRemovidos.itensEntrada = itResult.rowCount || 0;
      console.log(`🗑️ Itens de entrada removidos: ${dadosRemovidos.itensEntrada}`);

      // 2.7 Deletar entradas
      const entResult = await client.query(`
        DELETE FROM entradas_estoque
        WHERE id = ANY($1)
      `, [entradaIds]);
      dadosRemovidos.entradas = entResult.rowCount || 0;
      console.log(`🗑️ Entradas removidas: ${dadosRemovidos.entradas}`);
    }

    // 3. Deletar pagamentos associados à NFe (via ordens de compra)
    // Primeiro, buscar as ordens associadas
    const ordensResult = await client.query(`
      SELECT DISTINCT req_id as orc_id
      FROM nfe_item_pedido_associacao
      WHERE nfe_id = $1
    `, [nfeId]);

    const orcIds = ordensResult.rows.map(r => r.orc_id);
    console.log(`📦 Ordens associadas à NFe: ${orcIds.join(', ') || 'nenhuma'}`);

    if (orcIds.length > 0) {
      const placeholders = orcIds.map((_, i) => `$${i + 1}`).join(', ');

      // Buscar cod_pgto das parcelas (exceto parcela 0 = antecipado)
      const pgtoResult = await client.query(`
        SELECT cod_pgto FROM ordem_pagamento_conta
        WHERE orc_id IN (${placeholders}) AND numero_parcela > 0
      `, orcIds);

      const codPgtos = pgtoResult.rows.map(r => r.cod_pgto);

      if (codPgtos.length > 0) {
        const pgtoPlaceholders = codPgtos.map((_, i) => `$${i + 1}`).join(', ');

        // Deletar de dbpgto
        await client.query(`DELETE FROM dbpgto WHERE cod_pgto IN (${pgtoPlaceholders})`, codPgtos);
        dadosRemovidos.pagamentos = codPgtos.length;
      }

      // Deletar de ordem_pagamento_conta (exceto parcela 0)
      await client.query(`
        DELETE FROM ordem_pagamento_conta WHERE orc_id IN (${placeholders}) AND numero_parcela > 0
      `, orcIds);

      // Deletar de ordem_pagamento_parcelas (exceto parcela 0)
      await client.query(`
        DELETE FROM ordem_pagamento_parcelas WHERE orc_id IN (${placeholders}) AND numero_parcela > 0
      `, orcIds);
    }

    console.log(`💰 Pagamentos removidos: ${dadosRemovidos.pagamentos}`);

    // 4. Deletar associações de pedidos
    const assocPedResult = await client.query(`
      DELETE FROM nfe_item_pedido_associacao
      WHERE nfe_id = $1
    `, [nfeId]);
    dadosRemovidos.associacoesPedidos = assocPedResult.rowCount || 0;
    console.log(`🔗 Associações de pedidos removidas: ${dadosRemovidos.associacoesPedidos}`);

    // 5. Deletar associações de itens
    const assocResult = await client.query(`
      DELETE FROM nfe_item_associacao
      WHERE nfe_id = $1
    `, [nfeId]);
    dadosRemovidos.associacoes = assocResult.rowCount || 0;
    console.log(`🔗 Associações de itens removidas: ${dadosRemovidos.associacoes}`);

    // 6. Deletar histórico
    const histResult = await client.query(`
      DELETE FROM dbnfe_ent_historico
      WHERE codnfe_ent = $1
    `, [nfeId]);
    dadosRemovidos.historico = histResult.rowCount || 0;
    console.log(`📜 Histórico removido: ${dadosRemovidos.historico} registros`);

    // 7. Progresso é salvo nas tabelas de associação (já foram deletadas acima)
    // Não existe tabela separada de progresso
    console.log(`💾 Progresso removido junto com as associações`);

    // 8. Resetar flag de pagamento configurado nas ordens de compra associadas
    if (orcIds.length > 0) {
      const placeholders = orcIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`
        UPDATE cmp_ordem_compra
        SET orc_pagamento_configurado = false,
            orc_banco = NULL,
            orc_tipo_documento = NULL
        WHERE orc_id IN (${placeholders})
      `, orcIds);
      console.log(`💳 Flag de pagamento resetada em ${orcIds.length} ordem(ns) de compra`);
    }

    // 9. Resetar status e flag de pagamento da NFe para 'N' (Recebida/Nova)
    await client.query(`
      UPDATE dbnfe_ent
      SET exec = 'N',
          pagamento_configurado = false
      WHERE codnfe_ent = $1
    `, [nfeId]);
    console.log(`✅ Status da NFe resetado para 'N' (Recebida) e pagamento_configurado = false`);

    // Commit da transação
    await client.query('COMMIT');

    console.log(`\n✅ NFe ${nfeId} resetada com sucesso!`);
    console.log(`📊 Resumo:`, dadosRemovidos);

    return res.status(200).json({
      success: true,
      message: `NFe ${nfe.numero_nf} resetada com sucesso! Todos os dados foram removidos.`,
      dadosRemovidos
    });

  } catch (error: any) {
    console.error('❌ Erro ao resetar NFe:', error);

    if (client) {
      await client.query('ROLLBACK');
    }

    return res.status(500).json({
      error: `Erro ao resetar NFe: ${error.message}`
    });

  } finally {
    if (client) {
      client.release();
    }
  }
}
