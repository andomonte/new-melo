const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function testUpdate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Testando query UPDATE na dbpgto (BEGIN/ROLLBACK para não alterar dados)...\n');

    await client.query('BEGIN');

    const updateQuery = `
      UPDATE dbpgto
      SET paga = 'S',
          dt_pgto = $2,
          valor_pago = $3,
          obs = COALESCE($4, obs),
          banco = $5,
          cod_ccusto = COALESCE($6, cod_ccusto),
          valor_juros = $7,
          cod_conta = COALESCE($8, cod_conta)
      WHERE cod_pgto = $1
      RETURNING *
    `;
    
    console.log('Query a ser testada:');
    console.log(updateQuery);
    console.log('\nExecutando UPDATE com cod_pgto = 27585...\n');

    const params = [
      '27585',                    // $1 - id
      '2025-11-12',              // $2 - dt_pgto
      3444.00,                   // $3 - valor_pago
      'Teste de pagamento',      // $4 - obs
      'Banco Teste',             // $5 - banco
      null,                      // $6 - cod_ccusto
      0,                         // $7 - valor_juros
      null                       // $8 - cod_conta
    ];

    const result = await client.query(updateQuery, params);

    console.log(`✅ Query UPDATE executada com sucesso! Afetou ${result.rowCount} linha(s)`);
    console.log('Dados retornados:', result.rows[0]);

    await client.query('ROLLBACK');
    console.log('\n✅ ROLLBACK executado - dados não foram alterados');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error);
    console.error('\nPosição do erro:', error.position);
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
  } finally {
    await client.end();
  }
}

testUpdate();
