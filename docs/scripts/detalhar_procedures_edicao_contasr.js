import oracledb from 'oracledb';
import chalk from 'chalk';

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });
} catch (err) {
  console.error('Erro ao inicializar Oracle Client:', err.message);
}

async function detalharProceduresEdicao() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log(chalk.green('✓ Conectado ao Oracle com sucesso!\n'));

    // 1. Procedure EDIT_ALTCONTASRECEBE
    console.log(chalk.blue('═══ 1. PROCEDURE: EDIT_ALTCONTASRECEBE ═══\n'));
    
    const paramsEditQuery = `
      SELECT argument_name, data_type, in_out, position
      FROM all_arguments
      WHERE owner = 'GERAL'
        AND object_name = 'EDIT_ALTCONTASRECEBE'
      ORDER BY position
    `;
    const paramsEdit = await connection.execute(paramsEditQuery);
    
    console.log(chalk.yellow('Parâmetros:'));
    paramsEdit.rows.forEach(row => {
      const [name, type, inOut, pos] = row;
      console.log(`  ${pos}. ${chalk.cyan(name || 'RETURN')}: ${type} [${inOut}]`);
    });

    // 2. Procedures CONTASR_ALT_*
    console.log(chalk.blue('\n═══ 2. PROCEDURES DE ALTERAÇÃO (CONTASR_ALT_*) ═══\n'));
    
    const altProcedures = [
      'CONTASR_ALT_DTVENC_CODRECEB',
      'CONTASR_ALT_NRODOC',
      'CONTASR_ALT_VALOR_CODRECEB'
    ];

    for (const procName of altProcedures) {
      console.log(chalk.yellow(`\n${procName}:`));
      
      const paramsQuery = `
        SELECT argument_name, data_type, in_out, position
        FROM all_arguments
        WHERE owner = 'GERAL'
          AND object_name = :procName
        ORDER BY position
      `;
      const params = await connection.execute(paramsQuery, [procName]);
      
      params.rows.forEach(row => {
        const [name, type, inOut, pos] = row;
        console.log(`  ${pos}. ${chalk.cyan(name || 'RETURN')}: ${type} [${inOut}]`);
      });
    }

    // 3. Package CONTASR
    console.log(chalk.blue('\n═══ 3. PACKAGE CONTASR ═══\n'));
    
    const contasrProcQuery = `
      SELECT procedure_name
      FROM all_procedures
      WHERE owner = 'GERAL'
        AND object_name = 'CONTASR'
        AND procedure_name IS NOT NULL
      ORDER BY procedure_name
    `;
    const contasrProcs = await connection.execute(contasrProcQuery);
    
    console.log(chalk.yellow('Procedures no package CONTASR:'));
    contasrProcs.rows.forEach(row => {
      console.log(`  - ${chalk.cyan(row[0])}`);
    });

    // 4. Detalhar CONTASR.ALT_CONTASR (procedure de alteração no package)
    console.log(chalk.blue('\n═══ 4. CONTASR.ALT_CONTASR (Procedure de Edição) ═══\n'));
    
    const altContasrQuery = `
      SELECT argument_name, data_type, in_out, position
      FROM all_arguments
      WHERE owner = 'GERAL'
        AND package_name = 'CONTASR'
        AND object_name = 'ALT_CONTASR'
      ORDER BY position
    `;
    const altContasr = await connection.execute(altContasrQuery);
    
    console.log(chalk.yellow('Parâmetros de CONTASR.ALT_CONTASR:'));
    if (altContasr.rows.length === 0) {
      console.log(chalk.gray('  Nenhum parâmetro encontrado'));
    } else {
      altContasr.rows.forEach(row => {
        const [name, type, inOut, pos] = row;
        console.log(`  ${pos}. ${chalk.cyan(name || 'RETURN')}: ${type} [${inOut}]`);
      });
    }

    // 5. CONTASR.ALTERA_NRODOC_CRECEB
    console.log(chalk.blue('\n═══ 5. CONTASR.ALTERA_NRODOC_CRECEB ═══\n'));
    
    const alteraNrodocQuery = `
      SELECT argument_name, data_type, in_out, position
      FROM all_arguments
      WHERE owner = 'GERAL'
        AND package_name = 'CONTASR'
        AND object_name = 'ALTERA_NRODOC_CRECEB'
      ORDER BY position
    `;
    const alteraNrodoc = await connection.execute(alteraNrodocQuery);
    
    console.log(chalk.yellow('Parâmetros:'));
    alteraNrodoc.rows.forEach(row => {
      const [name, type, inOut, pos] = row;
      console.log(`  ${pos}. ${chalk.cyan(name || 'RETURN')}: ${type} [${inOut}]`);
    });

    // 6. CONTASR.ALTERA_VALOR_CRECEB
    console.log(chalk.blue('\n═══ 6. CONTASR.ALTERA_VALOR_CRECEB ═══\n'));
    
    const alteraValorQuery = `
      SELECT argument_name, data_type, in_out, position
      FROM all_arguments
      WHERE owner = 'GERAL'
        AND package_name = 'CONTASR'
        AND object_name = 'ALTERA_VALOR_CRECEB'
      ORDER BY position
    `;
    const alteraValor = await connection.execute(alteraValorQuery);
    
    console.log(chalk.yellow('Parâmetros:'));
    alteraValor.rows.forEach(row => {
      const [name, type, inOut, pos] = row;
      console.log(`  ${pos}. ${chalk.cyan(name || 'RETURN')}: ${type} [${inOut}]`);
    });

    console.log(chalk.green('\n✅ Consulta concluída!\n'));

  } catch (err) {
    console.error(chalk.red('❌ Erro:'), err.message);
  } finally {
    if (connection) {
      await connection.close();
      console.log(chalk.gray('Conexão fechada.'));
    }
  }
}

detalharProceduresEdicao();
