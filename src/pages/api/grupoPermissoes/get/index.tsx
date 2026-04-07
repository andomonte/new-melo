import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { grupoId } = req.query;

  if (!grupoId || typeof grupoId !== 'string') {
    return res
      .status(400)
      .json({ error: 'Parâmetro grupoId é obrigatório e deve ser uma string' });
  }

  try {
    const pool = getPgPool();

    console.log('🔍 Buscando permissões para grupoId:', grupoId);

    const query = `
      SELECT
        gp.id,
        gp."grupoId",
        gp.editar,
        gp.cadastrar,
        gp.remover,
        gp.exportar,
        t."CODIGO_TELA",
        t."PATH_TELA",
        t."NOME_TELA"
      FROM "tb_grupo_Permissao" gp
      LEFT JOIN tb_telas t ON gp.tela = t."CODIGO_TELA"
      WHERE gp."grupoId" = $1
    `;

    const result = await pool.query(query, [grupoId]);

    const permissoes = result.rows.map((row) => ({
      id: row.id,
      grupoId: row.grupoId,
      editar: row.editar,
      cadastrar: row.cadastrar,
      remover: row.remover,
      exportar: row.exportar,
      tb_telas: {
        CODIGO_TELA: row.CODIGO_TELA,
        PATH_TELA: row.PATH_TELA,
        NOME_TELA: row.NOME_TELA,
      },
    }));

    res.status(200).json({ permissoes });
  } catch (error: any) {
    console.error('❌ Erro ao buscar permissões:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Erro ao buscar permissões',
      details: error.message,
    });
  }
}
