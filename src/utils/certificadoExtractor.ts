import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

export interface CertificadoExtraido {
  certificadoKey: string;
  certificadoCrt: string;
  cadeiaCrt: string;
}

/**
 * Extrai certificado digital de um arquivo .pfx
 * @param pfxBuffer Buffer do arquivo .pfx
 * @param senha Senha do certificado
 * @returns Objeto com chave privada, certificado e cadeia
 */
export function extrairCertificado(pfxBuffer: Buffer, senha: string): CertificadoExtraido {
  try {
    console.log('Iniciando extração do certificado...');
    // Carregar PFX
    const pfxData = pfxBuffer.toString('binary');
    const p12Der = forge.util.createBuffer(pfxData);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

    console.log('PFX carregado com sucesso');

    // 🆕 Extrair chave privada - suportar múltiplos tipos de bag
    let chavePrivadaPem: string | null = null;
    
    // Tentar extrair de pkcs8ShroudedKeyBag (mais comum)
    const shroudedKeyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (shroudedKeyBags?.length && shroudedKeyBags[0]?.key) {
      chavePrivadaPem = forge.pki.privateKeyToPem(shroudedKeyBags[0].key);
      console.log('✅ Chave privada extraída de pkcs8ShroudedKeyBag (RSA/comum)');
    }
    
    // Se não encontrou, tentar keyBag (usado por alguns certificados modernos)
    if (!chavePrivadaPem) {
      const keyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
      if (keyBags?.length && keyBags[0]?.key) {
        chavePrivadaPem = forge.pki.privateKeyToPem(keyBags[0].key);
        console.log('✅ Chave privada extraída de keyBag (ECDSA/moderno)');
      }
    }
    
    if (!chavePrivadaPem) {
      throw new Error('Chave privada não encontrada no certificado (tentou pkcs8ShroudedKeyBag e keyBag)');
    }
    
    console.log('Chave privada extraída, tamanho:', chavePrivadaPem.length);

    // Extrair certificados
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    if (!certBags?.length) {
      throw new Error('Nenhum certificado encontrado');
    }

    const certificadosPem = certBags
      .filter(bag => bag.cert)
      .map(bag => forge.pki.certificateToPem(bag.cert!));

    console.log(`📋 Certificados encontrados no PFX: ${certificadosPem.length}`);

    // Separar certificado principal e cadeia
    const certificadoPrincipal = certificadosPem[0];
    const certificadosCadeia = certificadosPem.slice(1);
    
    // Tentar montar cadeia completa (AC intermediárias + AC raiz)
    let cadeiaCertificados = '';
    if (certificadosCadeia.length > 0) {
      cadeiaCertificados = certificadosCadeia.join('\n');
      console.log(`✅ Cadeia de certificados extraída: ${certificadosCadeia.length} certificado(s) intermediário(s)`);
      console.log(`   Tamanho total da cadeia: ${cadeiaCertificados.length} bytes`);
    } else {
      console.warn('⚠️ Nenhuma cadeia de certificados encontrada no PFX');
      console.log('💡 Isto é normal para alguns certificados modernos (A1 sem intermediárias)');
      console.log('💡 A conexão HTTPS com SEFAZ funcionará sem a cadeia na maioria dos casos');
    }

    console.log('✅ Certificado principal extraído, tamanho:', certificadoPrincipal.length);

    return {
      certificadoKey: chavePrivadaPem,
      certificadoCrt: certificadoPrincipal,
      cadeiaCrt: cadeiaCertificados || '' // Retornar string vazia se não houver cadeia
    };
  } catch (error) {
    console.error('Erro ao extrair certificado:', error);
    throw new Error(`Falha ao extrair certificado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Extrai o CNPJ do certificado digital ICP-Brasil
 * Suporta certificados e-CNPJ A1/A3 (RSA, ECDSA, etc)
 * @param certificadoPem Certificado em formato PEM
 * @returns CNPJ extraído do certificado
 */
export function extrairCNPJDoCertificado(certificadoPem: string): string | null {
  try {
    console.log('🔍 Tentando extrair CNPJ do certificado...');
    const cert = forge.pki.certificateFromPem(certificadoPem);
    
    // 1️⃣ Tentar extrair do Subject Alternative Name (SAN) - onde geralmente fica em e-CNPJ
    const extensions = cert.extensions || [];
    for (const ext of extensions) {
      if (ext.name === 'subjectAltName' || ext.id === '2.5.29.17') {
        console.log('📋 Encontrou extensão subjectAltName:', JSON.stringify(ext, null, 2));
        const altNames = (ext as any).altNames || [];
        for (const altName of altNames) {
          // OtherName pode conter o CNPJ
          if (altName.type === 0 && altName.value) {
            const valor = String(altName.value);
            const cnpjMatch = valor.match(/\d{14}/);
            if (cnpjMatch) {
              console.log('✅ CNPJ encontrado em SAN/OtherName:', cnpjMatch[0]);
              return cnpjMatch[0];
            }
          }
        }
      }
    }
    
    // 2️⃣ Tentar extrair do serialNumber do Subject (padrão ICP-Brasil para e-CNPJ)
    const subject = cert.subject.attributes;
    console.log('📋 Atributos do subject:', subject.map(attr => `${attr.name || attr.shortName}: ${attr.value}`));
    
    for (const attr of subject) {
      // serialNumber geralmente contém o CNPJ em certificados ICP-Brasil
      if (attr.name === 'serialNumber' || attr.shortName === 'serialNumber') {
        const value = String(attr.value);
        console.log('📌 serialNumber encontrado:', value);
        const cleanValue = value.replace(/\D/g, '');
        if (cleanValue.length === 14) {
          console.log('✅ CNPJ encontrado no serialNumber:', cleanValue);
          return cleanValue;
        }
      }
    }

    // 3️⃣ Tentar extrair do CN (Common Name) - formato: RAZAO SOCIAL:CNPJ
    for (const attr of subject) {
      if (attr.name === 'CN' || attr.shortName === 'CN') {
        const value = String(attr.value);
        console.log('📌 CN encontrado:', value);
        
        // Certificados ICP-Brasil podem ter formato "EMPRESA:12345678000190"
        const cnpjMatch = value.match(/(\d{14})/);
        if (cnpjMatch) {
          console.log('✅ CNPJ encontrado no CN:', cnpjMatch[0]);
          return cnpjMatch[0];
        }
      }
    }

    // 4️⃣ Varrer todos os outros atributos do subject
    for (const attr of subject) {
      const value = String(attr.value);
      const cleanValue = value.replace(/\D/g, '');
      
      if (cleanValue.length === 14) {
        console.log(`✅ CNPJ encontrado em ${attr.name || attr.shortName}:`, cleanValue);
        return cleanValue;
      }
    }

    console.warn('⚠️ Nenhum CNPJ encontrado no certificado');
    console.log('💡 Dica: Verifique se é um certificado e-CNPJ válido ICP-Brasil');
    return null;
  } catch (error) {
    console.error('❌ Erro ao extrair CNPJ do certificado:', error);
    return null;
  }
}