const { Pool } = require('pg');
require('dotenv').config();

async function verificarTabelasReceber() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔍 Verificando tabelas de recebimento no PostgreSQL...\n');

    // 1. Listar todas as tabelas relacionadas a recebimento
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 TABELAS RELACIONADAS A RECEBIMENTO NO POSTGRESQL');
    console.log('═══════════════════════════════════════════════════════\n');

    const tabelasQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'db_manaus') as num_colunas
      FROM information_schema.tables t
      WHERE table_schema = 'db_manaus' 
        AND (table_name LIKE '%receb%' OR table_name = 'dbclien' OR table_name = 'dbconta' OR table_name = 'dbvend')
      ORDER BY table_name
    `;

    const tabelasResult = await pool.query(tabelasQuery);
    
    console.log(`Tabelas encontradas: ${tabelasResult.rows.length}\n`);
    console.log('TABELA                    | COLUNAS');
    console.log('--------------------------|--------');
    
    for (const row of tabelasResult.rows) {
      const table = row.table_name.padEnd(25);
      console.log(`${table} | ${row.num_colunas}`);
    }

    // 2. Verificar estrutura da tabela dbreceb
    if (tabelasResult.rows.some(r => r.table_name === 'dbreceb')) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📋 ESTRUTURA DA TABELA dbreceb NO POSTGRESQL');
      console.log('═══════════════════════════════════════════════════════\n');

      const colunasQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus' AND table_name = 'dbreceb'
        ORDER BY ordinal_position
      `;

      const colunasResult = await pool.query(colunasQuery);
      
      console.log(`Colunas encontradas: ${colunasResult.rows.length}\n`);
      console.log('COLUNA                | TIPO         | TAMANHO | PRECISÃO | ESCALA | ANULÁVEL');
      console.log('----------------------|--------------|---------|----------|--------|----------');
      
      colunasResult.rows.forEach(row => {
        const col = (row.column_name || '').padEnd(21);
        const type = (row.data_type || '').padEnd(12);
        const len = String(row.character_maximum_length || row.numeric_precision || '-').padEnd(7);
        const prec = String(row.numeric_precision || '-').padEnd(8);
        const scale = String(row.numeric_scale || '-').padEnd(6);
        const nullable = row.is_nullable || '';
        console.log(`${col} | ${type} | ${len} | ${prec} | ${scale} | ${nullable}`);
      });

      // 3. Contar registros
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 CONTAGEM DE REGISTROS');
      console.log('═══════════════════════════════════════════════════════\n');

      const countQuery = 'SELECT COUNT(*) as total FROM db_manaus.dbreceb';
      const countResult = await pool.query(countQuery);
      console.log(`Total de registros na dbreceb: ${countResult.rows[0].total}`);

      // 4. Exemplo de dados
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 EXEMPLO DE DADOS (5 primeiros registros)');
      console.log('═══════════════════════════════════════════════════════\n');

      const dadosQuery = 'SELECT * FROM db_manaus.dbreceb ORDER BY cod_receb DESC LIMIT 5';
      const dadosResult = await pool.query(dadosQuery);

      if (dadosResult.rows.length > 0) {
        console.log('Primeiro registro:');
        console.log(JSON.stringify(dadosResult.rows[0], null, 2));
      } else {
        console.log('⚠️  Nenhum registro encontrado');
      }

      // 5. Verificar relacionamentos/constraints
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('🔗 CONSTRAINTS E ÍNDICES DA TABELA dbreceb');
      console.log('═══════════════════════════════════════════════════════\n');

      const constraintsQuery = `
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'db_manaus' AND tc.table_name = 'dbreceb'
        ORDER BY tc.constraint_type, tc.constraint_name
      `;

      const constraintsResult = await pool.query(constraintsQuery);
      
      if (constraintsResult.rows.length > 0) {
        console.log(`Constraints encontradas: ${constraintsResult.rows.length}\n`);
        console.log('NOME                      | TIPO | COLUNA           | TABELA REFERÊNCIA');
        console.log('--------------------------|------|------------------|------------------');
        
        constraintsResult.rows.forEach(row => {
          const name = (row.constraint_name || '').substring(0, 25).padEnd(25);
          const type = (row.constraint_type || '').padEnd(4);
          const col = (row.column_name || '').padEnd(16);
          const ref = row.foreign_table_name || '-';
          console.log(`${name} | ${type} | ${col} | ${ref}`);
        });
      } else {
        console.log('Nenhuma constraint encontrada');
      }
    } else {
      console.log('\n⚠️  Tabela dbreceb não encontrada no PostgreSQL!');
    }

    // 6. Verificar se existe tabela dbfreceb (histórico)
    if (tabelasResult.rows.some(r => r.table_name === 'dbfreceb')) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📋 ESTRUTURA DA TABELA dbfreceb (Histórico)');
      console.log('═══════════════════════════════════════════════════════\n');

      const colunasHistQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus' AND table_name = 'dbfreceb'
        ORDER BY ordinal_position
      `;

      const colunasHistResult = await pool.query(colunasHistQuery);
      
      console.log(`Colunas encontradas: ${colunasHistResult.rows.length}\n`);
      console.log('COLUNA                | TIPO         | TAMANHO | ANULÁVEL');
      console.log('----------------------|--------------|---------|----------');
      
      colunasHistResult.rows.forEach(row => {
        const col = (row.column_name || '').padEnd(21);
        const type = (row.data_type || '').padEnd(12);
        const len = String(row.character_maximum_length || '-').padEnd(7);
        const nullable = row.is_nullable || '';
        console.log(`${col} | ${type} | ${len} | ${nullable}`);
      });

      const countHistQuery = 'SELECT COUNT(*) as total FROM db_manaus.dbfreceb';
      const countHistResult = await pool.query(countHistQuery);
      console.log(`\nTotal de registros na dbfreceb: ${countHistResult.rows[0].total}`);
    }

    console.log('\n✅ Verificação concluída com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro durante a verificação:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Conexão fechada');
  }
}

verificarTabelasReceber()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Erro fatal:', err);
    process.exit(1);
  });
