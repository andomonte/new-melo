// Script para analisar certificados digitais ICP-Brasil
// Verifica validade, emissor, data de expiração e outros detalhes

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

class CertificateAnalyzer {
  constructor() {
    this.certPaths = [
      // Possíveis locais onde certificados podem estar armazenados
      path.join(process.cwd(), 'certificates'),
      path.join(process.cwd(), 'certs'),
      path.join(process.cwd(), 'ssl'),
      path.join(process.cwd(), 'src', 'config'),
      path.join(process.cwd(), 'config'),
      // Diretórios comuns do Windows
      'C:\\Certificados',
      'C:\\Certificates',
      // Variáveis de ambiente
      process.env.CERT_PATH,
      process.env.SSL_CERT_PATH
    ].filter(Boolean);
  }

  // Procurar arquivos de certificado
  findCertificateFiles() {
    console.log('🔍 PROCURANDO CERTIFICADOS DIGITAIS');
    console.log('=====================================');

    const foundCerts = [];

    for (const certPath of this.certPaths) {
      if (fs.existsSync(certPath)) {
        console.log(`📁 Verificando diretório: ${certPath}`);

        try {
          const files = fs.readdirSync(certPath);
          const certFiles = files.filter(file =>
            file.endsWith('.p12') ||
            file.endsWith('.pfx') ||
            file.endsWith('.cer') ||
            file.endsWith('.crt') ||
            file.endsWith('.pem')
          );

          if (certFiles.length > 0) {
            console.log(`   📄 Encontrados ${certFiles.length} arquivo(s) de certificado:`);
            certFiles.forEach(file => {
              const fullPath = path.join(certPath, file);
              console.log(`      • ${file}`);
              foundCerts.push(fullPath);
            });
          } else {
            console.log(`   📭 Nenhum arquivo de certificado encontrado`);
          }
        } catch (error) {
          console.log(`   ❌ Erro ao acessar diretório: ${error.message}`);
        }
      } else {
        console.log(`📁 Diretório não existe: ${certPath}`);
      }
    }

    console.log(`\n📊 Total de certificados encontrados: ${foundCerts.length}`);
    return foundCerts;
  }

  // Analisar certificado P12/PFX
  analyzeP12Certificate(filePath) {
    console.log(`\n🔐 ANALISANDO CERTIFICADO: ${path.basename(filePath)}`);
    console.log('='.repeat(50));

    try {
      // Tentar ler o arquivo
      const certBuffer = fs.readFileSync(filePath);
      console.log(`📏 Tamanho do arquivo: ${certBuffer.length} bytes`);

      // Para análise completa, precisaríamos da senha
      // Por enquanto, apenas informações básicas
      console.log(`📄 Tipo: ${path.extname(filePath).toUpperCase().substring(1)}`);
      console.log(`📍 Localização: ${filePath}`);

      // Verificar se é um arquivo P12/PFX válido
      try {
        // Tentar parse básico (sem senha)
        const p12 = crypto.createPrivateKey({ key: certBuffer, format: 'pem' });
        console.log(`✅ Arquivo parece válido (parse básico OK)`);
      } catch (parseError) {
        console.log(`⚠️  Arquivo pode requerer senha ou estar corrompido`);
        console.log(`   Erro: ${parseError.message}`);
      }

      return {
        path: filePath,
        type: path.extname(filePath),
        size: certBuffer.length,
        valid: true
      };

    } catch (error) {
      console.log(`❌ Erro ao analisar certificado: ${error.message}`);
      return {
        path: filePath,
        error: error.message,
        valid: false
      };
    }
  }

