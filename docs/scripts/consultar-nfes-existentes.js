// Script para verificar NFes números 1 e 2 no banco
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function verificarNFes() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Verificando NFes números 1 e 2 no banco local...\n');

    // Buscar NFes com os números específicos
    const query = `
      SELECT 
        nfe.codfat,
        nfe.chave,
        nfe.status,
        nfe.nrodoc_fiscal,
        nfe.numprotocolo,
        nfe.dthrprotocolo,
        f.serie
      FROM db_manaus.dbfat_nfe nfe
      LEFT JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE nfe.chave IN (
        '13251018053139000169550020000000011208942310',
        '13251018053139000169550020000000021000240867'
      )
      OR (f.serie = '2' AND nfe.nrodoc_fiscal IN ('1', '2', '000000001', '000000002'))
      ORDER BY CAST(nfe.nrodoc_fiscal AS INTEGER);
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ NENHUMA das NFes (1 ou 2) foi encontrada no banco local!');
      console.log('');
      console.log('📋 Isso confirma que:');
      console.log('   - As NFes foram autorizadas na SEFAZ');
      console.log('   - Mas NÃO foram salvas no banco local');
      console.log('   - Sistema está "cego" e não sabe que elas existem');
      console.log('');
      console.log('✅ Correção aplicada: Sistema vai começar do número 3');
      console.log('');
    } else {
      console.log(`✅ Encontradas ${result.rows.length} NFe(s) no banco:\n`);
      
      result.rows.forEach((row, index) => {
        console.log(`NFe ${index + 1}:`);
        console.log(`  CODFAT: ${row.codfat}`);
        console.log(`  Número: ${row.nrodoc_fiscal}`);
        console.log(`  Série: ${row.serie || 'N/A'}`);
        console.log(`  Status: ${row.status}`);
        console.log(`  Chave: ${row.chave}`);
        console.log(`  Protocolo: ${row.numprotocolo || 'N/A'}`);
        console.log(`  Data: ${row.dthrprotocolo || 'N/A'}`);
        console.log('');
      });
    }

    // Buscar último número autorizado
    const queryMax = `
      SELECT MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) as ultimo_numero
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2'
        AND nfe.nrodoc_fiscal IS NOT NULL
        AND nfe.nrodoc_fiscal != ''
        AND nfe.nrodoc_fiscal::text ~ '^[0-9]+$'
        AND nfe.status = '100';
    `;

    const maxResult = await pool.query(queryMax);
    const ultimoNumero = maxResult.rows[0]?.ultimo_numero;

    console.log('📊 Análise do próximo número:');
    if (ultimoNumero) {
      console.log(`   Último número AUTORIZADO no banco: ${ultimoNumero}`);
      console.log(`   Próximo número a ser usado: ${parseInt(ultimoNumero) + 1}`);
    } else {
      console.log('   Último número AUTORIZADO no banco: NENHUM');
      console.log('   Próximo número a ser usado: 3 (correção aplicada)');
    }
    console.log('');

    // Verificar todas as NFes da série 2
    const queryTodas = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = '100' THEN 1 END) as autorizadas,
        COUNT(CASE WHEN status != '100' THEN 1 END) as nao_autorizadas
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2';
    `;

    const todasResult = await pool.query(queryTodas);
    const stats = todasResult.rows[0];

    console.log('📈 Estatísticas da série 2:');
    console.log(`   Total de NFes: ${stats.total}`);
    console.log(`   Autorizadas (100): ${stats.autorizadas}`);
    console.log(`   Não autorizadas: ${stats.nao_autorizadas}`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
  } finally {
    await pool.end();
  }
}

verificarNFes();
