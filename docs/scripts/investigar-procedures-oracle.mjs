import dotenv from "dotenv";
import oracledb from "oracledb";
import chalk from "chalk";
import fs from "fs";

dotenv.config();

// Inicializar Oracle Client em modo Thick
oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_23_8" });

console.log(chalk.blue("🧠 Oracle client modo:"), oracledb.thin ? chalk.red("Thin ❌") : chalk.green("Thick ✅"));

const log = (msg) => {
  console.log(msg);
  fs.appendFileSync("investigacao-remessa-log.txt", `[${new Date().toISOString()}] ${msg}\n`);
};

async function investigarProceduresRemessa() {
  let connection;

  try {
    log(chalk.yellow("\n🔍 Conectando ao Oracle..."));
    
    // Configuração da conexão (mesma do DATABASE_URL2)
    connection = await oracledb.getConnection({
      user: "GERAL",
      password: "123",
      connectString: "201.64.221.132:1524/desenv.mns.melopecas.com.br"
    });

    log(chalk.green("✅ Conectado com sucesso ao Oracle!\n"));

    // 1. Procedures com REMESSA no nome
    log(chalk.cyan("=" .repeat(80)));
    log(chalk.cyan("1. PROCEDURES COM 'REMESSA' NO NOME"));
    log(chalk.cyan("=".repeat(80)));

    const resultNome = await connection.execute(
      `SELECT 
        object_name,
        object_type,
        status,
        TO_CHAR(created, 'DD/MM/YYYY HH24:MI:SS') as criado_em,
        TO_CHAR(last_ddl_time, 'DD/MM/YYYY HH24:MI:SS') as ultima_modificacao
      FROM all_objects
      WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND UPPER(object_name) LIKE '%REMESSA%'
        AND owner = 'GERAL'
      ORDER BY object_name`
    );

    if (resultNome.rows.length > 0) {
      resultNome.rows.forEach(row => {
        log(`\n📦 ${chalk.bold(row[0])} (${row[1]})`);
        log(`   Status: ${row[2]}`);
        log(`   Criado em: ${row[3]}`);
        log(`   Última modificação: ${row[4]}`);
      });
    } else {
      log(chalk.gray("   Nenhuma procedure encontrada.\n"));
    }

    // 2. Procedures com REMESSA no código
    log(chalk.cyan("\n" + "=".repeat(80)));
    log(chalk.cyan("2. PROCEDURES COM 'REMESSA' NO CÓDIGO"));
    log(chalk.cyan("=".repeat(80)));

    const resultCodigo = await connection.execute(
      `SELECT DISTINCT
        name,
        type,
        COUNT(*) as ocorrencias
      FROM all_source
      WHERE UPPER(text) LIKE '%REMESSA%'
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      GROUP BY name, type
      ORDER BY name`
    );

    if (resultCodigo.rows.length > 0) {
      log(`\n📝 Encontradas ${resultCodigo.rows.length} procedures/funções:\n`);
      resultCodigo.rows.forEach(row => {
        log(`   • ${chalk.bold(row[0])} (${row[1]}) - ${chalk.yellow(row[2])} ocorrências`);
      });
    } else {
      log(chalk.gray("   Nenhuma procedure encontrada.\n"));
    }

    // 3. Procedures com CNAB/BOLETO
    log(chalk.cyan("\n" + "=".repeat(80)));
    log(chalk.cyan("3. PROCEDURES COM 'CNAB' OU 'BOLETO' NO CÓDIGO"));
    log(chalk.cyan("=".repeat(80)));

    const resultCNAB = await connection.execute(
      `SELECT DISTINCT
        name,
        type,
        COUNT(*) as ocorrencias
      FROM all_source
      WHERE (UPPER(text) LIKE '%CNAB%' OR UPPER(text) LIKE '%BOLETO%')
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
      GROUP BY name, type
      ORDER BY name`
    );

    if (resultCNAB.rows.length > 0) {
      log(`\n💰 Encontradas ${resultCNAB.rows.length} procedures/funções:\n`);
      resultCNAB.rows.forEach(row => {
        log(`   • ${chalk.bold(row[0])} (${row[1]}) - ${chalk.yellow(row[2])} ocorrências`);
      });
    } else {
      log(chalk.gray("   Nenhuma procedure encontrada.\n"));
    }

    // 4. Tabelas com REMESSA
    log(chalk.cyan("\n" + "=".repeat(80)));
    log(chalk.cyan("4. TABELAS COM 'REMESSA' NO NOME"));
    log(chalk.cyan("=".repeat(80)));

    const resultTabelas = await connection.execute(
      `SELECT 
        table_name,
        num_rows
      FROM all_tables
      WHERE UPPER(table_name) LIKE '%REMESSA%'
        AND owner = 'GERAL'
      ORDER BY table_name`
    );

    if (resultTabelas.rows.length > 0) {
      resultTabelas.rows.forEach(row => {
        log(`\n🗄️  ${chalk.bold(row[0])}`);
        log(`   Linhas: ${row[1] || 'N/A'}`);
      });
    } else {
      log(chalk.gray("   Nenhuma tabela encontrada.\n"));
    }

    // 5. Tabelas de BOLETO/TÍTULO/COBRANÇA
    log(chalk.cyan("\n" + "=".repeat(80)));
    log(chalk.cyan("5. TABELAS DE BOLETO/TÍTULO/COBRANÇA"));
    log(chalk.cyan("=".repeat(80)));

    const resultTabelasBoleto = await connection.execute(
      `SELECT 
        table_name,
        num_rows
      FROM all_tables
      WHERE (
          UPPER(table_name) LIKE '%BOLETO%' OR
          UPPER(table_name) LIKE '%TITULO%' OR
          UPPER(table_name) LIKE '%COBRANCA%' OR
          UPPER(table_name) LIKE '%BANCO%'
        )
        AND owner = 'GERAL'
      ORDER BY table_name`
    );

    if (resultTabelasBoleto.rows.length > 0) {
      resultTabelasBoleto.rows.forEach(row => {
        log(`   • ${chalk.bold(row[0])} - ${row[1] || 'N/A'} linhas`);
      });
    } else {
      log(chalk.gray("   Nenhuma tabela encontrada.\n"));
    }

    // 6. Código fonte das procedures encontradas
    if (resultCodigo.rows.length > 0) {
      log(chalk.cyan("\n" + "=".repeat(80)));
      log(chalk.cyan("6. CÓDIGO FONTE DAS PROCEDURES DE REMESSA"));
      log(chalk.cyan("=".repeat(80)));

      // Pegar código das primeiras 3 procedures
      const maxProcs = Math.min(3, resultCodigo.rows.length);
      
      for (let i = 0; i < maxProcs; i++) {
        const procName = resultCodigo.rows[i][0];
        
        log(chalk.yellow(`\n${"=".repeat(80)}`));
        log(chalk.yellow(`📄 CÓDIGO DE: ${procName}`));
        log(chalk.yellow("=".repeat(80)));

        const resultCode = await connection.execute(
          `SELECT text
          FROM all_source
          WHERE name = :procName
            AND owner = 'GERAL'
          ORDER BY line`,
          [procName]
        );

        if (resultCode.rows.length > 0) {
          const codigo = resultCode.rows.map(row => row[0]).join('');
          log(codigo);
          
          // Salvar em arquivo separado
          fs.writeFileSync(
            `procedure_${procName}.sql`,
            codigo,
            'utf-8'
          );
          log(chalk.green(`\n✅ Código salvo em: procedure_${procName}.sql`));
        }
      }
    }

    // 7. Buscar procedures de TÍTULO/COBRANÇA
    log(chalk.cyan("\n" + "=".repeat(80)));
    log(chalk.cyan("7. PROCEDURES DE TÍTULO/COBRANÇA"));
    log(chalk.cyan("=".repeat(80)));

    const resultTitulo = await connection.execute(
      `SELECT DISTINCT
        name,
        type
      FROM all_source
      WHERE (
          UPPER(text) LIKE '%TITULO%' OR 
          UPPER(text) LIKE '%COBRANCA%'
        )
        AND owner = 'GERAL'
        AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
      ORDER BY name`
    );

    if (resultTitulo.rows.length > 0) {
      log(`\n📋 Encontradas ${resultTitulo.rows.length} procedures:\n`);
      resultTitulo.rows.forEach(row => {
        log(`   • ${chalk.bold(row[0])} (${row[1]})`);
      });
    } else {
      log(chalk.gray("   Nenhuma procedure encontrada.\n"));
    }

    log(chalk.green("\n\n✅ Investigação concluída!"));
    log(chalk.blue(`📄 Log salvo em: investigacao-remessa-log.txt`));

  } catch (error) {
    log(chalk.red(`\n❌ Erro: ${error.message}`));
    console.error(error);
  } finally {
    if (connection) {
      try {
        await connection.close();
        log(chalk.green("\n✅ Conexão fechada."));
      } catch (err) {
        log(chalk.red(`Erro ao fechar conexão: ${err.message}`));
      }
    }
  }
}

investigarProceduresRemessa();
