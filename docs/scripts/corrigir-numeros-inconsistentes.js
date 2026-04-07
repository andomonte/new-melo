const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function corrigirNumerosInconsistentes() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔧 CORREÇÃO DE NÚMEROS INCONSISTENTES\n');
    console.log('=' .repeat(80));
    
    // Buscar todas as NFes com chave
    const query = `
      SELECT 
        nfe.codfat,
        nfe.nrodoc_fiscal,
        nfe.chave,
        nfe.status
      FROM db_manaus.dbfat_nfe nfe
      WHERE nfe.chave IS NOT NULL AND nfe.chave != ''
      ORDER BY nfe.codfat
    `;
    
    const result = await client.query(query);
    
    console.log(`\n📊 Analisando ${result.rows.length} NFes com chave...\n`);
    
    const correcoes = [];
    
    for (const nfe of result.rows) {
      // Extrair número da chave (posições 25-34)
      const numeroDaChave = nfe.chave.substring(25, 34);
      const numeroNaChave = parseInt(numeroDaChave);
      const numeroNoBanco = parseInt(nfe.nrodoc_fiscal);
      
      if (numeroNaChave !== numeroNoBanco) {
        console.log(`⚠️  INCONSISTÊNCIA ENCONTRADA:`);
        console.log(`   Fatura: ${nfe.codfat}`);
        console.log(`   Número no banco: ${numeroNoBanco}`);
        console.log(`   Número na chave: ${numeroNaChave}`);
        console.log(`   Status: ${nfe.status}`);
        console.log(`   Chave: ${nfe.chave}`);
        console.log('');
        
        correcoes.push({
          codfat: nfe.codfat,
          numeroAtual: numeroNoBanco,
          numeroCorreto: numeroNaChave,
          status: nfe.status
        });
      }
    }
    
    if (correcoes.length === 0) {
      console.log('✅ Não há inconsistências! Todos os números estão corretos.');
    } else {
      console.log(`\n🔨 APLICANDO ${correcoes.length} CORREÇÕES:\n`);
      console.log('=' .repeat(80));
      
      for (const correcao of correcoes) {
        console.log(`\n📝 Corrigindo fatura ${correcao.codfat}:`);
        console.log(`   ${correcao.numeroAtual} → ${correcao.numeroCorreto}`);
        
        const updateQuery = `
          UPDATE db_manaus.dbfat_nfe
          SET nrodoc_fiscal = $1
          WHERE codfat = $2
        `;
        
        await client.query(updateQuery, [
          correcao.numeroCorreto.toString(),
          correcao.codfat
        ]);
        
        console.log(`   ✅ Atualizado!`);
      }
      
      console.log('\n\n✅ TODAS AS CORREÇÕES APLICADAS COM SUCESSO!');
    }
    
    // Verificar último número real
    console.log('\n\n📊 VERIFICAÇÃO FINAL:\n');
    console.log('=' .repeat(80));
    
    const queryUltimo = `
      SELECT 
        MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) as ultimo_numero
      FROM db_manaus.dbfat_nfe nfe
      INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
      WHERE f.serie = '2' AND nfe.status = '100'
    `;
    
    const ultimoResult = await client.query(queryUltimo);
    const ultimo = ultimoResult.rows[0].ultimo_numero;
    
    console.log(`\nÚltimo número AUTORIZADO na série 2: ${ultimo}`);
    console.log(`Próximo número disponível: ${ultimo + 1}`);
    
  } catch (error) {
    console.error('\n❌ Erro na correção:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

corrigirNumerosInconsistentes();
