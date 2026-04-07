const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres'
});

async function resetNFes() {
  const nfeIds = [1016, 1017]; // NFes 530057 e 530230

  let client;
  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');
    await client.query('BEGIN');

    console.log('========================================');
    console.log('RESETANDO NFEs:', nfeIds.join(', '));
    console.log('========================================\n');

    for (const nfeId of nfeIds) {
      console.log(`\n--- Resetando NFe ${nfeId} ---`);

      // 1. Buscar ordens associadas ANTES de deletar as associacoes
      const ordensResult = await client.query(`
        SELECT DISTINCT req_id as orc_id
        FROM nfe_item_pedido_associacao
        WHERE nfe_id = $1
      `, [nfeId]);

      const ordensAssociadas = ordensResult.rows.map(r => Number(r.orc_id));
      console.log(`Ordens associadas encontradas: ${ordensAssociadas.join(', ') || 'nenhuma'}`);

      // 2. Para cada ordem, deletar pagamentos e resetar flags
      for (const orcId of ordensAssociadas) {
        console.log(`\n  Processando ordem ${orcId}...`);

        // 2.1 Buscar cod_pgto das parcelas para deletar de dbpgto
        const pgtosResult = await client.query(`
          SELECT cod_pgto FROM ordem_pagamento_conta WHERE orc_id = $1
        `, [orcId]);

        const codPgtos = pgtosResult.rows.map(r => r.cod_pgto);
        console.log(`    cod_pgtos encontrados: ${codPgtos.join(', ') || 'nenhum'}`);

        // 2.2 Deletar de dbpgto
        for (const codPgto of codPgtos) {
          const delPgto = await client.query(`DELETE FROM dbpgto WHERE cod_pgto = $1`, [codPgto]);
          console.log(`    Deletado dbpgto ${codPgto}: ${delPgto.rowCount} registro(s)`);
        }

        // 2.3 Deletar de ordem_pagamento_conta
        const delOpc = await client.query(`DELETE FROM ordem_pagamento_conta WHERE orc_id = $1`, [orcId]);
        console.log(`    Deletado ordem_pagamento_conta: ${delOpc.rowCount} registro(s)`);

        // 2.4 Deletar de ordem_pagamento_parcelas
        const delOpp = await client.query(`DELETE FROM ordem_pagamento_parcelas WHERE orc_id = $1`, [orcId]);
        console.log(`    Deletado ordem_pagamento_parcelas: ${delOpp.rowCount} registro(s)`);

        // 2.5 Resetar flags da ordem de compra
        await client.query(`
          UPDATE cmp_ordem_compra
          SET
            orc_pagamento_configurado = false,
            orc_banco = NULL,
            orc_tipo_documento = NULL
          WHERE orc_id = $1
        `, [orcId]);
        console.log(`    Resetado flags de pagamento da ordem ${orcId}`);

        // 2.6 Resetar qnt_atendida - pulado por agora (estrutura de tabelas diferente)
      }

      // 3. Deletar associacoes de itens
      const delAssocPed = await client.query(`
        DELETE FROM nfe_item_pedido_associacao WHERE nfe_id = $1
      `, [nfeId]);
      console.log(`\n  Deletado nfe_item_pedido_associacao: ${delAssocPed.rowCount} registro(s)`);

      const delAssoc = await client.query(`
        DELETE FROM nfe_item_associacao WHERE nfe_id = $1
      `, [nfeId]);
      console.log(`  Deletado nfe_item_associacao: ${delAssoc.rowCount} registro(s)`);

      // 4. Resetar status da NFe para 'R' (Recebida)
      await client.query(`
        UPDATE dbnfe_ent
        SET
          exec = 'R',
          pagamento_configurado = false
        WHERE codnfe_ent = $1
      `, [nfeId]);
      console.log(`  NFe ${nfeId} resetada para status 'R' (Recebida)`);

      // 5. Limpar historico (opcional - para comecar do zero)
      const delHist = await client.query(`
        DELETE FROM dbnfe_ent_historico WHERE codnfe_ent = $1
      `, [nfeId]);
      console.log(`  Deletado historico: ${delHist.rowCount} registro(s)`);
    }

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('RESET CONCLUIDO COM SUCESSO!');
    console.log('========================================');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('ERRO:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

resetNFes();
