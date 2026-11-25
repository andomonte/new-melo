/**
 * Assinatura XMLDSig (enveloped) da DPS (infDPS) e do pedido de evento (infPedReg), RSA-SHA256 —
 * o mesmo algoritmo que a Sefin Nacional usa nas NFS-e (a NF-e do projeto usa SHA-1; aqui não).
 * Conferido em 25/11/2026: a Sefin aceitou a assinatura (passou da validação de esquema/assinatura).
 * xml-crypto 2.x (API posicional). Só servidor.
 */
import { SignedXml } from 'xml-crypto';

const SIG_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/** Assina o elemento `tag` (infDPS | infPedReg). key/cert em PEM. Devolve o XML com a declaração. */
export function assinarXmlNfse(xml: string, tag: 'infDPS' | 'infPedReg', keyPem: string, certPem: string): string {
  const certB64 = certPem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  const sig: any = new SignedXml();
  sig.signatureAlgorithm = SIG_SHA256;
  sig.canonicalizationAlgorithm = C14N;
  sig.addReference(`//*[local-name(.)='${tag}']`, [ENVELOPED, C14N], DIGEST_SHA256);
  sig.signingKey = keyPem;
  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certB64}</X509Certificate></X509Data>`,
    getKey: () => Buffer.from(keyPem),
  };
  sig.computeSignature(xml, { location: { reference: `//*[local-name(.)='${tag}']`, action: 'after' } });
  return `<?xml version="1.0" encoding="UTF-8"?>${sig.getSignedXml()}`;
}
