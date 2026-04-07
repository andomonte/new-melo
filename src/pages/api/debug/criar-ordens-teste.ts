import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');

    console.log('🔄 Criando ordens de teste para produtos específicos...');

    // Lista de produtos que EXISTEM no banco
    const produtos = [
      { codprod: '001755', descricao: 'ROLAMENTO', quantidade: 100, preco: 150.00 },
      { codprod: '106220', descricao: 'ANEL DE GUIA MARTELO', quantidade: 50, preco: 45.00 },
      { codprod: '000002', descricao: 'ROLAMENTO', quantidade: 50, preco: 250.00 },
      { codprod: '000004', descricao: 'ROLAMENTO', quantidade: 4, preco: 250.00 },
      { codprod: '000005', descricao: 'FILTRO GM', quantidade: 50, preco: 75.00 },
      { codprod: '000009', descricao: 'ROLAMENTO', quantidade: 50, preco: 750.00 },
      { codprod: '000012', descricao: 'ROLAMENTO', quantidade: 50, preco: 500.00 }
    ];

    // Criar requisição de teste
    const reqId = 99999;
    const reqVersao = 1;
    const hoje = new Date().toISOString().split('T')[0];

    // Verificar se já existe
    const checkReq = await client.query(
      'SELECT req_id FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [reqId, reqVersao]
    );

    if (checkReq.rows.length === 0) {
      // Criar requisição
      await client.query(`
        INSERT INTO db_manaus.cmp_requisicao (
          req_id, req_versao, req_data, req_status,
          req_cod_credor, req_codcomprador, req_id_composto,
          req_observacao, req_cond_pagto
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [reqId, reqVersao, hoje, 'A', '00675', '001', 'REQ-TESTE-99999', 'Requisição de teste para associação NFe', '30 DIAS']);

      console.log('✅ Requisição criada');
    }

    // Criar itens da requisição na tabela correta
    for (const produto of produtos) {
      // Verificar se o item já existe
      const checkItem = await client.query(
        'SELECT itr_codprod FROM db_manaus.cmp_it_requisicao WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3',
        [reqId, reqVersao, produto.codprod]
      );

      if (checkItem.rows.length === 0) {
        await client.query(`
          INSERT INTO db_manaus.cmp_it_requisicao (
            itr_req_id, itr_req_versao, itr_codprod,
            itr_quantidade, itr_pr_unitario, itr_quantidade_atendida,
            itr_base_indicacao
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [reqId, reqVersao, produto.codprod, produto.quantidade, produto.preco, 0, 'MANUAL']);

        console.log(`✅ Item criado: ${produto.codprod}`);
      } else {
        // Atualizar quantidade_atendida para 0
        await client.query(`
          UPDATE db_manaus.cmp_it_requisicao
          SET itr_quantidade_atendida = 0
          WHERE itr_req_id = $1 AND itr_req_versao = $2 AND itr_codprod = $3
        `, [reqId, reqVersao, produto.codprod]);

        console.log(`🔄 Item atualizado: ${produto.codprod}`);
      }
    }

    // Criar ordens de compra
    const ordens = [
      { id: 2422, fornecedor: '00675', nome: 'AEROBRASIL TRANSP INTERAN LTDA' },
      { id: 2423, fornecedor: '00807', nome: '0002-98 PEMAZA TOYOTA' }
    ];

    for (const ordem of ordens) {
      // Verificar se ordem já existe
      const checkOrdem = await client.query(
        'SELECT orc_id FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1',
        [ordem.id]
      );

      if (checkOrdem.rows.length === 0) {
        await client.query(`
          INSERT INTO db_manaus.cmp_ordem_compra (
            orc_id, orc_req_id, orc_req_versao,
            orc_data, orc_status
          ) VALUES ($1, $2, $3, $4, $5)
        `, [ordem.id, reqId, reqVersao, hoje, 'A']);

        console.log(`✅ Ordem ${ordem.id} criada`);
      } else {
        // Atualizar status para Ativo
        await client.query(`
          UPDATE db_manaus.cmp_ordem_compra
          SET orc_status = 'A'
          WHERE orc_id = $1
        `, [ordem.id]);

        console.log(`🔄 Ordem ${ordem.id} atualizada para status Ativo`);
      }
    }

    // Verificar se fornecedores existem, senão criar
    for (const ordem of ordens) {
      const checkFornecedor = await client.query(
        'SELECT cod_credor FROM db_manaus.dbcredor WHERE cod_credor = $1',
        [ordem.fornecedor]
      );

      if (checkFornecedor.rows.length === 0) {
        await client.query(`
          INSERT INTO db_manaus.dbcredor (
            cod_credor, nome, razao, cpf_cgc, tipo
          ) VALUES ($1, $2, $2, $3, 'F')
        `, [ordem.fornecedor, ordem.nome, '00000000000000']);

        console.log(`✅ Fornecedor ${ordem.fornecedor} criado`);
      }
    }

    await client.query('COMMIT');

    // Verificar resultado
    const verifyQuery = `
      SELECT
        o.orc_id,
        COUNT(DISTINCT ri.itr_codprod) as total_produtos,
        SUM(ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as total_disponivel
      FROM db_manaus.cmp_ordem_compra o
      INNER JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      INNER JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
      WHERE o.orc_status = 'A'
      AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
      AND o.orc_id IN (2422, 2423)
      GROUP BY o.orc_id
    `;

    const result = await client.query(verifyQuery);

    return res.status(200).json({
      success: true,
      message: 'Ordens de teste criadas com sucesso!',
      ordens: result.rows,
      produtosCriados: produtos.map(p => p.codprod)
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Erro ao criar ordens de teste:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar ordens de teste',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}