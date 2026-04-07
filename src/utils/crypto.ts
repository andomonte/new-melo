// src/utils/crypto.ts
import crypto from 'crypto';

// A chave mestra deve ser carregada de uma variável de ambiente.
const CRYPTO_MASTER_KEY = process.env.CRYPTO_MASTER_KEY || '';

if (!CRYPTO_MASTER_KEY || CRYPTO_MASTER_KEY.length < 32) {
  console.error(
    'ERRO CRÍTICO: CRYPTO_MASTER_KEY não definida ou muito curta. Por favor, defina uma chave forte (min 32 caracteres) nas variáveis de ambiente. A aplicação não pode funcionar com segurança sem ela.',
  );
  process.exit(1); // Em produção, é essencial parar se a chave mestra não for segura
}

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits para AES-256-CBC
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';

/**
 * Deriva uma chave de criptografia a partir da CHAVE MESTRA e um salt ÚNICO por criptografia.
 * @param salt Buffer do salt aleatório e único para esta operação.
 * @returns Promise<Buffer> A chave derivada.
 */
function deriveKeyFromMaster(salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      CRYPTO_MASTER_KEY,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      },
    );
  });
}

/**
 * Criptografa um texto.
 * Retorna uma string no formato "texto_cifrado_base64.salt_base64.iv_base64".
 * @param text O texto a ser criptografado.
 * @returns Promise<string> O texto criptografado no formato base64.
 */
export async function encrypt(
  text: string | null | undefined,
): Promise<string | null> {
  if (text === null || text === undefined || text === '') {
    return null; // Não criptografa valores nulos/vazios
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKeyFromMaster(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return `${encrypted}.${salt.toString('base64')}.${iv.toString('base64')}`;
}

/**
 * Descriptografa um texto.
 * O texto de entrada deve estar no formato "texto_cifrado_base64.salt_base64.iv_base64".
 * @param encryptedText O texto criptografado no formato base64.
 * @returns Promise<string> O texto original.
 */
export async function decrypt(
  encryptedText: string | null | undefined,
): Promise<string | null> {
  if (
    encryptedText === null ||
    encryptedText === undefined ||
    encryptedText === ''
  ) {
    return null; // Não tenta descriptografar valores nulos/vazios
  }

  const parts = encryptedText.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'Formato de texto criptografado inválido: esperado "cifrado.salt.iv".',
    );
  }

  const [encrypted, saltBase64, ivBase64] = parts;

  try {
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const key = await deriveKeyFromMaster(salt); // Usa a mesma chave mestra para derivar

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Erro ao descriptografar dado:', e);
    throw new Error(
      'Falha na descriptografia. Dado corrompido ou chave inválida.',
    );
  }
}
