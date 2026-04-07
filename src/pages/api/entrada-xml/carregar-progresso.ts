import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface ItemAssociation {
  pedidoId: string;
  quantidade: number;
  valorUnitario: number;
}

interface ItemProgresso {
  nfeItemId: string;
  produtoId: string;
  produtoDescricao?: string;
  associacoes: ItemAssociation[];
  status: 'associated' | 'partial';
  quantidadeTotal: number;
}

interface CarregarProgressoResponse {
  success: boolean;
  data?: {
    items: ItemProgresso[];
    totalItens: number;
    itensAssociados: number;
    percentual: number;
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CarregarProgressoResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId } = req.query;

  if (!nfeId || typeof nfeId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'NFE ID é obrigatório'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    console.log(`🔍 Carregando progresso salvo para NFe ${nfeId}`);

    // Buscar total de itens da NFe
    const totalItensResult = await client.query(`
      SELECT COUNT(*) as total
      FROM dbnfe_ent_det
      WHERE codnfe_ent = $1
    `, [nfeId]);

    const totalItens = parseInt(totalItensResult.rows[0]?.total || 0);

    // Buscar associações salvas
    const associacoesResult = await client.query(`
      SELECT
        nia.nfe_item_id,
        nia.produto_cod,
        nia.quantidade_associada,
        nia.valor_unitario,
        nia.status,
        p.descr as produto_descricao,
        COALESCE(
          json_agg(
            json_build_object(
              'pedidoId', nipa.req_id,
              'quantidade', nipa.quantidade,
              'valorUnitario', nipa.valor_unitario
            )
          ) FILTER (WHERE nipa.req_id IS NOT NULL),
          '[]'::json
        ) as associacoes
      FROM nfe_item_associacao nia
      LEFT JOIN nfe_item_pedido_associacao nipa ON nia.id = nipa.nfe_associacao_id
      LEFT JOIN dbprod p ON nia.produto_cod = p.codprod
      WHERE nia.nfe_id = $1
      GROUP BY nia.nfe_item_id, nia.produto_cod, nia.quantidade_associada, nia.valor_unitario, nia.status, p.descr
      ORDER BY nia.nfe_item_id
    `, [nfeId]);

    const items: ItemProgresso[] = associacoesResult.rows.map((row: any) => ({
      nfeItemId: row.nfe_item_id.toString(),
      produtoId: row.produto_cod,
      produtoDescricao: row.produto_descricao,
      associacoes: row.associacoes,
      status: row.status === 'ASSOCIADO' ? 'associated' : 'partial',
      quantidadeTotal: parseFloat(row.quantidade_associada || 0)
    }));

    const itensAssociados = items.length;
    const percentual = totalItens > 0 ? (itensAssociados / totalItens) * 100 : 0;

    console.log(`✅ Progresso carregado: ${itensAssociados}/${totalItens} itens (${percentual.toFixed(1)}%)`);

    return res.status(200).json({
      success: true,
      data: {
        items,
        totalItens,
        itensAssociados,
        percentual: parseFloat(percentual.toFixed(2))
      }
    });

  } catch (err) {
    console.error('❌ Erro ao carregar progresso:', err);

    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar progresso salvo'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
