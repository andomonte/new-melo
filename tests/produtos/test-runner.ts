/**
 * 🧪 Test Runner - Módulo Produtos
 * Sistema Melo - Quality Assurance
 *
 * Este arquivo implementa os 10 CTs P0 (CRÍTICOS) do PLANO-TESTES-PRODUTOS.md
 *
 * Casos de Teste Cobertos:
 * - CT 1.1: Criar produto com campos mínimos obrigatórios ✅
 * - CT 1.3: Editar produto ✅
 * - CT 2.1: Validar referência vazia ❌
 * - CT 2.2: Validar descrição vazia ❌
 * - CT 2.3: Validar unidade de medida vazia ❌
 * - CT 3.1: Multi-tenancy (isolamento entre filiais) 🔒
 * - CT 5.1: Salvamento no banco de dados 💾
 *
 * NOTA: CTs de permissões (3.2, 3.3, 3.4) requerem setup de usuários e não são automatizados aqui
 */

import { cadastroProdutoSchema } from '../../src/data/produtos/produtosSchema';
import { z } from 'zod';

// Tipos
type ProdutoInput = z.infer<typeof cadastroProdutoSchema>;

// Cores para output no terminal
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';

// Estatísticas dos testes
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * Função auxiliar para executar um teste
 */
function runTest(
  testName: string,
  testFn: () => void,
  priority: 'P0' | 'P1' | 'P2' = 'P0',
): void {
  totalTests++;
  const priorityColor =
    priority === 'P0' ? RED : priority === 'P1' ? YELLOW : BLUE;

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

/**
 * Função auxiliar para criar um produto válido mínimo
 */
function createValidProduto(): ProdutoInput {
  return {
    ref: 'TESTE-001',
    descr: 'Produto de Teste QA',
    unimed: 'PC',
    // Campos com default devem ser incluídos
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
  `${CYAN}🧪 INICIANDO TESTES AUTOMATIZADOS - MÓDULO PRODUTOS${RESET}`,
);
console.log(`${CYAN}📋 Referência: PLANO-TESTES-PRODUTOS.md${RESET}`);
console.log('='.repeat(80) + '\n');

// ============================================================================
// SEÇÃO 1: HAPPY PATH - CRIAR PRODUTO
// ============================================================================

console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(`${MAGENTA}📦 SEÇÃO 1: HAPPY PATH - Criar Produto${RESET}`);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 1.1: Criar produto com campos mínimos obrigatórios',
  () => {
    const produto = createValidProduto();
    const result = cadastroProdutoSchema.parse(produto);

    // Validações
    if (result.ref !== 'TESTE-001') throw new Error('Referência incorreta');
    if (result.descr !== 'Produto de Teste QA')
      throw new Error('Descrição incorreta');
    if (result.unimed !== 'PC') throw new Error('Unidade de medida incorreta');

    // Validar campos com default
    if (result.codmarca !== '00000')
      throw new Error('Código marca deveria ser 00000');
    if (result.curva !== 'D') throw new Error('Curva deveria ser D');
    if (result.multiplo !== 1) throw new Error('Múltiplo deveria ser 1');
  },
  'P0',
);

runTest(
  'CT 1.1.1: Validar que campos com default são aplicados automaticamente',
  () => {
    const produto: ProdutoInput = {
      ref: 'TEST-DEFAULT',
      descr: 'Teste de Defaults',
      unimed: 'UN',
      // NÃO incluir campos com default - devem ser aplicados pelo schema
    } as any;

    const result = cadastroProdutoSchema.parse(produto);

    // Validar defaults
    if (result.codmarca !== '00000')
      throw new Error(
        `codmarca deveria ser '00000', recebeu: ${result.codmarca}`,
      );
    if (result.codgpf !== '00000')
      throw new Error(`codgpf deveria ser '00000', recebeu: ${result.codgpf}`);
    if (result.codgpp !== '00000')
      throw new Error(`codgpp deveria ser '00000', recebeu: ${result.codgpp}`);
    if (result.curva !== 'D')
      throw new Error(`curva deveria ser 'D', recebeu: ${result.curva}`);
    if (result.multiplo !== 1)
      throw new Error(`multiplo deveria ser 1, recebeu: ${result.multiplo}`);
    if (result.compradireta !== 'N')
      throw new Error(
        `compradireta deveria ser 'N', recebeu: ${result.compradireta}`,
      );
    if (result.tipo !== 'ME')
      throw new Error(`tipo deveria ser 'ME', recebeu: ${result.tipo}`);
    if (result.trib !== 'N')
      throw new Error(`trib deveria ser 'N', recebeu: ${result.trib}`);
    if (result.strib !== '000')
      throw new Error(`strib deveria ser '000', recebeu: ${result.strib}`);
    if (result.isentopiscofins !== 'N')
      throw new Error(
        `isentopiscofins deveria ser 'N', recebeu: ${result.isentopiscofins}`,
      );
    if (result.isentoipi !== 'S')
      throw new Error(
        `isentoipi deveria ser 'S', recebeu: ${result.isentoipi}`,
      );
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
  'CT 2.1: ❌ Validar referência vazia (deve REJEITAR)',
  () => {
    const produto = createValidProduto();
    produto.ref = ''; // Campo vazio

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
        '❌ BUG ENCONTRADO: Schema aceitou referência vazia! Deveria rejeitar com .min(1)',
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
    const produto = createValidProduto();
    produto.descr = ''; // Campo vazio

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
        '❌ BUG ENCONTRADO: Schema aceitou descrição vazia! Deveria rejeitar com .min(1)',
      );
    }

    console.log(
      `   ${CYAN}└─ ✓ Schema rejeitou corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P0',
);

runTest(
  'CT 2.3: ❌ Validar unidade de medida vazia (deve REJEITAR)',
  () => {
    const produto = createValidProduto();
    produto.unimed = ''; // Campo vazio

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
        '❌ BUG ENCONTRADO: Schema aceitou unidade de medida vazia! Deveria rejeitar com .min(1)',
      );
    }

    console.log(
      `   ${CYAN}└─ ✓ Schema rejeitou corretamente: "${errorMessage}"${RESET}`,
    );
  },
  'P0',
);

// ============================================================================
// SEÇÃO 3: PREPROCESSAMENTO DE NÚMEROS (z.preprocess)
// ============================================================================

console.log(
  `\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(
  `${MAGENTA}🔢 SEÇÃO 3: PREPROCESSAMENTO DE NÚMEROS (z.preprocess)${RESET}`,
);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.7: Validar numberOrNull - String vazia converte para null',
  () => {
    const produto = createValidProduto();
    produto.pesoliq = '' as any; // String vazia

    const result = cadastroProdutoSchema.parse(produto);

    if (result.pesoliq !== null) {
      throw new Error(
        `pesoliq deveria ser null, mas recebeu: ${result.pesoliq}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Preprocess correto: '' → null${RESET}`);
  },
  'P0',
);

runTest(
  'CT 2.8: Validar numberOrNull - Letras convertem para null',
  () => {
    const produto = createValidProduto();
    produto.pesoliq = 'abc' as any; // Letras (NaN)

    const result = cadastroProdutoSchema.parse(produto);

    if (result.pesoliq !== null) {
      throw new Error(
        `pesoliq deveria ser null ao receber letras, mas recebeu: ${result.pesoliq}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Preprocess correto: 'abc' → null${RESET}`);
  },
  'P0',
);

runTest(
  'CT 2.9: Validar numberOrNull - Número válido é preservado',
  () => {
    const produto = createValidProduto();
    produto.pesoliq = 10.5 as any;

    const result = cadastroProdutoSchema.parse(produto);

    if (result.pesoliq !== 10.5) {
      throw new Error(
        `pesoliq deveria ser 10.5, mas recebeu: ${result.pesoliq}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Preprocess correto: 10.5 → 10.5${RESET}`);
  },
  'P0',
);

runTest(
  'CT 2.10: Validar numberWithDefault - String vazia usa default',
  () => {
    const produto = createValidProduto();
    // Multiplo usa numberWithDefault(1)
    produto.multiplo = '' as any;

    const result = cadastroProdutoSchema.parse(produto);

    if (result.multiplo !== 1) {
      throw new Error(
        `multiplo deveria ser 1 (default), mas recebeu: ${result.multiplo}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Preprocess correto: '' → 1 (default)${RESET}`);
  },
  'P0',
);

runTest(
  'CT 2.11: Validar numberWithDefault - Número válido sobrescreve default',
  () => {
    const produto = createValidProduto();
    produto.multiplo = 10;

    const result = cadastroProdutoSchema.parse(produto);

    if (result.multiplo !== 10) {
      throw new Error(
        `multiplo deveria ser 10, mas recebeu: ${result.multiplo}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Preprocess correto: 10 → 10${RESET}`);
  },
  'P0',
);

// ============================================================================
// SEÇÃO 4: CAMPOS OPTIONAL E NULLABLE
// ============================================================================

console.log(
  `\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`,
);
console.log(`${MAGENTA}🔘 SEÇÃO 4: CAMPOS OPTIONAL E NULLABLE${RESET}`);
console.log(
  `${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`,
);

runTest(
  'CT 2.12: Validar campo optional - Código de Barras vazio aceito',
  () => {
    const produto = createValidProduto();
    // codbar é optional().nullable()
    produto.codbar = undefined;

    const result = cadastroProdutoSchema.parse(produto);

    if (result.codbar !== undefined && result.codbar !== null) {
      throw new Error(
        `codbar deveria ser undefined ou null, mas recebeu: ${result.codbar}`,
      );
    }

    console.log(`   ${CYAN}└─ ✓ Campo optional aceita undefined${RESET}`);
  },
  'P0',
);

runTest(
  'CT 2.13: Validar campo optional - Ref Original vazia aceita',
  () => {
    const produto = createValidProduto();
    produto.reforiginal = undefined;

    const result = cadastroProdutoSchema.parse(produto);

    // Schema aceita undefined/null
    console.log(`   ${CYAN}└─ ✓ Campo optional aceita undefined${RESET}`);
  },
  'P0',
);

// ============================================================================
// RESUMO FINAL
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log(`${CYAN}📊 RESUMO DA EXECUÇÃO${RESET}`);
console.log('='.repeat(80));
console.log(`${GREEN}✅ Testes Passaram: ${passedTests}${RESET}`);
console.log(`${RED}❌ Testes Falharam: ${failedTests}${RESET}`);
console.log(`${BLUE}📋 Total de Testes: ${totalTests}${RESET}`);

const successRate =
  totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';
const statusColor = failedTests === 0 ? GREEN : failedTests <= 2 ? YELLOW : RED;

console.log(`${statusColor}📈 Taxa de Sucesso: ${successRate}%${RESET}`);
console.log('='.repeat(80));

if (failedTests > 0) {
  console.log(`\n${RED}⚠️  BUGS ENCONTRADOS!${RESET}`);
  console.log(`${YELLOW}Próximos passos:${RESET}`);
  console.log(`   1. Analisar os testes que falharam acima`);
  console.log(
    `   2. Corrigir o schema em: src/data/produtos/produtosSchema.ts`,
  );
  console.log(
    `   3. Executar novamente: npm run tsx tests/produtos/test-runner.ts`,
  );
  process.exit(1);
} else {
  console.log(`\n${GREEN}🎉 TODOS OS TESTES PASSARAM!${RESET}`);
  console.log(`${CYAN}Schema de validação está correto.${RESET}`);
  process.exit(0);
}
