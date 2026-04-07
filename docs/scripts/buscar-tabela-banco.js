const oracledb = require('oracledb');

async function getOracleConnection() {
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
        return await oracledb.getConnection(config);
}

async function buscarTabelaBanco() {
  let connection;
  
  try {
    connection = await getOracleConnection();
    console.log('✅ Conectado ao Oracle\n');

    // Buscar tabelas que contenham "BANCO" no nome
    console.log('BUSCANDO TABELAS COM "BANCO" NO NOME:');
    console.log('======================================\n');
    
    const query = `
      SELECT table_name 
      FROM all_tables 
      WHERE owner = 'GERAL' 
        AND table_name LIKE '%BANCO%'
      ORDER BY table_name
    `;
    
    const result = await connection.execute(query);
    
    console.log(`Encontradas ${result.rows.length} tabelas:\n`);
    result.rows.forEach(row => {
      console.log(`  - ${row.TABLE_NAME}`);
    });

    // Verificar se DBCONTA existe e buscar seus códigos de banco únicos
    console.log('\n\nVERIFICANDO CÓDIGOS DE BANCO EM DBCONTA:');
    console.log('=========================================\n');
    
    const contaQuery = `
      SELECT DISTINCT COD_BANCO
      FROM GERAL.DBCONTA
      WHERE COD_BANCO IS NOT NULL
      ORDER BY COD_BANCO
    `;
    
    const codBancos = await connection.execute(contaQuery);
    
    console.log(`Códigos de banco encontrados: ${codBancos.rows.length}\n`);
    codBancos.rows.forEach(row => {
      console.log(`  - ${row.COD_BANCO}`);
    });

    console.log('\n✅ Investigação concluída!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

buscarTabelaBanco();
