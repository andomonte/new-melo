/**
 * 🧪 Test Runner - Validação de Tamanho Máximo (Max Length)
 * Sistema Melo - Módulo Produtos
 *
 * Este arquivo testa as validações de .max() adicionadas ao schema
 * para prevenir erros PostgreSQL 22001 (string too long)
 *
 * Casos de Teste Cobertos:
 * - CT 2.16: Referência excedendo limite (20 caracteres) ❌
 * - CT 2.17: Descrição excedendo limite (200 caracteres) ❌
 * - Outros campos string com limites
 * - Percentuais com validação de range (0-100%)
 */

import { cadastroProdutoSchema } from '../../src/data/produtos/produtosSchema';
import { z } from 'zod';

type ProdutoInput = z.infer<typeof cadastroProdutoSchema>;

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
  priority: 'P0' | 'P1' | 'P2' = 'P2',
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

function createValidProduto(): ProdutoInput {
  return {
    ref: 'TESTE-001',
    descr: 'Produto de Teste QA',
    unimed: 'PC',
    codmarca: '00000',
    codgpf: '00000',
    codgpp: '00000',
    curva: 'D',
    multiplo: 1,
    compradireta: 'N',
    tipo: 'ME',
    trib: 'N',
    strib: '000',
    isentopiscofins: 'N',
    isentoipi: 'S',
  };
}

console.log('\n' + '='.repeat(80));
console.log(
  `${CYAN}🧪 TESTES DE VALIDAÇÃO DE TAMANHO MÁXIMO - MÓDULO PRODUTOS${RESET}`,
);
console.log(
  `${CYAN}🎯 Objetivo: Prevenir erro PostgreSQL 22001 (string too long)${RESET}`,
);
console.log('='.repeat(80) + '\n');

// ============================================================================
// SEÇÃO 1: VALIDAÇÃO DE TAMANHO MÁXIMO - CAMPOS OBRIGATÓRIOS
// ============================================================================

console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(
  `${MAGENTA}📏 SEÇÃO 1: Validação de Tamanho Máximo - Campos Obrigatórios${RESET}`,
);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.16: ❌ Referência com 21 caracteres (limite: 20)',
  () => {
    const produto = createValidProduto();
    produto.ref = 'A'.repeat(21); // 21 caracteres

    let errorThrown = false;
    let errorMessage = '';

    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const refError = error.errors.find((e) => e.path.includes('ref'));
        errorMessage = refError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error(
        '❌ BUG: Schema aceitou referência com 21 caracteres! Limite: 20',
      );
    }

    console.log(
      `   ${CYAN}└─ ✓ Rejeitado corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P2',
);

runTest(
  'CT 2.16.1: ✅ Referência com exatamente 20 caracteres (deve ACEITAR)',
  () => {
    const produto = createValidProduto();
    produto.ref = 'A'.repeat(20); // Exatamente 20 - deve passar

    const result = cadastroProdutoSchema.parse(produto);
    if (result.ref.length !== 20) {
      throw new Error(
        `Ref deveria ter 20 caracteres, tem: ${result.ref.length}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Aceito corretamente (20 caracteres)${RESET}`);
  },
  'P2',
);

runTest(
  'CT 2.17: ❌ Descrição com 201 caracteres (limite: 200)',
  () => {
    const produto = createValidProduto();
    produto.descr = 'A'.repeat(201);

    let errorThrown = false;
    let errorMessage = '';

    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const descrError = error.errors.find((e) => e.path.includes('descr'));
        errorMessage = descrError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error(
        '❌ BUG: Schema aceitou descrição com 201 caracteres! Limite: 200',
      );
    }

    console.log(
      `   ${CYAN}└─ ✓ Rejeitado corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P2',
);

runTest(
  'CT 2.17.1: ✅ Descrição com exatamente 200 caracteres',
  () => {
    const produto = createValidProduto();
    produto.descr = 'A'.repeat(200);

    const result = cadastroProdutoSchema.parse(produto);
    console.log(`   ${CYAN}└─ ✓ Aceito (200 caracteres)${RESET}`);
  },
  'P2',
);

