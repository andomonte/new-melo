const fs = require('fs');

console.log('🧪 TESTE DEFINITIVO - NFe COM VALORES SIMPLES');
console.log('=============================================');

// Criar payload de teste com valores super simples
const payloadTeste = {
  dbclien: {
    nome: 'CLIENTE TESTE',
    documento: '12345678901',
    endereco: 'RUA TESTE, 123',
    bairro: 'CENTRO',
    cidade: 'MANAUS',
    estado: 'AM',
    cep: '69000000'
  },
  dbvenda: {
    id: 999999,
    desconto: 0,
    acrescimo: 0
  },
  dbitvenda: [
    {
      id: 1,
      codprod: 'P001',
      nome: 'PRODUTO TESTE 1',
      qtde: 1.0000,
      preco: 10.00,
      ncm: '12345678',
      unidade: 'UN',
      icms: { pICMS: 18.00, vICMS: 1.80, cstICMS: '00', baseICMS: 10.00 },
      ipi: { pIPI: 5.00, vIPI: 0.50 },
      pis: { pPIS: 1.65, vPIS: 0.17, cstPIS: '01' },
      cofins: { pCOFINS: 7.60, vCOFINS: 0.76, cstCOFINS: '01' },
      fcp: { vFCP: 0 }
    },
    {
      id: 2,
      codprod: 'P002',
      nome: 'PRODUTO TESTE 2',
      qtde: 2.0000,
      preco: 5.00,
      ncm: '87654321',
      unidade: 'UN',
      icms: { pICMS: 18.00, vICMS: 1.80, cstICMS: '00', baseICMS: 10.00 },
      ipi: { pIPI: 5.00, vIPI: 0.50 },
      pis: { pPIS: 1.65, vPIS: 0.16, cstPIS: '01' },
      cofins: { pCOFINS: 7.60, vCOFINS: 0.76, cstCOFINS: '01' },
      fcp: { vFCP: 0 }
    }
  ]
};

// Calcular totais esperados
const vProdTotal = 10.00 + 10.00; // 20.00
const vICMSTotal = 1.80 + 1.80;   // 3.60
const vIPITotal = 0.50 + 0.50;    // 1.00
const vPISTotal = 0.17 + 0.16;    // 0.33
const vCOFINSTotal = 0.76 + 0.76; // 1.52
const vNFTotal = vProdTotal + vICMSTotal + vIPITotal + vPISTotal + vCOFINSTotal; // 26.45

console.log('📊 TOTAIS ESPERADOS:');
console.log(`vProd: ${vProdTotal.toFixed(2)}`);
console.log(`vICMS: ${vICMSTotal.toFixed(2)}`);
console.log(`vIPI: ${vIPITotal.toFixed(2)}`);
console.log(`vPIS: ${vPISTotal.toFixed(2)}`);
console.log(`vCOFINS: ${vCOFINSTotal.toFixed(2)}`);
console.log(`vNF: ${vNFTotal.toFixed(2)}`);

// Salvar payload de teste
fs.writeFileSync('scripts/payload_teste_simples.json', JSON.stringify(payloadTeste, null, 2));

console.log('\n✅ Payload de teste salvo em scripts/payload_teste_simples.json');
console.log('\n🎯 PRÓXIMO PASSO:');
console.log('================');
console.log('1. Use este payload para gerar uma NFe com valores super simples');
console.log('2. Se ainda der rejeição 610, confirma que é bug da Sefaz AM');
console.log('3. Se passar, significa que há algo específico nos dados originais');

console.log('\n💡 VALORES ESCOLHIDOS:');
console.log('=====================');
console.log('- Valores redondos e simples (10.00, 5.00)');
console.log('- Quantidades inteiras (1, 2)');
console.log('- Impostos com valores que resultam em centavos simples');
console.log('- Total final: R$ 26,45 (valor fácil de validar)');

console.log('\n🔍 SE ESTE TESTE PASSAR:');
console.log('========================');
console.log('Significa que o problema está nos dados específicos da fatura atual,');
console.log('possivelmente em algum item com cálculo complexo que gera imprecisão microscópica.');

console.log('\n🔍 SE ESTE TESTE FALHAR:');
console.log('========================');
console.log('Confirma que é um bug da Sefaz AM ou problema sistêmico no código/configuração.');