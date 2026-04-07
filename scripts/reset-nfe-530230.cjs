const { Pool } = require('pg');

const pool = new Pool({
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
});

async function resetNFe() {
  const client = await pool.connect();
  const nfeId = '530230';

  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO db_manaus');

    console.log('\n🔄 Resetando NFe ' + nfeId + ' completamente...\n');

    // 1. Buscar ordens associadas antes de deletar
    const ordensResult = await client.query(
      'SELECT DISTINCT req_id as orc_id FROM nfe_item_pedido_associacao WHERE nfe_id = $1',
      [nfeId]
    );
    const ordens = ordensResult.rows.map(r => r.orc_id);
    console.log('📦 Ordens associadas encontradas: ' + (ordens.length > 0 ? ordens.join(', ') : 'nenhuma'));

    // 2. Deletar associações de itens com pedidos
    const delPedidoAssoc = await client.query(
      'DELETE FROM nfe_item_pedido_associacao WHERE nfe_id = $1',
      [nfeId]
    );
    console.log('✅ Deletadas ' + delPedidoAssoc.rowCount + ' associacoes item-pedido');

    // 3. Deletar associações de itens
    const delItemAssoc = await client.query(
      'DELETE FROM nfe_item_associacao WHERE nfe_id = $1',
      [nfeId]
    );
    console.log('✅ Deletadas ' + delItemAssoc.rowCount + ' associacoes de item');

    // 4. Para cada ordem, deletar pagamentos e resetar flags
    for (const orcId of ordens) {
      // Buscar cod_pgto vinculados
      const pgtosResult = await client.query(
        'SELECT cod_pgto FROM ordem_pagamento_conta WHERE orc_id = $1',
        [orcId]
      );

      for (const row of pgtosResult.rows) {
        await client.query('DELETE FROM dbpgto WHERE cod_pgto = $1', [row.cod_pgto]);
      }
      console.log('✅ Deletados ' + pgtosResult.rowCount + ' pagamentos (dbpgto) da ordem ' + orcId);

      // Deletar de ordem_pagamento_conta
      const delConta = await client.query(
        'DELETE FROM ordem_pagamento_conta WHERE orc_id = $1',
        [orcId]
      );
      console.log('✅ Deletadas ' + delConta.rowCount + ' linhas de ordem_pagamento_conta');

      // Deletar de ordem_pagamento_parcelas
      const delParcelas = await client.query(
        'DELETE FROM ordem_pagamento_parcelas WHERE orc_id = $1',
        [orcId]
      );
      console.log('✅ Deletadas ' + delParcelas.rowCount + ' linhas de ordem_pagamento_parcelas');

      // Resetar flags da ordem
      await client.query(`
        UPDATE cmp_ordem_compra
        SET orc_pagamento_configurado = false,
            orc_banco = null,
            orc_tipo_documento = null
        WHERE orc_id = $1
      `, [orcId]);
      console.log('✅ Flags de pagamento resetadas na ordem ' + orcId);
    }

    // 5. Resetar status da NFe para 'R' (Recebida)
    await client.query(`
      UPDATE dbnfe_ent
      SET exec = 'R', pagamento_configurado = false
      WHERE codnfe_ent = $1
    `, [nfeId]);
    console.log('✅ NFe ' + nfeId + ' resetada para status R (Recebida)');

    // 6. Limpar historico para comecar do zero
    const delHistorico = await client.query(
      'DELETE FROM dbnfe_ent_historico WHERE codnfe_ent = $1',
      [nfeId]
    );
    console.log('✅ Deletados ' + delHistorico.rowCount + ' registros de historico');

    await client.query('COMMIT');
    console.log('\n🎉 NFe ' + nfeId + ' resetada com sucesso! Pronta para testar.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resetNFe();
