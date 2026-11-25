import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/** Detalhe da nota de serviço: cabeçalho, serviço, cliente e títulos (dbreceb tipo 'S'). */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const codfat = String(req.query.codfat || '').trim();
  try {
    const nota = (await pool.query(
      `SELECT n.*, n.dtemissao::text AS dtemissao, n.data::text AS data, c.nome AS nome_cliente, c.cpfcgc AS doc_cliente
         FROM nfs_nota n LEFT JOIN dbclien c ON c.codcli = n.codcli WHERE n.codfat = $1`, [codfat])).rows[0];
    if (!nota) return res.status(404).json({ erro: 'Nota não encontrada.' });
    const servicos = (await pool.query(
      `SELECT s.sen_id, s.descr, s.qtde, s.prunit, sv.sen_codigo, sv.sen_cnae, sv.sen_atividade
         FROM nfs_nota_servico s LEFT JOIN dbservico_nfs sv ON sv.sen_id = s.sen_id WHERE s.codfat = $1 ORDER BY s.id`,
      [codfat])).rows;
    const titulos = (await pool.query(
      `SELECT cod_receb, nro_doc, dt_emissao::text AS dt_emissao, dt_venc::text AS dt_venc, valor_pgto, valor_rec,
              rec, cancel, forma_fat, banco, cod_conta, dt_pgto::text AS dt_pgto
         FROM dbreceb WHERE tipo = 'S' AND cod_fat = $1 ORDER BY dt_venc, nro_doc`, [codfat])).rows;
    return res.status(200).json({ nota, servicos, titulos });
  } catch (e: any) {
    console.error('Erro ao buscar nota de serviço:', e);
    return res.status(500).json({ erro: 'Erro ao buscar a nota de serviço', detalhes: e?.message });
  }
}
