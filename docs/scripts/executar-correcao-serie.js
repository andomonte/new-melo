// Corrigir série da fatura 000234546
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
async function corrigirSerie() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔧 Corrigindo série da fatura 000234546...\n');

    const updateQuery = `
      UPDATE db_manaus.dbfatura 
      SET serie = '2' 
      WHERE codfat = '000234546'
      RETURNING *;
    `;

    const result = await pool.query(updateQuery);

    if (result.rowCount > 0) {
      console.log('✅ Fatura atualizada com sucesso!');
      console.log(`   CODFAT: ${result.rows[0].codfat}`);
      console.log(`   Série: ${result.rows[0].serie}`);
      console.log('');

      // Verificar se agora a query MAX() encontra o número 1
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

      console.log('📊 Teste da query MAX():');
      if (ultimoNumero) {
        console.log(`   ✅ Último número encontrado: ${ultimoNumero}`);
        console.log(`   ✅ Próximo número será: ${parseInt(ultimoNumero) + 1}`);
        console.log('');
        console.log('🎉 SUCESSO! A query agora encontra o número 1!');
        console.log('   O próximo número será 2 (mas número 2 já existe na SEFAZ)');
        console.log('');
        console.log('⚠️  ATENÇÃO: Ainda precisamos registrar a NFe número 2 no banco!');
      } else {
        console.log('   ❌ Ainda não encontrou (pode ser problema no nrodoc_fiscal)');
      }
      console.log('');

      // Verificar valor do nrodoc_fiscal
      const queryNfe = `
        SELECT nrodoc_fiscal, status, chave
        FROM db_manaus.dbfat_nfe
        WHERE codfat = '000234546';
      `;

      const nfeResult = await pool.query(queryNfe);
      if (nfeResult.rows.length > 0) {
        const nfe = nfeResult.rows[0];
        console.log('🔍 Verificando nrodoc_fiscal:');
        console.log(`   Valor: "${nfe.nrodoc_fiscal}"`);
        console.log(`   Tipo: ${typeof nfe.nrodoc_fiscal}`);
        console.log(`   Status: ${nfe.status}`);
        console.log('');

        // Verificar se é numérico
        if (!/^[0-9]+$/.test(nfe.nrodoc_fiscal)) {
          console.log(`   ⚠️  PROBLEMA: nrodoc_fiscal não é numérico!`);
          console.log(`   Precisa ser atualizado para "1"`);
        }
      }

    } else {
      console.log('❌ Nenhuma linha foi atualizada');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

corrigirSerie();
