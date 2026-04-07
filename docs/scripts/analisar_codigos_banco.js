const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function analisarCodigosBanco() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Verificar relação entre códigos de banco
    console.log('Relação entre códigos de banco na dbreceb e dbbanco:');
    const relacao = await client.query(`
      SELECT DISTINCT d.cod_banco, d.nome, r.banco
      FROM db_manaus.dbbanco d
      INNER JOIN db_manaus.dbreceb r ON d.cod_banco = r.banco
      ORDER BY r.banco
    `);

    relacao.rows.forEach(row => {
      console.log(`Código ${row.banco} = ${row.cod_banco} - ${row.nome}`);
    });

    // Verificar bancos distintos usados nas remessas
    console.log('\nBancos distintos nas remessas existentes:');
    const bancosRemessa = await client.query(`
      SELECT DISTINCT ra.banco, COUNT(*) as quantidade
      FROM db_manaus.dbremessa_arquivo ra
      GROUP BY ra.banco
      ORDER BY ra.banco
    `);

    bancosRemessa.rows.forEach(row => {
      console.log(`${row.banco}: ${row.quantidade} remessas`);
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

analisarCodigosBanco();