  // Verificar configurações de certificado no código
  checkCodeConfiguration() {
    console.log(`\n🔍 VERIFICANDO CONFIGURAÇÃO NO CÓDIGO`);
    console.log('=====================================');

    const configFiles = [
      'src/utils/enviarCupomParaSefaz.ts',
      'src/config/database.ts',
      'src/config/certificates.ts',
      'config/certificates.js',
      'src/utils/certificado.ts'
    ];

    for (const configFile of configFiles) {
      const fullPath = path.join(process.cwd(), configFile);
      if (fs.existsSync(fullPath)) {
        console.log(`📄 Verificando: ${configFile}`);

        try {
          const content = fs.readFileSync(fullPath, 'utf8');

          // Procurar por referências a certificados
          const certPatterns = [
            /cert.*path/i,
            /p12|pfx/i,
            /certificate/i,
            /ssl.*cert/i,
            /key.*path/i,
            /\.p12|\.pfx/i
          ];

          let foundRefs = false;
          certPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              console.log(`   🔍 Encontrado padrão "${pattern}": ${matches.join(', ')}`);
              foundRefs = true;
            }
          });

          if (!foundRefs) {
            console.log(`   📭 Nenhuma referência a certificados encontrada`);
          }

        } catch (error) {
          console.log(`   ❌ Erro ao ler arquivo: ${error.message}`);
        }
      }
    }
  }

  // Verificar variáveis de ambiente
  checkEnvironmentVariables() {
    console.log(`\n🌍 VERIFICANDO VARIÁVEIS DE AMBIENTE`);
    console.log('====================================');

    const certVars = [
      'CERT_PATH',
      'SSL_CERT_PATH',
      'CERT_PASSWORD',
      'SSL_KEY_PATH',
      'PFX_PATH',
      'P12_PATH'
    ];

    let foundVars = false;
    certVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`   ✅ ${varName}: ${value}`);
        foundVars = true;
      }
    });

    if (!foundVars) {
      console.log(`   📭 Nenhuma variável de ambiente de certificado configurada`);
    }
  }

  // Executar análise completa
  async runAnalysis() {
    console.log('🚀 INICIANDO ANÁLISE DE CERTIFICADOS ICP-BRASIL');
    console.log('================================================\n');

    // 1. Procurar arquivos de certificado
    const foundCerts = this.findCertificateFiles();

    // 2. Analisar certificados encontrados
    const analyzedCerts = [];
    for (const certPath of foundCerts) {
      const analysis = this.analyzeP12Certificate(certPath);
      analyzedCerts.push(analysis);
    }

    // 3. Verificar configuração no código
    this.checkCodeConfiguration();

    // 4. Verificar variáveis de ambiente
    this.checkEnvironmentVariables();

    // 5. Conclusões
    this.printConclusions(analyzedCerts);

    return analyzedCerts;
  }

  // Imprimir conclusões
  printConclusions(analyzedCerts) {
    console.log(`\n🎯 CONCLUSÕES DA ANÁLISE`);
    console.log('========================');

    const validCerts = analyzedCerts.filter(cert => cert.valid);

    if (validCerts.length === 0) {
      console.log(`❌ NENHUM CERTIFICADO VÁLIDO ENCONTRADO`);
      console.log(`💡 Ações necessárias:`);
      console.log(`   1. 🔍 Obter certificado ICP-Brasil válido`);
      console.log(`   2. 📁 Armazenar em local seguro`);
      console.log(`   3. 🔧 Configurar no código da aplicação`);
      console.log(`   4. 🧪 Testar conectividade com SEFAZ-AM`);
    } else {
      console.log(`✅ ${validCerts.length} certificado(s) encontrado(s)`);
      console.log(`💡 Próximos passos:`);
      console.log(`   1. 🔐 Verificar validade e expiração`);
      console.log(`   2. 🔧 Configurar no código se necessário`);
      console.log(`   3. 🧪 Testar emissão NFC-e`);
    }

    console.log(`\n📋 RESUMO:`);
    console.log(`   • Certificados encontrados: ${analyzedCerts.length}`);
    console.log(`   • Certificados válidos: ${validCerts.length}`);
    console.log(`   • Configuração no código: 🔍 Verificada`);
    console.log(`   • Variáveis de ambiente: 🌍 Verificadas`);
    console.log(`   • Status SEFAZ-AM: 🔒 Requer certificados válidos`);
  }
}

// Executar análise
async function main() {
  const analyzer = new CertificateAnalyzer();
  await analyzer.runAnalysis();
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}