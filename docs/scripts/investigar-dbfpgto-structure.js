const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function investigarEstrutura() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 INVESTIGAÇÃO DA TABELA DBPGTO NO POSTGRESQL');
    console.log('═'.repeat(80) + '\n');

    // 1. Estrutura da tabela dbpgto
    console.log('📊 1. ESTRUTURA DA TABELA DBPGTO\n');
    
    const queryColunas = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'db_manaus'
        AND table_name = 'dbpgto'
      ORDER BY ordinal_position;
    `;

    const colunas = await client.query(queryColunas);
    console.log(`Total de colunas: ${colunas.rows.length}\n`);
    
    colunas.rows.forEach((col, index) => {
      let tipo = col.data_type;
      if (col.character_maximum_length) {
        tipo += `(${col.character_maximum_length})`;
      } else if (col.numeric_precision) {
        tipo += `(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
      }
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`${(index + 1).toString().padStart(2)}. ${col.column_name.padEnd(25)} ${tipo.padEnd(25)} ${nullable}`);
    });

    // 2. Verificar se existe tabela dbfpgto (formas de pagamento)
    console.log('\n\n🔍 2. VERIFICANDO TABELA DBFPGTO (FORMAS DE PAGAMENTO)\n');
    
    const queryDbfpgto = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbfpgto'
      );
    `;

    const existeDbfpgto = await client.query(queryDbfpgto);
    
    if (existeDbfpgto.rows[0].exists) {
      console.log('✅ Tabela DBFPGTO encontrada!\n');
      
      const queryColunasDbfpgto = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbfpgto'
        ORDER BY ordinal_position;
      `;

      const colunasDbfpgto = await client.query(queryColunasDbfpgto);
      console.log(`Estrutura da DBFPGTO (${colunasDbfpgto.rows.length} colunas):\n`);
      
      colunasDbfpgto.rows.forEach((col, index) => {
        let tipo = col.data_type;
        if (col.character_maximum_length) {
          tipo += `(${col.character_maximum_length})`;
        }
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`${(index + 1).toString().padStart(2)}. ${col.column_name.padEnd(25)} ${tipo.padEnd(25)} ${nullable}`);
      });

      // Exemplos de formas de pagamento
      console.log('\n\n📝 Exemplos de FORMAS DE PAGAMENTO (DBFPGTO):\n');
      const sampleFpgto = await client.query(`
        SELECT * FROM db_manaus.dbfpgto
        ORDER BY cod_fpgto
        LIMIT 10;
      `);

      if (sampleFpgto.rows.length > 0) {
        sampleFpgto.rows.forEach(row => {
          console.log(`   ${row.cod_fpgto} - ${row.desc_fpgto || row.descricao || 'Sem descrição'}`);
        });
      }

    } else {
      console.log('❌ Tabela DBFPGTO não encontrada no PostgreSQL');
      console.log('⚠️  Será necessário criar a tabela de formas de pagamento\n');
    }

    // 3. Analisar registros de dbpgto com formas de pagamento
    console.log('\n\n📊 3. ANÁLISE DE REGISTROS NA DBPGTO\n');

    const queryAnalise = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN paga = 'S' THEN 1 END) as pagas,
        COUNT(CASE WHEN cancel = 'S' THEN 1 END) as canceladas,
        COUNT(CASE WHEN dt_pgto IS NOT NULL THEN 1 END) as com_data_pgto,
        COUNT(CASE WHEN valor_pago IS NOT NULL THEN 1 END) as com_valor_pago,
        COUNT(CASE WHEN banco IS NOT NULL THEN 1 END) as com_banco,
        COUNT(CASE WHEN valor_juros IS NOT NULL AND valor_juros > 0 THEN 1 END) as com_juros
      FROM db_manaus.dbpgto;
    `;

    const analise = await client.query(queryAnalise);
    const stats = analise.rows[0];

    console.log(`Total de registros: ${stats.total}`);
    console.log(`Contas pagas: ${stats.pagas} (${((stats.pagas/stats.total)*100).toFixed(2)}%)`);
    console.log(`Contas canceladas: ${stats.canceladas} (${((stats.canceladas/stats.total)*100).toFixed(2)}%)`);
    console.log(`Com data de pagamento: ${stats.com_data_pgto}`);
    console.log(`Com valor pago: ${stats.com_valor_pago}`);
    console.log(`Com banco informado: ${stats.com_banco}`);
    console.log(`Com juros: ${stats.com_juros}`);

    // 4. Exemplo de registro pago
    console.log('\n\n📝 4. EXEMPLO DE REGISTRO PAGO (COM TODAS AS INFORMAÇÕES):\n');

    const exemploQuery = `
      SELECT *
      FROM db_manaus.dbpgto
      WHERE paga = 'S'
        AND dt_pgto IS NOT NULL
      ORDER BY dt_pgto DESC
      LIMIT 1;
    `;

    const exemplo = await client.query(exemploQuery);

    if (exemplo.rows.length > 0) {
      const reg = exemplo.rows[0];
      console.log('Dados do pagamento:');
      Object.keys(reg).forEach(key => {
        if (reg[key] !== null) {
          console.log(`   ${key}: ${reg[key]}`);
        }
      });
    } else {
      console.log('⚠️  Nenhum registro pago encontrado');
    }

    // 5. Verificar como é a relação com formas de pagamento
    console.log('\n\n🔗 5. RELAÇÃO DBPGTO x DBFPGTO\n');

    // Verificar se existe coluna cod_fpgto em dbpgto
    const temCodFpgto = colunas.rows.find(c => c.column_name === 'cod_fpgto');
    
    if (temCodFpgto) {
      console.log('✅ Coluna COD_FPGTO encontrada em DBPGTO');
      console.log('   Isso indica que cada pagamento tem uma forma de pagamento associada\n');

      // Buscar distribuição de formas de pagamento
      const distQuery = `
        SELECT 
          cod_fpgto,
          COUNT(*) as quantidade
        FROM db_manaus.dbpgto
        WHERE cod_fpgto IS NOT NULL
        GROUP BY cod_fpgto
        ORDER BY quantidade DESC
        LIMIT 10;
      `;

      const dist = await client.query(distQuery);
      
      if (dist.rows.length > 0) {
        console.log('📊 Formas de pagamento mais usadas:\n');
        dist.rows.forEach(row => {
          console.log(`   Código ${row.cod_fpgto}: ${row.quantidade} registros`);
        });
      }

    } else {
      console.log('❌ Coluna COD_FPGTO não encontrada em DBPGTO');
      console.log('⚠️  A tabela pode precisar ser ajustada para incluir forma de pagamento\n');
    }

    // 6. Verificar se dbpgto tem campo para múltiplas formas de pagamento
    console.log('\n\n💳 6. MODELO DE PAGAMENTO\n');

    const modeloQuery = `
      SELECT 
        cod_pgto,
        valor_pgto,
        valor_pago,
        dt_pgto,
        banco,
        cod_fpgto,
        nro_cheque,
        sispag
      FROM db_manaus.dbpgto
      WHERE paga = 'S'
        AND dt_pgto IS NOT NULL
      LIMIT 5;
    `;

    const modelo = await client.query(modeloQuery);
    
    if (modelo.rows.length > 0) {
      console.log('Exemplos de como os pagamentos estão registrados:\n');
      modelo.rows.forEach((reg, idx) => {
        console.log(`Exemplo ${idx + 1}:`);
        console.log(`   Código: ${reg.cod_pgto}`);
        console.log(`   Valor: R$ ${reg.valor_pgto}`);
        console.log(`   Pago: R$ ${reg.valor_pago || 'N/A'}`);
        console.log(`   Data Pgto: ${reg.dt_pgto}`);
        console.log(`   Banco: ${reg.banco || 'N/A'}`);
        console.log(`   Forma Pgto: ${reg.cod_fpgto || 'N/A'}`);
        console.log(`   Cheque: ${reg.nro_cheque || 'N/A'}`);
        console.log(`   SisPag: ${reg.sispag || 'N/A'}`);
        console.log('');
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ INVESTIGAÇÃO CONCLUÍDA');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

investigarEstrutura();
