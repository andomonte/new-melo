/**
 * 🧪 TESTES DE VALIDAÇÃO - TAMANHO MÁXIMO DE CAMPOS
 *
 * Casos de Teste para validar restrições .max() adicionadas ao schema
 *
 * Objetivo: Prevenir erro PostgreSQL 22001 (string too long)
 * Base: Limites da tabela dbclien conforme schema.prisma
 */

import { cadastroClientesSchema } from '@/data/clientes/clientesSchema';
import { z } from 'zod';

console.log('🔍 ========================================');
console.log('📊 TESTES DE VALIDAÇÃO - TAMANHO MÁXIMO');
console.log('========================================\n');

// Helper para criar payload base válido
const criarPayloadBase = () => ({
  cpfcgc: '12345678901',
  nome: 'Cliente Teste',
  cep: '69000000',
  ender: 'Rua Teste',
  numero: '123',
  uf: 'AM',
  cidade: 'Manaus',
  bairro: 'Centro',
  codpais: 1058,
  tipocliente: 'F',
  sit_tributaria: 1,
  imun: { isentoIm: true, imun: undefined },
  iest: { isentoIe: true, iest: undefined },
  isuframa: { isentoSuf: true, isuframa: undefined },
  claspgto: 'A',
  faixafin: 'A',
  atraso: { aceitarAtraso: false, atraso: undefined },
  icms: 'N',
  mesmoEndereco: true,
  cepcobr: undefined,
  endercobr: undefined,
  numcobr: undefined,
  ufcobr: undefined,
  cidadecobr: undefined,
  bairrocobr: undefined,
  codpaiscobr: undefined,
  prvenda: 'T',
  kickback: 0,
  bloquear_preco: 'S',
  limite: 1000,
});

// Contador de resultados
let passCount = 0;
let failCount = 0;
let totalTests = 0;

// Helper para executar teste
function testarCampo(
  nomeCampo: string,
  valorInvalido: any,
  tamanhoMaximo: number,
  caminhoErro?: string[],
) {
  totalTests++;
  const ctNumber = totalTests.toString().padStart(2, '0');
  const payload = criarPayloadBase();

  // Aplicar valor no caminho correto (pode ser aninhado, ex: imun.imun)
  if (caminhoErro && caminhoErro.length > 1) {
    (payload as any)[caminhoErro[0]][caminhoErro[1]] = valorInvalido;
  } else {
    (payload as any)[nomeCampo] = valorInvalido;
  }

  try {
    cadastroClientesSchema.parse(payload);
    console.log(
      `❌ CT MAX-${ctNumber}: ${nomeCampo} > ${tamanhoMaximo} chars - FAIL`,
    );
    console.log(
      `   📝 Schema NÃO rejeitou string com ${valorInvalido.length} caracteres\n`,
    );
    failCount++;
    return false;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const caminhoEsperado = caminhoErro || [nomeCampo];
      const erroEncontrado = error.errors.find(
        (e) => JSON.stringify(e.path) === JSON.stringify(caminhoEsperado),
      );

      if (
        erroEncontrado &&
        (erroEncontrado.message.includes('não pode ter mais de') ||
          erroEncontrado.message.includes('deve ter') ||
          erroEncontrado.message.includes('exatamente'))
      ) {
        console.log(
          `✅ CT MAX-${ctNumber}: ${nomeCampo} > ${tamanhoMaximo} chars - PASS`,
        );
        console.log(`   📝 Erro correto: "${erroEncontrado.message}"\n`);
        passCount++;
        return true;
      }
    }

    console.log(
      `❌ CT MAX-${ctNumber}: ${nomeCampo} > ${tamanhoMaximo} chars - FAIL`,
    );
    console.log(`   📝 Erro inesperado ou mensagem incorreta\n`);
    failCount++;
    return false;
  }
}

console.log('🧪 TESTES DE CAMPOS PRINCIPAIS\n');

// CT MAX-01: CPF/CNPJ com 21 caracteres (limite: 20)
testarCampo('cpfcgc', 'A'.repeat(21), 20);

// CT MAX-02: Nome com 41 caracteres (limite: 40)
testarCampo('nome', 'A'.repeat(41), 40);

// CT MAX-03: CEP com 10 caracteres (limite: 9)
testarCampo('cep', '1'.repeat(10), 9);

