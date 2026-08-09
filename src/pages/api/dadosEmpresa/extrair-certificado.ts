// pages/api/dadosEmpresa/extrair-certificado.ts
// Extração do certificado (.pfx) NO SERVIDOR (Node) — mais confiável que no navegador.
// Estratégia em 2 camadas:
//   1) node-forge — abre PKCS#12 moderno (AES-256/PBES2/SHA-256); Vercel-ok, sem binário externo.
//   2) OpenSSL (fallback) — quando o forge falha: .pfx LEGADO (RC2-40/3DES/SHA1) ou
//      codificação de senha que o forge não reproduz. Usa o binário openssl (local/melo).
// Propaga o ERRO REAL (não o genérico "verifique a senha").
import { NextApiRequest, NextApiResponse } from 'next';
import { extrairCertificado } from '@/utils/certificadoExtractor';
import { extrairCertificadoOpenssl } from '@/utils/certificadoExtractorOpenssl';

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { pfxBase64, senha } = req.body || {};
  if (!pfxBase64 || typeof pfxBase64 !== 'string') {
    return res.status(400).json({ erro: 'Arquivo do certificado (.pfx) não informado.' });
  }
  if (!senha) {
    return res.status(400).json({ erro: 'Senha do certificado não informada.' });
  }

  try {
    const buffer = Buffer.from(pfxBase64, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ erro: 'Arquivo do certificado vazio ou inválido.' });
    }
    let cert;
    let via = 'node-forge';
    try {
      cert = extrairCertificado(buffer, senha);
    } catch (forgeErr: any) {
      // node-forge falhou (ex.: .pfx legado RC2/3DES ou senha que o forge não reproduz).
      // Cai para OpenSSL, a implementação de referência.
      console.warn(
        '⚠️ [extrair-certificado] node-forge falhou, tentando OpenSSL:',
        forgeErr?.message,
      );
      try {
        cert = extrairCertificadoOpenssl(buffer, senha);
        via = 'openssl';
      } catch (osslErr: any) {
        // Ambos falharam — devolve a causa mais informativa.
        const forgeMsg = forgeErr?.message || 'falha no node-forge';
        const osslMsg = osslErr?.message || 'falha no OpenSSL';
        throw new Error(`${osslMsg} (node-forge: ${forgeMsg})`);
      }
    }

    console.log(`✅ [extrair-certificado] Certificado extraído via ${via}.`);
    return res.status(200).json({
      certificadoKey: cert.certificadoKey,
      certificadoCrt: cert.certificadoCrt,
      cadeiaCrt: cert.cadeiaCrt,
    });
  } catch (error: any) {
    // Erro tratável: devolve a causa REAL (senha, formato, algoritmo...).
    const detalhe = error?.message || 'Falha ao extrair o certificado.';
    console.error('❌ [extrair-certificado] Falha:', detalhe);
    return res.status(400).json({
      erro: `Não foi possível ler o certificado: ${detalhe}`,
    });
  }
}
