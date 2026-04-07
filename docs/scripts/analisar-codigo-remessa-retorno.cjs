const oracledb = require('oracledb');
require('dotenv').config();

// Adicionar Oracle Instant Client ao PATH antes de inicializar
const instantClientPath = 'C:\\oracle\\instantclient_23_8';
process.env.PATH = instantClientPath + ';' + process.env.PATH;
console.log('✅ Oracle Instant Client adicionado ao PATH');

// FORÇAR modo Thick antes de qualquer conexão
try {
  oracledb.initOracleClient({
    libDir: instantClientPath,
  });
  console.log('✅ Oracle Instant Client inicializado em modo Thick');
} catch (err) {
  if (err.message.includes('already been initialized')) {
    console.log('✅ Oracle Instant Client já está em modo Thick');
  } else {
    console.error('❌ Erro ao inicializar Oracle Client:', err.message);
    process.exit(1);
  }
}

async function analisarCodigoCompleto() {
  let connection;

  try {
    const connectString = `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE}`;
    
    console.log(`🔌 Conectando ao Oracle: ${connectString}`);
    
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: connectString
    });

    console.log('✅ Conectado ao Oracle Database\n');

    const packagesToAnalyze = [
      { name: 'REMESSABANCO', type: 'PACKAGE BODY', description: '📤 GERAÇÃO DE REMESSAS BANCÁRIAS' },
      { name: 'RETORNO', type: 'PACKAGE BODY', description: '📥 PROCESSAMENTO DE RETORNO BANCÁRIO' },
      { name: 'PRETCOBRANCA', type: 'PACKAGE BODY', description: '💰 PRÉ-COBRANÇA E TÍTULOS' }
    ];

    for (const pkg of packagesToAnalyze) {
      console.log('═'.repeat(80));
      console.log(`${pkg.description}`);
      console.log(`📦 Package: ${pkg.name}`);
      console.log('═'.repeat(80));

      try {
        // Buscar código fonte completo
        const querySource = `
          SELECT text 
          FROM all_source 
          WHERE name = :objectName 
            AND type = :objectType
          ORDER BY line
        `;

        const sourceResult = await connection.execute(querySource, {
          objectName: pkg.name,
          objectType: pkg.type
        });

        if (sourceResult.rows && sourceResult.rows.length > 0) {
          console.log(`\n📄 Total de linhas: ${sourceResult.rows.length}\n`);
          console.log('─'.repeat(80));
          
          let codigoCompleto = '';
          sourceResult.rows.forEach(row => {
            codigoCompleto += row[0];
          });
          
          console.log(codigoCompleto);
          console.log('\n─'.repeat(80));
          
          // Análise de procedures dentro do package
          console.log('\n🔍 ANÁLISE DE PROCEDURES/FUNCTIONS:\n');
          
          const procedures = codigoCompleto.match(/PROCEDURE\s+(\w+)/gi);
          const functions = codigoCompleto.match(/FUNCTION\s+(\w+)/gi);
          
          if (procedures) {
            console.log(`📋 ${procedures.length} Procedures encontradas:`);
            procedures.forEach((proc, idx) => {
              console.log(`   ${idx + 1}. ${proc.trim()}`);
            });
            console.log('');
          }
          
          if (functions) {
            console.log(`🔧 ${functions.length} Functions encontradas:`);
            functions.forEach((func, idx) => {
              console.log(`   ${idx + 1}. ${func.trim()}`);
            });
            console.log('');
          }
          
          // Buscar chamadas de SELECT nas tabelas principais
          console.log('🗃️ TABELAS ACESSADAS:\n');
          const tabelas = new Set();
          const selectMatches = codigoCompleto.match(/FROM\s+(\w+)/gi);
          const insertMatches = codigoCompleto.match(/INSERT\s+INTO\s+(\w+)/gi);
          const updateMatches = codigoCompleto.match(/UPDATE\s+(\w+)/gi);
          
          if (selectMatches) {
            selectMatches.forEach(match => {
              const table = match.replace(/FROM\s+/i, '').trim();
              if (table.startsWith('DB') || table.startsWith('SAV_')) {
                tabelas.add(table);
              }
            });
          }
          
          if (insertMatches) {
            insertMatches.forEach(match => {
              const table = match.replace(/INSERT\s+INTO\s+/i, '').trim();
              if (table.startsWith('DB') || table.startsWith('SAV_')) {
                tabelas.add(table);
              }
            });
          }
          
          if (updateMatches) {
            updateMatches.forEach(match => {
              const table = match.replace(/UPDATE\s+/i, '').trim();
              if (table.startsWith('DB') || table.startsWith('SAV_')) {
                tabelas.add(table);
              }
            });
          }
          
          if (tabelas.size > 0) {
            Array.from(tabelas).sort().forEach((tabela, idx) => {
              console.log(`   ${idx + 1}. ${tabela}`);
            });
          }
          
        } else {
          console.log('⚠️ Código fonte não encontrado');
        }
      } catch (err) {
        console.error(`❌ Erro ao buscar ${pkg.name}: ${err.message}`);
      }
      
      console.log('\n\n');
    }

    console.log('═'.repeat(80));
    console.log('✅ ANÁLISE COMPLETA FINALIZADA');
    console.log('═'.repeat(80));

  } catch (err) {
    console.error('\n❌ Erro ao consultar Oracle:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n🔌 Conexão fechada');
      } catch (err) {
        console.error('❌ Erro ao fechar conexão:', err.message);
      }
    }
  }
}

analisarCodigoCompleto();
