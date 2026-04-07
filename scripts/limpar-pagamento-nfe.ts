/**
 * Script para limpar pagamento de NFe e permitir reconfiguração
 * Uso: npx ts-node scripts/limpar-pagamento-nfe.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function limparPagamentoNFe() {
  const pool = new Pool({
    host: process.env.PG_HOST || 'servicos.melopecas.com.br',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'postgres',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'Melodb@2025',
    ssl: false
  });

  const client = await pool.connect();

  try {
    await client.query('SET search_path TO db_manaus');

    // Pagamentos específicos da MARELLI COFAP que precisam ser limpos
    const codPgtos = ['27651', '27652', '27653'];

    console.log('\n🔍 Buscando pagamentos para limpar: ' + codPgtos.join(', ') + '\n');

    const pagamentosResult = await client.query(`
      SELECT
        p.cod_pgto,
        p.cod_credor,
        p.nro_dup,
        p.valor_pgto,
        p.dt_venc,
        p.dt_emissao,
        p.nro_nf,
        p.banco,
        p.ordem_compra,
        c.nome as fornecedor
      FROM dbpgto p
      LEFT JOIN dbcredor c ON p.cod_credor = c.cod_credor
      WHERE p.cod_pgto = ANY($1)
      ORDER BY CAST(p.cod_pgto AS INTEGER) DESC
    `, [codPgtos]);

    if (pagamentosResult.rows.length === 0) {
      console.log('❌ Nenhum pagamento encontrado com esses códigos');
      return;
    }

    console.log('📋 Pagamentos encontrados para limpar:');
    pagamentosResult.rows.forEach((r: any) => {
      console.log('  - cod_pgto: ' + r.cod_pgto + ', nro_dup: ' + r.nro_dup + ', valor: R$ ' + r.valor_pgto + ', fornecedor: ' + r.fornecedor);
    });

    const nfeId = pagamentosResult.rows[0]?.nro_nf;

    // Buscar ordens associadas
    const ordensResult = await client.query(`
      SELECT DISTINCT orc_id FROM ordem_pagamento_conta WHERE cod_pgto = ANY($1)
    `, [codPgtos]);

    const ordemIds = ordensResult.rows.map((r: any) => r.orc_id);
    console.log('\n📦 Ordens associadas: ' + (ordemIds.join(', ') || 'nenhuma'));
    console.log('📄 NFe associada: ' + (nfeId || 'não identificada'));

    console.log('\n⚠️  Iniciando limpeza...\n');

    await client.query('BEGIN');

    // 1. Remover de ordem_pagamento_conta
    if (ordemIds.length > 0) {
      const delOpcResult = await client.query(`
        DELETE FROM ordem_pagamento_conta
        WHERE orc_id = ANY($1) AND numero_parcela > 0
        RETURNING *
      `, [ordemIds]);
      console.log('✅ Removidos ' + delOpcResult.rowCount + ' registros de ordem_pagamento_conta');

      // 2. Remover de ordem_pagamento_parcelas
      const delOppResult = await client.query(`
        DELETE FROM ordem_pagamento_parcelas
        WHERE orc_id = ANY($1) AND numero_parcela > 0
        RETURNING *
      `, [ordemIds]);
      console.log('✅ Removidos ' + delOppResult.rowCount + ' registros de ordem_pagamento_parcelas');

      // 3. Resetar flag nas ordens
      await client.query(`
        UPDATE cmp_ordem_compra
        SET orc_pagamento_configurado = false,
            orc_banco = NULL,
            orc_tipo_documento = NULL
        WHERE orc_id = ANY($1)
      `, [ordemIds]);
      console.log('✅ Reset do flag orc_pagamento_configurado nas ordens: ' + ordemIds.join(', '));
    }

    // 4. Remover de dbpgto
    const delPgtoResult = await client.query(`
      DELETE FROM dbpgto
      WHERE cod_pgto = ANY($1)
      RETURNING *
    `, [codPgtos]);
    console.log('✅ Removidos ' + delPgtoResult.rowCount + ' registros de dbpgto');

    // 5. Resetar flag na NFe (se identificada)
    if (nfeId) {
      await client.query(`
        UPDATE dbnfe_ent
        SET pagamento_configurado = false
        WHERE codnfe_ent = $1
      `, [nfeId]);
      console.log('✅ Reset do flag pagamento_configurado na NFe: ' + nfeId);
    }

    await client.query('COMMIT');

    console.log('\n🎉 Limpeza concluída! Agora você pode configurar o pagamento novamente pelo "Gerar Cobrança".\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

limparPagamentoNFe().catch(console.error);
