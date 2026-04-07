import { NextApiRequest, NextApiResponse } from 'next';

import crypto from 'crypto';
import { getPgPool } from '@/lib/pg';

// Chave de criptografia - IMPORTANTE: Em produção, use uma variável de ambiente segura
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || 'your-32-character-secret-key!!'; // Deve ter 32 caracteres
const ALGORITHM = 'aes-256-cbc';

// Função para criptografar a senha
function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Função para descriptografar a senha
function decrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      // Verificar se quer listar todas ou apenas a ativa
      const { all } = req.query;

      if (all === 'true') {
        // Buscar todas as configurações
        const result = await client.query(
          `SELECT id, host, port, secure, username, password, from_email, from_name, ativo, created_at, updated_at
           FROM smtp_config
           ORDER BY ativo DESC, updated_at DESC`
        );

        if (result.rows.length === 0) {
          return res.status(200).json({
            sucesso: true,
            configs: [],
            mensagem: 'Nenhuma configuração SMTP cadastrada'
          });
        }

        const configs = result.rows.map((config: { password: string; id: any; host: any; port: any; secure: any; username: any; from_email: any; from_name: any; ativo: any; created_at: any; updated_at: any; }) => {
          const senhaDescriptografada = decrypt(config.password);
          return {
            id: config.id,
            host: config.host,
            port: config.port,
            secure: config.secure,
            username: config.username,
            password: '********', // Mascarar senha na listagem
            from_email: config.from_email,
            from_name: config.from_name,
            ativo: config.ativo,
            created_at: config.created_at,
            updated_at: config.updated_at
          };
        });

        return res.status(200).json({
          sucesso: true,
          configs
        });
      } else {
        // Buscar apenas configuração ativa
        const result = await client.query(
          `SELECT id, host, port, secure, username, password, from_email, from_name, ativo, created_at, updated_at
           FROM smtp_config
           WHERE ativo = true
           ORDER BY updated_at DESC
           LIMIT 1`
        );

        if (result.rows.length === 0) {
          return res.status(200).json({
            sucesso: true,
            configuracao: null,
            mensagem: 'Nenhuma configuração SMTP cadastrada'
          });
        }

        const config = result.rows[0];
        
        // Descriptografar a senha antes de enviar (apenas para exibição parcial)
        const senhaDescriptografada = decrypt(config.password);
        
        return res.status(200).json({
          sucesso: true,
          configuracao: {
            id: config.id,
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.username,
            pass: senhaDescriptografada.substring(0, 4) + '************', // Retorna apenas parte da senha
            passCompleta: senhaDescriptografada, // Senha completa (use com cuidado)
            fromEmail: config.from_email,
            fromName: config.from_name,
            ativo: config.ativo,
            createdAt: config.created_at,
            updatedAt: config.updated_at
          }
        });
      }

    } else if (req.method === 'POST') {
      // Salvar nova configuração SMTP
      const { host, port, secure, user, pass, fromEmail, fromName } = req.body;

      // Validações
      if (!host || !port || !user || !pass || !fromEmail || !fromName) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Todos os campos são obrigatórios'
        });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user) || !emailRegex.test(fromEmail)) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Formato de email inválido'
        });
      }

      // Validar porta
      const portNum = parseInt(port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Porta inválida (deve ser entre 1 e 65535)'
        });
      }

      // Criptografar a senha antes de salvar
      const senhaCriptografada = encrypt(pass);

      await client.query('BEGIN');

      try {
        // Desativar todas as configurações anteriores
        await client.query(
          `UPDATE smtp_config SET ativo = false WHERE ativo = true`
        );

        // Inserir nova configuração
        const insertResult = await client.query(
          `INSERT INTO smtp_config (host, port, secure, username, password, from_email, from_name, ativo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           RETURNING id, host, port, secure, username, from_email, from_name, ativo, created_at, updated_at`,
          [host, portNum, secure, user, senhaCriptografada, fromEmail, fromName]
        );

        await client.query('COMMIT');

        const novaConfig = insertResult.rows[0];

        return res.status(201).json({
          sucesso: true,
          mensagem: 'Configuração SMTP salva com sucesso',
          configuracao: {
            id: novaConfig.id,
            host: novaConfig.host,
            port: novaConfig.port,
            secure: novaConfig.secure,
            user: novaConfig.username,
            fromEmail: novaConfig.from_email,
            fromName: novaConfig.from_name,
            ativo: novaConfig.ativo,
            createdAt: novaConfig.created_at,
            updatedAt: novaConfig.updated_at
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

    } else if (req.method === 'PUT') {
      // Atualizar configuração existente
      const { id, host, port, secure, user, pass, fromEmail, fromName } = req.body;

      if (!id) {
        return res.status(400).json({
          sucesso: false,
          erro: 'ID da configuração é obrigatório'
        });
      }

      // Validações
      if (!host || !port || !user || !fromEmail || !fromName) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Todos os campos são obrigatórios'
        });
      }

      // Se uma nova senha foi fornecida, criptografá-la
      let senhaCriptografada;
      if (pass && !pass.includes('*')) {
        senhaCriptografada = encrypt(pass);
      } else {
        // Manter a senha existente
        const existingConfig = await client.query(
          `SELECT password FROM smtp_config WHERE id = $1`,
          [id]
        );
        if (existingConfig.rows.length === 0) {
          return res.status(404).json({
            sucesso: false,
            erro: 'Configuração não encontrada'
          });
        }
        senhaCriptografada = existingConfig.rows[0].password;
      }

      const portNum = parseInt(port);

      const updateResult = await client.query(
        `UPDATE smtp_config 
         SET host = $1, port = $2, secure = $3, username = $4, password = $5, 
             from_email = $6, from_name = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING id, host, port, secure, username, from_email, from_name, ativo, updated_at`,
        [host, portNum, secure, user, senhaCriptografada, fromEmail, fromName, id]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Configuração não encontrada'
        });
      }

      const configAtualizada = updateResult.rows[0];

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Configuração SMTP atualizada com sucesso',
        configuracao: {
          id: configAtualizada.id,
          host: configAtualizada.host,
          port: configAtualizada.port,
          secure: configAtualizada.secure,
          user: configAtualizada.username,
          fromEmail: configAtualizada.from_email,
          fromName: configAtualizada.from_name,
          ativo: configAtualizada.ativo,
          updatedAt: configAtualizada.updated_at
        }
      });

    } else if (req.method === 'DELETE') {
      // Deletar configuração
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          sucesso: false,
          erro: 'ID da configuração é obrigatório'
        });
      }

      const deleteResult = await client.query(
        `DELETE FROM smtp_config WHERE id = $1 RETURNING id`,
        [id]
      );

      if (deleteResult.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          erro: 'Configuração não encontrada'
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Configuração SMTP deletada com sucesso'
      });

    } else {
      return res.status(405).json({
        sucesso: false,
        erro: 'Método não permitido'
      });
    }

  } catch (error: any) {
    console.error('❌ Erro na API de configuração SMTP:', error);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro ao processar configuração SMTP',
      detalhes: error.message
    });
  } finally {
    client.release();
  }
}
