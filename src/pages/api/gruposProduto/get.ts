// src/pages/api/gruposProduto/get.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Mantenha se precisar serializar BigInts
import { parseCookies } from 'nookies';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string; // O termo de busca para filtrar os grupos de produtos
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '9999', search = '' }: GetParams = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNumber = parseInt(page, 10);
    const perPageNumber = parseInt(perPage, 10);
    const offset = (pageNumber - 1) * perPageNumber;
    const searchTerm = `%${search}%`; // Termo de busca para usar em LIKE

    // Consulta para buscar os grupos de produtos com paginação e filtro
    // *** CORRIGIDO AQUI: USANDO 'dbgpprod' EM VEZ DE 'dbgrupodeprodutos' ***
    const gruposProdutosResult = await client.query(
      `
      SELECT codgpp, descr, codvend, descbalcao, dscrev30, dscrev45, dscrev60, dscrv30, dscrv45, dscrv60, dscbv30, dscbv45, dscbv60, dscpv30, dscpv45, dscpv60, comgpp, comgpptmk, comgppextmk, codseg, diasreposicao, codcomprador, ramonegocio, gpp_id, p_comercial, v_marketing, codgpc, margem_min_venda, margem_med_venda, margem_ide_venda, bloquear_preco, codgrupai, codgrupoprod, "DSCBALCAO"
      FROM dbgpprod
      WHERE
        codgpp ILIKE $1 OR
        descr ILIKE $1
      ORDER BY codgpp
      OFFSET $2
      LIMIT $3
    `,
      [searchTerm, offset, perPageNumber],
    );

    const gruposProdutos = gruposProdutosResult.rows;

    // Consulta para obter a contagem total de grupos de produtos (para a paginação)
    // *** CORRIGIDO AQUI: USANDO 'dbgpprod' EM VEZ DE 'dbgrupodeprodutos' ***
    const countResult = await client.query(
      `
      SELECT COUNT(*) as total
      FROM dbgpprod
      WHERE
        codgpp ILIKE $1 OR
        descr ILIKE $1
    `,
      [searchTerm],
    );
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: gruposProdutos.map((grupo) => serializeBigInt(grupo)),
      meta: {
        total: total,
        lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar grupos de produtos:', error);
    res.status(500).json({ error: 'Erro ao buscar grupos de produtos' });
  } finally {
    if (client) {
      client.release();
    }
  }
}