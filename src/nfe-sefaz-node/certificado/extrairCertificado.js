const fs = require('fs');
const forge = require('node-forge');

// Caminho do .pfx e senha
const pfxPath = './certificado.pfx'; //{CERTIFICATE_PATH}
const senha = '150407'; //{CERTIFICATE_PASSWORD.PASSWORD? PASSWORD.LENGTH? LENGTH}

// Ler e carregar PFX
const pfxData = fs.readFileSync(pfxPath);
const p12Der = forge.util.createBuffer(pfxData.toString('binary'));
const p12Asn1 = forge.asn1.fromDer(p12Der);
const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

// 🔐 Chave privada
const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
if (!keyBags?.length) throw new Error('❌ Chave privada não encontrada');
const chavePrivadaPem = forge.pki.privateKeyToPem(keyBags[0].key);

// 📜 Certificados (todos da cadeia)
const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
if (!certBags?.length) throw new Error('❌ Nenhum certificado encontrado');

const certificadosPem = certBags.map(bag => forge.pki.certificateToPem(bag.cert));

// Separar certificado principal e cadeia
const certificadoPrincipal = certificadosPem[0];
const cadeiaCertificados = certificadosPem.slice(1).join('\n');

// 💾 Salvar arquivos
fs.writeFileSync('certificado.key', chavePrivadaPem);
fs.writeFileSync('certificado.crt', certificadoPrincipal);
fs.writeFileSync('cadeia.crt', cadeiaCertificados);

//TEMPO

console.log('✅ Extração concluída:');
console.log('- certificado.key');
console.log('- certificado.crt');
console.log('- cadeia.crt');
