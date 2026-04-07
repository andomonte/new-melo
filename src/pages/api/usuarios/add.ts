import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';

const SALT_ROUNDS = 10;

interface Funcao {
  id_functions: number;
}

interface ArmazemDoPayload {
  id_armazem: number;
  nome: string;
  filial: string;
  ativo: boolean;
}

interface FilialPayload {
  codigo_filial: number | string;
  nome_filial: string;
  codvend?: string | null;
  funcoesDoUsuario?: Funcao[];
  armazens?: ArmazemDoPayload[];
}

interface PerfilPayload {
  perfil_name: string;
  filial: FilialPayload[];
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const {
      login_user_login,
      login_user_name,
      perfis,
    }: {
      login_user_login: string;
      login_user_name: string;
      perfis: PerfilPayload[];
    } = req.body;

    const pool = getPgPool();
    client = await pool.connect();

    // Já existe?
    const usuarioExistenteResult = await client.query(
      'SELECT login_user_login FROM tb_login_user WHERE login_user_login = $1',
      [login_user_login],
    );

    if (usuarioExistenteResult.rows.length > 0) {
      res.status(400).json({ error: 'Usuário já existe.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(login_user_login, SALT_ROUNDS);

    await client.query('BEGIN');

    // 1) Usuário
    await client.query(
      `INSERT INTO tb_login_user 
        (login_user_login, login_user_name, login_user_password)
       VALUES ($1, $2, $3)`,
      [login_user_login, login_user_name, hashedPassword],
    );

    // Usado para inserir tb_login_filiais ao final (sem duplicar)
    const uniqueFiliais = new Map<
      string,
      { codigo_filial: number; nome_filial: string }
    >();

    // 2) Perfis, Filiais (com codvend), Funções do usuário por filial e Armazéns do usuário por filial
    for (const perfil of perfis) {
      for (const filial of perfil.filial) {
        const codigoFilial = Number(filial.codigo_filial);

        // 2.1) tb_user_perfil
        await client.query(
          `INSERT INTO tb_user_perfil 
            (user_login_id, perfil_name, codigo_filial, nome_filial, codvend)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            login_user_login,
            perfil.perfil_name,
            codigoFilial,
            filial.nome_filial,
            filial.codvend ?? null,
          ],
        );

        // 2.2) Funções do usuário por filial
        if (
          Array.isArray(filial.funcoesDoUsuario) &&
          filial.funcoesDoUsuario.length > 0
        ) {
          for (const funcao of filial.funcoesDoUsuario) {
            // ✅ CORREÇÃO: Verificar se já existe antes de inserir
            const existeFuncao = await client.query(
              `SELECT 1 FROM tb_login_access_user 
               WHERE id_functions = $1 
                 AND login_user_login = $2 
                 AND codigo_filial = $3`,
              [funcao.id_functions, login_user_login, codigoFilial],
            );

            if (existeFuncao.rows.length === 0) {
              await client.query(
                `INSERT INTO tb_login_access_user 
                  (id_functions, login_user_login, login_perfil_name, codigo_filial)
                 VALUES ($1, $2, $3, $4)`,
                [
                  funcao.id_functions,
                  login_user_login,
                  perfil.perfil_name,
                  codigoFilial,
                ],
              );
            }
          }
        }

        // 2.3) Armazéns do usuário por filial
        if (Array.isArray(filial.armazens) && filial.armazens.length > 0) {
          for (const arm of filial.armazens) {
            if (!arm || !arm.id_armazem) continue;

            // ✅ CORREÇÃO: Verificar se já existe antes de inserir
            const existeArmazem = await client.query(
              `SELECT 1 FROM tb_login_armazem_user 
               WHERE id_armazem = $1 
                 AND login_user_login = $2 
                 AND codigo_filial = $3`,
              [arm.id_armazem, login_user_login, codigoFilial],
            );

            if (existeArmazem.rows.length === 0) {
              await client.query(
                `INSERT INTO tb_login_armazem_user
                  (id_armazem, login_user_login, login_perfil_name, codigo_filial)
                 VALUES ($1, $2, $3, $4)`,
                [
                  arm.id_armazem,
                  login_user_login,
                  perfil.perfil_name,
                  codigoFilial,
                ],
              );
            }
          }
        }

        // 2.4) Guardar para tb_login_filiais
        uniqueFiliais.set(String(codigoFilial), {
          codigo_filial: codigoFilial,
          nome_filial: filial.nome_filial,
        });
      }
    }

    // 3) tb_login_filiais (sem duplicar)
    for (const [, f] of uniqueFiliais) {
      // ✅ CORREÇÃO: Verificar se já existe antes de inserir
      const existeFilial = await client.query(
        `SELECT 1 FROM tb_login_filiais 
         WHERE login_user_login = $1 
           AND codigo_filial = $2`,
        [login_user_login, f.codigo_filial],
      );

      if (existeFilial.rows.length === 0) {
        await client.query(
          `INSERT INTO tb_login_filiais 
            (login_user_login, codigo_filial, nome_filial)
           VALUES ($1, $2, $3)`,
          [login_user_login, f.codigo_filial, f.nome_filial],
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Usuário criado com sucesso.' });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: `Erro ao criar usuário: ${error.message}` });
  } finally {
    if (client) client.release();
  }
}
