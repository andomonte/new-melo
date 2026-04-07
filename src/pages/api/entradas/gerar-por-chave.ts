import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

/**
 * POST /api/entradas/gerar-por-chave
 *
 * Gera a entrada de estoque a partir da chave de acesso da NFe (44 dígitos).
 * A NFe precisa estar processada (exec='S') e não pode ter entrada já gerada.
 *
 * Lê as associações salvas em nfe_item_associacao / nfe_item_pedido_associacao
 * e cria: entradas_estoque, entrada_itens, entrada_operacoes,
 * atualiza estoque (dbprod), atualiza pedidos (itr_quantidade_atendida),
 * auto-finaliza ordens totalmente atendidas.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { chaveNFe } = req.body;

  if (!chaveNFe) {
    return res.status(400).json({
      error: 'Chave de acesso da NFe é obrigatória.'
    });
  }

  // Suportar chaves de importação (prefixo IMP) e NFe normal (44 dígitos)
  const isImportacao = chaveNFe.startsWith('IMP');
  const chaveLimpa = isImportacao ? chaveNFe : chaveNFe.replace(/\D/g, '');

  if (!isImportacao && chaveLimpa.length !== 44) {
    return res.status(400).json({
      error: 'Chave de acesso da NFe inválida. Deve conter 44 dígitos.'
    });
  }
  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Buscar NFe pela chave de acesso
    const nfeResult = await client.query(`
      SELECT codnfe_ent, exec as status, nnf as numero_nf, chave, natop, infcpl
      FROM db_manaus.dbnfe_ent
      WHERE chave = $1
      FOR UPDATE NOWAIT
    `, [chaveLimpa]);

    if (nfeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'NFe não encontrada com esta chave de acesso.'
      });
    }

    const nfe = nfeResult.rows[0];
    const nfeId = nfe.codnfe_ent;

    // 2. Validar que a NFe está processada
    if (nfe.status !== 'S') {
      await client.query('ROLLBACK');
      const statusLabel = nfe.status === 'A' ? 'em andamento' : nfe.status === 'N' || nfe.status === 'R' ? 'não processada' : nfe.status;
      return res.status(400).json({
        error: `Esta NFe está ${statusLabel}. Processe a NFe primeiro na tela de Entrada XML.`
      });
    }

    // 3. Validar que não existe entrada já gerada para esta NFe
    const entradaExistente = await client.query(`
      SELECT id, numero_entrada FROM db_manaus.entradas_estoque
      WHERE nfe_id = $1
    `, [nfeId]);

    if (entradaExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Já existe entrada gerada para esta NFe: ${entradaExistente.rows[0].numero_entrada}`
      });
    }

    // 4. Buscar associações salvas
    const associacoesQuery = await client.query(`
      SELECT
        nia.produto_cod,
        nia.quantidade_associada,
        nia.valor_unitario,
        nia.meia_nota,
        nia.preco_unitario_nf,
        nia.preco_real,
        ARRAY_AGG(
          json_build_object(
            'pedidoId', nipa.req_id,
            'quantidade', nipa.quantidade,
            'valorUnitario', nipa.valor_unitario
          )
        ) as associacoes
      FROM db_manaus.nfe_item_associacao nia
      LEFT JOIN db_manaus.nfe_item_pedido_associacao nipa ON nia.id = nipa.nfe_associacao_id
      WHERE nia.nfe_id = $1 AND nia.status != 'ASSOCIADO_TESTE'
      GROUP BY nia.id, nia.produto_cod, nia.quantidade_associada, nia.valor_unitario,
               nia.meia_nota, nia.preco_unitario_nf, nia.preco_real
    `, [nfeId]);

    if (associacoesQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Nenhuma associação encontrada para esta NFe.'
      });
    }

    const associacoesSalvas = associacoesQuery.rows;
    console.log(`📦 Gerando entrada para NFe ${nfe.numero_nf} (chave: ${chaveLimpa.slice(-8)}...) - ${associacoesSalvas.length} associações`);

    // 5. Gerar número da entrada
    const timestamp = Date.now();
    const numeroEntrada = `E${timestamp.toString().slice(-8)}`;

    // 6. Criar entrada principal
    const tipoOperacao = nfe.natop === 'ENTRADA_IMPORTACAO' ? 'ENTRADA_IMPORTACAO' : 'ENTRADA_NFE';
    const entradaResult = await client.query(`
      INSERT INTO db_manaus.entradas_estoque (
        numero_entrada, nfe_id, tipo_operacao, data_entrada,
        valor_total, status, created_at
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'PENDENTE', NOW())
      RETURNING id
    `, [numeroEntrada, nfeId, tipoOperacao, 0]);

    const entradaId = entradaResult.rows[0].id;

    // 7. Criar registro de operação para recebimento físico
    await client.query(`
      INSERT INTO db_manaus.entrada_operacoes (
        entrada_id, status, created_at, updated_at
      ) VALUES ($1, 'AGUARDANDO_RECEBIMENTO', NOW(), NOW())
    `, [entradaId]);

    // 8. Preparar dados dos itens
    const associacoesParaValidar: { pedidoId: string; produtoCod: string; quantidade: number }[] = [];
    const itensParaInserir: { produtoCod: string; quantidade: number; valorUnitario: number; reqId: string | null }[] = [];
    const estoquesParaAtualizar: Map<string, number> = new Map();
    let valorTotalEntrada = 0;

    for (const itemSalvo of associacoesSalvas) {
      const isMeiaNota = itemSalvo.meia_nota === true;
      const quantidadeFloat = parseFloat(itemSalvo.quantidade_associada.toString());
      const precoRaw = isMeiaNota ? itemSalvo.preco_unitario_nf : (itemSalvo.preco_real || itemSalvo.valor_unitario);
      const precoParaProcessar = precoRaw ? parseFloat(precoRaw.toString()) : 0;

      let req_id = null;
      if (itemSalvo.associacoes && itemSalvo.associacoes[0] !== null) {
        req_id = itemSalvo.associacoes[0].pedidoId;
      }

      itensParaInserir.push({
        produtoCod: itemSalvo.produto_cod,
        quantidade: quantidadeFloat,
        valorUnitario: precoParaProcessar,
        reqId: req_id
      });

      valorTotalEntrada += quantidadeFloat * precoParaProcessar;

      if (itemSalvo.associacoes && itemSalvo.associacoes[0] !== null) {
        for (const associacao of itemSalvo.associacoes) {
          const isTestOrder = associacao.pedidoId?.toString().startsWith('99') ||
                             associacao.pedidoId?.toString().startsWith('FB') ||
                             associacao.pedidoId?.toString().includes('ERRO');
          if (!isTestOrder && associacao.pedidoId) {
            associacoesParaValidar.push({
              pedidoId: associacao.pedidoId,
              produtoCod: itemSalvo.produto_cod,
              quantidade: parseFloat(associacao.quantidade)
            });
          }
        }
      }

      const qtdAtual = estoquesParaAtualizar.get(itemSalvo.produto_cod) || 0;
      estoquesParaAtualizar.set(itemSalvo.produto_cod, qtdAtual + quantidadeFloat);
    }

    // 9. Validar quantidades nos pedidos
    if (associacoesParaValidar.length > 0) {
      const paresUnicos = [...new Set(associacoesParaValidar.map(a => `${a.pedidoId}|${a.produtoCod}`))];
      const placeholders = paresUnicos.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const params = paresUnicos.flatMap(par => par.split('|'));

      const batchCheckResult = await client.query(`
        SELECT
          o.orc_id as pedido_id,
          ri.itr_codprod as produto_cod,
          ri.itr_quantidade,
          COALESCE(ri.itr_quantidade_atendida, 0) as itr_quantidade_atendida
        FROM db_manaus.cmp_it_requisicao ri
        INNER JOIN db_manaus.cmp_ordem_compra o ON (
          o.orc_req_id = ri.itr_req_id AND o.orc_req_versao = ri.itr_req_versao
        )
        WHERE (o.orc_id, ri.itr_codprod) IN (${placeholders})
      `, params);

      const qtdMap = new Map<string, { total: number; atendida: number }>();
      for (const row of batchCheckResult.rows) {
        qtdMap.set(`${row.pedido_id}|${row.produto_cod}`, {
          total: parseFloat(row.itr_quantidade),
          atendida: parseFloat(row.itr_quantidade_atendida)
        });
      }

      const qtdSolicitadaMap = new Map<string, number>();
      for (const assoc of associacoesParaValidar) {
        const key = `${assoc.pedidoId}|${assoc.produtoCod}`;
        qtdSolicitadaMap.set(key, (qtdSolicitadaMap.get(key) || 0) + assoc.quantidade);
      }

      for (const [key, qtdSolicitada] of qtdSolicitadaMap) {
        const [pedidoId, produtoCod] = key.split('|');
        const qtdInfo = qtdMap.get(key);
        if (!qtdInfo) {
          throw new Error(`Pedido ${pedidoId} não encontrado ou produto ${produtoCod} não está neste pedido`);
        }
        const qtdDisponivel = qtdInfo.total - qtdInfo.atendida;
        if (qtdDisponivel < qtdSolicitada) {
          throw new Error(
            `Quantidade insuficiente no pedido ${pedidoId} para produto ${produtoCod}. ` +
            `Disponível: ${qtdDisponivel}, Solicitado: ${qtdSolicitada}`
          );
        }
      }
    }

    // 10. Inserir itens da entrada
    let itensProcessados = 0;
    for (const item of itensParaInserir) {
      await client.query(`
        INSERT INTO db_manaus.entrada_itens (
          entrada_id, produto_cod, quantidade, valor_unitario,
          valor_total, req_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [entradaId, item.produtoCod, item.quantidade, item.valorUnitario,
          item.quantidade * item.valorUnitario, item.reqId]);
      itensProcessados++;
    }

    // 11. Atualizar quantidade atendida nos pedidos
    // Para importações, isso já foi feito em gerar-entradas.ts - pular para evitar duplo incremento
    const isImportacao = nfe.natop === 'ENTRADA_IMPORTACAO';
    if (associacoesParaValidar.length > 0 && !isImportacao) {
      const updatesAgrupados = new Map<string, number>();
      for (const assoc of associacoesParaValidar) {
        const key = `${assoc.pedidoId}|${assoc.produtoCod}`;
        updatesAgrupados.set(key, (updatesAgrupados.get(key) || 0) + assoc.quantidade);
      }

      const updatePromises = Array.from(updatesAgrupados.entries()).map(([key, quantidade]) => {
        const [pedidoId, produtoCod] = key.split('|');
        return client.query(`
          UPDATE db_manaus.cmp_it_requisicao ri
          SET itr_quantidade_atendida = COALESCE(itr_quantidade_atendida, 0) + $1
          FROM db_manaus.cmp_ordem_compra o
          WHERE o.orc_id = $2
            AND ri.itr_req_id = o.orc_req_id
            AND ri.itr_req_versao = o.orc_req_versao
            AND ri.itr_codprod = $3
        `, [quantidade, pedidoId, produtoCod]);
      });
      await Promise.all(updatePromises);

      // 11.1 Auto-finalizar ordens totalmente atendidas
      const pedidosDistintos = new Set<string>();
      for (const assoc of associacoesParaValidar) {
        if (assoc.pedidoId) pedidosDistintos.add(assoc.pedidoId);
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
            userName: 'Sistema (Entrada NFe)',
            reason: `Ordem fechada automaticamente - todos os itens atendidos via entrada ${numeroEntrada}`,
            comments: {
              tipo: 'FINALIZACAO',
              motivo: 'auto_entrada_nfe',
              entrada_id: entradaId,
              nfe_id: nfeId
            }
          });
          console.log(`✅ Ordem ${pedidoId} fechada automaticamente`);
        }
      }
    }

    // 12. Atualizar estoque
    const estoquePromises = Array.from(estoquesParaAtualizar.entries()).map(([codprod, quantidade]) => {
      return client.query(`
        UPDATE db_manaus.dbprod
        SET qtest = COALESCE(qtest, 0) + $1,
            qtdreservada = COALESCE(qtdreservada, 0) + $1
        WHERE codprod = $2
      `, [quantidade, codprod]);
    });
    await Promise.all(estoquePromises);

    // 13. Atualizar valor total da entrada
    await client.query(`
      UPDATE db_manaus.entradas_estoque SET valor_total = $1 WHERE id = $2
    `, [valorTotalEntrada, entradaId]);

    // 14. Se for importação, atualizar codent na fatura da DI para o numero_entrada
    if (nfe.natop === 'ENTRADA_IMPORTACAO' && nfe.infcpl) {
      const parts = nfe.infcpl.split(':'); // IMPORTACAO:id_importacao:id_fatura
      if (parts.length === 3 && parts[0] === 'IMPORTACAO') {
        const importacaoId = parseInt(parts[1]);
        const faturaId = parseInt(parts[2]);
        if (faturaId && importacaoId) {
          await client.query(`
            UPDATE db_manaus.dbent_importacao_entrada
            SET codent = $1
            WHERE id = $2 AND id_importacao = $3
          `, [numeroEntrada, faturaId, importacaoId]);
          console.log(`[gerar-por-chave] Importação DI#${importacaoId}: codent da fatura ${faturaId} atualizado para ${numeroEntrada}`);
        } else {
          console.warn(`[gerar-por-chave] Importação: infcpl mal formado: ${nfe.infcpl}`);
        }
      } else {
        console.warn(`[gerar-por-chave] Importação: infcpl inesperado: ${nfe.infcpl}`);
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Entrada ${numeroEntrada} gerada com sucesso! ${itensProcessados} itens`);

    return res.status(200).json({
      success: true,
      message: `Entrada ${numeroEntrada} gerada com sucesso!`,
      numeroEntrada,
      entradaId,
      itensProcessados,
      numeroNF: nfe.numero_nf
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');

    if (error.code === '55P03') {
      return res.status(409).json({
        error: 'Esta NFe está sendo processada por outro usuário. Aguarde.'
      });
    }

    console.error('Erro ao gerar entrada por chave:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao gerar entrada'
    });

  } finally {
    if (client) client.release();
  }
}
