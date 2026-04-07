import oracledb from 'oracledb';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../../.env.local') });

// Configurar Oracle client em modo Thick
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_8' });
} catch (err) {
  // Já inicializado ou não necessário
  console.log(chalk.gray('Oracle client já inicializado ou caminho alternativo'));
}

async function verificarEdicaoReceber() {
  let connection;

  try {
    console.log(chalk.blue('\n=== VERIFICAÇÃO: Edição de Títulos a Receber no Oracle ===\n'));

    // Conectar ao Oracle
    connection = await oracledb.getConnection({
      user: 'GERAL',
      password: '123',
      connectString: '201.64.221.132:1524/desenv.mns.melopecas.com.br'
    });

    console.log(chalk.green('✓ Conectado ao Oracle com sucesso!\n'));

    // 1. Verificar estrutura da tabela DBRECEB (títulos)
    console.log(chalk.yellow('1️⃣  Estrutura da tabela DBRECEB (Títulos a Receber):'));
    const estruturaQuery = `
      SELECT column_name, data_type, data_length, nullable
      FROM all_tab_columns
      WHERE owner = 'GERAL'
        AND table_name = 'DBRECEB'
      ORDER BY column_id
    `;
    const estruturaResult = await connection.execute(estruturaQuery);
    
    console.log(chalk.cyan(`   Campos encontrados: ${estruturaResult.rows.length}`));
    estruturaResult.rows.forEach(row => {
      const [nome, tipo, tamanho, nullable] = row;
      const nullText = nullable === 'Y' ? chalk.gray('(null)') : chalk.red('(NOT NULL)');
      console.log(`   - ${chalk.white(nome)}: ${tipo}(${tamanho}) ${nullText}`);
    });

    // 2. Verificar procedures de edição/atualização
    console.log(chalk.yellow('\n2️⃣  Procedures relacionadas a atualização de recebimentos:'));
    const proceduresQuery = `
      SELECT object_name, procedure_name, object_type
      FROM all_procedures
      WHERE owner = 'GERAL'
        AND (
          UPPER(object_name) LIKE '%RECEB%' 
          OR UPPER(procedure_name) LIKE '%RECEB%'
          OR UPPER(object_name) LIKE '%EDIT%'
          OR UPPER(procedure_name) LIKE '%EDIT%'
          OR UPPER(object_name) LIKE '%ALT%'
          OR UPPER(procedure_name) LIKE '%ALT%'
          OR UPPER(object_name) LIKE '%UPD%'
          OR UPPER(procedure_name) LIKE '%UPD%'
        )
      ORDER BY object_name, procedure_name
    `;
    const proceduresResult = await connection.execute(proceduresQuery);
    
    if (proceduresResult.rows.length > 0) {
      console.log(chalk.cyan(`   Procedures encontradas: ${proceduresResult.rows.length}`));
      proceduresResult.rows.forEach(row => {
        const [objName, procName, objType] = row;
        console.log(`   - ${chalk.white(objName)}${procName ? `.${procName}` : ''} (${objType})`);
      });
    } else {
      console.log(chalk.gray('   Nenhuma procedure específica de edição encontrada.'));
    }

    // 3. Verificar se existe procedure Upd_ContasR ou similar
    console.log(chalk.yellow('\n3️⃣  Buscando procedure específica de Update de Contas a Receber:'));
    const updProcQuery = `
      SELECT object_name, object_type
      FROM all_objects
      WHERE owner = 'GERAL'
        AND object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
        AND (
          UPPER(object_name) LIKE 'UPD%CONTA%R%'
          OR UPPER(object_name) LIKE '%UPDATE%RECEB%'
          OR UPPER(object_name) = 'UPD_CONTASR'
        )
    `;
    const updProcResult = await connection.execute(updProcQuery);
    
    if (updProcResult.rows.length > 0) {
      console.log(chalk.green(`   ✓ Procedures de UPDATE encontradas: ${updProcResult.rows.length}`));
      
      for (const row of updProcResult.rows) {
        const [objName, objType] = row;
        console.log(chalk.white(`\n   Procedure: ${objName} (${objType})`));
        
        // Buscar parâmetros da procedure
        const paramsQuery = `
          SELECT argument_name, data_type, in_out, position
          FROM all_arguments
          WHERE owner = 'GERAL'
            AND object_name = :objName
            AND package_name IS NULL
          ORDER BY position
        `;
        const paramsResult = await connection.execute(paramsQuery, [objName]);
        
        if (paramsResult.rows.length > 0) {
          console.log(chalk.cyan('   Parâmetros:'));
          paramsResult.rows.forEach(paramRow => {
            const [argName, dataType, inOut, position] = paramRow;
            console.log(`      ${position}. ${chalk.yellow(argName || 'RETURN')}: ${dataType} [${inOut}]`);
          });
        }
      }
    } else {
      console.log(chalk.gray('   Nenhuma procedure específica de UPDATE encontrada.'));
    }

    // 4. Verificar constraints/regras na tabela
    console.log(chalk.yellow('\n4️⃣  Constraints e regras na tabela DBRECEB:'));
    const constraintsQuery = `
      SELECT constraint_name, constraint_type, search_condition
      FROM all_constraints
      WHERE owner = 'GERAL'
        AND table_name = 'DBRECEB'
    `;
    const constraintsResult = await connection.execute(constraintsQuery);
    
    if (constraintsResult.rows.length > 0) {
      console.log(chalk.cyan(`   Constraints encontradas: ${constraintsResult.rows.length}`));
      constraintsResult.rows.forEach(row => {
        const [name, type, condition] = row;
        const typeText = type === 'P' ? 'PRIMARY KEY' : 
                        type === 'U' ? 'UNIQUE' :
                        type === 'C' ? 'CHECK' :
                        type === 'R' ? 'FOREIGN KEY' : type;
        console.log(`   - ${chalk.white(name)}: ${typeText}`);
        if (condition && condition.length < 100) {
          console.log(chalk.gray(`     ${condition}`));
        }
      });
    }

    // 5. Verificar se há títulos que foram editados (comparar dt_alteracao vs dt_emissao)
    console.log(chalk.yellow('\n5️⃣  Análise de títulos editados (últimos 100 registros):'));
    const edicaoAnaliseQuery = `
      SELECT 
        COUNT(*) as total_titulos,
        SUM(CASE WHEN recebido > 0 THEN 1 ELSE 0 END) as titulos_com_recebimento,
        SUM(CASE WHEN recebido = 0 THEN 1 ELSE 0 END) as titulos_sem_recebimento
      FROM (
        SELECT 
          r.cod_receb,
          r.valor_pgto,
          COALESCE(
            (SELECT SUM(f.valor) 
             FROM GERAL.DBFRECEB f 
             WHERE f.cod_receb = r.cod_receb
            ), 0
          ) as recebido
        FROM GERAL.DBRECEB r
        WHERE ROWNUM <= 100
        ORDER BY r.cod_receb DESC
      )
    `;
    const edicaoAnaliseResult = await connection.execute(edicaoAnaliseQuery);
    
    if (edicaoAnaliseResult.rows.length > 0) {
      const [total, comReceb, semReceb] = edicaoAnaliseResult.rows[0];
      console.log(chalk.cyan('   Estatísticas dos últimos 100 títulos:'));
      console.log(`   - Total: ${chalk.white(total)}`);
      console.log(`   - Com recebimentos: ${chalk.green(comReceb)}`);
      console.log(`   - Sem recebimentos: ${chalk.yellow(semReceb)}`);
      console.log(chalk.gray('\n   💡 Títulos SEM recebimentos podem ser editados'));
      console.log(chalk.gray('   💡 Títulos COM recebimentos NÃO devem ser editados (regra de negócio)'));
    }

    // 6. Verificar campos editáveis comuns
    console.log(chalk.yellow('\n6️⃣  Campos tipicamente editáveis em DBRECEB:'));
    const camposEditaveis = [
      'DT_VENC', 'DT_EMISSAO', 'VALOR_PGTO', 'OBS', 
      'NRO_DOC', 'CODCLI', 'REC_COF_ID', 'BANCO'
    ];
    
    console.log(chalk.cyan('   Campos que geralmente podem ser editados:'));
    camposEditaveis.forEach(campo => {
      console.log(`   - ${chalk.white(campo)}`);
    });

    console.log(chalk.green('\n✅ Verificação concluída!\n'));
    console.log(chalk.blue('═══════════════════════════════════════════════════════════\n'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Erro durante verificação:'), error.message);
    console.error(chalk.gray(error.stack));
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log(chalk.gray('Conexão fechada.'));
      } catch (err) {
        console.error(chalk.red('Erro ao fechar conexão:'), err.message);
      }
    }
  }
}

verificarEdicaoReceber();
