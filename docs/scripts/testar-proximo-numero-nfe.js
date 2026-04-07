const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function testarProximoNumero() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  const client = await pool.connect();

  try {
    console.log('🔍 Testando lógica de próximo número de NFe...\n');

    // Teste 1: Buscar números já autorizados na série 9
    const serie = '9';
    const result = await client.query(
      `SELECT nrodoc_fiscal, chave, status, numprotocolo
       FROM db_manaus.dbfat_nfe 
       WHERE serie = $1 
         AND status = '100'
       ORDER BY CAST(nrodoc_fiscal AS INTEGER) DESC
       LIMIT 10`,
      [serie]
    );

    console.log(`📊 Números já autorizados na série ${serie}:`);
    result.rows.forEach((row) => {
      console.log(`  - Número: ${row.nrodoc_fiscal}, Status: ${row.status}, Protocolo: ${row.numprotocolo}`);
    });

    const numerosUsados = new Set(
      result.rows.map((row) => parseInt(row.nrodoc_fiscal, 10))
    );

    // Teste 2: Simular busca do próximo número a partir do número 1
    let numeroAtual = 1;
    let proximoNumero = numeroAtual;

    while (numerosUsados.has(proximoNumero)) {
      console.log(`  ⚠️ Número ${proximoNumero} já usado, incrementando...`);
      proximoNumero++;
    }

    console.log(`\n✅ Próximo número disponível para série ${serie}: ${proximoNumero}`);
    console.log(`   (partindo de ${numeroAtual})`);

    // Teste 3: Verificar se existe algum número "perdido" no meio da sequência
    if (numerosUsados.size > 1) {
      const numerosOrdenados = Array.from(numerosUsados).sort((a, b) => a - b);
      console.log(`\n🔢 Sequência de números usados:`, numerosOrdenados.slice(0, 20));
      
      // Verificar gaps
      const gaps = [];
      for (let i = 0; i < numerosOrdenados.length - 1; i++) {
        if (numerosOrdenados[i + 1] - numerosOrdenados[i] > 1) {
          gaps.push(`Entre ${numerosOrdenados[i]} e ${numerosOrdenados[i + 1]}`);
        }
      }
      
      if (gaps.length > 0) {
        console.log(`\n⚠️ Gaps encontrados na sequência:`, gaps);
      } else {
        console.log(`\n✅ Nenhum gap encontrado - sequência contínua`);
      }
    }

    // Teste 4: Verificar chaves duplicadas
    const duplicatasResult = await client.query(
      `SELECT chave, COUNT(*) as total
       FROM db_manaus.dbfat_nfe 
       WHERE serie = $1 
       GROUP BY chave
       HAVING COUNT(*) > 1`,
      [serie]
    );

    if (duplicatasResult.rows.length > 0) {
      console.log(`\n❌ ATENÇÃO: Chaves duplicadas encontradas:`);
      duplicatasResult.rows.forEach((row) => {
        console.log(`  - Chave: ${row.chave} (${row.total} vezes)`);
      });
    } else {
      console.log(`\n✅ Nenhuma chave duplicada encontrada`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testarProximoNumero();
