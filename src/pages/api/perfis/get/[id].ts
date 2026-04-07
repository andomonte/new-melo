import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { PerfilCompleto } from '@/data/perfis/perfis'; // Importe a interface

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  let client: PoolClient | undefined;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID do perfil é obrigatório.' });
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const perfilDetalhadoResult = await client.query<any>(
      `
      SELECT
        p.login_perfil_name AS login_perfil_name,
        t."CODIGO_TELA",
        t."NOME_TELA",
        BOOL_OR(gp.cadastrar) AS cadastrar,
        BOOL_OR(gp.editar) AS editar,
        BOOL_OR(gp.remover) AS remover,
        BOOL_OR(gp.exportar) AS exportar,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT lap.id_functions), NULL) AS funcoes,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.login_user_login), NULL) AS usuarios
      FROM db_manaus.tb_login_perfil p
      LEFT JOIN db_manaus."tb_grupo_Permissao" gp ON gp."grupoId" = p.login_perfil_name
      LEFT JOIN db_manaus.tb_telas t ON t."CODIGO_TELA" = gp.tela
      LEFT JOIN db_manaus.tb_login_access_perfil lap ON lap.login_perfil_name = p.login_perfil_name
      LEFT JOIN db_manaus.tb_login_user u ON u.login_perfil_name = p.login_perfil_name
      WHERE p.login_perfil_name = $1
      GROUP BY p.login_perfil_name, t."CODIGO_TELA", t."NOME_TELA"
    `,
      [id],
    );

    const perfilDetalhado = perfilDetalhadoResult.rows;

    if (!perfilDetalhado || perfilDetalhado.length === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    // Formatar a resposta para a estrutura esperada
    const login_perfil_name = perfilDetalhado[0].login_perfil_name;
    const usuarios = perfilDetalhado[0].usuarios || [];
    const funcoesSet = new Set<number>();
    perfilDetalhado.forEach((item) => {
      (item.funcoes || []).forEach((funcId: string) =>
        funcoesSet.add(parseInt(funcId, 10)),
      );
    });
    const funcoes = Array.from(funcoesSet);

    const telasPermissoes: PerfilCompleto['telasPermissoes'] =
      perfilDetalhado.map((item) => ({
        CODIGO_TELA: item.CODIGO_TELA,
        NOME_TELA: item.NOME_TELA,
        cadastrar: item.cadastrar,
        editar: item.editar,
        remover: item.remover,
        exportar: item.exportar,
      }));

    const responseData: PerfilCompleto = {
      login_perfil_name,
      telasPermissoes,
      funcoes,
      usuarios: usuarios.map((user: string) => ({ login_user_login: user })),
    };

    return res.status(200).json(serializeBigInt(responseData));
  } catch (error) {
    console.error('Erro ao buscar perfil detalhado:', error);
    return res
      .status(500)
      .json({
        error: 'Erro ao buscar perfil detalhado.',
        details: (error as Error).message,
      });
  } finally {
    if (client) {
      client.release();
    }
  }
}
