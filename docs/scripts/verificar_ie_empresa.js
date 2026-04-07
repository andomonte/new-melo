import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function verificarIEEmpresa() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const CNPJ = '04618302000189';
  
  try {
    console.log('='.repeat(80));
    console.log('VERIFICAÇÃO DE INSCRIÇÃO ESTADUAL - ERRO 997 SEFAZ');
    console.log('='.repeat(80));
    console.log('\n');
    
    // Buscar dados da empresa
    const result = await pool.query(`
      SELECT 
        cgc,
        nomecontribuinte,
        inscricaoestadual,
        uf,
        municipio,
        csc_nfce_id,
        csc_nfce_homologacao
      FROM db_manaus.dadosempresa
      WHERE cgc = $1
    `, [CNPJ]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Empresa com CNPJ ${CNPJ} não encontrada!`);
      process.exit(1);
    }
    
    const empresa = result.rows[0];
    
    console.log('📋 DADOS DA EMPRESA NO BANCO:');
    console.log('-'.repeat(60));
    console.log(`   CNPJ: ${empresa.cgc}`);
    console.log(`   Nome Contribuinte: ${empresa.nomecontribuinte}`);
    console.log(`   Município: ${empresa.municipio}`);
    console.log(`   IE Atual: ${empresa.inscricaoestadual || '(VAZIO!)'}`);
    console.log(`   UF: ${empresa.uf}`);
    console.log('\n');
    
    console.log('🔍 DIAGNÓSTICO DO ERRO 997:');
    console.log('-'.repeat(60));
    console.log('   O erro "Serie ja vinculada a outra inscricao estadual" significa:');
    console.log('   - A série "2" já foi usada com uma IE DIFERENTE para esse CNPJ');
    console.log('   - Isso pode acontecer se a IE foi alterada no cadastro');
    console.log('   - OU se a IE estava vazia/incorreta em emissões anteriores');
    console.log('\n');
    
    console.log('✅ SOLUÇÕES POSSÍVEIS:');
    console.log('-'.repeat(60));
    console.log('');
    console.log('   1️⃣  VERIFICAR IE CORRETA NO SINTEGRA:');
    console.log('       → Acesse: https://www.sintegra.gov.br/');
    console.log('       → Consulte o CNPJ: 04618302000189');
    console.log('       → Compare a IE retornada com a do banco');
    console.log('');
    console.log('   2️⃣  SE A IE ESTIVER INCORRETA, ATUALIZAR:');
    console.log('       UPDATE db_manaus.dadosempresa');
    console.log('       SET inscricaoestadual = \'IE_CORRETA_DO_SINTEGRA\'');
    console.log(`       WHERE cgc = '${CNPJ}';`);
    console.log('');
    console.log('   3️⃣  USAR OUTRA SÉRIE (TEMPORÁRIO PARA TESTES):');
    console.log('       → Alterar a série de "2" para "3" ou "901" (homologação)');
    console.log('       → Isso cria um novo vínculo CNPJ+Série+IE');
    console.log('');
    console.log('   4️⃣  CONTATAR SEFAZ-AM:');
    console.log('       → Se a IE está correta mas o erro persiste');
    console.log('       → Solicitar desvínculo da série "2" da IE antiga');
    console.log('\n');
    
    console.log('⚠️  IMPORTANTE:');
    console.log('-'.repeat(60));
    console.log('   Uma vez que a SEFAZ vincula CNPJ + SÉRIE + IE,');
    console.log('   NÃO É POSSÍVEL usar a mesma série com outra IE');
    console.log('   sem intervenção manual da SEFAZ ou mudança de série.');
    console.log('\n');
    
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao consultar:', error);
    console.error('Detalhes:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verificarIEEmpresa();
