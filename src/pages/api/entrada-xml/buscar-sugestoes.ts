import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface Sugestao {
  reqId: string;
  reqIdComposto: string;
  fornecedor: string;
  quantidade: number;
  quantidadeAtendida: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
  confianca: number;
  motivo: string;
  dataRequisicao: string;
  status: string;
}

interface BuscarSugestoesResponse {
  success: boolean;
  sugestoes: Sugestao[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BuscarSugestoesResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { produtoCod, fornecedorCod, limite = 5 } = req.body;

  if (!produtoCod) {
    return res.status(400).json({
      error: 'Código do produto é obrigatório'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Buscar sugestões usando a função do banco
    const sugestoesResult = await client.query(`
      SELECT
        s.req_id_sugerido,
        s.req_id_composto,
        s.confianca,
        s.motivo,
        r.req_status,
        r.req_data,
        r.req_cod_credor,
        f.for_nome as fornecedor_nome,
        ri.itr_quantidade,
        ri.itr_pr_unitario,
        COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
        (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel
      FROM db_manaus.buscar_sugestoes_associacao($1, $2, $3) s
      INNER JOIN db_manaus.cmp_requisicao r ON s.req_id_sugerido = r.req_id
      LEFT JOIN db_manaus.cad_fornecedor f ON r.req_cod_credor = f.for_id
      INNER JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id
      WHERE ri.itr_codprod = $1
      ORDER BY s.confianca DESC, s.req_id_sugerido DESC
    `, [produtoCod, fornecedorCod, limite]);

    // Se não houver sugestões baseadas em histórico, buscar requisições disponíveis
    let sugestoes = sugestoesResult.rows;

    if (sugestoes.length === 0) {
      console.log(`Sem sugestões baseadas em histórico para produto ${produtoCod}. Buscando requisições disponíveis...`);

      const requisicoesDisponiveis = await client.query(`
        SELECT
          r.req_id as req_id_sugerido,
          r.req_id_composto,
          0.3 as confianca,
          'Requisição disponível sem histórico' as motivo,
          r.req_status,
          r.req_data,
          r.req_cod_credor,
          f.for_nome as fornecedor_nome,
          ri.itr_quantidade,
          ri.itr_pr_unitario,
          COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
          (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as quantidade_disponivel
        FROM db_manaus.cmp_requisicao r
        INNER JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id
        LEFT JOIN db_manaus.cad_fornecedor f ON r.req_cod_credor = f.for_id
        WHERE ri.itr_codprod = $1
          AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
          AND r.req_status IN ('P', 'A')
          ${fornecedorCod ? 'AND r.req_cod_credor = $2' : ''}
        ORDER BY r.req_data DESC
        LIMIT $${fornecedorCod ? 3 : 2}
      `, fornecedorCod ? [produtoCod, fornecedorCod, limite] : [produtoCod, limite]);

      sugestoes = requisicoesDisponiveis.rows;
    }

    // Formatar as sugestões
    const sugestoesFormatadas: Sugestao[] = sugestoes.map(row => ({
      reqId: row.req_id_sugerido?.toString() || '',
      reqIdComposto: row.req_id_composto || '',
      fornecedor: row.fornecedor_nome || 'Não informado',
      quantidade: parseFloat(row.itr_quantidade || '0'),
      quantidadeAtendida: parseFloat(row.quantidade_atendida || '0'),
      quantidadeDisponivel: parseFloat(row.quantidade_disponivel || '0'),
      valorUnitario: parseFloat(row.itr_pr_unitario || '0'),
      confianca: parseFloat(row.confianca || '0'),
      motivo: row.motivo || '',
      dataRequisicao: row.req_data ? new Date(row.req_data).toLocaleDateString('pt-BR') : '',
      status: row.req_status || ''
    }));

    console.log(`Retornando ${sugestoesFormatadas.length} sugestões para produto ${produtoCod}`);

    res.status(200).json({
      success: true,
      sugestoes: sugestoesFormatadas
    });

  } catch (err) {
    console.error('Erro ao buscar sugestões:', err);
    res.status(500).json({
      error: 'Falha ao buscar sugestões de associação.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}