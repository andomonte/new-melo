import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { login } = req.query;

  if (!login || typeof login !== 'string') {
    return res.status(400).json({
      error: 'Parâmetro login é obrigatório e deve ser uma string',
    });
  }

  try {
    // 1. Buscar perfis do usuário
    const userPerfis = await prisma.tb_user_perfil.findMany({
      where: { user_login_id: login },
      select: { perfil_name: true },
    });

    // 2. Funções diretas do usuário
    const funcoesUser = await prisma.tb_login_access_user.findMany({
      where: { login_user_login: login },
      select: { id_functions: true },
    });

    // 3. Funções dos perfis do usuário
    const funcoesPerfil = await prisma.tb_login_access_perfil.findMany({
      where: { 
        login_perfil_name: { 
          in: userPerfis.map(p => p.perfil_name) 
        } 
      },
      select: { id_functions: true },
    });

    // 4. Combinar todas as funções (sem duplicatas)
    const allFunctionIds = [
      ...new Set([
        ...funcoesUser.flatMap((f) => f.id_functions ?? []),
        ...funcoesPerfil.flatMap((f) => f.id_functions ?? []),
      ]),
    ];

    // 5. Buscar detalhes das funções
    const funcoes = await prisma.tb_login_functions.findMany({
      where: {
        id_functions: {
          in: allFunctionIds.map(Number),
        },
      },
      select: {
        id_functions: true,
        sigla: true,
        descricao: true,
        usadoEm: true,
      },
    });

    // 6. Separar funções por origem para debug
    const funcoesDirectas = await prisma.tb_login_functions.findMany({
      where: {
        id_functions: {
          in: funcoesUser.flatMap((f) => f.id_functions ?? []).map(Number),
        },
      },
      select: {
        sigla: true,
        descricao: true,
      },
    });

    const funcoesPorPerfil = await prisma.tb_login_functions.findMany({
      where: {
        id_functions: {
          in: funcoesPerfil.flatMap((f) => f.id_functions ?? []).map(Number),
        },
      },
      select: {
        sigla: true,
        descricao: true,
      },
    });

    res.status(200).json({ 
      funcoes,
      totalFuncoes: funcoes.length,
      detalhes: {
        perfis: userPerfis.map(p => p.perfil_name),
        funcoesDirectas: funcoesDirectas.length,
        funcoesPorPerfil: funcoesPorPerfil.length,
      }
    });
  } catch (error) {
    console.error('Erro ao buscar funções do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar funções do usuário' });
  } finally {
    await prisma.$disconnect();
  }
}