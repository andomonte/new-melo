import dotenv from 'dotenv';
import oracledb from 'oracledb';
import chalk from 'chalk';

dotenv.config();

// Inicializar Oracle Client em modo Thick
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });

console.log(chalk.blue('🧠 Oracle client modo:'), oracledb.thin ? chalk.red('Thin ❌') : chalk.green('Thick ✅'));

async function verificarCamposCartao() {
  let connection;

  try {
    console.log(chalk.yellow('\n🔌 Conectando ao Oracle...'));
    
    // Configuração da conexão (mesma do DATABASE_URL2)
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });
    
    console.log(chalk.green('✅ Conectado com sucesso!\n'));

    // 1. Verificar campos da tabela DBFRECEB
    console.log(chalk.cyan('=' .repeat(80)));
    console.log(chalk.cyan('1. VERIFICANDO CAMPOS DA TABELA DBFRECEB'));
    console.log(chalk.cyan('='.repeat(80)) + '\n');
    
    const queryTabela = `
      SELECT 
        column_name,
        data_type,
        data_length,
        nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'DBFRECEB'
        AND column_name IN (
          'CODOPERA', 'DT_CARTAO', 'TX_CARTAO', 'NRO_CHEQUE',
          'CMC7', 'ID_AUTENTICACAO', 'PARCELA', 
          'CODDOCUMENTO', 'COD_DOCUMENTO', 
          'CODAUTORIZACAO', 'COD_AUTORIZACAO'
        )
      ORDER BY column_name
    `;

    const resultTabela = await connection.execute(queryTabela);
    
    if (resultTabela.rows && resultTabela.rows.length > 0) {
      console.log(chalk.green('✅ Campos encontrados em DBFRECEB:'));
      console.log(chalk.gray('─'.repeat(80)));
      resultTabela.rows.forEach(row => {
        console.log(chalk.white(`  ${row[0].padEnd(20)} | ${row[1].padEnd(15)} | Tam: ${String(row[2]).padEnd(5)} | Null: ${row[3]}`));
      });
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.yellow(`Total: ${resultTabela.rows.length} campos de cartão/cheque encontrados\n`));
    } else {
      console.log(chalk.red('⚠️  Nenhum campo de cartão encontrado na tabela DBFRECEB\n'));
    }

    // 2. Verificar assinatura da procedure
    console.log(chalk.cyan('\n' + '=' .repeat(80)));
    console.log(chalk.cyan('2. VERIFICANDO ASSINATURA DA PROCEDURE Inc_ContasFR'));
    console.log(chalk.cyan('='.repeat(80)) + '\n');
    
    const queryAssinatura = `
      SELECT 
        argument_name,
        data_type,
        in_out,
        position
      FROM all_arguments
      WHERE owner = 'GERAL'
        AND object_name = 'INC_CONTASFR'
        AND package_name = 'CONTASFR'
        AND argument_name IN (
          'PCODOPERA', 'PDT_CARTAO', 'PTX_CARTAO', 
          'PNRO_CHEQUE', 'PCMC7', 'PID_AUTENTICACAO',
          'PPARCELA', 'PCODDOCUMENTO', 'PCODAUTORIZACAO'
        )
      ORDER BY position
    `;

    const resultAssinatura = await connection.execute(queryAssinatura);

    if (resultAssinatura.rows && resultAssinatura.rows.length > 0) {
      console.log(chalk.green('✅ Parâmetros de cartão/cheque na procedure Inc_ContasFR:'));
      console.log(chalk.gray('─'.repeat(80)));
      resultAssinatura.rows.forEach(row => {
        console.log(chalk.white(`  Pos ${String(row[3]).padStart(2)}: ${row[0].padEnd(20)} | ${row[1].padEnd(15)} | ${row[2]}`));
      });
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.yellow(`Total: ${resultAssinatura.rows.length} parâmetros de cartão encontrados\n`));
    } else {
      console.log(chalk.red('⚠️  Nenhum parâmetro de cartão encontrado na assinatura\n'));
    }

    // 3. Contar registros com campos de cartão preenchidos
    console.log(chalk.cyan('\n' + '=' .repeat(80)));
    console.log(chalk.cyan('3. VERIFICANDO DADOS REAIS NA TABELA'));
    console.log(chalk.cyan('='.repeat(80)) + '\n');
    
    const queryDados = `
      SELECT 
        COUNT(*) as total,
        COUNT(CODOPERA) as com_operadora,
        COUNT(DT_CARTAO) as com_dt_cartao,
        COUNT(TX_CARTAO) as com_tx_cartao,
        COUNT(PARCELA) as com_parcela,
        COUNT(CMC7) as com_cmc7
      FROM GERAL.DBFRECEB
      WHERE ROWNUM <= 10000
    `;

    const resultDados = await connection.execute(queryDados);

    if (resultDados.rows && resultDados.rows.length > 0) {
      const [total, operadora, dtCartao, txCartao, parcela, cmc7] = resultDados.rows[0];
      console.log(chalk.green('✅ Estatísticas de uso (últimos 10.000 registros):'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.white(`  Total de registros:        ${total}`));
      console.log(chalk.white(`  Com CODOPERA preenchido:   ${operadora} (${((operadora/total) * 100).toFixed(1)}%)`));
      console.log(chalk.white(`  Com DT_CARTAO preenchido:  ${dtCartao} (${((dtCartao/total) * 100).toFixed(1)}%)`));
      console.log(chalk.white(`  Com TX_CARTAO preenchido:  ${txCartao} (${((txCartao/total) * 100).toFixed(1)}%)`));
      console.log(chalk.white(`  Com PARCELA preenchido:    ${parcela} (${((parcela/total) * 100).toFixed(1)}%)`));
      console.log(chalk.white(`  Com CMC7 preenchido:       ${cmc7} (${((cmc7/total) * 100).toFixed(1)}%)`));
      console.log(chalk.gray('─'.repeat(80)));
      console.log();
    }

    console.log(chalk.cyan('\n' + '=' .repeat(80)));
    console.log(chalk.cyan('🎯 CONCLUSÃO'));
    console.log(chalk.cyan('='.repeat(80)) + '\n');
    console.log(chalk.white('Se os campos aparecerem acima, confirma que:'));
    console.log(chalk.green('  ✅ A tabela DBFRECEB possui colunas para dados de cartão/cheque'));
    console.log(chalk.green('  ✅ A procedure Inc_ContasFR aceita esses parâmetros'));
    console.log(chalk.green('  ✅ O sistema legado Oracle utiliza essas informações'));
    console.log(chalk.green('  ✅ É correto manter esses campos no novo sistema\n'));

  } catch (err) {
    console.error(chalk.red('❌ Erro ao executar consulta:'), err.message);
    console.error(chalk.red('Stack:'), err.stack);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log(chalk.gray('\n🔌 Conexão fechada.'));
      } catch (err) {
        console.error(chalk.red('Erro ao fechar conexão:'), err.message);
      }
    }
  }
}

// Executar
verificarCamposCartao().catch(console.error);
