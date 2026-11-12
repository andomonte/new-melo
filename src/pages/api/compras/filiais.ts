import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

// Unidades Melo (cad_unidade_melo) para "Entrega em" / "Destinado para".
// Devolve TODAS (ativas e inativas): a tela de nova requisição mostra só as
// ativas; a de edição mantém a unidade já gravada mesmo se foi inativada; a de
// visualização só precisa do nome. nome_filial = filial do sistema ligada
// (define a unidade padrão de quem está logado nela).
interface Filial {
  unm_id: string;
  unm_nome: string;
  unm_ativo: string;
  unm_codigo_filial: string | null;
  nome_filial: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Filial[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query<Filial>(`
      SELECT u.unm_id, u.unm_nome,
             COALESCE(u.unm_ativo, 'S') AS unm_ativo,
             u.unm_codigo_filial, f.nome_filial
        FROM cad_unidade_melo u
        LEFT JOIN tb_filial f ON f.codigo_filial = u.unm_codigo_filial
       ORDER BY u.unm_nome
    `);
    
    client.release();
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar filiais:', err);
    res.status(500).json({ error: 'Falha ao buscar filiais.' });
  }
}