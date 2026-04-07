/**
 * Test Runner - Contas Module
 *
 * Testes automatizados para validação do schema de Contas
 * Baseado no padrão de testes de Marcas
 */

import { contaSchema } from '../../src/data/contas/contasSchema';
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
  `${colors.cyan}    TESTES AUTOMATIZADOS - MÓDULO CONTAS${colors.reset}`,
);
console.log(
  `${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`,
);

// =====================================================
// CATEGORIA 1: Validação de Campos Obrigatórios
// =====================================================

console.log(`${colors.blue}Categoria 1: Campos Obrigatórios${colors.reset}\n`);

runTest('CT-CONTAS-001: Deve aceitar conta válida com todos os campos', () => {
  const validConta = {
    cod_conta: '0001',
    cod_banco: '001',
    nro_conta: '123456789012345',
    oficial: 'S',
    digito: '1',
    variacao: '019',
    convenio: '123456789',
    carteira: '17',
  };

  const result = contaSchema.safeParse(validConta);
  assert(
    result.success,
    `Deveria validar conta válida: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest(
  'CT-CONTAS-002: Deve aceitar conta com campos mínimos (todos opcionais)',
  () => {
    const minimalConta = {};

    const result = contaSchema.safeParse(minimalConta);
    assert(
      result.success,
      `Deveria aceitar objeto vazio (todos campos opcionais): ${
        result.success ? '' : JSON.stringify(result.error.errors)
      }`,
    );
  },
);

// =====================================================
// CATEGORIA 2: Validação de Comprimento Máximo
// =====================================================

console.log(
  `\n${colors.blue}Categoria 2: Validação de Comprimento Máximo${colors.reset}\n`,
);

runTest(
  'CT-CONTAS-003: Deve rejeitar cod_conta com mais de 4 caracteres',
  () => {
    const invalidConta = {
      cod_conta: '00001', // 5 caracteres
    };

    const result = contaSchema.safeParse(invalidConta);
    assert(!result.success, 'Deveria rejeitar cod_conta com 5 caracteres');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'cod_conta');
      assert(error !== undefined, 'Deveria ter erro específico para cod_conta');
      assert(
        error!.message.includes('4 caracteres'),
        `Mensagem de erro deveria mencionar limite de 4 caracteres, obteve: ${
          error!.message
        }`,
      );
    }
  },
);

runTest(
  'CT-CONTAS-004: Deve aceitar cod_conta com exatamente 4 caracteres',
  () => {
    const validConta = {
      cod_conta: '0001', // 4 caracteres
    };

    const result = contaSchema.safeParse(validConta);
    assert(
      result.success,
      `Deveria aceitar cod_conta com 4 caracteres: ${
        result.success ? '' : JSON.stringify(result.error.errors)
      }`,
    );
  },
);

runTest(
  'CT-CONTAS-005: Deve rejeitar cod_banco com mais de 4 caracteres',
  () => {
    const invalidConta = {
      cod_banco: '00001', // 5 caracteres
    };

    const result = contaSchema.safeParse(invalidConta);
    assert(!result.success, 'Deveria rejeitar cod_banco com 5 caracteres');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'cod_banco');
      assert(error !== undefined, 'Deveria ter erro específico para cod_banco');
    }
  },
);

runTest(
  'CT-CONTAS-006: Deve rejeitar nro_conta com mais de 15 caracteres',
  () => {
    const invalidConta = {
      nro_conta: '1234567890123456', // 16 caracteres
    };

    const result = contaSchema.safeParse(invalidConta);
    assert(!result.success, 'Deveria rejeitar nro_conta com 16 caracteres');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'nro_conta');
      assert(error !== undefined, 'Deveria ter erro específico para nro_conta');
      assert(
        error!.message.includes('15 caracteres'),
        `Mensagem de erro deveria mencionar limite de 15 caracteres, obteve: ${
          error!.message
        }`,
      );
    }
  },
);

runTest(
  'CT-CONTAS-007: Deve aceitar nro_conta com exatamente 15 caracteres',
  () => {
    const validConta = {
      nro_conta: '123456789012345', // 15 caracteres
    };

    const result = contaSchema.safeParse(validConta);
    assert(
      result.success,
      `Deveria aceitar nro_conta com 15 caracteres: ${
        result.success ? '' : JSON.stringify(result.error.errors)
      }`,
    );
  },
);

runTest('CT-CONTAS-008: Deve rejeitar oficial com mais de 1 caractere', () => {
  const invalidConta = {
    oficial: 'SN', // 2 caracteres
  };

  const result = contaSchema.safeParse(invalidConta);
  assert(!result.success, 'Deveria rejeitar oficial com 2 caracteres');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'oficial');
    assert(error !== undefined, 'Deveria ter erro específico para oficial');
  }
});

runTest('CT-CONTAS-009: Deve rejeitar digito com mais de 1 caractere', () => {
  const invalidConta = {
    digito: '12', // 2 caracteres
  };

  const result = contaSchema.safeParse(invalidConta);
  assert(!result.success, 'Deveria rejeitar digito com 2 caracteres');
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path[0] === 'digito');
    assert(error !== undefined, 'Deveria ter erro específico para digito');
  }
});

runTest(
  'CT-CONTAS-010: Deve rejeitar variacao com mais de 3 caracteres',
  () => {
    const invalidConta = {
      variacao: '0199', // 4 caracteres
    };

    const result = contaSchema.safeParse(invalidConta);
    assert(!result.success, 'Deveria rejeitar variacao com 4 caracteres');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'variacao');
      assert(error !== undefined, 'Deveria ter erro específico para variacao');
    }
  },
);

runTest(
  'CT-CONTAS-011: Deve rejeitar convenio com mais de 9 caracteres',
  () => {
    const invalidConta = {
      convenio: '1234567890', // 10 caracteres
    };

    const result = contaSchema.safeParse(invalidConta);
    assert(!result.success, 'Deveria rejeitar convenio com 10 caracteres');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'convenio');
      assert(error !== undefined, 'Deveria ter erro específico para convenio');
    }
  },
);

runTest(
  'CT-CONTAS-012: Deve rejeitar carteira com mais de 2 caracteres',
  () => {
    const invalidConta = {
      carteira: '171', // 3 caracteres
    };

    const result = contaSchema.safeParse(invalidConta);
    assert(!result.success, 'Deveria rejeitar carteira com 3 caracteres');
    if (!result.success) {
      const error = result.error.errors.find((e) => e.path[0] === 'carteira');
      assert(error !== undefined, 'Deveria ter erro específico para carteira');
    }
  },
);

// =====================================================
// CATEGORIA 3: Validação de Valores Nulos/Vazios
// =====================================================

console.log(
  `\n${colors.blue}Categoria 3: Valores Nulos e Vazios${colors.reset}\n`,
);

runTest('CT-CONTAS-013: Deve aceitar cod_banco como null', () => {
  const contaWithNull = {
    cod_banco: null,
  };

  const result = contaSchema.safeParse(contaWithNull);
  assert(
    result.success,
    `Deveria aceitar cod_banco null: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest('CT-CONTAS-014: Deve aceitar nro_conta como null', () => {
  const contaWithNull = {
    nro_conta: null,
  };

  const result = contaSchema.safeParse(contaWithNull);
  assert(
    result.success,
    `Deveria aceitar nro_conta null: ${
      result.success ? '' : JSON.stringify(result.error.errors)
    }`,
  );
});

runTest('CT-CONTAS-015: Deve aceitar variacao como null', () => {
  const contaWithNull = {
    variacao: null,
  };

  const result = contaSchema.safeParse(contaWithNull);
  assert(
    result.success,
    `Deveria aceitar variacao null: ${
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
