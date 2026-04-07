const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function consultarNotasAssociadas(codPgto) {
  console.log(`🔍 [Consulta] Buscando notas associadas ao título ${codPgto}...`);

  try {
    // 1. Verificar se o título existe e é importado
    const tituloResult = await pool.query(`
      SELECT
        cod_pgto,
        tipo,
        cod_transp,
        valor_pgto,
        obs,
        titulo_importado,
        dt_emissao,
        dt_venc,
        paga,
        cancel
      FROM dbpgto
      WHERE cod_pgto = $1
    `, [codPgto]);

    if (tituloResult.rows.length === 0) {
      console.log('❌ [Consulta] Título não encontrado!');
      return;
    }

    const titulo = tituloResult.rows[0];
    console.log('📄 [Consulta] Informações do título:');
    console.log(`   Código: ${titulo.cod_pgto}`);
    console.log(`   Tipo: ${titulo.tipo} (${titulo.tipo === 'T' ? 'Transportadora' : 'Fornecedor'})`);
    console.log(`   Transportadora: ${titulo.cod_transp}`);
    console.log(`   Valor: R$ ${titulo.valor_pgto}`);
    console.log(`   Importado: ${titulo.titulo_importado}`);
    console.log(`   Pago: ${titulo.paga}`);
    console.log(`   Cancelado: ${titulo.cancel}`);
    console.log(`   Observação: ${titulo.obs}`);
    console.log('---');

    // 2. Buscar notas de conhecimento associadas
    const notasResult = await pool.query(`
      SELECT
        c.codpgto,
        c.codtransp,
        c.nrocon,
        nc.totaltransp,
        nc.pago as cte_pago,
        nc.dtemissao as cte_emissao,
        nc.chave as chave_cte,
        t.nome as nome_transportadora
      FROM dbconhecimento c
      JOIN dbconhecimentoent nc ON c.codtransp = nc.codtransp AND c.nrocon = nc.nrocon
      JOIN dbtransp t ON c.codtransp = t.codtransp
      WHERE c.codpgto = $1
      ORDER BY nc.nrocon
    `, [codPgto]);

    console.log(`📋 [Consulta] Notas de conhecimento associadas (${notasResult.rows.length}):`);

    if (notasResult.rows.length === 0) {
      console.log('   Nenhuma nota associada encontrada.');
      return;
    }

    let valorTotalNotas = 0;
    notasResult.rows.forEach((nota, index) => {
      console.log(`${index + 1}. CT-e: ${nota.codtransp}-${nota.nrocon}`);
      console.log(`   Transportadora: ${nota.nome_transportadora}`);
      console.log(`   Valor: R$ ${nota.totaltransp}`);
      console.log(`   Pago: ${nota.cte_pago}`);
      console.log(`   Emissão: ${nota.cte_emissao}`);
      if (nota.chave_cte) {
        console.log(`   Chave CT-e: ${nota.chave_cte}`);
      }
      console.log('---');
      valorTotalNotas += parseFloat(nota.totaltransp);
    });

    console.log(`💰 [Consulta] Valor total das notas: R$ ${valorTotalNotas.toFixed(2)}`);
    console.log(`💰 [Consulta] Valor do título: R$ ${titulo.valor_pgto}`);

    // Verificar se os valores batem
    const diferenca = Math.abs(parseFloat(titulo.valor_pgto) - valorTotalNotas);
    if (diferenca < 0.01) {
      console.log('✅ [Consulta] Valores conferem!');
    } else {
      console.log(`⚠️ [Consulta] Diferença de R$ ${diferenca.toFixed(2)} entre título e soma das notas`);
    }

  } catch (error) {
    console.error('❌ [Consulta] Erro:', error.message);
  } finally {
    await pool.end();
  }
}

// Função para listar todos os títulos importados
async function listarTitulosImportados() {
  console.log('📊 [Lista] Títulos importados disponíveis:');

  try {
    const result = await pool.query(`
      SELECT
        cod_pgto,
        tipo,
        cod_transp,
        valor_pgto,
        obs,
        dt_emissao,
        dt_venc
      FROM dbpgto
      WHERE titulo_importado = true
      ORDER BY dt_emissao DESC
    `);

    result.rows.forEach((titulo, index) => {
      console.log(`${index + 1}. ${titulo.cod_pgto} - R$ ${titulo.valor_pgto} - ${titulo.obs}`);
    });

    console.log(`\n💡 [Lista] Total: ${result.rows.length} títulos importados`);
    console.log('💡 [Lista] Use: node consultar_notas_titulo.js <COD_PGTO>');

  } catch (error) {
    console.error('❌ [Lista] Erro:', error.message);
  } finally {
    await pool.end();
  }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);
if (args.length === 0) {
  // Sem argumentos - listar títulos importados
  listarTitulosImportados();
} else {
  // Com argumento - consultar notas do título específico
  const codPgto = args[0];
  consultarNotasAssociadas(codPgto);
}