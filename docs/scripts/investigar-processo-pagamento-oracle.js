const oracledb = require('oracledb');

async function investigarProcessoPagamento() {
  let connection;

  try {
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
    console.log('============================================');
    console.log('INVESTIGAÇÃO: PROCESSO DE PAGAMENTO (BAIXA)');
    console.log('============================================\n');

    // 1. Verificar procedures relacionadas a pagamento
    console.log('1. PROCEDURES RELACIONADAS A PAGAMENTO:');
    console.log('------------------------------------------');
    const procedures = await connection.execute(`
      SELECT object_name, object_type, status
      FROM all_objects
      WHERE owner = 'GERAL'
      AND object_type IN ('PROCEDURE', 'PACKAGE')
      AND (
        UPPER(object_name) LIKE '%PGTO%'
        OR UPPER(object_name) LIKE '%PAG%'
        OR UPPER(object_name) LIKE '%BAIXA%'
        OR UPPER(object_name) LIKE '%PAYMENT%'
      )
      ORDER BY object_type, object_name
    `);

    console.log(`Encontradas ${procedures.rows.length} procedures/packages:\n`);
    procedures.rows.forEach((proc) => {
      console.log(`${proc.OBJECT_TYPE}: ${proc.OBJECT_NAME} (${proc.STATUS})`);
    });

    // 2. Analisar tabela DBPGTO_ENT (histórico de pagamentos)
    console.log(
      '\n\n2. ESTRUTURA DA TABELA DBPGTO_ENT (Histórico de Pagamentos):',
    );
    console.log('------------------------------------------------------------');
    const dbpgtoEntCols = await connection.execute(`
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
      AND table_name = 'DBPGTO_ENT'
      ORDER BY column_id
    `);

    console.log(`\nColunas (${dbpgtoEntCols.rows.length}):\n`);
    dbpgtoEntCols.rows.forEach((col) => {
      console.log(
        `${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE}(${col.DATA_LENGTH}) ${
          col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'
        }`,
      );
    });

    // 3. Analisar exemplos reais de pagamentos
    console.log('\n\n3. EXEMPLOS REAIS DE PAGAMENTOS (DBPGTO_ENT):');
    console.log('----------------------------------------------');
    const pagamentosExemplo = await connection.execute(`
      SELECT *
      FROM (
        SELECT 
          cod_pgto,
          dt_pgto,
          vl_pago,
          tp_pgto,
          nro_cheque,
          portador,
          banco,
          agencia,
          conta_pag,
          forma_pgto,
          obs
        FROM dbpgto_ent
        WHERE dt_pgto IS NOT NULL
        ORDER BY dt_pgto DESC
      )
      WHERE ROWNUM <= 10
    `);

    console.log(`\nÚltimos 10 pagamentos registrados:\n`);
    pagamentosExemplo.rows.forEach((pag, idx) => {
      console.log(`\n--- Pagamento ${idx + 1} ---`);
      console.log(`COD_PGTO: ${pag.COD_PGTO}`);
      console.log(
        `DT_PGTO: ${
          pag.DT_PGTO ? pag.DT_PGTO.toISOString().split('T')[0] : 'NULL'
        }`,
      );
      console.log(`VL_PAGO: R$ ${pag.VL_PAGO || '0.00'}`);
      console.log(`TP_PGTO: ${pag.TP_PGTO || 'NULL'}`);
      console.log(`FORMA_PGTO: ${pag.FORMA_PGTO || 'NULL'}`);
      console.log(`NRO_CHEQUE: ${pag.NRO_CHEQUE || 'NULL'}`);
      console.log(`PORTADOR: ${pag.PORTADOR || 'NULL'}`);
      console.log(`BANCO: ${pag.BANCO || 'NULL'}`);
      console.log(`AGENCIA: ${pag.AGENCIA || 'NULL'}`);
      console.log(`CONTA_PAG: ${pag.CONTA_PAG || 'NULL'}`);
      console.log(`OBS: ${pag.OBS || 'NULL'}`);
    });

    // 4. Verificar campos em DBPGTO que controlam o status de pagamento
    console.log('\n\n4. CAMPOS DE CONTROLE DE PAGAMENTO EM DBPGTO:');
    console.log('----------------------------------------------');
    const camposPagamento = await connection.execute(`
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
      AND table_name = 'DBPGTO'
      AND (
        UPPER(column_name) LIKE '%PAG%'
        OR UPPER(column_name) LIKE '%DT_PGTO%'
        OR UPPER(column_name) LIKE '%VL_PAGO%'
        OR UPPER(column_name) LIKE '%BAIXA%'
      )
      ORDER BY column_id
    `);

    console.log(`\nColunas relacionadas a pagamento:\n`);
    camposPagamento.rows.forEach((col) => {
      console.log(
        `${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE}(${col.DATA_LENGTH}) ${
          col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'
        }`,
      );
    });

    // 5. Verificar distribuição de tipos de pagamento
    console.log('\n\n5. DISTRIBUIÇÃO DE TIPOS DE PAGAMENTO (TP_PGTO):');
    console.log('-------------------------------------------------');
    const distribuicaoTpPgto = await connection.execute(`
      SELECT 
        tp_pgto,
        COUNT(*) as total,
        SUM(vl_pago) as valor_total
      FROM dbpgto_ent
      WHERE tp_pgto IS NOT NULL
      GROUP BY tp_pgto
      ORDER BY total DESC
    `);

    console.log('\nDistribuição:\n');
    distribuicaoTpPgto.rows.forEach((row) => {
      console.log(
        `${row.TP_PGTO}: ${row.TOTAL} pagamentos, Total: R$ ${
          row.VALOR_TOTAL || '0.00'
        }`,
      );
    });

    // 6. Verificar distribuição de formas de pagamento
    console.log('\n\n6. DISTRIBUIÇÃO DE FORMAS DE PAGAMENTO (FORMA_PGTO):');
    console.log('----------------------------------------------------');
    const distribuicaoFormaPgto = await connection.execute(`
      SELECT 
        forma_pgto,
        COUNT(*) as total,
        SUM(vl_pago) as valor_total
      FROM dbpgto_ent
      WHERE forma_pgto IS NOT NULL
      GROUP BY forma_pgto
      ORDER BY total DESC
    `);

    console.log('\nDistribuição:\n');
    distribuicaoFormaPgto.rows.forEach((row) => {
      console.log(
        `${row.FORMA_PGTO}: ${row.TOTAL} pagamentos, Total: R$ ${
          row.VALOR_TOTAL || '0.00'
        }`,
      );
    });

    // 7. Analisar contas a pagar COM pagamento registrado
    console.log('\n\n7. ANÁLISE DE CONTAS COM PAGAMENTO:');
    console.log('------------------------------------');
    const contasComPagamento = await connection.execute(`
      SELECT 
        p.cod_pgto,
        p.valor_pgto,
        p.paga,
        p.dt_pgto,
        p.vl_pago,
        e.dt_pgto as dt_pgto_ent,
        e.vl_pago as vl_pago_ent,
        e.tp_pgto,
        e.forma_pgto
      FROM dbpgto p
      LEFT JOIN dbpgto_ent e ON p.cod_pgto = e.cod_pgto
      WHERE p.paga = 'S'
      AND ROWNUM <= 5
      ORDER BY p.dt_pgto DESC
    `);

    console.log('\nExemplos de contas pagas:\n');
    contasComPagamento.rows.forEach((conta, idx) => {
      console.log(`\n--- Conta ${idx + 1} ---`);
      console.log(`COD_PGTO: ${conta.COD_PGTO}`);
      console.log(`VALOR_PGTO (DBPGTO): R$ ${conta.VALOR_PGTO || '0.00'}`);
      console.log(`PAGA: ${conta.PAGA}`);
      console.log(
        `DT_PGTO (DBPGTO): ${
          conta.DT_PGTO ? conta.DT_PGTO.toISOString().split('T')[0] : 'NULL'
        }`,
      );
      console.log(`VL_PAGO (DBPGTO): R$ ${conta.VL_PAGO || '0.00'}`);
      console.log(
        `DT_PGTO (DBPGTO_ENT): ${
          conta.DT_PGTO_ENT
            ? conta.DT_PGTO_ENT.toISOString().split('T')[0]
            : 'NULL'
        }`,
      );
      console.log(`VL_PAGO (DBPGTO_ENT): R$ ${conta.VL_PAGO_ENT || '0.00'}`);
      console.log(`TP_PGTO: ${conta.TP_PGTO || 'NULL'}`);
      console.log(`FORMA_PGTO: ${conta.FORMA_PGTO || 'NULL'}`);
    });

    // 8. Verificar se existem triggers
    console.log('\n\n8. TRIGGERS RELACIONADOS A DBPGTO:');
    console.log('-----------------------------------');
    const triggers = await connection.execute(`
      SELECT trigger_name, triggering_event, status, trigger_type
      FROM all_triggers
      WHERE owner = 'GERAL'
      AND table_name = 'DBPGTO'
      ORDER BY trigger_name
    `);

    if (triggers.rows.length > 0) {
      console.log(`\nEncontrados ${triggers.rows.length} triggers:\n`);
      triggers.rows.forEach((trg) => {
        console.log(
          `${trg.TRIGGER_NAME}: ${trg.TRIGGERING_EVENT} (${trg.TRIGGER_TYPE}) - ${trg.STATUS}`,
        );
      });
    } else {
      console.log('\nNenhum trigger encontrado em DBPGTO');
    }

    // 9. Buscar código de procedures específicas
    console.log('\n\n9. BUSCANDO CÓDIGO DE PROCEDURES RELEVANTES:');
    console.log('--------------------------------------------');

    // Tentar encontrar procedure de pagamento
    const procSource = await connection.execute(`
      SELECT name, text
      FROM all_source
      WHERE owner = 'GERAL'
      AND (
        UPPER(text) LIKE '%UPDATE%DBPGTO%'
        OR UPPER(text) LIKE '%INSERT%DBPGTO_ENT%'
      )
      AND type IN ('PROCEDURE', 'PACKAGE BODY')
      AND ROWNUM <= 20
      ORDER BY name, line
    `);

    if (procSource.rows.length > 0) {
      console.log('\nTrechos de código encontrados:\n');
      let currentProc = '';
      procSource.rows.forEach((row) => {
        if (row.NAME !== currentProc) {
          currentProc = row.NAME;
          console.log(`\n--- ${row.NAME} ---`);
        }
        console.log(row.TEXT.trim());
      });
    }

    // 10. Verificar portadores (bancos) disponíveis
    console.log('\n\n10. PORTADORES (BANCOS) UTILIZADOS:');
    console.log('------------------------------------');
    const portadores = await connection.execute(`
      SELECT DISTINCT portador, COUNT(*) as total
      FROM dbpgto_ent
      WHERE portador IS NOT NULL
      GROUP BY portador
      ORDER BY total DESC
    `);

    console.log('\nPortadores mais utilizados:\n');
    portadores.rows.forEach((row) => {
      console.log(`${row.PORTADOR}: ${row.TOTAL} pagamentos`);
    });

    console.log('\n\n============================================');
    console.log('INVESTIGAÇÃO CONCLUÍDA!');
    console.log('============================================');
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

investigarProcessoPagamento();
