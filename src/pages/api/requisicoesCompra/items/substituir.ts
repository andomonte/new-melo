import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import {
  gerarDetalhesSubstituicaoItem,
  type ProdutoInfo
} from '@/lib/compras/historicoHelper';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

interface SubstituirItemRequest {
  req_id: number;
  req_versao: number;
  codprod_original: string; // Código do produto original a ser substituído
  novo_produto: {
    codprod: string;
    quantidade: number;
    preco_unitario: number;
    preco_total: number;
  };
  userId?: string;
  userName?: string;
}

interface SubstituirItemResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SubstituirItemResponse>) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  const { req_id, req_versao, codprod_original, novo_produto, userId, userName }: SubstituirItemRequest = req.body;

  // Usar dados do usuário recebidos ou fallback para sistema
  const userIdFinal = userId || 'SISTEMA';
  const userNameFinal = userName || 'Sistema';

  if (!req_id || !req_versao || !codprod_original || !novo_produto) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros obrigatórios: req_id, req_versao, codprod_original, novo_produto'
    });
  }

  let client: PoolClient | null = null;

  console.log(`🔌 Conectando ao pool...`);
  try {
    client = await pool.connect();
    console.log(`✅ Cliente conectado ao banco!`);

    // Verificar se o item original existe
    const checkItemQuery = `
      SELECT itr_codprod as codprod FROM db_manaus.cmp_it_requisicao
      WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
    `;

    const itemResult = await client.query(checkItemQuery, [req_id, req_versao, codprod_original]);

    if (itemResult.rows.length === 0) {
      client.release();
      client = null;
      return res.status(404).json({
        success: false,
        message: `Item ${codprod_original} não encontrado na requisição ${req_id}`
      });
    }

    // Iniciar transação com isolation level explícito
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');

    // 1. Buscar o item original completo para copiar campos obrigatórios
    const fetchOriginalQuery = `
      SELECT * FROM db_manaus.cmp_it_requisicao
      WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
    `;

    const originalResult = await client.query(fetchOriginalQuery, [
      req_id,
      req_versao,
      codprod_original
    ]);

    if (originalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Item ${codprod_original} não encontrado`
      });
    }

    const itemOriginalTabela = originalResult.rows[0];

    // 2. Deletar o item original
    const deleteQuery = `
      DELETE FROM db_manaus.cmp_it_requisicao
      WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
      RETURNING *
    `;

    console.log(`\n========== SUBSTITUIÇÃO DE ITEM ==========`);
    console.log(`📋 Requisição: ${req_id} v${req_versao}`);
    console.log(`🔄 Substituir: ${codprod_original} → ${novo_produto.codprod}`);
    console.log(`🗑️  Tentando deletar: req=${req_id}, versao=${req_versao}, codprod=${codprod_original}`);
    const deleteResult = await client.query(deleteQuery, [
      req_id,
      req_versao,
      codprod_original
    ]);

    console.log(`🗑️  Resultado DELETE:`, deleteResult.rows);
    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'Erro ao deletar item original'
      });
    }

    // 3. Verificar se o produto substituto já existe na requisição
    const checkNovoQuery = `
      SELECT * FROM db_manaus.cmp_it_requisicao
      WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
    `;
    const checkNovoResult = await client.query(checkNovoQuery, [req_id, req_versao, novo_produto.codprod]);

    let insertResult;

    if (checkNovoResult.rows.length > 0) {
      // Produto substituto já existe - fazer UPDATE somando quantidade
      console.log(`⚠️ Produto ${novo_produto.codprod} já existe na requisição. Fazendo UPDATE...`);
      const updateQuery = `
        UPDATE db_manaus.cmp_it_requisicao
        SET itr_quantidade = itr_quantidade + $4,
            itr_pr_unitario = $5
        WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
        RETURNING *
      `;
      insertResult = await client.query(updateQuery, [
        req_id,
        req_versao,
        novo_produto.codprod,
        novo_produto.quantidade,
        novo_produto.preco_unitario
      ]);
    } else {
      // Produto substituto não existe - fazer INSERT
      const insertQuery = `
        INSERT INTO db_manaus.cmp_it_requisicao
          (itr_req_id, itr_req_versao, itr_codprod, itr_quantidade, itr_pr_unitario,
           itr_base_indicacao, itr_quantidade_atendida, itr_quantidade_sugerida,
           itr_data_sugestao, itr_quantidade_fechada)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      console.log(`➕ Tentando inserir: req=${req_id}, versao=${req_versao}, codprod=${novo_produto.codprod}`);
      insertResult = await client.query(insertQuery, [
        req_id,
        req_versao,
        novo_produto.codprod,
        novo_produto.quantidade,
        novo_produto.preco_unitario,
        itemOriginalTabela.itr_base_indicacao || '',        // Garantir string vazia ao invés de null
        itemOriginalTabela.itr_quantidade_atendida || 0,    // Garantir 0 ao invés de null
        itemOriginalTabela.itr_quantidade_sugerida || null,
        itemOriginalTabela.itr_data_sugestao || null,
        itemOriginalTabela.itr_quantidade_fechada || null
      ]);
    }

    console.log(`➕ Resultado INSERT:`, insertResult.rows);
    if (insertResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'Erro ao inserir item substituto'
      });
    }

    const updateResult = insertResult;

    // Buscar informações dos produtos para histórico detalhado
    const produtosQuery = `
      SELECT codprod, descr
      FROM db_manaus.dbprod
      WHERE codprod IN ($1, $2)
    `;
    const produtosResult = await client.query(produtosQuery, [codprod_original, novo_produto.codprod]);
    const produtosMap = new Map(produtosResult.rows.map(p => [p.codprod, p.descr]));

    // Informações do produto original
    const produtoOriginalInfo: ProdutoInfo = {
      codprod: codprod_original,
      descr: produtosMap.get(codprod_original) || 'Produto não encontrado',
      quantidade: itemOriginalTabela.itr_quantidade,
      preco_unitario: itemOriginalTabela.itr_pr_unitario
    };

    // Informações do produto novo
    const produtoNovoInfo: ProdutoInfo = {
      codprod: novo_produto.codprod,
      descr: produtosMap.get(novo_produto.codprod) || 'Produto não encontrado',
      quantidade: novo_produto.quantidade,
      preco_unitario: novo_produto.preco_unitario,
      preco_total: novo_produto.preco_total
    };

    // Gerar comentário estruturado
    const historicoComment = gerarDetalhesSubstituicaoItem(produtoOriginalInfo, produtoNovoInfo);

    // Get current requisition status
    const statusQuery = `
      SELECT req_status
      FROM db_manaus.cmp_requisicao
      WHERE req_id = $1 AND req_versao = $2
    `;
    const statusResult = await client.query(statusQuery, [req_id, req_versao]);
    const currentStatus = statusResult.rows[0]?.req_status || 'P';

    // Registrar histórico da substituição na requisição (usando SAVEPOINT para não abortar transação)
    try {
      await client.query('SAVEPOINT historico_requisicao');
      await client.query(
        `INSERT INTO db_manaus.cmp_requisicao_historico
         (req_id, req_versao, previous_status, new_status, user_id, user_name, created_at, reason, comments)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
        [
          req_id,
          req_versao,
          currentStatus,
          currentStatus,
          userIdFinal,
          userNameFinal,
          'Item substituído',
          historicoComment
        ]
      );
      await client.query('RELEASE SAVEPOINT historico_requisicao');
    } catch (historyError) {
      console.warn('Erro ao registrar histórico de substituição:', historyError);
      await client.query('ROLLBACK TO SAVEPOINT historico_requisicao');
      // Continua - histórico é opcional, não deve impedir a substituição
    }

    // Verificar se existe ordem de compra para esta requisição e registrar histórico (usando SAVEPOINT)
    try {
      await client.query('SAVEPOINT historico_ordem');
      const ordemQuery = `
        SELECT orc_id, orc_status FROM db_manaus.cmp_ordem_compra
        WHERE orc_req_id = $1 AND orc_req_versao = $2
      `;
      const ordemResult = await client.query(ordemQuery, [req_id, req_versao]);

      if (ordemResult.rows.length > 0) {
        const ordem = ordemResult.rows[0];
        await registrarHistoricoOrdem(client, {
          orcId: ordem.orc_id,
          previousStatus: ordem.orc_status,
          newStatus: ordem.orc_status,
          userId: userIdFinal,
          userName: userNameFinal,
          reason: `Item substituído: ${produtoOriginalInfo.descr} → ${produtoNovoInfo.descr}`,
          comments: {
            tipo: 'SUBSTITUIR_ITEM',
            codprod_original: codprod_original,
            referencia_original: produtoOriginalInfo.descr,
            codprod_novo: novo_produto.codprod,
            referencia_nova: produtoNovoInfo.descr,
            quantidade: novo_produto.quantidade,
            preco_unitario: novo_produto.preco_unitario
          }
        });
      }
      await client.query('RELEASE SAVEPOINT historico_ordem');
    } catch (ordemHistError) {
      console.warn('Erro ao registrar histórico na ordem:', ordemHistError);
      await client.query('ROLLBACK TO SAVEPOINT historico_ordem');
      // Continua - histórico da ordem é opcional
    }

    // Verificar ANTES do commit
    const verificacaoAntes = await client.query(
      `SELECT itr_codprod, itr_quantidade FROM db_manaus.cmp_it_requisicao
       WHERE itr_req_id = $1 AND itr_req_versao = $2
       ORDER BY itr_codprod`,
      [req_id, req_versao]
    );
    console.log(`🔍 ANTES DO COMMIT - Itens na requisição:`, verificacaoAntes.rows.map(r => `${r.itr_codprod}(qty:${r.itr_quantidade})`));

    // Commit da transação
    console.log(`💾 Fazendo COMMIT da transação...`);
    await client.query('COMMIT');
    console.log(`✅ COMMIT concluído!`);

    // Verificar DEPOIS do commit (nova query fora da transação)
    const verificacaoDepois = await client.query(
      `SELECT itr_codprod, itr_quantidade FROM db_manaus.cmp_it_requisicao
       WHERE itr_req_id = $1 AND itr_req_versao = $2
       ORDER BY itr_codprod`,
      [req_id, req_versao]
    );
    console.log(`🔍 DEPOIS DO COMMIT - Itens na requisição:`, verificacaoDepois.rows.map(r => `${r.itr_codprod}(qty:${r.itr_quantidade})`));
    console.log(`==========================================\n`);

    // Liberar client ANTES de enviar resposta
    client.release();
    client = null; // Evitar double release no finally
    console.log(`🔓 Cliente liberado de volta ao pool`);

    console.log(`✅ Item substituído: ${codprod_original} → ${novo_produto.codprod} (Req: ${req_id})`);
    console.log(`📝 Deletado:`, deleteResult.rows[0]);
    console.log(`📝 Inserido:`, insertResult.rows[0]);

    return res.status(200).json({
      success: true,
      message: 'Item substituído com sucesso',
      data: {
        item_original: deleteResult.rows[0],
        item_novo: insertResult.rows[0]
      }
    });

  } catch (error) {
    console.error('❌ Erro ao substituir item:', error);

    // Rollback em caso de erro
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao fazer rollback:', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}