const oracledb = require('oracledb');

async function investigarRelacionamento() {
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

    console.log('\n=== INVESTIGAÇÃO DO RELACIONAMENTO DBPGTO <-> DBFPGTO ===\n');

    // 1. Estrutura DBPGTO
    console.log('1. ESTRUTURA DA TABELA DBPGTO:');
    const dbpgtoColumns = await connection.execute(
      `SELECT column_name, data_type, data_length, nullable 
       FROM all_tab_columns 
       WHERE UPPER(table_name) = 'DBPGTO' 
       AND UPPER(owner) = 'MELO'
       ORDER BY column_id`
    );
    console.log(`   Total de colunas: ${dbpgtoColumns.rows.length}`);
    dbpgtoColumns.rows.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.DATA_LENGTH ? `(${col.DATA_LENGTH})` : ''}) ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
    });

    // 2. Estrutura DBFPGTO
    console.log('\n2. ESTRUTURA DA TABELA DBFPGTO:');
    const dbfpgtoColumns = await connection.execute(
      `SELECT column_name, data_type, data_length, nullable 
       FROM all_tab_columns 
       WHERE UPPER(table_name) = 'DBFPGTO' 
       AND UPPER(owner) = 'MELO'
       ORDER BY column_id`
    );
    console.log(`   Total de colunas: ${dbfpgtoColumns.rows.length}`);
    dbfpgtoColumns.rows.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.DATA_LENGTH ? `(${col.DATA_LENGTH})` : ''}) ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
    });

    // 3. Chaves primárias
    console.log('\n3. CHAVES PRIMÁRIAS:');
    const pkDbpgto = await connection.execute(
      `SELECT cols.column_name, cols.position
       FROM all_constraints cons
       JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name
       WHERE cons.constraint_type = 'P'
       AND UPPER(cons.table_name) = 'DBPGTO'
       AND UPPER(cons.owner) = 'MELO'
       ORDER BY cols.position`
    );
    console.log('   DBPGTO PK:', pkDbpgto.rows.map(r => r.COLUMN_NAME).join(', '));

    const pkDbfpgto = await connection.execute(
      `SELECT cols.column_name, cols.position
       FROM all_constraints cons
       JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name
       WHERE cons.constraint_type = 'P'
       AND UPPER(cons.table_name) = 'DBFPGTO'
       AND UPPER(cons.owner) = 'MELO'
       ORDER BY cols.position`
    );
    console.log('   DBFPGTO PK:', pkDbfpgto.rows.map(r => r.COLUMN_NAME).join(', '));

    // 4. Foreign Keys
    console.log('\n4. FOREIGN KEYS (RELACIONAMENTOS):');
    const fkDbfpgto = await connection.execute(
      `SELECT 
         a.constraint_name,
         a.table_name as child_table,
         c.table_name as parent_table,
         b.column_name as child_column,
         d.column_name as parent_column
       FROM all_constraints a
       JOIN all_cons_columns b ON a.constraint_name = b.constraint_name
       JOIN all_constraints c ON a.r_constraint_name = c.constraint_name
       JOIN all_cons_columns d ON c.constraint_name = d.constraint_name
       WHERE a.constraint_type = 'R'
       AND UPPER(a.table_name) = 'DBFPGTO'
       AND UPPER(a.owner) = 'MELO'`
    );
    
    if (fkDbfpgto.rows.length > 0) {
      fkDbfpgto.rows.forEach(fk => {
        console.log(`   FK: ${fk.CHILD_TABLE}.${fk.CHILD_COLUMN} -> ${fk.PARENT_TABLE}.${fk.PARENT_COLUMN}`);
      });
    } else {
      console.log('   ⚠️  Nenhuma FK definida explicitamente no Oracle');
    }

    // 5. Colunas em comum
    console.log('\n5. COLUNAS EM COMUM (POSSÍVEL RELACIONAMENTO):');
    const commonCols = dbpgtoColumns.rows.filter(col1 => 
      dbfpgtoColumns.rows.some(col2 => col2.COLUMN_NAME === col1.COLUMN_NAME)
    );
    console.log(`   Total de colunas em comum: ${commonCols.length}`);
    commonCols.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}`);
    });

    // 6. Análise da coluna COD_PGTO (chave de relacionamento)
    console.log('\n6. ANÁLISE DA COLUNA COD_PGTO (CHAVE DE RELACIONAMENTO):');
    
    // Contar registros em DBPGTO
    const countDbpgto = await connection.execute(
      `SELECT COUNT(*) as total FROM DBPGTO`
    );
    console.log(`   Total de registros em DBPGTO: ${countDbpgto.rows[0].TOTAL}`);

    // Contar registros em DBFPGTO
    const countDbfpgto = await connection.execute(
      `SELECT COUNT(*) as total FROM DBFPGTO`
    );
    console.log(`   Total de registros em DBFPGTO: ${countDbfpgto.rows[0].TOTAL}`);

    // Verificar quantos cod_pgto em DBFPGTO existem em DBPGTO
    const matchingCodes = await connection.execute(
      `SELECT COUNT(DISTINCT f.cod_pgto) as total
       FROM DBFPGTO f
       WHERE EXISTS (SELECT 1 FROM DBPGTO p WHERE p.cod_pgto = f.cod_pgto)`
    );
    console.log(`   COD_PGTO em DBFPGTO que existem em DBPGTO: ${matchingCodes.rows[0].TOTAL}`);

    // Verificar órfãos
    const orphans = await connection.execute(
      `SELECT COUNT(DISTINCT f.cod_pgto) as total
       FROM DBFPGTO f
       WHERE NOT EXISTS (SELECT 1 FROM DBPGTO p WHERE p.cod_pgto = f.cod_pgto)`
    );
    console.log(`   COD_PGTO órfãos em DBFPGTO (sem correspondente em DBPGTO): ${orphans.rows[0].TOTAL}`);

    // 7. Cardinalidade do relacionamento
    console.log('\n7. CARDINALIDADE DO RELACIONAMENTO:');
    const cardinality = await connection.execute(
      `SELECT 
         COUNT(DISTINCT cod_pgto) as contas_com_pagamentos,
         COUNT(*) as total_pagamentos,
         ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT cod_pgto), 0), 2) as media_pagamentos_por_conta
       FROM DBFPGTO`
    );
    const card = cardinality.rows[0];
    console.log(`   Contas em DBPGTO com registros em DBFPGTO: ${card.CONTAS_COM_PAGAMENTOS}`);
    console.log(`   Total de formas de pagamento registradas: ${card.TOTAL_PAGAMENTOS}`);
    console.log(`   Média de formas de pagamento por conta: ${card.MEDIA_PAGAMENTOS_POR_CONTA}`);

    // 8. Exemplo de JOIN
    console.log('\n8. EXEMPLO DE JOIN ENTRE AS TABELAS (5 registros):');
    
    // Primeiro, vamos pegar os nomes corretos das colunas
    const colNames = dbpgtoColumns.rows.map(r => r.COLUMN_NAME);
    console.log(`   Colunas disponíveis em DBPGTO: ${colNames.join(', ')}`);
    
    // Construir query dinamicamente baseado nas colunas que existem
    let selectFields = ['p.cod_pgto'];
    if (colNames.includes('DT_EMISSAO')) selectFields.push('p.dt_emissao');
    if (colNames.includes('DT_VENC')) selectFields.push('p.dt_venc');
    if (colNames.includes('VALOR')) selectFields.push('p.valor');
    if (colNames.includes('VLR_PGTO')) selectFields.push('p.vlr_pgto');
    if (colNames.includes('PAGA')) selectFields.push('p.paga');
    
    selectFields.push('f.cod_fpgto', 'f.tp_pgto', 'f.valor_pgto', 'f.dt_pgto', 'f.nro_cheque');
    
    const joinQuery = `
      SELECT ${selectFields.join(', ')}
      FROM DBPGTO p
      INNER JOIN DBFPGTO f ON p.cod_pgto = f.cod_pgto
      WHERE ROWNUM <= 5
      ORDER BY p.cod_pgto
    `;
    
    console.log(`\n   Query: ${joinQuery}\n`);
    
    const joinExample = await connection.execute(joinQuery);
    
    if (joinExample.rows.length > 0) {
      joinExample.rows.forEach(row => {
        console.log(`\n   Conta: ${row.COD_PGTO}`);
        if (row.DT_EMISSAO) console.log(`   - Emissão: ${row.DT_EMISSAO}`);
        if (row.DT_VENC) console.log(`   - Vencimento: ${row.DT_VENC}`);
        if (row.VALOR) console.log(`   - Valor: ${row.VALOR}`);
        if (row.VLR_PGTO) console.log(`   - Valor: ${row.VLR_PGTO}`);
        if (row.PAGA) console.log(`   - Paga: ${row.PAGA}`);
        console.log(`   - Forma Pgto: ${row.COD_FPGTO}, Tipo: ${row.TP_PGTO}, Valor Pago: ${row.VALOR_PGTO}`);
        console.log(`   - Data Pgto: ${row.DT_PGTO}, Cheque: ${row.NRO_CHEQUE || 'N/A'}`);
      });
    }

    // 9. Distribuição de formas de pagamento
    console.log('\n9. DISTRIBUIÇÃO DE FORMAS DE PAGAMENTO:');
    const distribution = await connection.execute(
      `SELECT 
         cod_fpgto,
         tp_pgto,
         COUNT(*) as quantidade,
         ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentual
       FROM DBFPGTO
       GROUP BY cod_fpgto, tp_pgto
       ORDER BY quantidade DESC`
    );
    
    distribution.rows.forEach(row => {
      console.log(`   ${row.COD_FPGTO} (${row.TP_PGTO}): ${row.QUANTIDADE} registros (${row.PERCENTUAL}%)`);
    });

    // 10. Conclusão
    console.log('\n\n=== CONCLUSÃO DO RELACIONAMENTO ===');
    console.log('');
    console.log('TIPO DE RELACIONAMENTO: Um-para-Muitos (1:N)');
    console.log('');
    console.log('DBPGTO (Tabela Principal - Contas a Pagar)');
    console.log('  ↓');
    console.log('  ↓ cod_pgto');
    console.log('  ↓');
    console.log('DBFPGTO (Tabela Dependente - Formas de Pagamento)');
    console.log('');
    console.log('DESCRIÇÃO:');
    console.log('- Uma conta em DBPGTO pode ter ZERO ou MAIS formas de pagamento em DBFPGTO');
    console.log('- Cada forma de pagamento em DBFPGTO pertence a EXATAMENTE UMA conta em DBPGTO');
    console.log('- A coluna cod_pgto é a chave estrangeira que liga as tabelas');
    console.log('- Permite que uma conta seja paga com múltiplas formas de pagamento');
    console.log('');
    console.log('EXEMPLO PRÁTICO:');
    console.log('Conta cod_pgto=12345 no valor de R$ 1.000,00 pode ser paga:');
    console.log('  - R$ 500,00 em Dinheiro (cod_fpgto=001)');
    console.log('  - R$ 300,00 em PIX (cod_fpgto=003)');
    console.log('  - R$ 200,00 em Cartão (cod_fpgto=005)');
    console.log('  Total: 3 registros em DBFPGTO para 1 registro em DBPGTO');

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

investigarRelacionamento();
