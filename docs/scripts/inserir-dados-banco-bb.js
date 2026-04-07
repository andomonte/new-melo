// Inserir dados bancários do Banco do Brasil na tabela dbdados_banco
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function inserirDadosBancoBB() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🏦 Inserindo dados do Banco do Brasil (0005)...\n');

    // Verificar se já existe
    const verificar = await pool.query(
      `SELECT * FROM db_manaus.dbdados_banco WHERE banco = '001'`
    );

    if (verificar.rows.length > 0) {
      console.log('⚠️  Registro já existe. Atualizando...');
      
      await pool.query(
        `UPDATE db_manaus.dbdados_banco 
         SET 
           nroconta = $1,
           agencia = $2,
           convenio = $3,
           carteira = $4
         WHERE banco = $5`,
        [
          '0000000',        // Número da conta (7 dígitos)
          '0000',           // Agência (4 dígitos)
          '1805313900',     // Convênio (10 primeiros dígitos)
          '17',             // Carteira RCR (Cobrança Simples)
          '001'             // Código padrão BB (001)
        ]
      );
      
      console.log('✅ Dados do Banco do Brasil atualizados!');
    } else {
      console.log('➕ Criando novo registro...');
      
      await pool.query(
        `INSERT INTO db_manaus.dbdados_banco (banco, nroconta, agencia, convenio, carteira)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          '001',            // Código padrão BB
          '0000000',        // Número da conta
          '0000',           // Agência
          '1805313900',     // Convênio (10 primeiros dígitos)
          '17'              // Carteira
        ]
      );
      
      console.log('✅ Dados do Banco do Brasil inseridos!');
    }

    // Mostrar dados finais
    const resultado = await pool.query(
      `SELECT * FROM db_manaus.dbdados_banco WHERE banco = '001'`
    );
    
    console.log('\n📋 Dados cadastrados:');
    console.log(JSON.stringify(resultado.rows[0], null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

inserirDadosBancoBB();
