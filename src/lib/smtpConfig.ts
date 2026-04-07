import { getPgPool } from '@/lib/pg';
import crypto from 'crypto';

// Chave de criptografia - deve ser a mesma usada na API
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || 'your-32-character-secret-key!!';
const ALGORITHM = 'aes-256-cbc';

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

// Função para descriptografar a senha
function decrypt(text: string): string {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('❌ Erro ao descriptografar senha SMTP:', error);
    throw new Error('Falha ao descriptografar configuração SMTP');
  }
}

/**
 * Busca a configuração SMTP ativa do banco de dados
 * @returns Configuração SMTP ou null se não encontrada
 */
export async function getActiveSmtpConfig(): Promise<SMTPConfig | null> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT host, port, secure, username, password, from_email, from_name
       FROM db_manaus.smtp_config
       WHERE ativo = true
       ORDER BY id DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.warn('⚠️ Nenhuma configuração SMTP ativa encontrada no banco de dados');
      return null;
    }

    const config = result.rows[0];

    // Descriptografar a senha
    const senhaDescriptografada = decrypt(config.password);

    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.username,
      pass: senhaDescriptografada,
      fromEmail: config.from_email,
      fromName: config.from_name,
    };

  } catch (error) {
    console.error('❌ Erro ao buscar configuração SMTP:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Busca configuração SMTP (banco de dados ou fallback para variáveis de ambiente)
 * @returns Configuração SMTP válida
 */
export async function getSmtpConfigWithFallback(): Promise<SMTPConfig> {
  try {
    // Tentar buscar do banco primeiro
    const dbConfig = await getActiveSmtpConfig();
    
    if (dbConfig) {
      console.log('✅ Usando configuração SMTP do banco de dados');
      return dbConfig;
    }

    // Fallback: usar variáveis de ambiente
    console.warn('⚠️ Usando configuração SMTP das variáveis de ambiente (fallback)');
    
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.EMAIL_FROM || '',
      fromName: process.env.EMAIL_FROM_NAME || 'Sistema NFe',
    };

  } catch (error) {
    console.error('❌ Erro ao buscar configuração SMTP, usando fallback:', error);
    
    // Em caso de erro, usar variáveis de ambiente
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.EMAIL_FROM || '',
      fromName: process.env.EMAIL_FROM_NAME || 'Sistema NFe',
    };
  }
}
