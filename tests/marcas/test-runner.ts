/**
 * 🧪 Test Runner - Módulo Marcas
 * Sistema Melo - Quality Assurance
 *
 * Este arquivo implementa testes automatizados para o módulo de Marcas
 *
 * Casos de Teste Cobertos:
 * - CT 1.1: Criar marca com campos mínimos obrigatórios ✅
 * - CT 2.1: Validar código vazio ❌
 * - CT 2.2: Validar descrição vazia ❌
 * - CT 2.3: Validar tamanho máximo do código (5 caracteres) ❌
 * - CT 2.4: Validar tamanho máximo da descrição (200 caracteres) ❌
 */

import { crudMarcaSchema } from '../../src/data/marcas/marcasSchema';
import { z } from 'zod';

type MarcaInput = z.infer<typeof crudMarcaSchema>;

// Cores para output no terminal
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(
  testName: string,
  testFn: () => void,
  priority: 'P0' | 'P1' | 'P2' = 'P0',
): void {
  totalTests++;
  const priorityColor =
    priority === 'P0' ? RED : priority === 'P1' ? YELLOW : CYAN;

  try {
    testFn();
    passedTests++;
    console.log(
      `${GREEN}✅ PASS${RESET} [${priorityColor}${priority}${RESET}] ${testName}`,
    );
  } catch (error) {
    failedTests++;
    console.log(
      `${RED}❌ FAIL${RESET} [${priorityColor}${priority}${RESET}] ${testName}`,
    );
    if (error instanceof Error) {
      console.log(`   ${RED}└─ ${error.message}${RESET}`);
    } else if (error instanceof z.ZodError) {
      console.log(`   ${RED}└─ Erro de validação Zod:${RESET}`);
      error.errors.forEach((err) => {
        console.log(
          `      ${RED}• ${err.path.join('.')}: ${err.message}${RESET}`,
        );
      });
    }
  }
}

function createValidMarca(): MarcaInput {
  return {
    codmarca: '00001',
    descr: 'Marca de Teste',
    bloquear_preco: 'S',
  };
}

console.log('\n' + '='.repeat(80));
console.log(`${CYAN}🧪 INICIANDO TESTES AUTOMATIZADOS - MÓDULO MARCAS${RESET}`);
console.log(`${CYAN}📋 Validação de Schema Zod${RESET}`);
console.log('='.repeat(80) + '\n');

// ============================================================================
// SEÇÃO 1: HAPPY PATH - CRIAR MARCA
// ============================================================================

console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(`${MAGENTA}📦 SEÇÃO 1: HAPPY PATH - Criar Marca${RESET}`);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 1.1: Criar marca com campos mínimos obrigatórios',
  () => {
    const marca = createValidMarca();
    const result = crudMarcaSchema.parse(marca);

    if (result.codmarca !== '00001') throw new Error('Código incorreto');
    if (result.descr !== 'Marca de Teste')
      throw new Error('Descrição incorreta');
  },
  'P0',
);

runTest(
  'CT 1.2: Criar marca sem campo opcional bloquear_preco',
  () => {
    const marca: MarcaInput = {
      codmarca: '00002',
      descr: 'Marca sem Bloqueio',
    };

    const result = crudMarcaSchema.parse(marca);
    if (result.codmarca !== '00002') throw new Error('Código incorreto');
  },
  'P0',
);

// ============================================================================
// SEÇÃO 2: VALIDAÇÃO DE SCHEMA ZOD - CAMPOS OBRIGATÓRIOS VAZIOS
// ============================================================================

console.log(
  `\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(
  `${MAGENTA}🔍 SEÇÃO 2: VALIDAÇÃO DE SCHEMA - Campos Obrigatórios${RESET}`,
);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.1: ❌ Validar código vazio (deve REJEITAR)',
  () => {
    const marca = createValidMarca();
    marca.codmarca = '';

    let errorThrown = false;
    let errorMessage = '';

    try {
      crudMarcaSchema.parse(marca);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const codmarcaError = error.errors.find((e) =>
          e.path.includes('codmarca'),
        );
        errorMessage = codmarcaError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error(
        '❌ BUG: Schema aceitou código vazio! Deveria rejeitar com .min(1)',
      );
    }

    console.log(
      `   ${CYAN}└─ ✓ Schema rejeitou corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P0',
);