// CT MAX-04: Logradouro com 101 caracteres (limite: 100)
testarCampo('ender', 'R'.repeat(101), 100);

// CT MAX-05: Número com 61 caracteres (limite: 60)
testarCampo('numero', '1'.repeat(61), 60);

// CT MAX-06: UF com 3 caracteres (limite: 2)
testarCampo('uf', 'AMZ', 2);

// CT MAX-07: Cidade com 101 caracteres (limite: 100)
testarCampo('cidade', 'M'.repeat(101), 100);

// CT MAX-08: Bairro com 101 caracteres (limite: 100)
testarCampo('bairro', 'C'.repeat(101), 100);

console.log('\n🧪 TESTES DE CAMPOS DE ISENÇÃO\n');

// CT MAX-09: IE com 21 caracteres (limite: 20)
const payloadIE = criarPayloadBase();
payloadIE.iest.isentoIe = false;
(payloadIE.iest as any).iest = 'I'.repeat(21);
totalTests++;
try {
  cadastroClientesSchema.parse(payloadIE);
  console.log(`❌ CT MAX-09: iest > 20 chars - FAIL`);
  console.log(`   📝 Schema NÃO rejeitou IE com 21 caracteres\n`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erroIE = error.errors.find((e) => e.path.includes('iest'));
    if (erroIE && erroIE.message.includes('não pode ter mais de')) {
      console.log(`✅ CT MAX-09: iest > 20 chars - PASS`);
      console.log(`   📝 Erro correto: "${erroIE.message}"\n`);
      passCount++;
    } else {
      console.log(`❌ CT MAX-09: iest > 20 chars - FAIL`);
      console.log(`   📝 Erro inesperado\n`);
      failCount++;
    }
  }
}

// CT MAX-10: IM com 21 caracteres (limite: 20)
const payloadIM = criarPayloadBase();
payloadIM.imun.isentoIm = false;
(payloadIM.imun as any).imun = 'M'.repeat(21);
totalTests++;
try {
  cadastroClientesSchema.parse(payloadIM);
  console.log(`❌ CT MAX-10: imun > 20 chars - FAIL`);
  console.log(`   📝 Schema NÃO rejeitou IM com 21 caracteres\n`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erroIM = error.errors.find((e) => e.path.includes('imun'));
    if (erroIM && erroIM.message.includes('não pode ter mais de')) {
      console.log(`✅ CT MAX-10: imun > 20 chars - PASS`);
      console.log(`   📝 Erro correto: "${erroIM.message}"\n`);
      passCount++;
    } else {
      console.log(`❌ CT MAX-10: imun > 20 chars - FAIL`);
      console.log(`   📝 Erro inesperado\n`);
      failCount++;
    }
  }
}

// CT MAX-11: Suframa com 21 caracteres (limite: 20)
const payloadSUF = criarPayloadBase();
payloadSUF.isuframa.isentoSuf = false;
(payloadSUF.isuframa as any).isuframa = 'S'.repeat(21);
totalTests++;
try {
  cadastroClientesSchema.parse(payloadSUF);
  console.log(`❌ CT MAX-11: isuframa > 20 chars - FAIL`);
  console.log(`   📝 Schema NÃO rejeitou Suframa com 21 caracteres\n`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erroSUF = error.errors.find((e) => e.path.includes('isuframa'));
    if (erroSUF && erroSUF.message.includes('não pode ter mais de')) {
      console.log(`✅ CT MAX-11: isuframa > 20 chars - PASS`);
      console.log(`   📝 Erro correto: "${erroSUF.message}"\n`);
      passCount++;
    } else {
      console.log(`❌ CT MAX-11: isuframa > 20 chars - FAIL`);
      console.log(`   📝 Erro inesperado\n`);
      failCount++;
    }
  }
}

console.log('\n🧪 TESTES DE CAMPOS SELECT (1 caractere)\n');

// CT MAX-12: Classificação Pagamento com 2 caracteres (limite: 1)
testarCampo('claspgto', 'AB', 1);

// CT MAX-13: Faixa Financeira com 3 caracteres (limite: 2)
testarCampo('faixafin', 'ABC', 2);

// CT MAX-14: ICMS com 2 caracteres (limite: 1)
testarCampo('icms', 'SN', 1);

