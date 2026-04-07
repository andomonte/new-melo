// Script para validar correção do endpoint SEFAZ-AM
// Verifica se a URL foi corrigida corretamente no código

const fs = require('fs');
const path = require('path');

class EndpointCorrectionValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  // Validar se a URL foi corrigida no arquivo
  validateEndpointCorrection() {
    console.log('🔍 VALIDANDO CORREÇÃO DO ENDPOINT SEFAZ-AM');
    console.log('===========================================');
    console.log('');

    const filePath = path.join(this.projectRoot, 'src', 'utils', 'enviarCupomParaSefaz.ts');

    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // URLs esperadas
      const urlIncorreta = 'https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4';
      const urlCorreta = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';

      const hasIncorreta = content.includes(urlIncorreta);
      const hasCorreta = content.includes(urlCorreta);

      console.log('📋 Verificação no arquivo:', path.relative(this.projectRoot, filePath));
      console.log('');

      console.log('❌ URL Incorreta (sem /services/):');
      console.log(`   ${urlIncorreta}`);
      console.log(`   Presente no código: ${hasIncorreta ? '❌ SIM (PROBLEMA!)' : '✅ NÃO (OK)'}`);
      console.log('');

      console.log('✅ URL Correta (com /services/):');
      console.log(`   ${urlCorreta}`);
      console.log(`   Presente no código: ${hasCorreta ? '✅ SIM (CORRETO!)' : '❌ NÃO (PROBLEMA!)'}`);
      console.log('');

      // Verificar comentários explicativos
      const hasComment = content.includes('URL OFICIAL da SEFAZ-AM');
      console.log('📝 Documentação no código:');
      console.log(`   Comentários explicativos: ${hasComment ? '✅ Presentes' : '❌ Ausentes'}`);

      console.log('\n' + '='.repeat(50));
      console.log('📊 RESULTADO DA VALIDAÇÃO:');

      if (!hasIncorreta && hasCorreta && hasComment) {
        console.log('🎉 CORREÇÃO APLICADA COM SUCESSO!');
        console.log('   ✅ URL incorreta removida');
        console.log('   ✅ URL correta implementada');
        console.log('   ✅ Código documentado');
        console.log('');
        console.log('🚀 PRONTO PARA TESTE REAL!');
        console.log('   O erro 404 deve ser resolvido com certificados válidos.');
        return true;
      } else {
        console.log('❌ CORREÇÃO INCOMPLETA:');
        if (hasIncorreta) console.log('   - URL incorreta ainda presente');
        if (!hasCorreta) console.log('   - URL correta não encontrada');
        if (!hasComment) console.log('   - Documentação ausente');
        return false;
      }

    } catch (error) {
      console.log(`❌ Erro ao ler arquivo: ${error.message}`);
      return false;
    }
  }

  // Mostrar contexto da correção
  showCorrectionContext() {
    console.log('\n📖 CONTEXTO DA CORREÇÃO:');
    console.log('='.repeat(50));

    console.log('🔍 Problema identificado:');
    console.log('   Erro 404 "Requested resource not found!"');
    console.log('   Página Axis2 retornada pelo servidor');
    console.log('');

    console.log('🔧 Correção aplicada:');
    console.log('   De: /nfce-services/NFeAutorizacao4');
    console.log('   Para: /nfce-services/services/NfeAutorizacao4');
    console.log('   Adicionado: /services/ no caminho');
    console.log('');

    console.log('📚 Fonte da correção:');
    console.log('   docs/SEFAZ-AM-ENDPOINTS.md');
    console.log('   Documentação oficial SEFAZ-AM');
    console.log('');

    console.log('⚠️  Nota sobre testes:');
    console.log('   Erro EPROTO/SSL esperado sem certificados ICP-Brasil');
    console.log('   Teste real requer certificados válidos');
  }

  // Executar validação completa
  runValidation() {
    const success = this.validateEndpointCorrection();
    this.showCorrectionContext();

    console.log('\n' + '='.repeat(50));
    console.log('🎯 PRÓXIMOS PASSOS:');

    if (success) {
      console.log('1. ✅ Correção aplicada ao código');
      console.log('2. 🔐 Configure certificados ICP-Brasil válidos');
      console.log('3. 🧪 Teste emissão real com certificados');
      console.log('4. 📊 Monitore resposta SEFAZ-AM');
    } else {
      console.log('1. ❌ Complete a correção do endpoint');
      console.log('2. 🔍 Verifique novamente o arquivo');
      console.log('3. 📖 Consulte docs/SEFAZ-AM-ENDPOINTS.md');
    }

    return success;
  }
}

// Executar validação
async function main() {
  const validator = new EndpointCorrectionValidator();
  validator.runValidation();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}