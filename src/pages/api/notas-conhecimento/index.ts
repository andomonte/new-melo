import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export interface NotaConhecimento {
  codtransp: string;
  nrocon: string;
  serie: string;
  totalcon: number;
  totaltransp: number;
  dtcon: string;
  dtemissao: string;
  pago: string;
  cancel: string;
  cfop: string;
  icms: number;
  baseicms: number;
  tipocon: string;
  chave: string;
  protocolo: string;
  // Dados da transportadora (JOIN)
  nome_transp?: string;
  // Dados do pagamento (se existir)
  cod_pgto?: string;
  dt_pgto?: string;
  valor_pago?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const pool = getPgPool();

  try {
    const {
      page = 1,
      limit = 20,
      data_inicio,
      data_fim,
      codtransp,
      nrocon,
      search
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Construir filtros WHERE
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    // Filtro por período
    if (data_inicio) {
      whereClause += ` AND ce.dtcon >= $${paramIndex}`;
      params.push(data_inicio);
      paramIndex++;
    }

    if (data_fim) {
      whereClause += ` AND ce.dtcon <= $${paramIndex}`;
      params.push(data_fim);
      paramIndex++;
    }

    // Filtro por transportadora
    if (codtransp) {
      whereClause += ` AND ce.codtransp = $${paramIndex}`;
      params.push(codtransp);
      paramIndex++;
    }

    // Filtro por número do conhecimento
    if (nrocon) {
      whereClause += ` AND ce.nrocon LIKE $${paramIndex}`;
      params.push(`%${nrocon}%`);
      paramIndex++;
    }

    // Filtro fixo: apenas pendentes (não pagos e não cancelados)
    whereClause += ` AND (ce.pago IS NULL OR ce.pago = 'N') AND (ce.cancel IS NULL OR ce.cancel != 'S')`;

    // REMOVIDO: Não filtra mais CT-es com conta gerada
    // Agora eles aparecem na listagem, mas sem checkbox
    // whereClause += ` AND c.codpgto IS NULL`;

    // Busca geral
    if (search) {
      whereClause += ` AND (
        ce.nrocon LIKE $${paramIndex} OR
        ce.codtransp LIKE $${paramIndex} OR
        t.nome LIKE $${paramIndex} OR
        ce.chave LIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const query = `
      SELECT DISTINCT ON (ce.codtransp, ce.nrocon, ce.serie)
        ce.codtransp,
        ce.nrocon,
        ce.serie,
        COALESCE(ce.totalcon, 0) as totalcon,
        COALESCE(ce.totaltransp, 0) as totaltransp,
        ce.dtcon,
        ce.dtemissao,
        ce.pago,
        ce.cancel,
        ce.cfop,
        COALESCE(ce.icms, 0) as icms,
        COALESCE(ce.baseicms, 0) as baseicms,
        ce.tipocon,
        ce.chave,
        ce.protocolo,
        t.nome as nome_transp,
        c.codpgto as cod_pgto,
        p.dt_pgto,
        COALESCE(p.valor_pgto, 0) as valor_pago
      FROM db_manaus.dbconhecimentoent ce
      LEFT JOIN db_manaus.dbtransp t ON t.codtransp = ce.codtransp
      LEFT JOIN db_manaus.dbconhecimento c ON c.nrocon = ce.nrocon AND c.codtransp = ce.codtransp
      LEFT JOIN db_manaus.dbpgto p ON p.cod_pgto = c.codpgto
      WHERE 1=1 ${whereClause}
      ORDER BY ce.codtransp, ce.nrocon, ce.serie, p.dt_pgto DESC NULLS LAST, ce.dtcon DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Query de contagem total (DISTINCT para evitar contar duplicatas)
    const countQuery = `
      SELECT COUNT(DISTINCT (ce.codtransp, ce.nrocon, ce.serie)) as total
      FROM db_manaus.dbconhecimentoent ce
      LEFT JOIN db_manaus.dbtransp t ON t.codtransp = ce.codtransp
      LEFT JOIN db_manaus.dbconhecimento c ON c.nrocon = ce.nrocon AND c.codtransp = ce.codtransp
      LEFT JOIN db_manaus.dbpgto p ON p.cod_pgto = c.codpgto
      WHERE 1=1 ${whereClause}
    `;

    const countParams = params.slice(0, -2);
    const countResult = await pool.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit as string));

    // Formatar dados
    const notasFormatadas = result.rows.map(row => ({
      ...row,
      dtcon: row.dtcon ? new Date(row.dtcon).toISOString().split('T')[0] : null,
      dtemissao: row.dtemissao ? new Date(row.dtemissao).toISOString().split('T')[0] : null,
      dt_pgto: row.dt_pgto ? new Date(row.dt_pgto).toISOString().split('T')[0] : null,
      totalcon: parseFloat(row.totalcon || 0),
      totaltransp: parseFloat(row.totaltransp || 0),
      icms: parseFloat(row.icms || 0),
      baseicms: parseFloat(row.baseicms || 0),
      valor_pago: parseFloat(row.valor_pago || 0),
    }));

    res.status(200).json({
      notas_conhecimento: notasFormatadas,
      paginacao: {
        pagina: parseInt(page as string),
        limite: parseInt(limit as string),
        total: total,
        totalPaginas: totalPages
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao consultar notas de conhecimento:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
