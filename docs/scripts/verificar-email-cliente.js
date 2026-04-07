// Utilitário para verificar se cliente tem email cadastrado
// Execute: node scripts/verificar-email-cliente.js CODIGO_CLIENTE

const { Pool } = require('pg');

const dbConfigs = {
  manaus: "postgresql://postgres:melodb@servicos.melopecas.com.br:5432/postgres?schema=db_manaus&connect_timeout=15",
  roraima: "postgresql://postgres:melodb@servicos.melopecas.com.br:5432/postgres?schema=db_boavista&connect_timeout=15", 
  rondonia: "postgresql://postgres:melodb@servicos.melopecas.com.br:5432/postgres?schema=db_portovelho&connect_timeout=15"
};

async function verificarEmailCliente(codCliente, filial = 'manaus') {
  const pool = new Pool({
    connectionString: dbConfigs[filial],
  });

  try {
    console.log(`🔍 Verificando email do cliente ${codCliente} na filial ${filial}...`);
    
    const result = await pool.query(`
      SELECT 
        cod_cli,
        nome,
        email,
        CASE 
          WHEN email IS NULL OR email = '' THEN '❌ SEM EMAIL'
          ELSE '✅ COM EMAIL'
        END as status_email
      FROM db_cliente 
      WHERE cod_cli = $1
    `, [codCliente]);

    if (result.rows.length === 0) {
      console.log(`❌ Cliente ${codCliente} não encontrado na filial ${filial}`);
      return;
    }

    const cliente = result.rows[0];
    console.log('\n📋 DADOS DO CLIENTE:');
    console.log(`Código: ${cliente.cod_cli}`);
    console.log(`Nome: ${cliente.nome}`);
    console.log(`Email: ${cliente.email || 'NÃO CADASTRADO'}`);
    console.log(`Status: ${cliente.status_email}`);
    
    if (cliente.email) {
      console.log('\n✅ CLIENTE RECEBERÁ EMAIL automaticamente após emissão da NFe');
    } else {
      console.log('\n⚠️ CLIENTE NÃO RECEBERÁ EMAIL - Email não cadastrado');
      console.log('💡 Para receber emails, cadastre o email do cliente no sistema');
    }

  } catch (error) {
    console.error('❌ Erro ao verificar email do cliente:', error.message);
  } finally {
    await pool.end();
  }
}

// Verificar argumentos da linha de comando
const codCliente = process.argv[2];
const filial = process.argv[3] || 'manaus';

if (!codCliente) {
  console.log('❌ Uso: node scripts/verificar-email-cliente.js CODIGO_CLIENTE [FILIAL]');
  console.log('📝 Exemplo: node scripts/verificar-email-cliente.js 123 manaus');
  console.log('🏢 Filiais: manaus, roraima, rondonia');
  process.exit(1);
}

verificarEmailCliente(codCliente, filial);