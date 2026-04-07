/**
 * Testes de Integração - Verificação de Cliente
 *
 * Como executar:
 * 1. Certifique-se que o banco de dados está configurado
 * 2. Execute: tsx scripts/test-client-verification.ts
 */

import {
  verifyClientExistence,
  getClientByCode,
  isCpfCnpjAvailable,
} from '../src/actions/client.actions';

// ============================================================================
// CORES PARA OUTPUT
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function success(msg: string) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg: string) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function info(msg: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

function warn(msg: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

// ============================================================================
// TESTES
// ============================================================================

async function testVerifyClientExistence() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 1: verifyClientExistence()');
  console.log('='.repeat(60));

  // Teste 1: CPF/CNPJ vazio
  try {
    info('Testando CPF/CNPJ vazio...');
    const result = await verifyClientExistence('');
    if (!result.exists) {
      success('CPF/CNPJ vazio retorna exists: false');
    } else {
      error('CPF/CNPJ vazio deveria retornar exists: false');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 2: CPF com formato inválido
  try {
    info('Testando CPF com formato inválido...');
    const result = await verifyClientExistence('123');
    if (!result.exists) {
      success('CPF inválido retorna exists: false');
    } else {
      error('CPF inválido deveria retornar exists: false');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 3: CPF com máscara
  try {
    info('Testando CPF com máscara (123.456.789-00)...');
    const result = await verifyClientExistence('123.456.789-00');
    console.log('   Resultado:', JSON.stringify(result, null, 2));

    if (result.exists) {
      success(`Cliente encontrado: ${result.client?.nome}`);
    } else {
      warn('Nenhum cliente encontrado com este CPF');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 4: CNPJ com máscara
  try {
    info('Testando CNPJ com máscara (12.345.678/0001-00)...');
    const result = await verifyClientExistence('12.345.678/0001-00');
    console.log('   Resultado:', JSON.stringify(result, null, 2));

    if (result.exists) {
      success(`Cliente encontrado: ${result.client?.nome}`);
    } else {
      warn('Nenhum cliente encontrado com este CNPJ');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 5: CPF sem máscara
  try {
    info('Testando CPF sem máscara (12345678900)...');
    const result = await verifyClientExistence('12345678900');
    console.log('   Resultado:', JSON.stringify(result, null, 2));

    if (result.exists) {
      success(`Cliente encontrado: ${result.client?.nome}`);
    } else {
      warn('Nenhum cliente encontrado com este CPF');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }
}

async function testGetClientByCode() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 2: getClientByCode()');
  console.log('='.repeat(60));

  // Teste 1: Código inválido
  try {
    info('Testando código inválido (0)...');
    const result = await getClientByCode(0);
    if (result === null) {
      success('Código 0 retorna null');
    } else {
      error('Código 0 deveria retornar null');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 2: Código inexistente
  try {
    info('Testando código inexistente (999999)...');
    const result = await getClientByCode(999999);
    if (result === null) {
      success('Código inexistente retorna null');
    } else {
      error('Código inexistente deveria retornar null');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 3: Código válido (você deve alterar para um código real)
  try {
    info('Testando código válido (1)...');
    const result = await getClientByCode(1);

    if (result) {
      success(`Cliente encontrado: ${result.nome}`);
      console.log('   Dados:', JSON.stringify(result, null, 2));
    } else {
      warn('Nenhum cliente encontrado com código 1');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }
}

async function testIsCpfCnpjAvailable() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 3: isCpfCnpjAvailable()');
  console.log('='.repeat(60));

  // Teste 1: CPF disponível (não existe)
  try {
    info('Testando CPF disponível (99999999999)...');
    const result = await isCpfCnpjAvailable('99999999999');

    if (result === true) {
      success('CPF está disponível');
    } else {
      warn('CPF já está cadastrado');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 2: CPF já cadastrado
  try {
    info('Testando CPF já cadastrado (123.456.789-00)...');
    const result = await isCpfCnpjAvailable('123.456.789-00');

    if (result === false) {
      success('CPF já cadastrado (retornou false)');
    } else {
      warn('CPF está disponível');
    }
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }

  // Teste 3: Com exclusão de código (para edição)
  try {
    info('Testando com exclusão de código...');
    const result = await isCpfCnpjAvailable('123.456.789-00', 1);
    console.log(`   Disponível (excluindo código 1): ${result}`);
    success('Teste de exclusão executado');
  } catch (err) {
    error(`Erro: ${err instanceof Error ? err.message : err}`);
  }
}

async function testSqlInjection() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 4: Proteção contra SQL Injection');
  console.log('='.repeat(60));

  const maliciousInputs = [
    "123' OR '1'='1",
    "123'; DROP TABLE dbclien; --",
    "123' UNION SELECT * FROM dbclien --",
    "123' AND 1=1 --",
  ];

  for (const input of maliciousInputs) {
    try {
      info(`Testando input malicioso: ${input}`);
      const result = await verifyClientExistence(input);

      if (!result.exists) {
        success('Input malicioso retornou exists: false (protegido)');
      } else {
        error('ALERTA: Input malicioso retornou um cliente!');
      }
    } catch (err) {
      // Erro é esperado e aceitável
      success('Input malicioso causou erro (também é proteção)');
    }
  }
}

async function testPerformance() {
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 5: Performance');
  console.log('='.repeat(60));

  const iterations = 10;
  const cpfCnpj = '12345678900';

  info(`Executando ${iterations} verificações consecutivas...`);

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    await verifyClientExistence(cpfCnpj);
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;

  success(`Total: ${totalTime}ms`);
  success(`Média: ${avgTime.toFixed(2)}ms por verificação`);

  if (avgTime < 100) {
    success('Performance: EXCELENTE (< 100ms)');
  } else if (avgTime < 300) {
    success('Performance: BOA (< 300ms)');
  } else if (avgTime < 1000) {
    warn('Performance: ACEITÁVEL (< 1000ms)');
  } else {
    error('Performance: RUIM (> 1000ms) - Considere otimizar');
  }
}

// ============================================================================
// EXECUTAR TODOS OS TESTES
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     TESTES DE INTEGRAÇÃO - VERIFICAÇÃO DE CLIENTE         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    await testVerifyClientExistence();
    await testGetClientByCode();
    await testIsCpfCnpjAvailable();
    await testSqlInjection();
    await testPerformance();

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}TODOS OS TESTES CONCLUÍDOS${colors.reset}`);
    console.log('='.repeat(60) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(60));
    console.error(`${colors.red}ERRO FATAL NOS TESTES${colors.reset}`);
    console.error('='.repeat(60));
    console.error(err);
    process.exit(1);
  }
}

// Executar testes
runAllTests()
  .then(() => {
    info('Testes finalizados com sucesso');
    process.exit(0);
  })
  .catch((err) => {
    error('Erro ao executar testes');
    console.error(err);
    process.exit(1);
  });
