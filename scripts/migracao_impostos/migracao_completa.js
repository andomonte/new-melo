const oracledb = require('oracledb');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configurações de conexão
const ORACLE_CONFIG = {
  user: 'GERAL',
  password: '123',
  connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
};

const PG_CONFIG = {
  host: 'servicos.melopecas.com.br',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Melodb@2025'
};

// Configurar Oracle Client (thick mode)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Diretório para salvar scripts
const SCRIPTS_DIR = path.join(__dirname);

// Log detalhado
const log = {
  messages: [],
  add: function(msg) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    console.log(logMsg);
    this.messages.push(logMsg);
  },
  save: function() {
    const logFile = path.join(SCRIPTS_DIR, 'migracao_log.txt');
    fs.writeFileSync(logFile, this.messages.join('\n'), 'utf8');
    console.log(`\nLog salvo em: ${logFile}`);
  }
};

// Mapeamento de tipos Oracle -> PostgreSQL
function mapOracleTypeToPg(oracleType, dataLength, dataPrecision, dataScale) {
  const type = oracleType.toUpperCase();

  if (type.includes('VARCHAR') || type === 'CHAR') {
    return `VARCHAR(${dataLength || 255})`;
  }
  if (type === 'NUMBER') {
    if (dataPrecision !== null && dataScale !== null) {
      if (dataScale === 0) {
        if (dataPrecision <= 4) return 'SMALLINT';
        if (dataPrecision <= 9) return 'INTEGER';
        if (dataPrecision <= 18) return 'BIGINT';
      }
      return `NUMERIC(${dataPrecision}, ${dataScale})`;
    }
    return 'NUMERIC';
  }
  if (type === 'DATE' || type.includes('TIMESTAMP')) {
    return 'TIMESTAMP';
  }
  if (type === 'CLOB') {
    return 'TEXT';
  }
  if (type === 'BLOB') {
    return 'BYTEA';
  }

  return 'VARCHAR(255)'; // default
}

// Obter estrutura da tabela Oracle
async function getOracleTableStructure(oracleConn, tableName) {
  log.add(`Obtendo estrutura da tabela ${tableName} do Oracle...`);

  const query = `
    SELECT
      COLUMN_NAME,
      DATA_TYPE,
      DATA_LENGTH,
      DATA_PRECISION,
      DATA_SCALE,
      NULLABLE
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = :tableName
    ORDER BY COLUMN_ID
  `;

  const result = await oracleConn.execute(query, [tableName.toUpperCase()]);
  return result.rows;
}

// Obter constraints da tabela Oracle
async function getOracleConstraints(oracleConn, tableName) {
  log.add(`Obtendo constraints da tabela ${tableName}...`);

  const query = `
    SELECT
      c.CONSTRAINT_NAME,
      c.CONSTRAINT_TYPE,
      cc.COLUMN_NAME,
      cc.POSITION
    FROM USER_CONSTRAINTS c
    JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    WHERE c.TABLE_NAME = :tableName
    ORDER BY c.CONSTRAINT_TYPE DESC, cc.POSITION
  `;

  const result = await oracleConn.execute(query, [tableName.toUpperCase()]);
  return result.rows;
}

// Gerar CREATE TABLE para PostgreSQL
function generatePgCreateTable(tableName, columns, constraints) {
  const columnDefs = columns.map(col => {
    const pgType = mapOracleTypeToPg(
      col.DATA_TYPE,
      col.DATA_LENGTH,
      col.DATA_PRECISION,
      col.DATA_SCALE
    );

    const nullable = col.NULLABLE === 'Y' ? '' : ' NOT NULL';
    return `  ${col.COLUMN_NAME.toLowerCase()} ${pgType}${nullable}`;
  });

  // Identificar primary key
  const pkConstraint = constraints.find(c => c.CONSTRAINT_TYPE === 'P');
  const pkColumns = constraints
    .filter(c => c.CONSTRAINT_TYPE === 'P')
    .sort((a, b) => a.POSITION - b.POSITION)
    .map(c => c.COLUMN_NAME.toLowerCase());

  if (pkColumns.length > 0) {
    columnDefs.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
  }

  return `CREATE TABLE IF NOT EXISTS ${tableName.toLowerCase()} (
${columnDefs.join(',\n')}
);`;
}

// Extrair dados do Oracle
async function extractOracleData(oracleConn, tableName) {
  log.add(`Extraindo dados da tabela ${tableName} do Oracle...`);

  const result = await oracleConn.execute(
    `SELECT * FROM ${tableName}`,
    [],
    { maxRows: 10000 }
  );

  log.add(`${result.rows.length} registros extraídos de ${tableName}`);
  return result.rows;
}

