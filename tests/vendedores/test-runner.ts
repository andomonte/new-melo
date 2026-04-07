/**
 * Test Runner - Vendedores Module
 *
 * Testes automatizados para validação do schema de Vendedores
 * Inclui teste para o bug crítico: codvend nulo
 */

import { cadastroVendedorSchema } from '../../src/data/vendedores/schemas';
import { z } from 'zod';

// ANSI colors para output colorido no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function runTest(testName: string, testFn: () => void): void {
  try {
    testFn();
    results.push({ testName, passed: true });
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
  } catch (error) {
    results.push({
      testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    if (error instanceof Error) {
      console.log(`  ${colors.red}${error.message}${colors.reset}`);
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

console.log(
  `\n${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`,
);
console.log(
  `${colors.cyan}    TESTES AUTOMATIZADOS - MÓDULO VENDEDORES${colors.reset}`,
);
console.log(
  `${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`,
);

// =====================================================
// CATEGORIA 1: Campos Obrigatórios
// =====================================================

console.log(`${colors.blue}Categoria 1: Campos Obrigatórios${colors.reset}\n`);

runTest('CT-VEND-001: Deve aceitar vendedor válido completo', () => {
  const validVendedor = {
    nome: 'João Silva Vendas',
    codcv: '001',
    status: 'A',
    ra_mat: '123456',
    valobj: 50000.0,
    comnormal: 5.5,
    comtele: 3.0,
    debito: 1000.0,
    credito: 5000.0,
    limite: 10000.0,
    comobj: 6.0,
    valobjf: 45000.0,
    valobjm: 15000.0,
    valobjsf: 5000.0,
  };

  const result = cadastroVendedorSchema.safeParse(validVendedor);
  assert(
    result.success,
    `Deveria validar vendedor válido: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest(
  'CT-VEND-002: Deve rejeitar vendedor sem nome (campo obrigatório)',
  () => {
    const invalidVendedor = {
      codcv: '001',
    };

    const result = cadastroVendedorSchema.safeParse(invalidVendedor);
    assert(!result.success, 'Deveria rejeitar vendedor sem nome');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'nome');
      assert(error !== undefined, 'Deveria ter erro específico para nome');
    }
  },
);

runTest('CT-VEND-003: Deve rejeitar nome vazio', () => {
  const invalidVendedor = {
    nome: '',
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar nome vazio');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'nome');
    assert(error !== undefined, 'Deveria ter erro específico para nome vazio');
  }
});

// =====================================================
// CATEGORIA 2: Validação de Comprimento Máximo (Strings)
// =====================================================

console.log(
  `\n${colors.blue}Categoria 2: Validação de Comprimento Máximo (Strings)${colors.reset}\n`,
);

runTest('CT-VEND-004: Deve rejeitar nome com mais de 30 caracteres', () => {
  const invalidVendedor = {
    nome: 'Nome muito longo que excede o limite de trinta caracteres permitidos',
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar nome com mais de 30 caracteres');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'nome');
    assert(error !== undefined, 'Deveria ter erro específico para nome');
    assert(
      error!.message.includes('30 caracteres'),
      `Mensagem deveria mencionar 30 caracteres, obteve: ${error!.message}`,
    );
  }
});

runTest('CT-VEND-005: Deve aceitar nome com exatamente 30 caracteres', () => {
  const validVendedor = {
    nome: 'João Silva Vendedor Top 123', // 30 caracteres
  };

  const result = cadastroVendedorSchema.safeParse(validVendedor);
  assert(
    result.success,
    `Deveria aceitar nome com 30 caracteres: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest('CT-VEND-006: Deve rejeitar codcv com mais de 3 caracteres', () => {
  const invalidVendedor = {
    nome: 'João Silva',
    codcv: '0001', // 4 caracteres
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar codcv com 4 caracteres');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'codcv');
    assert(error !== undefined, 'Deveria ter erro específico para codcv');
  }
});

runTest('CT-VEND-007: Deve rejeitar status com mais de 1 caractere', () => {
  const invalidVendedor = {
    nome: 'João Silva',
    status: 'AB', // 2 caracteres
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar status com 2 caracteres');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'status');
    assert(error !== undefined, 'Deveria ter erro específico para status');
  }
});

runTest('CT-VEND-008: Deve rejeitar ra_mat com mais de 6 caracteres', () => {
  const invalidVendedor = {
    nome: 'João Silva',
    ra_mat: '1234567', // 7 caracteres
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar ra_mat com 7 caracteres');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'ra_mat');
    assert(error !== undefined, 'Deveria ter erro específico para ra_mat');
  }
});

// =====================================================
// CATEGORIA 3: Validação de Valores Numéricos
// =====================================================

console.log(
  `\n${colors.blue}Categoria 3: Validação de Valores Numéricos (DECIMAL)${colors.reset}\n`,
);

runTest('CT-VEND-009: Deve rejeitar valobj maior que 999999.99', () => {
  const invalidVendedor = {
    nome: 'João Silva',
    valobj: 1000000.0, // Excede DECIMAL(8,2)
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar valobj > 999999.99');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'valobj');
    assert(error !== undefined, 'Deveria ter erro específico para valobj');
  }
});

runTest('CT-VEND-010: Deve aceitar valobj exatamente 999999.99', () => {
  const validVendedor = {
    nome: 'João Silva',
    valobj: 999999.99,
  };

  const result = cadastroVendedorSchema.safeParse(validVendedor);
  assert(
    result.success,
    `Deveria aceitar valobj = 999999.99: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest('CT-VEND-011: Deve rejeitar comnormal maior que 9999.99', () => {
  const invalidVendedor = {
    nome: 'João Silva',
    comnormal: 10000.0, // Excede DECIMAL(6,2)
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar comnormal > 9999.99');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'comnormal');
    assert(error !== undefined, 'Deveria ter erro específico para comnormal');
  }
});

runTest('CT-VEND-012: Deve rejeitar debito maior que 9999999.99', () => {
  const invalidVendedor = {
    nome: 'João Silva',
    debito: 10000000.0, // Excede DECIMAL(9,2)
  };

  const result = cadastroVendedorSchema.safeParse(invalidVendedor);
  assert(!result.success, 'Deveria rejeitar debito > 9999999.99');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'debito');
    assert(error !== undefined, 'Deveria ter erro específico para debito');
  }
});

// =====================================================
// CATEGORIA 4: Objetos Aninhados (detalhado_vendedor)
// =====================================================

console.log(`\n${colors.blue}Categoria 4: Objetos Aninhados${colors.reset}\n`);

runTest(
  'CT-VEND-013: Deve aceitar detalhado_vendedor com campos válidos',
  () => {
    const validVendedor = {
      nome: 'João Silva',
      detalhado_vendedor: {
        bairro: 'Centro',
        cep: '69000-000',
        cidade: 'Manaus',
        estado: 'AM',
        celular: '92999998888',
        logradouro: 'Rua das Flores',
        nome: 'João Silva Santos',
        tipo: 'Vendedor',
        cpf_cnpj: '123.456.789-00',
      },
    };

    const result = cadastroVendedorSchema.safeParse(validVendedor);
    assert(
      result.success,
      `Deveria aceitar detalhado_vendedor válido: ${
        result.success ? '' : JSON.stringify(result.error.errors)
      }`,
    );
  },
);

runTest('CT-VEND-014: Deve aceitar detalhado_vendedor com valores null', () => {
  const validVendedor = {
    nome: 'João Silva',
    detalhado_vendedor: {
      bairro: null,
      cep: null,
      cidade: null,
      estado: null,
      celular: null,
      logradouro: null,
      nome: null,
      tipo: null,
      cpf_cnpj: null,
    },
  };

  const result = cadastroVendedorSchema.safeParse(validVendedor);
  assert(
    result.success,
    `Deveria aceitar detalhado_vendedor com nulls: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest('CT-VEND-015: Deve aceitar grupos_produto vazio', () => {
  const validVendedor = {
    nome: 'João Silva',
    grupos_produto: [],
  };

  const result = cadastroVendedorSchema.safeParse(validVendedor);
  assert(
    result.success,
    `Deveria aceitar grupos_produto vazio: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest('CT-VEND-016: Deve aceitar PST com codpst e local', () => {
  const validVendedor = {
    nome: 'João Silva',
    pst: {
      codpst: 'PST001',
      local: 'MAO',
    },
  };

  const result = cadastroVendedorSchema.safeParse(validVendedor);
  assert(
    result.success,
    `Deveria aceitar PST válido: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

// =====================================================
// RELATÓRIO FINAL
// =====================================================

console.log(
  `\n${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`,
);
console.log(`${colors.cyan}    RELATÓRIO FINAL${colors.reset}`);
console.log(
  `${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`,
);

const totalTests = results.length;
const passedTests = results.filter((r) => r.passed).length;
const failedTests = results.filter((r) => !r.passed).length;
const successRate = ((passedTests / totalTests) * 100).toFixed(2);

console.log(`Total de testes: ${totalTests}`);
console.log(`${colors.green}✓ Passou: ${passedTests}${colors.reset}`);
console.log(`${colors.red}✗ Falhou: ${failedTests}${colors.reset}`);
console.log(`Taxa de sucesso: ${successRate}%\n`);

if (failedTests > 0) {
  console.log(`${colors.red}Testes que falharam:${colors.reset}`);
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.testName}`);
      if (r.error) {
        console.log(`    ${colors.yellow}${r.error}${colors.reset}`);
      }
    });
  console.log('');
  process.exit(1);
} else {
  console.log(
    `${colors.green}🎉 Todos os testes passaram com sucesso!${colors.reset}\n`,
  );
  process.exit(0);
}
