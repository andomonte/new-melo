import oracledb from 'oracledb';
import chalk from 'chalk';

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });
} catch (err) {
  console.error('Erro ao inicializar Oracle Client:', err.message);
}

async function verificarTabelasCartao() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log(chalk.green('✓ Conectado ao Oracle!\n'));

    // 1. Verificar tabela DBOPERA (operadoras de cartão)
    console.log(chalk.blue('═══ 1. TABELA DBOPERA (Operadoras de Cartão) ═══\n'));
    
    const operaQuery = `
      SELECT column_name, data_type, data_length
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'DBOPERA'
      ORDER BY column_id
    `;
    
    try {
      const opera = await connection.execute(operaQuery);
      console.log(chalk.yellow('Estrutura da DBOPERA:'));
      opera.rows.forEach(row => {
        console.log(`  - ${chalk.cyan(row[0])}: ${row[1]}(${row[2]})`);
      });
      
      // Buscar dados
      const operaDadosQuery = `SELECT * FROM GERAL.DBOPERA WHERE ROWNUM <= 10`;
      const operaDados = await connection.execute(operaDadosQuery);
      console.log(chalk.yellow('\nDados (primeiros 10):'));
      operaDados.rows.forEach(row => {
        console.log(`  ${JSON.stringify(row)}`);
      });
    } catch (err) {
      console.log(chalk.gray('  Tabela DBOPERA não encontrada ou sem acesso'));
    }

    // 2. Buscar tabelas relacionadas a tarifa/taxa de cartão
    console.log(chalk.blue('\n═══ 2. TABELAS DE TARIFA/TAXA ═══\n'));
    
    const tarifaQuery = `
      SELECT table_name
      FROM all_tables
      WHERE owner = 'GERAL'
        AND (table_name LIKE '%TARIF%' 
          OR table_name LIKE '%TAXA%'
          OR table_name LIKE '%OPER%'
          OR table_name LIKE '%CARTAO%')
      ORDER BY table_name
    `;
    const tarifa = await connection.execute(tarifaQuery);
    
    console.log(chalk.yellow('Tabelas encontradas:'));
    if (tarifa.rows.length > 0) {
      tarifa.rows.forEach(row => {
        console.log(`  - ${chalk.cyan(row[0])}`);
      });
    } else {
      console.log(chalk.gray('  Nenhuma tabela encontrada'));
    }

    // 3. Verificar se existe configuração de prazo/vencimento
    console.log(chalk.blue('\n═══ 3. TABELAS DE PRAZO/VENCIMENTO ═══\n'));
    
    const prazoQuery = `
      SELECT table_name
      FROM all_tables
      WHERE owner = 'GERAL'
        AND (table_name LIKE '%PRAZO%' 
          OR table_name LIKE '%VENC%'
          OR table_name LIKE '%PARCELA%')
      ORDER BY table_name
    `;
    const prazo = await connection.execute(prazoQuery);
    
    console.log(chalk.yellow('Tabelas encontradas:'));
    if (prazo.rows.length > 0) {
      prazo.rows.forEach(row => {
        console.log(`  - ${chalk.cyan(row[0])}`);
      });
    } else {
      console.log(chalk.gray('  Nenhuma tabela encontrada'));
    }

    // 4. Verificar tabelas de conciliação
    console.log(chalk.blue('\n═══ 4. TABELAS DE CONCILIAÇÃO ═══\n'));
    
    const concilQuery = `
      SELECT table_name
      FROM all_tables
      WHERE owner = 'GERAL'
        AND (table_name LIKE '%CONCIL%' 
          OR table_name LIKE '%IMPORT%'
          OR table_name LIKE '%ARQUIVO%'
          OR table_name LIKE '%RETORNO%')
      ORDER BY table_name
    `;
    const concil = await connection.execute(concilQuery);
    
    console.log(chalk.yellow('Tabelas encontradas:'));
    if (concil.rows.length > 0) {
      concil.rows.forEach(row => {
        console.log(`  - ${chalk.cyan(row[0])}`);
      });
    } else {
      console.log(chalk.gray('  Nenhuma tabela encontrada'));
    }

    // 5. Verificar campos úteis em DBFRECEB
    console.log(chalk.blue('\n═══ 5. CAMPOS RELEVANTES EM DBFRECEB ═══\n'));
    
    console.log(chalk.yellow('Campos para conciliação de cartão:'));
    console.log(`  - ${chalk.cyan('CODOPERA')}: Código da operadora (Santander, etc)`);
    console.log(`  - ${chalk.cyan('CODAUTORIZACAO')}: Número de autorização da transação`);
    console.log(`  - ${chalk.cyan('PARCELA')}: Formato atual | Sugestão: "01-03"`);
    console.log(`  - ${chalk.cyan('TX_CARTAO')}: Taxa da operadora`);
    console.log(`  - ${chalk.cyan('DT_CARTAO')}: Data da transação`);
    console.log(`  - ${chalk.cyan('CODDOCUMENTO')}: Código do documento/lote`);

    console.log(chalk.green('\n✅ Verificação concluída!\n'));

  } catch (err) {
    console.error(chalk.red('❌ Erro:'), err.message);
  } finally {
    if (connection) {
      await connection.close();
      console.log(chalk.gray('Conexão fechada.'));
    }
  }
}

verificarTabelasCartao();
