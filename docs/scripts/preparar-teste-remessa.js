import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();        
    
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verificarTitulos() {
  try {
    console.log('=== DETALHES DOS 2 TÍTULOS COM BRADESCO=N ===\n');

    // Ver os 2 títulos que deveriam aparecer
    const queryDetalhes = `
      SELECT 
        r.cod_receb,
        r.nro_doc,
        r.valor_pgto,
        r.dt_venc,
        r.dt_emissao,
        r.banco,
        r.bradesco,
        r.forma_fat,
        r.cancel,
        r.rec,
        r.valor_rec,
        r.venc_ant,
        cb.cod_banco,
        cb.cod_bc,
        cb.nome as nome_banco
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.cancel = 'N'
        AND r.rec = 'N'
        AND r.forma_fat = '2'
        AND r.valor_pgto > 0
        AND cb.cod_bc = '237'
        AND COALESCE(r.bradesco, 'N') = 'N'
      LIMIT 10
    `;
    const detalhes = await pool.query(queryDetalhes);
    console.log('Títulos encontrados: ' + detalhes.rows.length);
    detalhes.rows.forEach(r => {
      console.log('---');
      console.log('  cod_receb: ' + r.cod_receb);
      console.log('  nro_doc: ' + r.nro_doc);
      console.log('  valor: ' + r.valor_pgto);
      console.log('  dt_venc: ' + (r.dt_venc ? r.dt_venc.toISOString().split('T')[0] : 'NULL'));
      console.log('  banco (interno): ' + r.banco);
      console.log('  cod_banco: ' + r.cod_banco);
      console.log('  cod_bc: ' + r.cod_bc);
      console.log('  bradesco: ' + r.bradesco);
      console.log('  forma_fat: ' + r.forma_fat);
      console.log('  cancel: ' + r.cancel);
      console.log('  rec: ' + r.rec);
      console.log('  venc_ant: ' + (r.venc_ant ? r.venc_ant.toISOString().split('T')[0] : 'NULL'));
    });

    // Verificar se dt_venc está dentro do range
    console.log('\n=== VERIFICANDO FILTRO DE DATA ===\n');
    const queryData = `
      SELECT MIN(dt_venc) as min_venc, MAX(dt_venc) as max_venc
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE cb.cod_bc = '237'
        AND COALESCE(r.bradesco, 'N') = 'N'
        AND r.cancel = 'N'
        AND r.forma_fat = '2'
    `;
    const datas = await pool.query(queryData);
    console.log('Min dt_venc: ' + (datas.rows[0].min_venc?.toISOString().split('T')[0] || 'NULL'));
    console.log('Max dt_venc: ' + (datas.rows[0].max_venc?.toISOString().split('T')[0] || 'NULL'));

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await pool.end();
  }
}

verificarTitulos();
