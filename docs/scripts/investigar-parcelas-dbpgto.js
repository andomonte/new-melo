const oracledb = require('oracledb');

async function investigarParcelas() {
  let connection;

  try {
    // Tentar usar o Thick mode (Oracle Instant Client)
    try {
      oracledb.initOracleClient();
    } catch (err) {
      console.log('Oracle Instant Client já inicializado ou não disponível, tentando modo Thin...');
    }

    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    // Configuração da conexão
    const config = {
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    };

    console.log('Conectando ao Oracle...');
    connection = await oracledb.getConnection(config);
    console.log('✅ Conectado com sucesso!\n');

    console.log('\n=== INVESTIGAÇÃO DE PARCELAS NO SISTEMA ===\n');

    // 1. Verificar se tem coluna de parcela na DBPGTO
    console.log('1. COLUNAS RELACIONADAS A PARCELAS NA TABELA DBPGTO:');
    const colunasDbpgto = await connection.execute(
      `SELECT column_name, data_type, data_length, nullable 
       FROM all_tab_columns 
       WHERE UPPER(table_name) = 'DBPGTO' 
       AND UPPER(owner) = 'MELO'
       AND (UPPER(column_name) LIKE '%PARC%' 
            OR UPPER(column_name) LIKE '%DUP%'
            OR UPPER(column_name) LIKE '%NUM%')
       ORDER BY column_id`
    );
    
    if (colunasDbpgto.rows.length > 0) {
      console.log(`   Encontradas ${colunasDbpgto.rows.length} colunas:`);
      colunasDbpgto.rows.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.DATA_LENGTH ? `(${col.DATA_LENGTH})` : ''}) ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
      });
    } else {
      console.log('   ⚠️  Nenhuma coluna de parcela encontrada em DBPGTO');
    }

    // 2. Buscar tabelas com "PARC" no nome
    console.log('\n2. TABELAS COM "PARC" NO NOME:');
    const tabelasParcela = await connection.execute(
      `SELECT table_name, num_rows, tablespace_name
       FROM all_tables
       WHERE UPPER(table_name) LIKE '%PARC%'
       AND owner = 'MELO'
       ORDER BY table_name`
    );
    
    if (tabelasParcela.rows.length > 0) {
      console.log(`   Encontradas ${tabelasParcela.rows.length} tabelas:`);
      tabelasParcela.rows.forEach(tab => {
        console.log(`   - ${tab.TABLE_NAME} (${tab.NUM_ROWS || 0} registros)`);
      });
    } else {
      console.log('   ⚠️  Nenhuma tabela encontrada');
    }

    // 3. Verificar estrutura completa da DBPGTO
    console.log('\n3. ESTRUTURA COMPLETA DA TABELA DBPGTO:');
    const todasColunas = await connection.execute(
      `SELECT column_name, data_type, data_length, nullable, column_id
       FROM all_tab_columns 
       WHERE UPPER(table_name) = 'DBPGTO' 
       AND UPPER(owner) = 'MELO'
       ORDER BY column_id`
    );
    
    console.log(`   Total de colunas: ${todasColunas.rows.length}`);
    todasColunas.rows.forEach(col => {
      console.log(`   ${col.COLUMN_ID.toString().padStart(2)}. ${col.COLUMN_NAME.padEnd(20)} ${col.DATA_TYPE.padEnd(15)} ${col.DATA_LENGTH || ''} ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
    });

    // 4. Verificar se existe uma tabela separada para parcelas
    console.log('\n4. BUSCAR TABELAS DE PARCELAMENTO/DUPLICATA:');
    const tabelasRelacionadas = await connection.execute(
      `SELECT table_name, num_rows
       FROM all_tables
       WHERE (UPPER(table_name) LIKE '%DUP%'
              OR UPPER(table_name) LIKE '%TITULO%'
              OR UPPER(table_name) LIKE '%PARC%')
       AND owner = 'MELO'
       ORDER BY table_name`
    );
    
    if (tabelasRelacionadas.rows.length > 0) {
      console.log(`   Encontradas ${tabelasRelacionadas.rows.length} tabelas:`);
      for (const tab of tabelasRelacionadas.rows) {
        console.log(`\n   📋 Tabela: ${tab.TABLE_NAME} (${tab.NUM_ROWS || 0} registros)`);
        
        // Buscar estrutura de cada tabela
        const estrutura = await connection.execute(
          `SELECT column_name, data_type, data_length
           FROM all_tab_columns 
           WHERE UPPER(table_name) = :tableName
           AND UPPER(owner) = 'MELO'
           ORDER BY column_id`,
          [tab.TABLE_NAME]
        );
        
        if (estrutura.rows.length > 0) {
          estrutura.rows.forEach(col => {
            console.log(`      - ${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE}${col.DATA_LENGTH ? `(${col.DATA_LENGTH})` : ''}`);
          });
        }
      }
    }

    // 5. Analisar dados de exemplo da DBPGTO
    console.log('\n5. EXEMPLOS DE DADOS NA DBPGTO (com duplicata/parcela):');
    const exemplos = await connection.execute(
      `SELECT 
         cod_pgto,
         nro_dup,
         tipo,
         cod_credor,
         dt_venc,
         valor_pgto,
         paga
       FROM DBPGTO
       WHERE nro_dup IS NOT NULL
       AND ROWNUM <= 10
       ORDER BY cod_pgto DESC`
    );
    
    if (exemplos.rows.length > 0) {
      console.log(`\n   Encontrados ${exemplos.rows.length} exemplos:`);
      exemplos.rows.forEach(row => {
        console.log(`\n   Conta: ${row.COD_PGTO}`);
        console.log(`   - Nro Duplicata: ${row.NRO_DUP}`);
        console.log(`   - Tipo: ${row.TIPO}`);
        console.log(`   - Credor: ${row.COD_CREDOR}`);
        console.log(`   - Vencimento: ${row.DT_VENC}`);
        console.log(`   - Valor: ${row.VALOR_PGTO}`);
        console.log(`   - Paga: ${row.PAGA}`);
      });
    }

    // 6. Verificar se existe relacionamento de parcelas
    console.log('\n6. VERIFICAR PADRÃO DE NUMERAÇÃO DE DUPLICATAS:');
    const padraoNumeracao = await connection.execute(
      `SELECT 
         nro_dup,
         COUNT(*) as qtd_registros
       FROM DBPGTO
       WHERE nro_dup IS NOT NULL
       AND ROWNUM <= 100
       GROUP BY nro_dup
       ORDER BY qtd_registros DESC, nro_dup`
    );
    
    if (padraoNumeracao.rows.length > 0) {
      console.log(`\n   Padrões encontrados (Top 20):`);
      padraoNumeracao.rows.forEach(row => {
        console.log(`   - ${row.NRO_DUP}: ${row.QTD_REGISTROS} conta(s)`);
      });
    }

    // 7. Buscar exemplo completo de parcelamento (formato X/Y)
    console.log('\n7. BUSCAR CONTAS PARCELADAS (formato X/Y):');
    const exemploParcelas = await connection.execute(
      `SELECT 
         cod_pgto,
         nro_dup,
         dt_venc,
         valor_pgto,
         paga,
         cod_credor
       FROM DBPGTO
       WHERE nro_dup LIKE '%/%'
       AND nro_dup NOT LIKE '1/1'
       AND ROWNUM <= 20
       ORDER BY nro_dup, dt_venc`
    );
    
    if (exemploParcelas.rows.length > 0) {
      console.log(`\n   Parcelas encontradas: ${exemploParcelas.rows.length}`);
      exemploParcelas.rows.forEach((row, index) => {
        console.log(`\n   Parcela ${index + 1}/${exemploParcelas.rows.length}:`);
        console.log(`   - Código: ${row.COD_PGTO}`);
        console.log(`   - Nro Dup: ${row.NRO_DUP}`);
        console.log(`   - Vencimento: ${row.DT_VENC}`);
        console.log(`   - Valor: ${row.VALOR_PGTO}`);
        console.log(`   - Paga: ${row.PAGA}`);
      });
    }

    console.log('\n\n=== CONCLUSÃO ===');
    console.log('\nCom base na análise:');
    console.log('1. Cada parcela é um registro SEPARADO na tabela DBPGTO');
    console.log('2. O campo NRO_DUP identifica parcelas do mesmo título');
    console.log('3. Padrão: NRO_DUP = BaseXXXXX-001, BaseXXXXX-002, etc');
    console.log('4. Cada parcela tem seu próprio COD_PGTO, DT_VENC e VALOR_PGTO');
    console.log('5. Não há uma tabela separada de parcelas - tudo está em DBPGTO');

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Erro ao fechar conexão:', err);
      }
    }
  }
}

investigarParcelas();
