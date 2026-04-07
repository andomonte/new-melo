require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'srv-captain--postgre-oracle',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'db_manaus',
  user: process.env.DB_USER || 'postgre',
  password: process.env.DB_PASSWORD || 'Skynd@2019',
});

async function listarContasPorBanco() {
  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('🏦  TODAS AS CONTAS POR BANCO');
    console.log('════════════════════════════════════════════════════════\n');

    // Buscar todos os bancos e suas contas (apenas com números)
    const contas = await pool.query(`
      SELECT 
        cod_banco,
        cod_conta,
        nro_conta,
        digito,
        oficial
      FROM db_manaus.dbconta
      WHERE oficial = 'S'
      AND nro_conta ~ '^[0-9]+$'
      ORDER BY cod_banco, cod_conta;
    `);

    // Agrupar por banco
    const bancos = {};
    contas.rows.forEach(conta => {
      if (!bancos[conta.cod_banco]) {
        bancos[conta.cod_banco] = [];
      }
      bancos[conta.cod_banco].push(conta);
    });

    // Exibir por banco
    Object.entries(bancos).forEach(([codBanco, contasBanco]) => {
      console.log(`   ┌─ BANCO: ${codBanco}`);
      console.log(`   │`);
      contasBanco.forEach(conta => {
        const digito = conta.digito ? `-${conta.digito}` : '';
        console.log(`   │  📌 Conta: ${conta.nro_conta}${digito}`);
        console.log(`   │     Código: ${conta.cod_conta}`);
      });
      console.log('   └─\n');
    });

    // Mapear códigos de banco para nomes
    console.log('────────────────────────────────────────────────────────');
    console.log('🔍 CÓDIGOS DOS BANCOS:');
    console.log('────────────────────────────────────────────────────────\n');

    const bancoNomes = {
      '0000': 'Sistema/Interno',
      '0001': 'Banco do Brasil',
      '0002': 'Outro',
      '0062': 'Hipercard/Bradesco',
      '0067': 'Safra',
      '0071': 'Outro Banco'
    };

    Object.entries(bancos).forEach(([codBanco, contasBanco]) => {
      const nome = bancoNomes[codBanco] || 'Desconhecido';
      console.log(`   ${codBanco} → ${nome} (${contasBanco.length} conta(s))`);
    });

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ Listagem concluída!');
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

listarContasPorBanco();
