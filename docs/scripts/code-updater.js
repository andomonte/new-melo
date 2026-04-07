// Script para atualizar código automaticamente com correções NFC-e
// Aplica as correções necessárias nos arquivos do projeto

const fs = require('fs');
const path = require('path');

class CodeUpdater {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  // Atualizar endpoint no arquivo de envio
  updateEndpoint() {
    console.log('🔗 ATUALIZANDO ENDPOINT SEFAZ-AM');
    console.log('-'.repeat(40));

    const filePath = path.join(this.projectRoot, 'src', 'utils', 'enviarCupomParaSefaz.ts');

    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Procurar pela URL incorreta
    const oldUrl = 'https://homologacao.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
    const newUrl = 'https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4';

    if (content.includes(oldUrl)) {
      content = content.replace(oldUrl, newUrl);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('✅ Endpoint atualizado com sucesso');
      console.log(`   ${oldUrl}`);
      console.log(`   ↓`);
      console.log(`   ${newUrl}`);
      return true;
    } else if (content.includes(newUrl)) {
      console.log('✅ Endpoint já está correto');
      return true;
    } else {
      console.log('⚠️  URL não encontrada no arquivo');
      return false;
    }
  }

  // Verificar se envelope corrigido existe
  checkCorrectedEnvelope() {
    console.log('\n📄 VERIFICANDO ENVELOPE CORRIGIDO');
    console.log('-'.repeat(40));

    const envelopePath = path.join(__dirname, 'envelope-final-pronto.xml');

    if (fs.existsSync(envelopePath)) {
      const stats = fs.statSync(envelopePath);
      console.log('✅ Envelope corrigido encontrado');
      console.log(`📏 Tamanho: ${stats.size} bytes`);
      return true;
    } else {
      console.log('❌ Envelope corrigido não encontrado');
      console.log('💡 Execute: node envelope-finalizer.js');
      return false;
    }
  }

  // Criar backup dos arquivos modificados
  createBackup() {
    console.log('\n💾 CRIANDO BACKUP DOS ARQUIVOS');
    console.log('-'.repeat(40));

    const filesToBackup = [
      'src/utils/enviarCupomParaSefaz.ts',
      'src/utils/gerarXmlCupomFiscal.ts'
    ];

    filesToBackup.forEach(file => {
      const fullPath = path.join(this.projectRoot, file);

      if (fs.existsSync(fullPath)) {
        const backupPath = fullPath + '.backup';
        fs.copyFileSync(fullPath, backupPath);
        console.log(`✅ Backup criado: ${file}.backup`);
      } else {
        console.log(`⚠️  Arquivo não encontrado: ${file}`);
      }
    });
  }

  // Executar atualização completa
  runUpdate() {
    console.log('🚀 ATUALIZANDO CÓDIGO COM CORREÇÕES NFC-E');
    console.log('='.repeat(60));

    // Criar backups
    this.createBackup();

    // Verificar envelope
    const envelopeOk = this.checkCorrectedEnvelope();

    // Atualizar endpoint
    const endpointOk = this.updateEndpoint();

    console.log('\n📋 RESUMO DA ATUALIZAÇÃO:');
    console.log('-'.repeat(40));

    if (envelopeOk && endpointOk) {
      console.log('✅ Atualização concluída com sucesso!');
      console.log('');
      console.log('🔄 PRÓXIMOS PASSOS:');
      console.log('1. Teste a emissão de NFC-e');
      console.log('2. Verifique se o erro 400 foi resolvido');
      console.log('3. Monitore os logs da SEFAZ-AM');
      console.log('');
      console.log('🛠️  SCRIPTS DE DIAGNÓSTICO DISPONÍVEIS:');
      console.log('   node soap-tester.js envelope-final-pronto.xml');
      console.log('   node error-400-investigator.js');
      console.log('   node final-report.js');

      return true;
    } else {
      console.log('⚠️  Algumas atualizações não foram aplicadas');
      console.log('🔍 Verifique os logs acima para detalhes');
      return false;
    }
  }
}

// Função principal
function main() {
  const updater = new CodeUpdater();
  updater.runUpdate();
}

// Executar
if (require.main === module) {
  main();
}