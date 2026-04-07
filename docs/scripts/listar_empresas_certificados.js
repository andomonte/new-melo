import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function listarEmpresas() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('='.repeat(80));
    console.log('EMPRESAS CADASTRADAS COM CERTIFICADOS DIGITAIS');
    console.log('='.repeat(80));
    console.log('\n');
    
    const result = await pool.query(`
      SELECT 
        cgc,
        razaosocial,
        nomefantasia,
        inscricaoestadual,
        uf,
        CASE WHEN "certificadoKey" IS NOT NULL AND "certificadoKey" != '' THEN '✓' ELSE '✗' END as tem_key,
        CASE WHEN "certificadoCrt" IS NOT NULL AND "certificadoCrt" != '' THEN '✓' ELSE '✗' END as tem_crt,
        CASE WHEN "cadeiaCrt" IS NOT NULL AND "cadeiaCrt" != '' THEN '✓' ELSE '✗' END as tem_cadeia,
        csc_nfce_id,
        csc_nfce_homologacao,
        csc_nfce_producao
      FROM db_manaus.dadosempresa
      ORDER BY cgc
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma empresa encontrada!');
      process.exit(1);
    }
    
    result.rows.forEach((emp, idx) => {
      console.log(`\n${idx + 1}. ${emp.razaosocial || emp.nomefantasia || 'Sem nome'}`);
      console.log('-'.repeat(60));
      console.log(`   CNPJ: ${emp.cgc}`);
      console.log(`   IE: ${emp.inscricaoestadual || '(vazio)'}`);
      console.log(`   UF: ${emp.uf || '(vazio)'}`);
      console.log(`   Certificados: Key=${emp.tem_key} | Crt=${emp.tem_crt} | Cadeia=${emp.tem_cadeia}`);
      console.log(`   CSC ID: ${emp.csc_nfce_id || '(não configurado)'}`);
      console.log(`   CSC Homolog: ${emp.csc_nfce_homologacao ? '✓ Configurado' : '✗ Não configurado'}`);
      console.log(`   CSC Prod: ${emp.csc_nfce_producao ? '✓ Configurado' : '✗ Não configurado'}`);
      
      // Indicar se está pronta para emissão
      const prontaParaEmissao = emp.tem_key === '✓' && emp.tem_crt === '✓';
      console.log(`   Status: ${prontaParaEmissao ? '🟢 PRONTA PARA EMISSÃO' : '🔴 NÃO CONFIGURADA'}`);
    });
    
    console.log('\n');
    console.log('='.repeat(80));
    console.log('Para usar uma empresa específica, adicione ao .env.local:');
    console.log('CNPJ_EMISSOR_NFCE=CNPJ_DA_EMPRESA_AQUI');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao consultar empresas:', error);
    console.error('Detalhes:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listarEmpresas();