// Inserir dados no PostgreSQL
async function insertPgData(pgClient, tableName, columns, data) {
  if (data.length === 0) {
    log.add(`Nenhum dado para inserir em ${tableName}`);
    return 0;
  }

  log.add(`Inserindo ${data.length} registros em ${tableName}...`);

  const columnNames = columns.map(c => c.COLUMN_NAME.toLowerCase());
  let insertedCount = 0;

  // Inserir em lotes de 100
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    for (const row of batch) {
      const values = columnNames.map(col => {
        const value = row[col.toUpperCase()];
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'number') return value;
        return String(value);
      });

      const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
      const insertQuery = `INSERT INTO ${tableName.toLowerCase()} (${columnNames.join(', ')}) VALUES (${placeholders})`;

      try {
        await pgClient.query(insertQuery, values);
        insertedCount++;
      } catch (err) {
        log.add(`ERRO ao inserir registro em ${tableName}: ${err.message}`);
        log.add(`Valores: ${JSON.stringify(values)}`);
      }
    }

    log.add(`Progresso: ${Math.min(i + batchSize, data.length)}/${data.length} registros`);
  }

  log.add(`${insertedCount} registros inseridos com sucesso em ${tableName}`);
  return insertedCount;
}

// Criar índices
async function createIndexes(pgClient, tableName) {
  log.add(`Criando índices para ${tableName}...`);

  const indexes = {
    'cad_legislacao_icmsst': [
      'CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_protocolo ON cad_legislacao_icmsst(protocolo);'
    ],
    'cad_legislacao_icmsst_ncm': [
      'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm ON cad_legislacao_icmsst_ncm(ncm);',
      'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_protocolo ON cad_legislacao_icmsst_ncm(protocolo);',
      'CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm_protocolo ON cad_legislacao_icmsst_ncm(ncm, protocolo);'
    ],
    'fis_tributo_aliquota': [
      'CREATE INDEX IF NOT EXISTS idx_tributo_aliquota_codigo ON fis_tributo_aliquota(codigo);'
    ],
    'dbcest': [
      'CREATE INDEX IF NOT EXISTS idx_dbcest_cest ON dbcest(cest);',
      'CREATE INDEX IF NOT EXISTS idx_dbcest_ncm ON dbcest(ncm);'
    ]
  };

  const tableIndexes = indexes[tableName.toLowerCase()] || [];

  for (const indexSql of tableIndexes) {
    try {
      await pgClient.query(indexSql);
      log.add(`Índice criado: ${indexSql.split('INDEX')[1].split('ON')[0].trim()}`);
    } catch (err) {
      log.add(`ERRO ao criar índice: ${err.message}`);
    }
  }
}

