/**
 * Certificado para a conexão mTLS com o ADN (NFS-e nacional).
 *   - TESTE: se NFSE_TESTE_PFX (+ NFSE_TESTE_PFX_SENHA) estiver no .env, usa esse .pfx
 *     (desenvolvimento local, onde o certificado do cadastro não abre por falta da CRYPTO_MASTER_KEY).
 *   - PRODUÇÃO: certificado da empresa em dadosempresa (mesmo cadastro da NF-e), pelo CNPJ.
 * O ADN aceita certificado de outro CNPJ com a MESMA RAIZ (8 dígitos) do CNPJ consultado.
 * Só servidor.
 */
import fs from 'fs';
import https from 'https';
import { decrypt } from '@/utils/crypto';
import { extrairCertificado, extrairCNPJDoCertificado } from '@/utils/certificadoExtractor';
import { extrairCertificadoOpenssl } from '@/utils/certificadoExtractorOpenssl';

export interface Consultavel {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

export interface CertificadoAdn {
  agent: https.Agent;
  cnpjCertificado: string | null;
  origem: 'TESTE_PFX' | 'CADASTRO';
}

const soDigitos = (v: any) => String(v || '').replace(/\D/g, '');

// o extrator do projeto escreve bastante no console; silencia durante a leitura do .pfx
const silencioso = <T>(fn: () => T): T => {
  const log = console.log;
  console.log = () => undefined;
  try { return fn(); } finally { console.log = log; }
};

export async function certificadoAdn(db: Consultavel, cnpjConsulta: string): Promise<CertificadoAdn> {
  const pfxPath = process.env.NFSE_TESTE_PFX;
  if (pfxPath) {
    if (!fs.existsSync(pfxPath)) throw new Error(`Certificado de teste não encontrado (NFSE_TESTE_PFX).`);
    const buf = fs.readFileSync(pfxPath);
    const senha = process.env.NFSE_TESTE_PFX_SENHA || '';
    const c = silencioso(() => {
      try { return extrairCertificado(buf, senha); } catch { return extrairCertificadoOpenssl(buf, senha); }
    });
    return {
      agent: new https.Agent({ key: c.certificadoKey, cert: c.certificadoCrt, ca: c.cadeiaCrt || undefined }),
      cnpjCertificado: silencioso(() => extrairCNPJDoCertificado(c.certificadoCrt)),
      origem: 'TESTE_PFX',
    };
  }

  // cadastro da empresa: o próprio CNPJ ou outro da mesma raiz
  const cnpj = soDigitos(cnpjConsulta);
  const r = await db.query(
    `SELECT cgc, "certificadoKey", "certificadoCrt", "cadeiaCrt" FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
        AND left(regexp_replace(cgc, '\\D', '', 'g'), 8) = left($1, 8)
      ORDER BY (regexp_replace(cgc, '\\D', '', 'g') = $1) DESC LIMIT 1`, [cnpj]);
  const e = r.rows[0];
  if (!e) throw new Error(`Nenhum certificado cadastrado para o CNPJ ${cnpj} (Admin > Dados Empresa).`);
  const key = await decrypt(e.certificadoKey);
  const cert = await decrypt(e.certificadoCrt);
  const ca = e.cadeiaCrt ? await decrypt(e.cadeiaCrt) : null;
  if (!key || !cert) throw new Error('Não foi possível abrir o certificado da empresa (verifique a CRYPTO_MASTER_KEY do servidor).');
  return {
    agent: new https.Agent({ key, cert, ca: ca || undefined }),
    cnpjCertificado: soDigitos(e.cgc),
    origem: 'CADASTRO',
  };
}
