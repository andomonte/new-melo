import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface Divergencia {
  id: number;
  reqId: string;
  produto: string;
  descricaoProduto?: string;
  precoOC: number;
  precoNFe: number;
  diferencaPercentual: number;
  nivelAlerta: 'MEDIO' | 'ALTO' | 'CRITICO';
  dataOcorrencia: string;
  status: string;
  justificativa?: string;
}

interface ConsultarDivergenciasResponse {
  success: boolean;
  divergencias: Divergencia[];
  resumo: {
    total: number;
    criticas: number;
    altas: number;
    medias: number;
    valorTotalImpacto: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConsultarDivergenciasResponse | { error: string }>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const reqId = req.method === 'GET' ? req.query.reqId : req.body?.reqId;
  const status = (req.method === 'GET' ? req.query.status : req.body?.status) || 'PENDENTE';

  let client;

  try {
    client = await pool.connect();

    // Buscar divergências usando a função do banco
    const divergenciasResult = await client.query(`
      SELECT
        d.divergencia_id,
        d.requisicao_id,
        d.produto,
        p.descr as descricao_produto,
        d.preco_compra,
        d.preco_nfe_recebido,
        d.diferenca_pct,
        d.alerta,
        d.data_ocorrencia
      FROM db_manaus.consultar_divergencias_preco($1, $2) d
      LEFT JOIN db_manaus.dbprod p ON d.produto = p.codprod
      ORDER BY d.diferenca_pct DESC, d.data_ocorrencia DESC
    `, [reqId || null, status]);

    // Processar e formatar as divergências
    const divergencias: Divergencia[] = divergenciasResult.rows.map(row => {
      let nivelAlerta: 'MEDIO' | 'ALTO' | 'CRITICO' = 'MEDIO';

      if (row.diferenca_pct > 20) {
        nivelAlerta = 'CRITICO';
      } else if (row.diferenca_pct > 10) {
        nivelAlerta = 'ALTO';
      }

      return {
        id: row.divergencia_id,
        reqId: row.requisicao_id?.toString() || '',
        produto: row.produto || '',
        descricaoProduto: row.descricao_produto || '',
        precoOC: parseFloat(row.preco_compra || '0'),
        precoNFe: parseFloat(row.preco_nfe_recebido || '0'),
        diferencaPercentual: parseFloat(row.diferenca_pct || '0'),
        nivelAlerta,
        dataOcorrencia: row.data_ocorrencia ? new Date(row.data_ocorrencia).toLocaleString('pt-BR') : '',
        status: 'PENDENTE',
        justificativa: ''
      };
    });

    // Calcular resumo
    const criticas = divergencias.filter(d => d.nivelAlerta === 'CRITICO').length;
    const altas = divergencias.filter(d => d.nivelAlerta === 'ALTO').length;
    const medias = divergencias.filter(d => d.nivelAlerta === 'MEDIO').length;

    // Calcular impacto financeiro total
    const valorTotalImpacto = divergencias.reduce((total, div) => {
      return total + Math.abs(div.precoNFe - div.precoOC);
    }, 0);

    // Se não houver divergências recentes, buscar no histórico
    if (divergencias.length === 0 && !reqId) {
      console.log('Nenhuma divergência pendente encontrada. Buscando histórico recente...');

      const historicoResult = await client.query(`
        SELECT
          dp.id as divergencia_id,
          dp.req_id as requisicao_id,
          dp.produto_cod as produto,
          p.descr as descricao_produto,
          dp.preco_oc as preco_compra,
          dp.preco_nfe as preco_nfe_recebido,
          dp.diferenca_percentual as diferenca_pct,
          CASE
            WHEN dp.diferenca_percentual > 20 THEN 'CRITICO - Divergencia muito alta'
            WHEN dp.diferenca_percentual > 10 THEN 'ALTO - Requer atencao'
            ELSE 'MEDIO - Dentro da margem aceitavel'
          END as alerta,
          dp.data_registro as data_ocorrencia,
          dp.status,
          dp.justificativa
        FROM db_manaus.divergencias_preco dp
        LEFT JOIN db_manaus.dbprod p ON dp.produto_cod = p.codprod
        WHERE dp.data_registro > CURRENT_DATE - INTERVAL '30 days'
        ORDER BY dp.data_registro DESC
        LIMIT 10
      `);

      if (historicoResult.rows.length > 0) {
        console.log(`Encontradas ${historicoResult.rows.length} divergências no histórico recente`);
      }
    }

    console.log(`Retornando ${divergencias.length} divergências${reqId ? ` para requisição ${reqId}` : ''}`);

    res.status(200).json({
      success: true,
      divergencias,
      resumo: {
        total: divergencias.length,
        criticas,
        altas,
        medias,
        valorTotalImpacto
      }
    });

  } catch (err) {
    console.error('Erro ao consultar divergências:', err);
    res.status(500).json({
      error: 'Falha ao consultar divergências de preço.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}