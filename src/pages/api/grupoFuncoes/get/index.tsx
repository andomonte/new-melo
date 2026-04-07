// pages/api/auth/funcoes.ts (ou o caminho da sua API Route)
import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { login_user_login, grupoId } = req.query;

  if (!login_user_login || typeof login_user_login !== 'string') {
    return res.status(400).json({
      error: 'Parâmetro login_user_login é obrigatório e deve ser uma string',
    });
  }

  try {
    const pool = getPgPool();

    console.log('🔍 Buscando funções para:', { login_user_login, grupoId });

    // Funções do usuário
    const funcoesUserResult = await pool.query(
      'SELECT id_functions FROM tb_login_access_user WHERE login_user_login = $1',
      [login_user_login]
    );

    console.log('👤 Funções do usuário:', {
      total: funcoesUserResult.rows.length,
      rows: funcoesUserResult.rows
    });

    // Funções do grupo (se grupoId foi fornecido)
    let funcoesPerfilResult = { rows: [] };
    if (grupoId && typeof grupoId === 'string') {
      funcoesPerfilResult = await pool.query(
        'SELECT id_functions FROM tb_login_access_perfil WHERE login_perfil_name = $1',
        [grupoId]
      );
      
      console.log('👥 Funções do perfil/grupo:', {
        total: funcoesPerfilResult.rows.length,
        rows: funcoesPerfilResult.rows
      });
    }

    // Coletar todos os IDs de funções (removendo duplicatas)
    // id_functions é um valor único (bigint), não um array
    const idsFuncoes: number[] = [];

    // Processar funções do usuário
    funcoesUserResult.rows.forEach((row: any) => {
      if (row.id_functions !== null && row.id_functions !== undefined) {
        const id = Number(row.id_functions);
        if (!isNaN(id)) {
          idsFuncoes.push(id);
        }
      }
    });

    // Processar funções do perfil
    funcoesPerfilResult.rows.forEach((row: any) => {
      if (row.id_functions !== null && row.id_functions !== undefined) {
        const id = Number(row.id_functions);
        if (!isNaN(id)) {
          idsFuncoes.push(id);
        }
      }
    });

    // Remover duplicatas
    const idsUnicos = [...new Set(idsFuncoes.filter(id => !isNaN(id)))];

    console.log('🔢 IDs de funções encontrados:', idsUnicos);

    // Buscar os dados completos das funções
    let funcoes = [];
    if (idsUnicos.length > 0) {
      const placeholders = idsUnicos.map((_, index) => `$${index + 1}`).join(',');
      const funcoesResult = await pool.query(
        `SELECT id_functions, sigla, descricao FROM tb_login_functions WHERE id_functions IN (${placeholders})`,
        idsUnicos
      );
      funcoes = funcoesResult.rows;
      console.log('✅ Funções completas encontradas:', funcoes);
    } else {
      console.warn('⚠️ Nenhuma função encontrada para o usuário/grupo');
    }

    res.status(200).json({ funcoes });
  } catch (error) {
    console.error('❌ Erro ao buscar funções:', error);
    res.status(500).json({ error: 'Erro ao buscar funções' });
  }
}
