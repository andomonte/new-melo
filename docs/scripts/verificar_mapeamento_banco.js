const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
async function verificarMapeamentoBanco() {

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // 1. Verificar estrutura da tabela dbbanco
    console.log('📋 Estrutura da tabela dbbanco no PostgreSQL:\n');
    const estrutura = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbbanco'
      ORDER BY ordinal_position
    `);

    console.log('COLUNA                | TIPO            | TAMANHO');
    console.log('----------------------|-----------------|----------');
    estrutura.rows.forEach(row => {
      const col = (row.column_name || '').padEnd(21);
      const tipo = (row.data_type || '').padEnd(15);
      const tam = row.character_maximum_length || '-';
      console.log(`${col} | ${tipo} | ${tam}`);
    });

    // 2. Verificar bancos cadastrados
    console.log('\n📊 Bancos cadastrados no PostgreSQL:\n');
    const bancos = await client.query(`
      SELECT cod_banco, cod_bc, nome, n_agencia
      FROM db_manaus.dbbanco
      WHERE cod_banco IN ('0000', '0001', '0002')
        OR cod_bc IN ('237', '033')
      ORDER BY cod_banco
      LIMIT 20
    `);

    console.log('COD_BANCO | COD_BC | NOME                              | AGÊNCIA');
    console.log('----------|--------|-----------------------------------|----------');
    bancos.rows.forEach(row => {
      const cod = (row.cod_banco || '').padEnd(9);
      const codBc = (row.cod_bc || '').padEnd(6);
      const nome = (row.nome || '').substring(0, 33).padEnd(33);
      const agencia = (row.n_agencia || '').padEnd(8);
      console.log(`${cod} | ${codBc} | ${nome} | ${agencia}`);
    });

    // 3. Verificar distribuição de títulos por banco (campo r.banco)
    console.log('\n📊 Distribuição de títulos por BANCO (campo r.banco no dbreceb):\n');
    const distBanco = await client.query(`
      SELECT 
        COALESCE(banco, 'NULL') as banco_codigo,
        COUNT(*) as quantidade,
        COUNT(CASE WHEN bradesco = 'N' THEN 1 END) as nao_enviados,
        COUNT(CASE WHEN bradesco = 'S' THEN 1 END) as enviados
      FROM db_manaus.dbreceb
      WHERE forma_fat = '2'
        AND dt_venc >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY banco
      ORDER BY quantidade DESC
      LIMIT 10
    `);

    console.log('BANCO | QTD TOTAL | NÃO ENVIADOS | ENVIADOS');
    console.log('------|-----------|--------------|----------');
    distBanco.rows.forEach(row => {
      const banco = (row.banco_codigo || 'NULL').padEnd(5);
      const total = String(row.quantidade).padStart(9);
      const naoEnv = String(row.nao_enviados).padStart(12);
      const env = String(row.enviados).padStart(8);
      console.log(`${banco} | ${total} | ${naoEnv} | ${env}`);
    });

    // 4. Testar o JOIN com LPAD
    console.log('\n🔍 Testando JOIN com LPAD (r.banco → dbbanco.cod_banco):\n');
    const testJoin = await client.query(`
      SELECT 
        r.banco as banco_original,
        LPAD(COALESCE(r.banco, '0'), 4, '0') as banco_lpad,
        cb.cod_banco,
        cb.cod_bc,
        cb.nome as nome_banco,
        COUNT(*) as qtd_titulos
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.forma_fat = '2'
        AND r.dt_venc >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY r.banco, cb.cod_banco, cb.cod_bc, cb.nome
      ORDER BY qtd_titulos DESC
      LIMIT 10
    `);

    console.log('BANCO_ORIG | LPAD    | COD_BANCO | COD_BC | NOME_BANCO                        | QTD');
    console.log('-----------|---------|-----------|--------|-----------------------------------|-----');
    testJoin.rows.forEach(row => {
      const orig = (row.banco_original || 'NULL').padEnd(10);
      const lpad = (row.banco_lpad || '').padEnd(7);
      const codBanco = (row.cod_banco || 'NULL').padEnd(9);
      const codBc = (row.cod_bc || '').padEnd(6);
      const nome = (row.nome_banco || 'SEM NOME').substring(0, 33).padEnd(33);
      const qtd = String(row.qtd_titulos).padStart(3);
      console.log(`${orig} | ${lpad} | ${codBanco} | ${codBc} | ${nome} | ${qtd}`);
    });

    // 5. Verificar mapeamento correto BRADESCO e SANTANDER
    console.log('\n🏦 Verificando mapeamento BRADESCO (237) e SANTANDER (033):\n');
    const mapeamento = await client.query(`
      SELECT 
        cod_banco,
        cod_bc,
        nome
      FROM db_manaus.dbbanco
      WHERE cod_bc IN ('237', '033')
      ORDER BY cod_bc
    `);

    if (mapeamento.rows.length > 0) {
      console.log('COD_BANCO | COD_BC | NOME');
      console.log('----------|--------|----------------------------------');
      mapeamento.rows.forEach(row => {
        const cod = (row.cod_banco || '').padEnd(9);
        const codBc = (row.cod_bc || '').padEnd(6);
        const nome = (row.nome || '').substring(0, 40);
        console.log(`${cod} | ${codBc} | ${nome}`);
      });

      // 6. Verificar qual valor de r.banco corresponde a cada banco
      console.log('\n🔍 Qual valor de r.banco corresponde a BRADESCO e SANTANDER?\n');
      
      for (const banco of mapeamento.rows) {
        // Fazer o cálculo reverso: se cod_banco = '0000', então r.banco deveria ser '0'
        const bancoValor = banco.cod_banco.replace(/^0+/, '') || '0';
        
        console.log(`${banco.nome}:`);
        console.log(`  - COD_BC: ${banco.cod_bc}`);
        console.log(`  - COD_BANCO (dbbanco): ${banco.cod_banco}`);
        console.log(`  - VALOR ESPERADO em r.banco: ${bancoValor}`);
        console.log(`  - LPAD('${bancoValor}', 4, '0') = '${bancoValor.padStart(4, '0')}' ${bancoValor.padStart(4, '0') === banco.cod_banco ? '✅ MATCH' : '❌ NO MATCH'}\n`);
      }
    } else {
      console.log('⚠️ Nenhum banco encontrado com COD_BC 237 ou 033!');
    }

    // 7. Verificar o que está na API
    console.log('\n🔧 Verificação do filtro da API:\n');
    console.log('Frontend envia:');
    console.log('  - BRADESCO → banco = "237"');
    console.log('  - SANTANDER → banco = "033"\n');
    
    console.log('Backend espera filtrar por r.banco = ?');
    console.log('Mas r.banco armazena: 0, 1, 2, etc (códigos simples)\n');
    
    console.log('⚠️ PROBLEMA IDENTIFICADO:');
    console.log('   Frontend está enviando COD_BC (237/033)');
    console.log('   Backend precisa filtrar por r.banco (0/1/2)\n');
    
    console.log('💡 SOLUÇÃO:');
    console.log('   1. Frontend deve enviar: BRADESCO → "0", SANTANDER → "1" ou "2"');
    console.log('   2. OU converter no backend: 237 → buscar cod_banco → pegar último dígito\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n✅ Conexão fechada');
  }
}

verificarMapeamentoBanco();
