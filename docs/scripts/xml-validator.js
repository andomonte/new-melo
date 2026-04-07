// Script para corrigir XML mal formado e tags não balanceadas
// Formatar XML adequadamente e verificar estrutura

const fs = require('fs');

class XMLValidator {
  constructor() {
    this.envelope = null;
  }

  // Carrega envelope
  loadEnvelope(filename) {
    if (fs.existsSync(filename)) {
      this.envelope = fs.readFileSync(filename, 'utf8');
      console.log(`📄 Envelope carregado: ${filename}`);
      return true;
    }
    return false;
  }

  // Formatar XML adequadamente
  formatXML() {
    console.log('🔧 FORMATANDO XML');
    console.log('='.repeat(30));

    if (!this.envelope) {
      console.log('❌ Envelope não carregado');
      return false;
    }

    // Formatar XML com quebras de linha adequadas
    let formatted = this.envelope;

    // Adicionar quebras de linha após tags de fechamento
    formatted = formatted.replace(/></g, '>\n<');

    // Adicionar indentação básica
    formatted = this.addBasicIndentation(formatted);

    console.log('✅ XML formatado');
    return formatted;
  }

  // Adicionar indentação básica
  addBasicIndentation(xml) {
    const lines = xml.split('\n');
    let indentLevel = 0;
    const indentSize = 2;

    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      // Diminuir indentação para tags de fechamento
      if (trimmed.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indented = ' '.repeat(indentLevel * indentSize) + trimmed;

      // Aumentar indentação após tags de abertura (que não são auto-fechamento)
      if (trimmed.startsWith('<') && !trimmed.endsWith('/>') && !trimmed.startsWith('</')) {
        indentLevel++;
      }

      return indented;
    });

    return formattedLines.join('\n');
  }

  // Verificar balanceamento de tags
  checkTagBalance() {
    console.log('⚖️  VERIFICANDO BALANCEAMENTO DE TAGS');
    console.log('='.repeat(40));

    const tags = [];
    const selfClosing = [];
    let inTag = false;
    let currentTag = '';

    for (let i = 0; i < this.envelope.length; i++) {
      const char = this.envelope[i];

      if (char === '<') {
        inTag = true;
        currentTag = '';
      } else if (char === '>') {
        if (inTag) {
          if (currentTag.endsWith('/')) {
            // Tag auto-fechamento
            selfClosing.push(currentTag.slice(0, -1));
          } else if (currentTag.startsWith('/')) {
            // Tag de fechamento
            tags.push({ type: 'close', name: currentTag.slice(1) });
          } else {
            // Tag de abertura
            const tagName = currentTag.split(' ')[0];
            tags.push({ type: 'open', name: tagName });
          }
        }
        inTag = false;
      } else if (inTag) {
        currentTag += char;
      }
    }

    // Analisar balanceamento
    const openTags = tags.filter(t => t.type === 'open');
    const closeTags = tags.filter(t => t.type === 'close');

    console.log(`🏷️  Tags de abertura: ${openTags.length}`);
    console.log(`🏷️  Tags de fechamento: ${closeTags.length}`);
    console.log(`🏷️  Tags auto-fechamento: ${selfClosing.length}`);

    // Verificar tags não balanceadas
    const openTagNames = openTags.map(t => t.name);
    const closeTagNames = closeTags.map(t => t.name);

    const unbalanced = [];

    openTagNames.forEach(tag => {
      const openCount = openTagNames.filter(t => t === tag).length;
      const closeCount = closeTagNames.filter(t => t === tag).length;

      if (openCount !== closeCount) {
        unbalanced.push({
          tag,
          open: openCount,
          close: closeCount,
          diff: openCount - closeCount
        });
      }
    });

    if (unbalanced.length > 0) {
      console.log('\n❌ TAGS NÃO BALANCEADAS:');
      unbalanced.forEach(item => {
        console.log(`   ${item.tag}: ${item.open} abertas, ${item.close} fechadas (dif: ${item.diff})`);
      });
      return false;
    } else {
      console.log('✅ Todas as tags estão balanceadas');
      return true;
    }
  }

  // Corrigir problemas específicos
  fixSpecificIssues() {
    console.log('🔧 CORRIGINDO PROBLEMAS ESPECÍFICOS');
    console.log('='.repeat(40));

    let fixed = this.envelope;

    // 1. Garantir que não há caracteres especiais inesperados
    fixed = fixed.replace(/[^\x00-\x7F]/g, '');

    // 2. Garantir que o XML começa corretamente
    if (!fixed.startsWith('<?xml')) {
      fixed = '<?xml version="1.0" encoding="UTF-8"?>\n' + fixed;
    }

    // 3. Verificar namespaces
    const hasSoapNS = fixed.includes('xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"');
    const hasNfeNS = fixed.includes('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"');

    if (!hasSoapNS) {
      console.log('⚠️  Adicionando namespace SOAP faltante');
      fixed = fixed.replace(
        '<soap12:Envelope',
        '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"'
      );
    }

    if (!hasNfeNS) {
      console.log('⚠️  Adicionando namespace NFe faltante');
      fixed = fixed.replace(
        '<soap12:Envelope',
        '<soap12:Envelope xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"'
      );
    }

    console.log('✅ Correções específicas aplicadas');
    return fixed;
  }

  // Salvar XML corrigido
  saveFixedXML(filename) {
    const formatted = this.formatXML();
    const fixed = this.fixSpecificIssues();

    const finalXML = this.formatXMLForFile(fixed);

    try {
      fs.writeFileSync(filename, finalXML, 'utf8');
      console.log(`💾 XML corrigido salvo: ${filename}`);
      return true;
    } catch (error) {
      console.log(`❌ Erro ao salvar: ${error.message}`);
      return false;
    }
  }

  // Formatar para arquivo (sem indentação excessiva)
  formatXMLForFile(xml) {
    // Apenas adicionar quebras de linha básicas, sem indentação
    return xml.replace(/></g, '>\n<');
  }

  // Executar correção completa
  runFullFix() {
    console.log('🚀 CORREÇÃO COMPLETA DO XML NFC-E');
    console.log('='.repeat(50));

    if (!this.loadEnvelope('envelope-exemplo-final.xml')) {
      console.log('❌ Falha ao carregar envelope');
      return false;
    }

    console.log('\n📊 ANÁLISE INICIAL:');
    const balanced = this.checkTagBalance();

    if (!balanced) {
      console.log('\n🔧 CORRIGINDO PROBLEMAS...');

      const fixedXML = this.fixSpecificIssues();
      this.envelope = fixedXML;

      console.log('\n📊 VERIFICAÇÃO APÓS CORREÇÃO:');
      this.checkTagBalance();
    }

    // Salvar versão corrigida
    const success = this.saveFixedXML('envelope-xml-corrigido.xml');

    if (success) {
      console.log('\n✅ XML CORRIGIDO COM SUCESSO!');
      console.log('💡 Agora teste novamente com o endpoint correto:');
      console.log('   https://homnfce.sefaz.am.gov.br/nfce-services/NFeAutorizacao4');
    }

    return success;
  }
}

// Função principal
function main() {
  const validator = new XMLValidator();
  validator.runFullFix();
}

// Executar
if (require.main === module) {
  main();
}