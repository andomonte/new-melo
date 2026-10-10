/**
 * GET /api/importacao/list
 * Lista importações com filtros opcionais
 *
 * Query params:
 * - busca: busca por nro_di ou navio
 * - status: N | E | C
 * - com_nota: '1' lista só DIs que já têm nota de nacionalização emitida
 *             (tela "Gerar Entrada"). Guardado por to_regclass: se a tabela
 *             dbent_importacao_nfe (modelo do P4) ainda não existir, nada casa.
 * - todas:    '1' (modo dev) ignora o filtro com_nota — permite testar o fluxo
 *             de entrada antes de o P4 (emissão) existir.
 * - page: número da página (default 1)
 * - limit: itens por página (default 25)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const busca = (req.query.busca as string) || '';
  const status = (req.query.status as string) || '';
  const comNota = req.query.com_nota === '1';
  const todas = req.query.todas === '1';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
  const offset = (page - 1) * limit;

  const pool = getPgPool(filial);

  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (busca) {
      conditions.push(`(i.nro_di ILIKE $${paramIdx} OR i.navio ILIKE $${paramIdx})`);
      params.push(`%${busca}%`);
      paramIdx++;
    }

    if (status && ['N', 'E', 'C'].includes(status)) {
      conditions.push(`i.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    // Filtro "só com nota de nacionalização emitida" (tela Gerar Entrada).
    // Guardado por to_regclass: a tabela dbent_importacao_nfe é o modelo do P4
    // (emissão) e pode ainda não existir no schema — nesse caso o filtro não
    // casa nenhuma DI. O modo dev `todas=1` ignora o filtro para permitir testar.
    if (comNota && !todas) {
      const existe = await pool.query(
        `SELECT to_regclass('dbent_importacao_nfe') IS NOT NULL AS existe`,
      );
      if (existe.rows[0]?.existe) {
        conditions.push(
          `EXISTS (SELECT 1 FROM dbent_importacao_nfe n WHERE n.id_importacao = i.id)`,
        );
      } else {
        // Tabela do P4 ainda não existe → nenhuma DI tem nota emitida.
        conditions.push('1 = 0');
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM dbent_importacao i ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch rows
    const dataResult = await pool.query(
      `SELECT
        i.id, i.nro_di, i.data_di, i.status, i.tipo_die, i.taxa_dolar,
        i.total_mercadoria, i.frete, i.seguro, i.thc, i.total_cif,
        i.pis_cofins, i.ii, i.ipi, i.siscomex, i.anuencia,
        i.peso_liquido, i.qtd_adicoes, i.navio,
        i.data_entrada_brasil, i.codusr, i.data_cad
      FROM dbent_importacao i
      ${where}
      ORDER BY i.data_cad DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar importações:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao listar importações',
    });
  }
}
