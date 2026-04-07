require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

async function verificarHistorico() {
  try {
    console.log('🔍 Buscando tabelas que podem ter histórico de recebimentos...\n');
    
    // Pegar um cod_receb de exemplo
    const exemploReceb = await pool.query(`
      SELECT cod_receb, codcli, valor_rec, dt_venc
      FROM db_manaus.dbreceb 
      WHERE rec = 'S'
      LIMIT 1
    `);
    
    if (exemploReceb.rows.length > 0) {
      const exemplo = exemploReceb.rows[0];
      console.log('📄 Usando exemplo de conta recebida:');
      console.log(exemplo);
      console.log('\n');
      
      // Verificar tabelas candidatas com esse cod_receb
      const tabelasCandidatas = [
        'dbreceb_avulso',
        'dbpgto',
        'dbpgto_ent',
        'dbfprereceb',
        'dbnfe_ent_cobr'
      ];
      
      for (const tabela of tabelasCandidatas) {
        try {
          // Verificar estrutura da tabela
          const colunas = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns
            WHERE table_schema = 'db_manaus' 
              AND table_name = $1
            ORDER BY ordinal_position
          `, [tabela]);
          
          if (colunas.rows.length > 0) {
            console.log(`\n📊 TABELA: ${tabela}`);
            console.log('='  .repeat(80));
            console.log('Colunas:', colunas.rows.map(c => c.column_name).join(', '));
            
            // Tentar contar registros
            const count = await pool.query(`SELECT COUNT(*) as total FROM db_manaus.${tabela}`);
            console.log(`Total de registros: ${count.rows[0].total}`);
            
            // Mostrar exemplo se tiver dados
            if (count.rows[0].total > 0) {
              const sample = await pool.query(`SELECT * FROM db_manaus.${tabela} LIMIT 3`);
              console.log('Exemplo de dados (primeiras 3 linhas):');
              console.table(sample.rows);
            }
          }
        } catch (err) {
          console.log(`⚠️  ${tabela}: ${err.message}`);
        }
      }
      
      // Verificar se dbreceb tem campo que indica histórico de pagamentos parciais
      console.log('\n📊 Analisando lógica de pagamentos em dbreceb...');
      const analiseReceb = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE rec = 'S') as total_recebidos,
          COUNT(*) FILTER (WHERE rec = 'N') as total_pendentes,
          COUNT(*) FILTER (WHERE cancel = 'S') as total_cancelados,
          COUNT(*) FILTER (WHERE valor_rec > 0 AND valor_pgto > 0) as tem_valores
        FROM db_manaus.dbreceb
        LIMIT 1000
      `);
      
      console.table(analiseReceb.rows);
      
      // Verificar se há títulos parcialmente pagos (valor_rec < valor_pgto)
      const parciais = await pool.query(`
        SELECT cod_receb, codcli, nro_doc, valor_pgto, valor_rec, dt_venc, dt_pgto, rec
        FROM db_manaus.dbreceb
        WHERE valor_rec < valor_pgto AND valor_rec > 0
        LIMIT 5
      `);
      
      if (parciais.rows.length > 0) {
        console.log('\n💰 Exemplos de títulos parcialmente pagos:');
        console.table(parciais.rows);
      } else {
        console.log('\n✅ Sistema parece não ter pagamentos parciais.');
        console.log('Lógica sugerida: Status baseado apenas em rec="S" ou rec="N" na própria dbreceb.');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

verificarHistorico();