runTest(
  'CT 2.2: ❌ Validar descrição vazia (deve REJEITAR)',
  () => {
    const marca = createValidMarca();
    marca.descr = '';

    let errorThrown = false;
    let errorMessage = '';

    try {
      crudMarcaSchema.parse(marca);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const descrError = error.errors.find((e) => e.path.includes('descr'));
        errorMessage = descrError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error('❌ BUG: Schema aceitou descrição vazia!');
    }

    console.log(
      `   ${CYAN}└─ ✓ Schema rejeitou corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P0',
);

// ============================================================================
// SEÇÃO 3: VALIDAÇÃO DE TAMANHO MÁXIMO
// ============================================================================

console.log(
  `\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(`${MAGENTA}📏 SEÇÃO 3: VALIDAÇÃO DE TAMANHO MÁXIMO${RESET}`);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.3: ❌ Código com 6 caracteres (limite: 5)',
  () => {
    const marca = createValidMarca();
    marca.codmarca = '123456'; // 6 caracteres

    let errorThrown = false;
    let errorMessage = '';

    try {
      crudMarcaSchema.parse(marca);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const codmarcaError = error.errors.find((e) =>
          e.path.includes('codmarca'),
        );
        errorMessage = codmarcaError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error(
        '❌ BUG: Schema aceitou código com 6 caracteres! Limite: 5',
      );
    }

    console.log(
      `   ${CYAN}└─ ✓ Rejeitado corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P1',
);

runTest(
  'CT 2.3.1: ✅ Código com exatamente 5 caracteres (deve ACEITAR)',
  () => {
    const marca = createValidMarca();
    marca.codmarca = '12345'; // Exatamente 5

    const result = crudMarcaSchema.parse(marca);
    if (result.codmarca.length !== 5) {
      throw new Error(
        `Código deveria ter 5 caracteres, tem: ${result.codmarca.length}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Aceito corretamente (5 caracteres)${RESET}`);
  },
  'P1',
);

runTest(
  'CT 2.4: ❌ Descrição com 201 caracteres (limite: 200)',
  () => {
    const marca = createValidMarca();
    marca.descr = 'A'.repeat(201);

    let errorThrown = false;
    let errorMessage = '';

    try {
      crudMarcaSchema.parse(marca);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const descrError = error.errors.find((e) => e.path.includes('descr'));
        errorMessage = descrError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error('❌ BUG: Schema aceitou descrição com 201 caracteres!');
    }

    console.log(`   ${CYAN}└─ ✓ Rejeitado: "${errorMessage}"${RESET}`);
  },
  'P1',
);

runTest(
  'CT 2.4.1: ✅ Descrição com exatamente 200 caracteres',
  () => {
    const marca = createValidMarca();
    marca.descr = 'A'.repeat(200);

    const result = crudMarcaSchema.parse(marca);
    console.log(`   ${CYAN}└─ ✓ Aceito (200 caracteres)${RESET}`);
  },
  'P1',
);

// ============================================================================
// RESUMO FINAL
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log(`${CYAN}📊 RESUMO DA EXECUÇÃO${RESET}`);
console.log('='.repeat(80));
console.log(`${GREEN}✅ Testes Passaram: ${passedTests}${RESET}`);
console.log(`${RED}❌ Testes Falharam: ${failedTests}${RESET}`);
console.log(`${CYAN}📋 Total de Testes: ${totalTests}${RESET}`);

const successRate =
  totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';
const statusColor = failedTests === 0 ? GREEN : failedTests <= 2 ? YELLOW : RED;

console.log(`${statusColor}📈 Taxa de Sucesso: ${successRate}%${RESET}`);
console.log('='.repeat(80));

if (failedTests > 0) {
  console.log(`\n${RED}⚠️  BUGS ENCONTRADOS!${RESET}`);
  console.log(`${YELLOW}Próximos passos:${RESET}`);
  console.log(`   1. Analisar os testes que falharam acima`);
  console.log(`   2. Corrigir o schema em: src/data/marcas/marcasSchema.ts`);
  console.log(`   3. Executar novamente: npx tsx tests/marcas/test-runner.ts`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}🎉 TODOS OS TESTES PASSARAM!${RESET}`);
  console.log(`${CYAN}Schema de validação está correto.${RESET}`);
  process.exit(0);
}
