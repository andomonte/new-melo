// src/utils/certificadoExtractorOpenssl.ts
// Extração do certificado (.pfx) via OpenSSL (implementação de referência).
// Usado como FALLBACK quando o node-forge falha (ex.: .pfx legado RC2-40/3DES/SHA1,
// ou codificação de senha que o forge não reproduz). Server-only.
//
// Portabilidade: usa o binário `openssl`. Funciona no local (Git for Windows) e no melo (Linux).
// No Vercel (serverless) o binário pode não existir — por isso é FALLBACK: certificados
// modernos passam pelo node-forge (Vercel-ok); o upload de .pfx legado é feito no local/melo.
//
// IMPORTANTE (Windows): o provider `legacy` (necessário p/ RC2-40/3DES) só existe no
// openssl do mingw64 do Git, e o binário precisa saber onde está o legacy.dll via
// OPENSSL_MODULES. O openssl de `usr/bin` NÃO tem o módulo e falha com
// "unable to load provider legacy".
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { CertificadoExtraido } from './certificadoExtractor';

interface OpensslInfo {
  bin: string;
  modulesDir?: string; // dir com legacy.dll/legacy.so; setado em OPENSSL_MODULES
}

function testarBin(bin: string): boolean {
  try {
    execFileSync(bin, ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function temLegacy(dir: string): boolean {
  try {
    return (
      fs.existsSync(path.join(dir, 'legacy.dll')) ||
      fs.existsSync(path.join(dir, 'legacy.so'))
    );
  } catch {
    return false;
  }
}

/** Localiza a pasta de módulos que contém o provider `legacy`. */
function acharModulesDir(preferido?: string): string | undefined {
  const candidatos = [
    preferido,
    'C:/Program Files/Git/mingw64/lib/ossl-modules',
    '/usr/lib/x86_64-linux-gnu/ossl-modules',
    '/usr/lib/ossl-modules',
    '/usr/local/lib/ossl-modules',
    '/lib/x86_64-linux-gnu/ossl-modules',
  ].filter(Boolean) as string[];
  for (const d of candidatos) {
    if (temLegacy(d)) return d;
  }
  return undefined;
}

/** Escolhe um openssl utilizável e a pasta do provider legacy. */
function acharOpenssl(): OpensslInfo {
  const isWin = process.platform === 'win32';
  const candidatos: OpensslInfo[] = isWin
    ? [
        // O mingw64 é o único do Git que carrega o provider legacy.
        {
          bin: 'C:/Program Files/Git/mingw64/bin/openssl.exe',
          modulesDir: 'C:/Program Files/Git/mingw64/lib/ossl-modules',
        },
        { bin: 'C:/Program Files/Git/usr/bin/openssl.exe' },
        { bin: 'openssl' },
      ]
    : [{ bin: 'openssl' }, { bin: '/usr/bin/openssl' }];

  for (const c of candidatos) {
    if (testarBin(c.bin)) {
      const modulesDir = acharModulesDir(c.modulesDir);
      return { bin: c.bin, modulesDir };
    }
  }
  throw new Error('OpenSSL não encontrado no servidor (necessário para .pfx legado).');
}

export function extrairCertificadoOpenssl(
  pfxBuffer: Buffer,
  senha: string,
): CertificadoExtraido {
  const info = acharOpenssl();
  const id = crypto.randomBytes(8).toString('hex');
  const pfxPath = path.join(os.tmpdir(), `cert_${id}.pfx`);
  const pemPath = path.join(os.tmpdir(), `cert_${id}.pem`);
  fs.writeFileSync(pfxPath, pfxBuffer);

  try {
    // Senha via env (evita problemas de escaping/shell com caracteres especiais).
    const env: NodeJS.ProcessEnv = { ...process.env, CERT_PFX_PASS: senha };
    // Aponta o provider legacy explicitamente (Windows precisa; Linux normalmente já acha).
    if (info.modulesDir) env.OPENSSL_MODULES = info.modulesDir;

    const args = [
      'pkcs12',
      '-in', pfxPath,
      '-out', pemPath,
      '-nodes',
      '-passin', 'env:CERT_PFX_PASS',
    ];

    // 1ª tentativa: moderno. 2ª: -legacy (RC2/3DES desativados por padrão no OpenSSL 3).
    try {
      execFileSync(info.bin, args, { env, stdio: 'pipe' });
    } catch (e1: any) {
      const stderr1 = e1?.stderr?.toString?.() || '';
      try {
        execFileSync(info.bin, [...args, '-legacy'], { env, stdio: 'pipe' });
      } catch (e2: any) {
        const stderr2 = e2?.stderr?.toString?.() || '';
        const msg =
          (stderr2 || stderr1 || e2?.message || '').split('\n')[0] || 'erro OpenSSL';
        throw new Error(`OpenSSL não conseguiu abrir o .pfx: ${msg}`);
      }
    }

    const pem = fs.readFileSync(pemPath, 'utf8');
    const keyMatch = pem.match(
      /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/,
    );
    const certMatches =
      pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];

    if (!keyMatch) throw new Error('Chave privada não encontrada após a extração.');
    if (!certMatches.length) throw new Error('Certificado não encontrado após a extração.');

    return {
      certificadoKey: keyMatch[0].trim(),
      certificadoCrt: certMatches[0].trim(),
      cadeiaCrt: certMatches.slice(1).join('\n').trim(),
    };
  } finally {
    try { fs.unlinkSync(pfxPath); } catch { /* ignore */ }
    try { fs.unlinkSync(pemPath); } catch { /* ignore */ }
  }
}
