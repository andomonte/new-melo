import { readFileSync } from 'fs';
import { SignedXml } from 'xml-crypto';
import { DOMParser, XMLSerializer } from 'xmldom';

export async function assinarXML(
  xml: string,
  tag: string,
  caminhoKey: string,
  caminhoCert: string
): Promise<string> {
  const privateKey = readFileSync(caminhoKey, 'utf8');
  const certRaw = readFileSync(caminhoCert, 'utf8');

  const cert = certRaw
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n|\r/g, '');

  return assinarXMLComCertificados(xml, tag, privateKey, cert);
}

export async function assinarXMLComCertificados(
  xml: string,
  tag: string,
  privateKey: string,
  cert: string
): Promise<string> {
  const certLimpo = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n|\r/g, '');

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const elemento = doc.getElementsByTagName(tag)[0];

  class CustomKeyInfoProvider {
    getKeyInfo(): string {
      return `<X509Data><X509Certificate>${certLimpo}</X509Certificate></X509Data>`;
    }
    file = ''; // Não é usado
    getKey(): Buffer {
      return Buffer.from(privateKey, 'utf8');
    }
  }

  const signer = new SignedXml();

  // --- CORREÇÃO APLICADA: Alterado o algoritmo de assinatura para RSA-SHA1 ---
  // Atualizado: SEFAZ está rejeitando SHA-256, exige SHA-1
  signer.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  signer.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

  signer.addReference(
    `//*[local-name(.)='${tag}']`,
    [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    // Atualizado: SEFAZ está rejeitando SHA-256, exige SHA-1
    'http://www.w3.org/2000/09/xmldsig#sha1'
  );

  signer.signingKey = privateKey;
  signer.keyInfoProvider = new CustomKeyInfoProvider();

  signer.computeSignature(xml);
  const signatureXml = signer.getSignatureXml();
  const signatureDoc = new DOMParser().parseFromString(signatureXml, 'application/xml');
  const signatureNode = signatureDoc.documentElement;

  if (elemento.parentNode) {
    elemento.parentNode.appendChild(signatureNode);
  } else {
    doc.documentElement.appendChild(signatureNode);
  }

  return new XMLSerializer().serializeToString(doc);
}
