/**
 * 🧪 Test Runner Automatizado - Módulo Clientes
 * Sistema Melo - Quality Assurance
 *
 * Este script executa testes automatizados do plano de testes
 * para validar schemas, APIs e lógica de negócio.
 */

import { cadastroClientesSchema } from '../../src/data/clientes/clientesSchema.js';
import { z } from 'zod';

// ========================================
// UTILITÁRIOS DE TESTE
// ========================================

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(
  id: string,
  name: string,
  status: 'PASS' | 'FAIL' | 'SKIP',
  message?: string,
  error?: string,
) {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${emoji} ${id}: ${name} - ${status}`);
  if (message) console.log(`   📝 ${message}`);
  if (error) console.log(`   🔴 ${error}`);

  results.push({ id, name, status, message, error });
}

// ========================================
// SEÇÃO 2: TESTES DE VALIDAÇÃO DE SCHEMA
// ========================================

console.log('\n🔍 ========================================');
console.log('📊 INICIANDO TESTES DE VALIDAÇÃO DE SCHEMA');
console.log('========================================\n');

// CT 2.1: CPF/CNPJ Vazio
try {
  const dadosTeste = {
    cpfcgc: '', // VAZIO
    nome: 'Teste',
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.1',
    'Validar CPF/CNPJ Vazio',
    'FAIL',
    'Schema NÃO validou corretamente - deveria rejeitar CPF/CNPJ vazio',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const cpfError = error.errors.find((e) => e.path[0] === 'cpfcgc');
    if (cpfError && cpfError.message === 'Campo CPF/CNPJ é obrigatório.') {
      logTest(
        'CT 2.1',
        'Validar CPF/CNPJ Vazio',
        'PASS',
        'Erro correto: "Campo CPF/CNPJ é obrigatório."',
      );
    } else {
      logTest(
        'CT 2.1',
        'Validar CPF/CNPJ Vazio',
        'FAIL',
        'Mensagem de erro incorreta',
        JSON.stringify(cpfError),
      );
    }
  }
}

// CT 2.4: Nome Vazio
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: '', // VAZIO
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.4',
    'Validar Nome Vazio',
    'FAIL',
    'Schema NÃO validou - deveria rejeitar nome vazio',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const nomeError = error.errors.find((e) => e.path[0] === 'nome');
    if (nomeError && nomeError.message === 'Campo nome é obrigatório.') {
      logTest(
        'CT 2.4',
        'Validar Nome Vazio',
        'PASS',
        'Erro correto: "Campo nome é obrigatório."',
      );
    } else {
      logTest(
        'CT 2.4',
        'Validar Nome Vazio',
        'FAIL',
        'Mensagem de erro incorreta',
        JSON.stringify(nomeError),
      );
    }
  }
}

// CT 2.5: CEP Vazio
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste',
    cep: '', // VAZIO
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.5',
    'Validar CEP Vazio',
    'FAIL',
    'Schema NÃO validou - deveria rejeitar CEP vazio',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const cepError = error.errors.find((e) => e.path[0] === 'cep');
    if (cepError && cepError.message === 'Campo CEP é obrigatório.') {
      logTest(
        'CT 2.5',
        'Validar CEP Vazio',
        'PASS',
        'Erro correto: "Campo CEP é obrigatório."',
      );
    } else {
      logTest(
        'CT 2.5',
        'Validar CEP Vazio',
        'FAIL',
        'Mensagem de erro incorreta',
        JSON.stringify(cepError),
      );
    }
  }
}

// CT 2.19: Limite Negativo
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste',
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: -1000, // NEGATIVO
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.19',
    'Validar Limite Negativo',
    'FAIL',
    'Schema NÃO validou - deveria rejeitar limite negativo',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const limiteError = error.errors.find((e) => e.path[0] === 'limite');
    if (limiteError) {
      logTest(
        'CT 2.19',
        'Validar Limite Negativo',
        'PASS',
        `Erro detectado: ${limiteError.message}`,
      );
    } else {
      logTest(
        'CT 2.19',
        'Validar Limite Negativo',
        'FAIL',
        'Erro não detectado no campo limite',
      );
    }
  }
}

// ========================================
// SEÇÃO 2.2: TESTES DE REFINE
// ========================================

console.log('\n🔍 ========================================');
console.log('📊 TESTES DE LÓGICA REFINE');
console.log('========================================\n');

// CT 2.20: IE NÃO Isento com Campo Vazio
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste',
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: false, iest: '' }, // NÃO ISENTO MAS VAZIO
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.20',
    'Validar Refine - IE NÃO Isento Vazio',
    'FAIL',
    'Schema NÃO validou - refine() deveria rejeitar',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const ieError = error.errors.find((e) => e.path.includes('iest'));
    if (
      ieError &&
      ieError.message.includes('Inscrição Estadual é obrigatório')
    ) {
      logTest(
        'CT 2.20',
        'Validar Refine - IE NÃO Isento Vazio',
        'PASS',
        'Refine funcionando: "Campo Inscrição Estadual é obrigatório quando Isento IE está desmarcado."',
      );
    } else {
      logTest(
        'CT 2.20',
        'Validar Refine - IE NÃO Isento Vazio',
        'FAIL',
        'Mensagem de refine incorreta',
        JSON.stringify(ieError),
      );
    }
  }
}

// CT 2.21: IM NÃO Isento com Campo Vazio
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste',
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: false, imun: '' }, // NÃO ISENTO MAS VAZIO
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.21',
    'Validar Refine - IM NÃO Isento Vazio',
    'FAIL',
    'Schema NÃO validou - refine() deveria rejeitar',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const imError = error.errors.find((e) => e.path.includes('imun'));
    if (
      imError &&
      imError.message.includes('Inscrição Municipal é obrigatório')
    ) {
      logTest(
        'CT 2.21',
        'Validar Refine - IM NÃO Isento Vazio',
        'PASS',
        'Refine funcionando corretamente',
      );
    } else {
      logTest(
        'CT 2.21',
        'Validar Refine - IM NÃO Isento Vazio',
        'FAIL',
        'Mensagem de refine incorreta',
        JSON.stringify(imError),
      );
    }
  }
}

// CT 2.23: Aceitar Atraso SIM com Dias Vazio
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste',
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: true }, // MARCADO MAS SEM DIAS
    icms: 'N',
    mesmoEndereco: true,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.23',
    'Validar Refine - Atraso SIM sem Dias',
    'FAIL',
    'Schema NÃO validou - refine() deveria rejeitar',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const atrasoError = error.errors.find((e) => e.path.includes('atraso'));
    if (
      atrasoError &&
      atrasoError.message.includes('Dias em Atraso é obrigatório')
    ) {
      logTest(
        'CT 2.23',
        'Validar Refine - Atraso SIM sem Dias',
        'PASS',
        'Refine funcionando corretamente',
      );
    } else {
      logTest(
        'CT 2.23',
        'Validar Refine - Atraso SIM sem Dias',
        'FAIL',
        'Mensagem de refine incorreta',
        JSON.stringify(atrasoError),
      );
    }
  }
}

// ========================================
// SEÇÃO 2.3: TESTES DE SUPERREFINE
// ========================================

console.log('\n🔍 ========================================');
console.log('📊 TESTES DE SUPERREFINE - ENDEREÇO COBRANÇA');
console.log('========================================\n');

// CT 2.25: Endereço Cobrança Diferente com CEP Vazio
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste',
    cep: '69000-000',
    ender: 'Rua Teste',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: false, // ENDEREÇO DIFERENTE
    // cepcobr VAZIO - deveria dar erro
    endercobr: 'Rua Cobrança',
    ufcobr: 'AM',
    cidadecobr: 'Manaus',
    bairrocobr: 'Centro',
    codpaiscobr: 1058,
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.25',
    'Validar SuperRefine - CEP Cobrança Vazio',
    'FAIL',
    'Schema NÃO validou - superRefine() deveria rejeitar',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    const cepCobrError = error.errors.find((e) => e.path[0] === 'cepcobr');
    if (
      cepCobrError &&
      cepCobrError.message === 'Campo CEP cobrança é obrigatório.'
    ) {
      logTest(
        'CT 2.25',
        'Validar SuperRefine - CEP Cobrança Vazio',
        'PASS',
        'SuperRefine funcionando: "Campo CEP cobrança é obrigatório."',
      );
    } else {
      logTest(
        'CT 2.25',
        'Validar SuperRefine - CEP Cobrança Vazio',
        'FAIL',
        'Mensagem de superRefine incorreta',
        JSON.stringify(cepCobrError),
      );
    }
  }
}

// CT 2.31: Endereço Cobrança com "Mesmo Endereço" Marcado (Positivo)
try {
  const dadosTeste = {
    cpfcgc: '12345678900',
    nome: 'Teste Cliente',
    cep: '69000-000',
    ender: 'Rua Principal',
    uf: 'AM',
    cidade: 'Manaus',
    bairro: 'Centro',
    codpais: 1058,
    tipocliente: 'DISTRIBUIDOR',
    sit_tributaria: 1,
    imun: { isentoIm: true },
    iest: { isentoIe: true },
    isuframa: { isentoSuf: true },
    claspgto: 'A',
    faixafin: '1',
    atraso: { aceitarAtraso: false },
    icms: 'N',
    mesmoEndereco: true, // MESMO ENDEREÇO - campos de cobrança não são obrigatórios
    // Campos de cobrança vazios/undefined - não deveria dar erro
    prvenda: '1',
    kickback: 0,
    bloquear_preco: 'N',
    limite: 0,
  };

  cadastroClientesSchema.parse(dadosTeste);
  logTest(
    'CT 2.31',
    'Validar SuperRefine - Mesmo Endereço Marcado',
    'PASS',
    'Schema validou corretamente quando mesmoEndereco=true',
  );
} catch (error) {
  if (error instanceof z.ZodError) {
    logTest(
      'CT 2.31',
      'Validar SuperRefine - Mesmo Endereço Marcado',
      'FAIL',
      'SuperRefine NÃO deveria exigir campos de cobrança quando mesmoEndereco=true',
      JSON.stringify(error.errors),
    );
  }
}

// ========================================
// RESUMO DOS TESTES
// ========================================

console.log('\n\n📊 ========================================');
console.log('🎯 RESUMO DA EXECUÇÃO DE TESTES');
console.log('========================================\n');

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const skipped = results.filter((r) => r.status === 'SKIP').length;
const total = results.length;

console.log(`✅ PASS: ${passed}/${total}`);
console.log(`❌ FAIL: ${failed}/${total}`);
console.log(`⏭️  SKIP: ${skipped}/${total}`);
console.log(`\n📈 Taxa de Sucesso: ${((passed / total) * 100).toFixed(2)}%\n`);

// Testes que falharam
if (failed > 0) {
  console.log('❌ TESTES QUE FALHARAM:\n');
  results
    .filter((r) => r.status === 'FAIL')
    .forEach((r) => {
      console.log(`   ${r.id}: ${r.name}`);
      if (r.message) console.log(`      📝 ${r.message}`);
      if (r.error) console.log(`      🔴 ${r.error}`);
    });
}

console.log('\n========================================\n');

export { results };
