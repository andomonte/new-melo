
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function verificarUltimaFatura() {
    const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🔍  VERIFICANDO ÚLTIMA FATURA GERADA');
    console.log('════════════════════════════════════════════════════════\n');

    // Buscar a última fatura gerada
    const fatura = await pool.query(`
      SELECT 
        f.codfat,
        f.codcli,
        f.serie,
        f.totalfat,
        f.data,
        c.nome,
        c.nomefant,
        c.cpfcgc,
        LENGTH(REPLACE(REPLACE(c.cpfcgc, '.', ''), '-', '')) as tamanho_doc,
        CASE 
          WHEN LENGTH(REPLACE(REPLACE(c.cpfcgc, '.', ''), '-', '')) = 14 THEN 'CNPJ'
          WHEN LENGTH(REPLACE(REPLACE(c.cpfcgc, '.', ''), '-', '')) = 11 THEN 'CPF'
          ELSE 'INVÁLIDO'
        END as tipo_documento
      FROM db_manaus.dbfatura f
      JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      ORDER BY f.codfat DESC
      LIMIT 1;
    `);

    if (fatura.rows.length > 0) {
      const f = fatura.rows[0];
      
      console.log('📋 DADOS DA ÚLTIMA FATURA:\n');
      console.log(`   Código Fatura   : ${f.codfat}`);
      console.log(`   Cliente         : ${f.nome || f.nomefant}`);
      console.log(`   Código Cliente  : ${f.codcli}`);
      console.log(`   CPF/CNPJ        : ${f.cpfcgc}`);
      console.log(`   Tipo Documento  : ${f.tipo_documento} (${f.tamanho_doc} dígitos)`);
      console.log(`   Série           : ${f.serie}`);
      console.log(`   Valor Total     : R$ ${parseFloat(f.totalfat).toFixed(2)}`);
      console.log(`   Data            : ${f.data}`);

      console.log('\n────────────────────────────────────────────────────────');
      console.log('🎫 ANÁLISE PARA NFC-E (CUPOM FISCAL):');
      console.log('────────────────────────────────────────────────────────\n');

      if (f.tipo_documento === 'CNPJ') {
        console.log('   ❌ ERRO: Cliente possui CNPJ!');
        console.log('   \n   NFC-e (Cupom Fiscal - Modelo 65) só pode ser emitido para:');
        console.log('   - Clientes com CPF');
        console.log('   - Consumidor final sem documento\n');
        console.log('   📝 SOLUÇÃO:');
        console.log('   - Para clientes com CNPJ, deve-se emitir NF-e (Nota Fiscal - Modelo 55)');
        console.log('   - Use a API /api/faturamento/emitir ao invés de /api/faturamento/emitir-cupom\n');
      } else if (f.tipo_documento === 'CPF') {
        console.log('   ✅ Cliente possui CPF - pode emitir NFC-e');
      } else {
        console.log('   ⚠️  Documento inválido ou não informado');
      }
    } else {
      console.log('⚠️  Nenhuma fatura encontrada\n');
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ Verificação concluída!');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.log('\n════════════════════════════════════════════════════════');
    console.error('❌ ERRO');
    console.log('════════════════════════════════════════════════════════\n');
    console.error('Mensagem:', error.message);
    console.log('\n════════════════════════════════════════════════════════\n');
  } finally {
    await pool.end();
  }
}

verificarUltimaFatura();
