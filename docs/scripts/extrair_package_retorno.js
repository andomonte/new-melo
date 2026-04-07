const oracledb = require('oracledb');
const fs = require('fs');

async function extrairPackageRetorno() {
  let connection;

  try {
    // Tentar inicializar Oracle Client (opcional)
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

    console.log('✅ Conectado ao Oracle\n');

    // Buscar spec da package (declarações)
    console.log('📋 Buscando PACKAGE SPEC (declarações)...\n');
    const specResult = await connection.execute(
      `SELECT text 
       FROM all_source 
       WHERE name = 'RETORNO' 
       AND type = 'PACKAGE'
       AND owner = 'GERAL'
       ORDER BY line`
    );

    // Buscar body da package (implementação)
    console.log('📋 Buscando PACKAGE BODY (implementação)...\n');
    const bodyResult = await connection.execute(
      `SELECT text 
       FROM all_source 
       WHERE name = 'RETORNO' 
       AND type = 'PACKAGE BODY'
       AND owner = 'GERAL'
       ORDER BY line`
    );

    let output = '';
    
    output += '================================================================================\n';
    output += '📦 PACKAGE RETORNO - SPEC (Declarações)\n';
    output += '================================================================================\n';
    output += 'package RETORNO is\n';
    
    if (specResult.rows.length > 0) {
      specResult.rows.forEach(row => {
        output += row.TEXT;
      });
      console.log(`✅ SPEC encontrado: ${specResult.rows.length} linhas`);
    } else {
      output += '-- Nenhuma declaração encontrada\n';
      console.log('⚠️  SPEC não encontrado');
    }
    
    output += '\n\n';
    output += '================================================================================\n';
    output += '📦 PACKAGE RETORNO - BODY (Implementação)\n';
    output += '================================================================================\n';
    output += 'package body RETORNO is\n';
    
    if (bodyResult.rows.length > 0) {
      bodyResult.rows.forEach(row => {
        output += row.TEXT;
      });
      console.log(`✅ BODY encontrado: ${bodyResult.rows.length} linhas`);
    } else {
      output += '-- Nenhuma implementação encontrada\n';
      console.log('⚠️  BODY não encontrado');
    }
    
    output += '\n\nend RETORNO;\n';
    
    // Salvar em arquivo
    fs.writeFileSync('procedure_RETORNO.sql', output);
    console.log('\n✅ Código salvo em: procedure_RETORNO.sql');
    
    // Também buscar informações sobre procedures específicas
    console.log('\n📋 Buscando procedures relacionadas a retorno/importação...\n');
    const procResult = await connection.execute(
      `SELECT object_name, object_type, status
       FROM all_objects 
       WHERE owner = 'GERAL'
       AND object_type IN ('PROCEDURE', 'FUNCTION')
       AND (UPPER(object_name) LIKE '%RETORNO%' 
            OR UPPER(object_name) LIKE '%IMPORT%'
            OR UPPER(object_name) LIKE '%CNAB%'
            OR UPPER(object_name) LIKE '%DDA%')
       ORDER BY object_name`
    );

    if (procResult.rows.length > 0) {
      console.log('\n📌 Procedures/Functions relacionadas:');
      procResult.rows.forEach(row => {
        console.log(`   • ${row.OBJECT_NAME} (${row.OBJECT_TYPE}) - ${row.STATUS}`);
      });
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.error(err);
  } finally {
    if (connection) {
      await connection.close();
      console.log('\n✅ Conexão fechada');
    }
  }
}

// Executar
extrairPackageRetorno().catch(console.error);
