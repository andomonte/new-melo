const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function investigarParcelas() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Investigando estrutura de parcelas...\n');

    // 1. Verificar se existe campo de parcelas em dbpgto_ent
    console.log('1️⃣ Colunas da tabela dbpgto_ent:');
    const colunasPgto = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto_ent'
      ORDER BY ordinal_position
    `);
    console.table(colunasPgto.rows);

    // 2. Verificar contas com parcelas (se existir campo nro_parcela ou similar)
    console.log('\n2️⃣ Buscando campos relacionados a parcelas:');
    const camposParcela = colunasPgto.rows.filter(col => 
      col.column_name.toLowerCase().includes('parc') ||
      col.column_name.toLowerCase().includes('duplic') ||
      col.column_name.toLowerCase().includes('nro')
    );
    console.table(camposParcela);

    // 3. Verificar exemplos de contas
    console.log('\n3️⃣ Exemplos de contas (primeiras 10):');
    const exemplos = await client.query(`
      SELECT 
        codpgto,
        valor_pgto,
        dt_venc,
        paga,
        nro_nf,
        nro_dup
      FROM db_manaus.dbpgto_ent
      ORDER BY codpgto DESC
      LIMIT 10
    `);
    console.table(exemplos.rows);

    // 4. Verificar se existe padrão em nro_dup para parcelas
    console.log('\n4️⃣ Padrões em nro_dup (possíveis parcelas):');
    const padroesNroDup = await client.query(`
      SELECT 
        nro_dup,
        COUNT(*) as qtd_contas,
        STRING_AGG(DISTINCT codpgto::text, ', ') as codigos
      FROM db_manaus.dbpgto_ent
      WHERE nro_dup IS NOT NULL AND nro_dup != ''
      GROUP BY nro_dup
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    console.table(padroesNroDup.rows);

    // 5. Buscar contas do mesmo credor com valores similares
    console.log('\n5️⃣ Possíveis parcelas do mesmo credor:');
    const possivelParcelas = await client.query(`
      SELECT 
        codent as cod_credor,
        COUNT(*) as qtd_contas,
        SUM(valor_pgto) as valor_total,
        MIN(dt_venc) as primeira_venc,
        MAX(dt_venc) as ultima_venc
      FROM db_manaus.dbpgto_ent
      GROUP BY codent
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    console.table(possivelParcelas.rows);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

investigarParcelas();
