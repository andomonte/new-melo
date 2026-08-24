import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/venda-itens?codvenda=XXXX
 * Itens da venda (Referência, Marca, Qtde, Pç.Unit) — para o grid inferior da
 * tela de Fechar Vendas.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  const codvenda = String(req.query.codvenda || '').trim();
  if (!codvenda) return res.status(400).json({ erro: 'codvenda é obrigatório.' });

  try {
    const { rows } = await getPgPool().query(
      `SELECT p.ref AS referencia, COALESCE(p.aplic_extendida, p.descr) AS descr, m.descr AS marca, iv.qtd AS qtde, iv.prunit
         FROM dbitvenda iv
         LEFT JOIN dbprod p ON p.codprod = iv.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
        WHERE iv.codvenda = $1
        ORDER BY p.ref`,
      [codvenda],
    );
    return res.status(200).json({ itens: rows });
  } catch (error: any) {
    console.error('Erro ao buscar itens da venda:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao buscar itens da venda.', detalhes: error?.message });
  }
}