// CT MAX-15: Preço Venda com 2 caracteres (limite: 1)
testarCampo('prvenda', 'AB', 1);

// CT MAX-16: Bloquear Preço com 2 caracteres (limite: 1)
testarCampo('bloquear_preco', 'SN', 1);

console.log('\n🧪 TESTES DE ENDEREÇO DE COBRANÇA\n');

// Criar payload com endereço de cobrança diferente
const payloadCobranca = () => {
  const p = criarPayloadBase();
  p.mesmoEndereco = false;
  return p;
};

// CT MAX-17: CEP Cobrança com 10 caracteres (limite: 9)
const p17 = payloadCobranca();
(p17 as any).cepcobr = '1'.repeat(10);
totalTests++;
try {
  cadastroClientesSchema.parse(p17);
  console.log(`❌ CT MAX-17: cepcobr > 9 chars - FAIL`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erro = error.errors.find((e) => e.path.includes('cepcobr'));
    if (erro && erro.message.includes('não pode ter mais de')) {
      console.log(`✅ CT MAX-17: cepcobr > 9 chars - PASS`);
      passCount++;
    } else {
      console.log(`❌ CT MAX-17: cepcobr > 9 chars - FAIL (erro inesperado)`);
      failCount++;
    }
  }
}

// CT MAX-18: Logradouro Cobrança com 101 caracteres (limite: 100)
const p18 = payloadCobranca();
(p18 as any).endercobr = 'E'.repeat(101);
totalTests++;
try {
  cadastroClientesSchema.parse(p18);
  console.log(`❌ CT MAX-18: endercobr > 100 chars - FAIL`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erro = error.errors.find((e) => e.path.includes('endercobr'));
    if (erro && erro.message.includes('não pode ter mais de')) {
      console.log(`✅ CT MAX-18: endercobr > 100 chars - PASS`);
      passCount++;
    } else {
      console.log(
        `❌ CT MAX-18: endercobr > 100 chars - FAIL (erro inesperado)`,
      );
      failCount++;
    }
  }
}

// CT MAX-19: UF Cobrança com 3 caracteres (limite: 2)
const p19 = payloadCobranca();
(p19 as any).ufcobr = 'AMZ';
totalTests++;
try {
  cadastroClientesSchema.parse(p19);
  console.log(`❌ CT MAX-19: ufcobr > 2 chars - FAIL`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erro = error.errors.find((e) => e.path.includes('ufcobr'));
    if (erro && erro.message.includes('deve ter 2 caracteres')) {
      console.log(`✅ CT MAX-19: ufcobr > 2 chars - PASS`);
      passCount++;
    } else {
      console.log(`❌ CT MAX-19: ufcobr > 2 chars - FAIL (erro inesperado)`);
      failCount++;
    }
  }
}

// CT MAX-20: Cidade Cobrança com 101 caracteres (limite: 100)
const p20 = payloadCobranca();
(p20 as any).cidadecobr = 'C'.repeat(101);
totalTests++;
try {
  cadastroClientesSchema.parse(p20);
  console.log(`❌ CT MAX-20: cidadecobr > 100 chars - FAIL`);
  failCount++;
} catch (error) {
  if (error instanceof z.ZodError) {
    const erro = error.errors.find((e) => e.path.includes('cidadecobr'));
    if (erro && erro.message.includes('não pode ter mais de')) {
      console.log(`✅ CT MAX-20: cidadecobr > 100 chars - PASS`);
      passCount++;
    } else {
      console.log(
        `❌ CT MAX-20: cidadecobr > 100 chars - FAIL (erro inesperado)`,
      );
      failCount++;
    }
  }
}

console.log('\n📊 ========================================');
console.log('🎯 RESUMO DA EXECUÇÃO DE TESTES');
console.log('========================================\n');

console.log(`✅ PASS: ${passCount}/${totalTests}`);
console.log(`❌ FAIL: ${failCount}/${totalTests}`);
console.log(`⏭️  SKIP: 0/${totalTests}\n`);

const successRate = ((passCount / totalTests) * 100).toFixed(2);
console.log(`📈 Taxa de Sucesso: ${successRate}%\n`);

console.log('========================================\n');

// Exit code para CI/CD
process.exit(failCount > 0 ? 1 : 0);
