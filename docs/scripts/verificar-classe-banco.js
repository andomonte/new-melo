#!/usr/bin/env node

/**
 * Script para verificar classe de pagamento e banco de clientes
 * Uso: node scripts/verificar-classe-banco.js [CODIGO_CLIENTE]
 */

const { Pool } = require('pg');
require('dotenv').config();

const filial = process.env.FILIAL_PADRAO || 'MANAUS';

const pools = {
  MANAUS: new Pool({
    host: process.env.DB_HOST_MANAUS,
    port: process.env.DB_PORT_MANAUS,
    user: process.env.DB_USER_MANAUS,
    password: process.env.DB_PASSWORD_MANAUS,
    database: process.env.DB_NAME_MANAUS,
  }),
};

async function verificarClasseBanco(codcli) {
  const pool = pools[filial];

  try {
    console.log(`\n🔍 Verificando cliente: ${codcli || 'TODOS'}\n`);

    let query;
    let params;

    if (codcli) {
      query = `
        SELECT 
          codcli,
          nome,
          codcc as classe_pagamento,
          banco,
          status,
          COALESCE(limite, 0) as limite
        FROM dbclien 
        WHERE codcli = $1
      `;
      params = [codcli];
    } else {
      query = `
        SELECT 
          codcli,
          nome,
          codcc as classe_pagamento,
          banco,
          status,
          COALESCE(limite, 0) as limite
        FROM dbclien 
        WHERE codcli IN ('00002', '00001', '00003')
        ORDER BY codcli
      `;
      params = [];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      console.log('❌ Nenhum cliente encontrado');
      return;
    }

    console.log('📊 Resultado:\n');
    console.table(
      result.rows.map((row) => ({
        Código: row.codcli,
        Nome: row.nome.substring(0, 30),
        Classe: row.classe_pagamento || '(vazio)',
        Banco: row.banco || '(vazio)',
        Status: row.status === 'S' ? 'ATIVO' : 'INATIVO',
        Limite: `R$ ${parseFloat(row.limite).toFixed(2)}`,
      })),
    );

    // Buscar informações das classes de pagamento
    const classesQuery = `
      SELECT codcc, descr 
      FROM dbcclien 
      WHERE codcc IN (${result.rows
        .map((r) => `'${r.classe_pagamento}'`)
        .filter(Boolean)
        .join(',')})
    `;

    if (result.rows.some((r) => r.classe_pagamento)) {
      const classesResult = await pool.query(classesQuery);
      console.log('\n📋 Classes de Pagamento:\n');
      console.table(classesResult.rows);
    }

    // Buscar informações dos bancos
    const bancosQuery = `
      SELECT banco, nome 
      FROM dbbanco_cobranca 
      WHERE banco IN (${result.rows
        .map((r) => `'${r.banco}'`)
        .filter(Boolean)
        .join(',')})
    `;

    if (result.rows.some((r) => r.banco)) {
      const bancosResult = await pool.query(bancosQuery);
      console.log('\n🏦 Bancos:\n');
      console.table(bancosResult.rows);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar
const codcli = process.argv[2];
verificarClasseBanco(codcli).then(() => {
  console.log('\n✅ Verificação concluída\n');
  process.exit(0);
});
