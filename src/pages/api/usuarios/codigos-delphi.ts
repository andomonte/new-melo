// Usuários do Delphi de UMA filial, para o campo "Código Delphi" do cadastro.
//
// A filial vem por parâmetro, não pelo cookie: quem cadastra pode estar logado
// em Manaus e estar montando a linha de Roraima — e cada filial tem seu próprio
// cadastro de usuários (dbusuario_delphi é por schema, carregada do Oracle
// daquela filial).
//
// GET /api/usuarios/codigos-delphi?filial=RORAIMA

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolPorNomeFilial } from '@/lib/pg';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  const cookies = parseCookies({ req });
  const filial = String(req.query.filial || cookies.filial_melo || '').trim();
  if (!filial) return res.status(400).json({ erro: 'Informe a filial.' });

  const search = String(req.query.search || '').trim();

  try {
    const pool = await getPgPoolPorNomeFilial(filial);
    const params: any[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE codusr ILIKE $1 OR nomeusr ILIKE $1`;
    }
    const { rows } = await pool.query(
      `SELECT codusr AS value, codusr || ' - ' || COALESCE(btrim(nomeusr), '') AS label, nomeusr
       FROM dbusuario_delphi
       ${where}
       ORDER BY nomeusr, codusr
       LIMIT 500`,
      params,
    );
    return res.status(200).json({ sucesso: true, filial, usuarios: rows });
  } catch (error) {
    console.error('Erro ao buscar códigos do Delphi:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar usuários do Delphi',
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
