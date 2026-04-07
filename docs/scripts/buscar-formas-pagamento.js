const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function buscarFormasPagamento() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n🔍 Buscando Formas de Pagamento disponíveis...\n');

    // Buscar formas de pagamento únicas
    const query = `
      SELECT DISTINCT 
        cod_fpgto,
        tp_pgto,
        COUNT(*) as quantidade
      FROM db_manaus.dbfpgto
      WHERE cod_fpgto IS NOT NULL
      GROUP BY cod_fpgto, tp_pgto
      ORDER BY cod_fpgto;
    `;

    const result = await client.query(query);

    console.log(`📋 Encontradas ${result.rows.length} formas de pagamento:\n`);

    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        const tipo = row.tp_pgto === 'C' ? 'Cheque' : 
                     row.tp_pgto === 'D' ? 'Dinheiro' :
                     row.tp_pgto === 'T' ? 'Transferência' :
                     row.tp_pgto === 'P' ? 'PIX' :
                     row.tp_pgto === 'B' ? 'Boleto' :
                     row.tp_pgto === 'R' ? 'Cartão Crédito' :
                     row.tp_pgto === 'E' ? 'Cartão Débito' :
                     'Outros';
        
        console.log(`   ${row.cod_fpgto} - ${tipo} (${row.quantidade} registros)`);
      });
    }

    // Buscar descrições de formas de pagamento se houver tabela de cadastro
    console.log('\n\n🔍 Verificando tabela de cadastro de formas de pagamento...\n');

    const queryTabelas = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'db_manaus'
        AND (
          table_name LIKE '%fpgto%' 
          OR table_name LIKE '%forma%pagamento%'
          OR table_name LIKE '%tipo%pagamento%'
        )
      ORDER BY table_name;
    `;

    const tabelas = await client.query(queryTabelas);

    if (tabelas.rows.length > 0) {
      console.log('📊 Tabelas relacionadas a formas de pagamento:\n');
      tabelas.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });

      // Tentar buscar da tabela dbfpgto se tiver descrição
      const queryDesc = `
        SELECT 
          column_name
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbfpgto'
          AND (
            column_name LIKE '%desc%'
            OR column_name LIKE '%nome%'
          );
      `;

      const colunas = await client.query(queryDesc);
      
      if (colunas.rows.length > 0) {
        console.log('\n📝 Colunas de descrição encontradas:');
        colunas.rows.forEach(col => {
          console.log(`   - ${col.column_name}`);
        });
      }
    }

    console.log('\n✅ Pesquisa concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

buscarFormasPagamento();
