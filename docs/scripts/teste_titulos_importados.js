const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
// Configuração do banco de dados
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function testarGeracaoTituloImportado() {
  console.log('🧪 [Teste] Verificando geração de títulos importados...');

  try {
    // 1. Verificar se existem títulos com titulo_importado = true
    const result = await pool.query(`
      SELECT
        cod_pgto,
        tipo,
        cod_transp,
        valor_pgto,
        obs,
        titulo_importado,
        dt_emissao,
        dt_venc
      FROM dbpgto
      WHERE titulo_importado = true
      ORDER BY dt_emissao DESC
      LIMIT 5
    `);

    console.log(`📊 [Teste] Encontrados ${result.rows.length} títulos importados:`);

    result.rows.forEach((titulo, index) => {
      console.log(`${index + 1}. Código: ${titulo.cod_pgto}`);
      console.log(`   Tipo: ${titulo.tipo} (Transportadora)`);
      console.log(`   Transportadora: ${titulo.cod_transp}`);
      console.log(`   Valor: R$ ${titulo.valor_pgto}`);
      console.log(`   Observação: ${titulo.obs}`);
      console.log(`   Importado: ${titulo.titulo_importado}`);
      console.log(`   Emissão: ${titulo.dt_emissao}`);
      console.log(`   Vencimento: ${titulo.dt_venc}`);
      console.log('---');
    });

    // 2. Verificar se os títulos importados têm relacionamentos em dbconhecimento
    if (result.rows.length > 0) {
      const codPgto = result.rows[0].cod_pgto;
      const conhecimentoResult = await pool.query(`
        SELECT codpgto, codtransp, nrocon
        FROM dbconhecimento
        WHERE codpgto = $1
      `, [codPgto]);

      console.log(`🔗 [Teste] Relacionamentos do título ${codPgto}:`);
      conhecimentoResult.rows.forEach(rel => {
        console.log(`   CT-e: ${rel.codtransp}-${rel.nrocon}`);
      });
    }

    // 3. Verificar estatísticas gerais
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_titulos,
        COUNT(CASE WHEN titulo_importado = true THEN 1 END) as titulos_importados,
        COUNT(CASE WHEN titulo_importado = false THEN 1 END) as titulos_manuais
      FROM dbpgto
    `);

    console.log('📈 [Teste] Estatísticas gerais:');
    console.log(`   Total de títulos: ${statsResult.rows[0].total_titulos}`);
    console.log(`   Títulos importados: ${statsResult.rows[0].titulos_importados}`);
    console.log(`   Títulos manuais: ${statsResult.rows[0].titulos_manuais}`);

  } catch (error) {
    console.error('❌ [Teste] Erro:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar teste
testarGeracaoTituloImportado();