// Migrar uma tabela
async function migrateTable(oracleConn, pgClient, tableName) {
  log.add(`\n${'='.repeat(80)}`);
  log.add(`MIGRANDO TABELA: ${tableName}`);
  log.add('='.repeat(80));

  try {
    // 1. Obter estrutura Oracle
    const columns = await getOracleTableStructure(oracleConn, tableName);
    if (columns.length === 0) {
      log.add(`ERRO: Tabela ${tableName} não encontrada no Oracle`);
      return { success: false, table: tableName, records: 0 };
    }

    const constraints = await getOracleConstraints(oracleConn, tableName);

    // 2. Gerar CREATE TABLE
    const createTableSql = generatePgCreateTable(tableName, columns, constraints);
    log.add(`\nScript CREATE TABLE gerado:`);
    log.add(createTableSql);

    // Salvar script
    const scriptFile = path.join(SCRIPTS_DIR, `${tableName.toLowerCase()}_create.sql`);
    fs.writeFileSync(scriptFile, createTableSql, 'utf8');
    log.add(`Script salvo em: ${scriptFile}`);

    // 3. Verificar se tabela existe no PostgreSQL
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      );
    `;

    const tableExists = await pgClient.query(checkTableQuery, [tableName.toLowerCase()]);

    if (tableExists.rows[0].exists) {
      log.add(`\nTabela ${tableName} já existe no PostgreSQL`);
      log.add(`Verificando se deve limpar dados existentes...`);

      // Contar registros existentes
      const countResult = await pgClient.query(`SELECT COUNT(*) FROM ${tableName.toLowerCase()}`);
      const existingCount = parseInt(countResult.rows[0].count);
      log.add(`Registros existentes: ${existingCount}`);

      // Limpar tabela para nova carga
      log.add(`Limpando tabela ${tableName}...`);
      await pgClient.query(`TRUNCATE TABLE ${tableName.toLowerCase()} CASCADE`);
    } else {
      log.add(`\nCriando tabela ${tableName} no PostgreSQL...`);
      await pgClient.query(createTableSql);
      log.add(`Tabela ${tableName} criada com sucesso`);
    }

    // 4. Extrair dados do Oracle
    const data = await extractOracleData(oracleConn, tableName);

    // 5. Inserir dados no PostgreSQL
    const insertedCount = await insertPgData(pgClient, tableName, columns, data);

    // 6. Criar índices
    await createIndexes(pgClient, tableName);

    // 7. Verificar contagem final
    const finalCount = await pgClient.query(`SELECT COUNT(*) FROM ${tableName.toLowerCase()}`);
    const finalRecords = parseInt(finalCount.rows[0].count);

    log.add(`\nVERIFICAÇÃO FINAL:`);
    log.add(`  Oracle: ${data.length} registros`);
    log.add(`  PostgreSQL: ${finalRecords} registros`);
    log.add(`  Status: ${data.length === finalRecords ? 'OK ✓' : 'DIVERGÊNCIA ✗'}`);

    return {
      success: true,
      table: tableName,
      records: finalRecords,
      oracleRecords: data.length
    };

  } catch (err) {
    log.add(`\nERRO CRÍTICO ao migrar ${tableName}: ${err.message}`);
    log.add(err.stack);
    return { success: false, table: tableName, records: 0, error: err.message };
  }
}

// Função principal
async function main() {
  let oracleConn;
  let pgClient;

  try {
    log.add('INICIANDO MIGRAÇÃO DE TABELAS DE IMPOSTOS');
    log.add('='.repeat(80));

    // Inicializar Oracle Client
    log.add('\nInicializando Oracle Client...');
    await oracledb.initOracleClient({
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4'
    });
    log.add('Oracle Client inicializado');

    // Conectar ao Oracle
    log.add('\nConectando ao Oracle...');
    oracleConn = await oracledb.getConnection(ORACLE_CONFIG);
    log.add('Conexão Oracle estabelecida com sucesso');

    // Conectar ao PostgreSQL
    log.add('\nConectando ao PostgreSQL...');
    pgClient = new Client(PG_CONFIG);
    await pgClient.connect();
    log.add('Conexão PostgreSQL estabelecida com sucesso');

    // Tabelas para migrar (em ordem de prioridade)
    const tables = [
      'CAD_LEGISLACAO_ICMSST',
      'CAD_LEGISLACAO_ICMSST_NCM',
      'FIS_TRIBUTO_ALIQUOTA',
      'DBCEST'
    ];

    const results = [];

    // Migrar cada tabela
    for (const table of tables) {
      const result = await migrateTable(oracleConn, pgClient, table);
      results.push(result);
    }

    // Relatório final
    log.add('\n\n');
    log.add('='.repeat(80));
    log.add('RELATÓRIO FINAL DE MIGRAÇÃO');
    log.add('='.repeat(80));

    let totalRecords = 0;
    let successCount = 0;

    results.forEach(result => {
      const status = result.success ? 'SUCESSO' : 'FALHA';
      log.add(`\n${result.table}:`);
      log.add(`  Status: ${status}`);
      log.add(`  Registros Oracle: ${result.oracleRecords || 0}`);
      log.add(`  Registros PostgreSQL: ${result.records}`);

      if (result.error) {
        log.add(`  Erro: ${result.error}`);
      }

      if (result.success) {
        successCount++;
        totalRecords += result.records;
      }
    });

    log.add('\n' + '='.repeat(80));
    log.add(`RESUMO:`);
    log.add(`  Tabelas processadas: ${results.length}`);
    log.add(`  Tabelas migradas com sucesso: ${successCount}`);
    log.add(`  Total de registros migrados: ${totalRecords}`);
    log.add('='.repeat(80));

    // Gerar script SQL consolidado
    const consolidatedScript = [];
    consolidatedScript.push('-- MIGRAÇÃO DE TABELAS DE IMPOSTOS');
    consolidatedScript.push('-- Gerado em: ' + new Date().toISOString());
    consolidatedScript.push('-- Oracle -> PostgreSQL');
    consolidatedScript.push('\n');

    for (const table of tables) {
      const scriptFile = path.join(SCRIPTS_DIR, `${table.toLowerCase()}_create.sql`);
      if (fs.existsSync(scriptFile)) {
        consolidatedScript.push(`-- Tabela: ${table}`);
        consolidatedScript.push(fs.readFileSync(scriptFile, 'utf8'));
        consolidatedScript.push('\n');
      }
    }

    const consolidatedFile = path.join(SCRIPTS_DIR, 'migracao_completa.sql');
    fs.writeFileSync(consolidatedFile, consolidatedScript.join('\n'), 'utf8');
    log.add(`\nScript SQL consolidado salvo em: ${consolidatedFile}`);

  } catch (err) {
    log.add(`\nERRO FATAL: ${err.message}`);
    log.add(err.stack);
  } finally {
    // Fechar conexões
    if (oracleConn) {
      try {
        await oracleConn.close();
        log.add('\nConexão Oracle fechada');
      } catch (err) {
        log.add(`Erro ao fechar Oracle: ${err.message}`);
      }
    }

    if (pgClient) {
      try {
        await pgClient.end();
        log.add('Conexão PostgreSQL fechada');
      } catch (err) {
        log.add(`Erro ao fechar PostgreSQL: ${err.message}`);
      }
    }

    // Salvar log
    log.save();

    log.add('\n='.repeat(80));
    log.add('MIGRAÇÃO CONCLUÍDA');
    log.add('='.repeat(80));
  }
}

// Executar
main().catch(err => {
  console.error('Erro não tratado:', err);
  process.exit(1);
});