runTest(
  'CT 2.18: ❌ Unidade de Medida com 3 caracteres (limite: 2)',
  () => {
    const produto = createValidProduto();
    produto.unimed = 'ABC'; // 3 caracteres

    let errorThrown = false;
    let errorMessage = '';

    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const unimedError = error.errors.find((e) => e.path.includes('unimed'));
        errorMessage = unimedError?.message || '';
      }
    }

    if (!errorThrown) {
      throw new Error(
        '❌ BUG: Schema aceitou unimed com 3 caracteres! Limite: 2',
      );
    }

    console.log(`   ${CYAN}└─ ✓ Rejeitado: "${errorMessage}"${RESET}`);
  },
  'P2',
);

// ============================================================================
// SEÇÃO 2: VALIDAÇÃO DE TAMANHO MÁXIMO - CAMPOS OPCIONAIS
// ============================================================================

console.log(
  `\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(
  `${MAGENTA}📏 SEÇÃO 2: Validação de Tamanho Máximo - Campos Opcionais${RESET}`,
);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.19: ❌ Código de Barras com 16 caracteres (limite: 15)',
  () => {
    const produto = createValidProduto();
    produto.codbar = '1'.repeat(16);

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const codbarError = error.errors.find((e) => e.path.includes('codbar'));
        console.log(
          `   ${CYAN}└─ ✓ Rejeitado: "${codbarError?.message}"${RESET}`,
        );
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou código de barras com 16 caracteres!');
    }
  },
  'P2',
);

runTest(
  'CT 2.20: ❌ Classificação Fiscal com 11 caracteres (limite: 10)',
  () => {
    const produto = createValidProduto();
    produto.clasfiscal = '12345678901'; // 11 dígitos

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const clasfiscalError = error.errors.find((e) =>
          e.path.includes('clasfiscal'),
        );
        console.log(
          `   ${CYAN}└─ ✓ Rejeitado: "${clasfiscalError?.message}"${RESET}`,
        );
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou clasfiscal com 11 caracteres!');
    }
  },
  'P2',
);

runTest(
  'CT 2.21: ❌ CEST com 8 caracteres (limite: 7)',
  () => {
    const produto = createValidProduto();
    produto.cest = '12345678'; // 8 dígitos

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const cestError = error.errors.find((e) => e.path.includes('cest'));
        console.log(
          `   ${CYAN}└─ ✓ Rejeitado: "${cestError?.message}"${RESET}`,
        );
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou CEST com 8 caracteres!');
    }
  },
  'P2',
);

runTest(
  'CT 2.22: ❌ Observações com 101 caracteres (limite: 100)',
  () => {
    const produto = createValidProduto();
    produto.obs = 'A'.repeat(101);

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const obsError = error.errors.find((e) => e.path.includes('obs'));
        console.log(`   ${CYAN}└─ ✓ Rejeitado: "${obsError?.message}"${RESET}`);
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou observações com 101 caracteres!');
    }
  },
  'P2',
);

runTest(
  'CT 2.23: ❌ Aplicação Extendida com 256 caracteres (limite: 255)',
  () => {
    const produto = createValidProduto();
    produto.aplic_extendida = 'A'.repeat(256);

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const aplicError = error.errors.find((e) =>
          e.path.includes('aplic_extendida'),
        );
        console.log(
          `   ${CYAN}└─ ✓ Rejeitado: "${aplicError?.message}"${RESET}`,
        );
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou aplic_extendida com 256 caracteres!');
    }
  },
  'P2',
);

// ============================================================================
// SEÇÃO 3: VALIDAÇÃO DE RANGE - PERCENTUAIS
// ============================================================================

console.log(
  `\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(
  `${MAGENTA}📊 SEÇÃO 3: Validação de Range - Percentuais (0-100%)${RESET}`,
);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.24: ❌ PIS negativo (deve REJEITAR)',
  () => {
    const produto = createValidProduto();
    produto.pis = -1.5 as any;

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const pisError = error.errors.find((e) => e.path.includes('pis'));
        console.log(`   ${CYAN}└─ ✓ Rejeitado: "${pisError?.message}"${RESET}`);
      }
    }

    if (!errorThrown) {
      throw new Error('❌ BUG: Schema aceitou PIS negativo!');
    }
  },
  'P1',
);

