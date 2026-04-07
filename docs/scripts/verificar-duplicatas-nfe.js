const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verificarDuplicatas() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando faturas com múltiplas NFes...\n');
    
    // Buscar faturas com mais de 1 NFe
    const query = `
      SELECT 
        f.codfat,
        f.nroform,
        COUNT(nfe.codfat) as qtd_nfes,
        ARRAY_AGG(nfe.nrodoc_fiscal) as numeros_nfe,
        ARRAY_AGG(nfe.chave) as chaves
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      WHERE f.codfat IS NOT NULL
      GROUP BY f.codfat, f.nroform
      HAVING COUNT(nfe.codfat) > 1
      ORDER BY f.codfat DESC
      LIMIT 20;
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('✅ Nenhuma fatura com múltiplas NFes encontrada!');
    } else {
      console.log(`⚠️ Encontradas ${result.rows.length} faturas com múltiplas NFes:\n`);
      
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. Fatura: ${row.codfat} (nroform: ${row.nroform})`);
        console.log(`   📋 Quantidade de NFes: ${row.qtd_nfes}`);
        console.log(`   🔢 Números NFe: ${row.numeros_nfe.join(', ')}`);
        console.log(`   🔑 Chaves: ${row.chaves.map(c => c ? c.substring(0, 20) + '...' : 'null').join(', ')}`);
        console.log('');
      });
    }
    
    // Buscar fatura específica 000234542
    console.log('\n🔎 Detalhes da fatura 000234542:\n');
    
    const faturaQuery = `
      SELECT 
        f.codfat,
        f.nroform,
        f.codcli,
        f.data,
        c.nome as cliente_nome,
        COUNT(nfe.codfat) as qtd_nfes
      FROM db_manaus.dbfatura f
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
      WHERE f.codfat = '000234542'
      GROUP BY f.codfat, f.nroform, f.codcli, f.data, c.nome;
    `;
    
    const faturaResult = await client.query(faturaQuery);
    
    if (faturaResult.rows.length === 0) {
      console.log('❌ Fatura 000234542 não encontrada!');
    } else {
      console.log('📊 Dados da fatura:');
      console.log(faturaResult.rows[0]);
      
      // Buscar todas as NFes desta fatura
      const nfesQuery = `
        SELECT 
          codfat,
          nrodoc_fiscal,
          serie,
          chave,
          numprotocolo,
          status,
          data
        FROM db_manaus.dbfat_nfe
        WHERE codfat = '000234542'
        ORDER BY data DESC;
      `;
      
      const nfesResult = await client.query(nfesQuery);
      
      console.log(`\n📋 NFes associadas (${nfesResult.rows.length} registros):`);
      nfesResult.rows.forEach((nfe, index) => {
        console.log(`\n${index + 1}. NFe:`);
        console.log(`   - nrodoc_fiscal: ${nfe.nrodoc_fiscal}`);
        console.log(`   - serie: ${nfe.serie}`);
        console.log(`   - chave: ${nfe.chave?.substring(0, 30)}...`);
        console.log(`   - protocolo: ${nfe.numprotocolo}`);
        console.log(`   - status: ${nfe.status}`);
        console.log(`   - data: ${nfe.data}`);
      });
      
      // Verificar mensagens da fatura
      console.log('\n\n🔎 Verificando mensagens da fatura 000234542:\n');
      
      const mensagensQuery = `
        SELECT 
          mf.codfat,
          mf.codmsg,
          msg.codigo,
          msg.mensagem
        FROM db_manaus.dbmensagens_fatura mf
        LEFT JOIN db_manaus.dbmensagens msg ON mf.codmsg = msg.codigo
        WHERE mf.codfat = '000234542';
      `;
      
      const mensagensResult = await client.query(mensagensQuery);
      
      if (mensagensResult.rows.length === 0) {
        console.log('✅ Nenhuma mensagem associada à fatura 000234542');
      } else {
        console.log(`⚠️ Encontradas ${mensagensResult.rows.length} mensagens para a fatura 000234542:`);
        mensagensResult.rows.forEach((msg, index) => {
          console.log(`\n${index + 1}. Mensagem:`);
          console.log(`   - codmsg: ${msg.codmsg}`);
          console.log(`   - codigo: ${msg.codigo}`);
          console.log(`   - mensagem: ${msg.mensagem}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verificarDuplicatas();
