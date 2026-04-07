const { Pool } = require('pg');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Delay entre requisições para não sobrecarregar a API
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Consulta CNPJ na ReceitaWS (API pública gratuita)
 * Retorna dados da empresa incluindo regime tributário
 */
async function consultarCNPJ(cnpj) {
  try {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    console.log(`   📡 Consultando CNPJ ${cnpjLimpo} na ReceitaWS...`);
    
    const response = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Sistema-Melo/1.0'
      }
    });

    if (response.data.status === 'ERROR') {
      console.error(`   ❌ Erro: ${response.data.message}`);
      return null;
    }

    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn('   ⚠️  Rate limit atingido, aguardando 60 segundos...');
      await delay(60000);
      return consultarCNPJ(cnpj); // Tentar novamente
    }
    console.error(`   ❌ Erro ao consultar: ${error.message}`);
    return null;
  }
}

/**
 * Determina o CRT baseado nos dados da Receita Federal
 * 1 = Simples Nacional
 * 2 = Simples Nacional - excesso de sublimite
 * 3 = Regime Normal
 */
function determinarCRT(dados) {
  if (!dados) return '1'; // Default: Simples Nacional

  // Verificar se é optante pelo Simples Nacional
  const naturezaJuridica = dados.natureza_juridica || '';
  const porte = dados.porte || '';
  const situacao = dados.situacao || '';

  console.log(`   📊 Natureza: ${naturezaJuridica}`);
  console.log(`   📊 Porte: ${porte}`);
  console.log(`   📊 Situação: ${situacao}`);

  // Empresas de Grande Porte não podem ser Simples Nacional
  if (porte.toLowerCase().includes('demais')) {
    console.log('   ➡️  CRT = 3 (Regime Normal - Grande Porte)');
    return '3';
  }

  // Verificar situação especial (inativa, inapta, etc)
  if (situacao.toLowerCase().includes('baixada') || 
      situacao.toLowerCase().includes('inapta')) {
    console.log('   ⚠️  Empresa com situação irregular');
  }

  // Default para MEI, ME, EPP: Simples Nacional
  if (porte.toLowerCase().includes('micro') || 
      porte.toLowerCase().includes('pequeno') ||
      porte.toLowerCase().includes('mei')) {
    console.log('   ➡️  CRT = 1 (Simples Nacional)');
    return '1';
  }

  // Se não conseguiu determinar, usar Simples Nacional como padrão
  console.log('   ➡️  CRT = 1 (Simples Nacional - padrão)');
  return '1';
}

async function atualizarCRTEmpresas() {
  let client;
  
  try {
    console.log('🚀 Iniciando consulta e atualização de CRT das empresas...\n');
    console.log('⚠️  Este processo pode levar alguns minutos devido aos delays entre requisições.\n');

    client = await pool.connect();

    // 1. Buscar todas as empresas
    const empresas = await client.query(`
      SELECT cgc, nomecontribuinte, inscricaoestadual, crt
      FROM db_manaus.dadosempresa
      ORDER BY cgc
    `);

    console.log(`📋 Total de empresas encontradas: ${empresas.rows.length}\n`);
    console.log('='.repeat(80));

    let sucesso = 0;
    let erro = 0;
    let pulado = 0;

    for (let i = 0; i < empresas.rows.length; i++) {
      const empresa = empresas.rows[i];
      const cnpj = empresa.cgc;
      
      console.log(`\n[${i + 1}/${empresas.rows.length}] ${empresa.nomecontribuinte}`);
      console.log(`   CNPJ: ${cnpj}`);
      console.log(`   CRT Atual: ${empresa.crt || '(não definido)'}`);

      // Se já tem CRT definido e diferente de '1', pular
      if (empresa.crt && empresa.crt !== '1') {
        console.log('   ⏭️  Já possui CRT configurado, pulando...');
        pulado++;
        continue;
      }

      // Consultar na Receita Federal
      const dadosReceita = await consultarCNPJ(cnpj);
      
      if (!dadosReceita) {
        console.log('   ❌ Não foi possível consultar, mantendo padrão');
        erro++;
        await delay(2000); // Delay entre requisições
        continue;
      }

      // Determinar CRT
      const crtNovo = determinarCRT(dadosReceita);

      // Atualizar no banco
      await client.query(`
        UPDATE db_manaus.dadosempresa 
        SET crt = $1 
        WHERE cgc = $2
      `, [crtNovo, cnpj]);

      console.log(`   ✅ CRT atualizado para: ${crtNovo}`);
      sucesso++;

      // Delay de 3 segundos entre requisições para não sobrecarregar a API
      if (i < empresas.rows.length - 1) {
        console.log('   ⏳ Aguardando 3 segundos...');
        await delay(3000);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RESUMO DA ATUALIZAÇÃO:');
    console.log('='.repeat(80));
    console.log(`✅ Sucesso: ${sucesso}`);
    console.log(`❌ Erro: ${erro}`);
    console.log(`⏭️  Pulado: ${pulado}`);
    console.log(`📋 Total: ${empresas.rows.length}`);

    // Mostrar resultado final
    console.log('\n' + '='.repeat(80));
    console.log('📋 CRT das empresas após atualização:');
    console.log('='.repeat(80));
    
    const resultado = await client.query(`
      SELECT cgc, nomecontribuinte, crt,
        CASE 
          WHEN crt = '1' THEN 'Simples Nacional'
          WHEN crt = '2' THEN 'Simples Nacional - Excesso'
          WHEN crt = '3' THEN 'Regime Normal'
          ELSE 'Não definido'
        END as regime
      FROM db_manaus.dadosempresa
      ORDER BY cgc
    `);

    resultado.rows.forEach((emp, idx) => {
      console.log(`\n${idx + 1}. ${emp.nomecontribuinte}`);
      console.log(`   CNPJ: ${emp.cgc}`);
      console.log(`   CRT: ${emp.crt} - ${emp.regime}`);
    });

    console.log('\n✅ Processo concluído!\n');

  } catch (error) {
    console.error('\n❌ Erro no processo:', error);
    console.error('Detalhes:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Executar
atualizarCRTEmpresas();