runTest(
  'CT 2.25: ❌ PIS acima de 100% (deve REJEITAR)',
  () => {
    const produto = createValidProduto();
    produto.pis = 150 as any;

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const pisError = error.errors.find((e) => e.path.includes('pis'));
        console.log(`   ${CYAN}└─ ✓ Rejeitado: "${pisError?.message}"${RESET}`);
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou PIS > 100%!');
    }
  },
  'P1',
);

runTest(
  'CT 2.26: ✅ PIS com valor válido (1.65%)',
  () => {
    const produto = createValidProduto();
    produto.pis = 1.65 as any;

    const result = cadastroProdutoSchema.parse(produto);
    console.log(`   ${CYAN}└─ ✓ Aceito corretamente (1.65%)${RESET}`);
  },
  'P1',
);

runTest(
  'CT 2.27: ❌ COFINS negativo',
  () => {
    const produto = createValidProduto();
    produto.cofins = -7.6 as any;

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const cofinsError = error.errors.find((e) => e.path.includes('cofins'));
        console.log(
          `   ${CYAN}└─ ✓ Rejeitado: "${cofinsError?.message}"${RESET}`,
        );
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou COFINS negativo!');
    }
  },
  'P1',
);

runTest(
  'CT 2.28: ❌ IPI acima de 100%',
  () => {
    const produto = createValidProduto();
    produto.ipi = 999 as any;

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const ipiError = error.errors.find((e) => e.path.includes('ipi'));
        console.log(`   ${CYAN}└─ ✓ Rejeitado: "${ipiError?.message}"${RESET}`);
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou IPI > 100%!');
    }
  },
  'P1',
);

runTest(
  'CT 2.29: ❌ Percentual de Substituição negativo',
  () => {
    const produto = createValidProduto();
    produto.percsubst = -30 as any;

    let errorThrown = false;
    try {
      cadastroProdutoSchema.parse(produto);
    } catch (error) {
      errorThrown = true;
      if (error instanceof z.ZodError) {
        const percsubstError = error.errors.find((e) =>
          e.path.includes('percsubst'),
        );
        console.log(
          `   ${CYAN}└─ ✓ Rejeitado: "${percsubstError?.message}"${RESET}`,
        );
      }
    }

    if (!errorThrown) {
      throw new Error('Schema aceitou percsubst negativo!');
    }
  },
  'P1',
);

runTest(
  'CT 2.30: ✅ Percentual de Substituição válido (30%)',
  () => {
    const produto = createValidProduto();
    produto.percsubst = 30 as any;

    const result = cadastroProdutoSchema.parse(produto);
    console.log(`   ${CYAN}└─ ✓ Aceito corretamente (30%)${RESET}`);
  },
  'P1',
);

// ============================================================================
// RESUMO FINAL
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log(`${CYAN}📊 RESUMO DA EXECUÇÃO - TESTES DE TAMANHO MÁXIMO${RESET}`);
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
  console.log(`   1. Verificar erros acima`);
  console.log(`   2. Ajustar schema em: src/data/produtos/produtosSchema.ts`);
  console.log(
    `   3. Executar novamente: npm run tsx tests/produtos/test-max-length.ts`,
  );
  process.exit(1);
} else {
  console.log(`\n${GREEN}🎉 TODOS OS TESTES DE VALIDAÇÃO PASSARAM!${RESET}`);
  console.log(
    `${CYAN}✅ Validações de .max() implementadas corretamente${RESET}`,
  );
  console.log(`${CYAN}✅ Validações de range (0-100%) funcionando${RESET}`);
  console.log(
    `${CYAN}✅ Schema protegido contra erro PostgreSQL 22001${RESET}`,
  );
  process.exit(0);
}
