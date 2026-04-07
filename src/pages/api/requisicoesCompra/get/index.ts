// src/pages/api/requisicoesCompra/get/index.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

// Interface representando uma requisição de compra enriquecida com joins
interface RawRequisition {
  req_id: number;
  req_versao: number;
  req_id_composto?: string;
  req_data?: string;
  req_status?: string;
  req_cond_pagto?: string;
  req_observacao?: string;
  req_tipo?: string;

  orc_id?: number;
  orc_data?: string;
  orc_status?: string;

  fornecedor_codigo?: string;
  fornecedor_nome?: string;
  fornecedor_cpf_cnpj?: string;

  comprador_nome?: string;

  local_entrega?: string;
  destino?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | {
        data: RawRequisition[];
        meta: {
          total: number;
          lastPage: number;
          currentPage: number;
          perPage: number;
        };
      }
    | { error: string }
  >,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Parametrização de paginação e busca
  const page = parseInt((req.query.page as string) ?? '1', 10);
  const perPage = parseInt((req.query.perPage as string) ?? '10', 10);
  const search = (req.query.search as string) ?? '';
  const offset = (page - 1) * perPage;

  // WHERE dinâmico e parâmetros
  let whereSQL = '';
  const params: Array<string | number> = [];

  if (search) {
    whereSQL = `
      WHERE r.req_id_composto ILIKE $1
         OR dcred.nome        ILIKE $1
         OR dcmp.nome         ILIKE $1
    `;
    params.push(`%${search}%`);
  }

  // Adiciona LIMIT/OFFSET para paginação
  params.push(perPage, offset);

  // Query principal com todos os campos e joins
  const sql = `
    SELECT
      r.req_id,
      r.req_versao,
      r.req_id_composto,
      to_char(r.req_data, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS req_data,
      r.req_status,
      r.req_cond_pagto,
      r.req_observacao,
      r.req_tipo,
      r.req_cod_credor,

      o.orc_id,
      to_char(o.orc_data, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS orc_data,
      o.orc_status,

      -- Fornecedor: agora verifica na base correta
      COALESCE(dcred.cod_credor, r.req_cod_credor) AS fornecedor_codigo,
      COALESCE(dcred.nome, dcred.nome_fant, 'Código: ' || r.req_cod_credor || ' (não encontrado)') AS fornecedor_nome,
      dcred.cpf_cgc      AS fornecedor_cpf_cnpj,

      dcmp.nome          AS comprador_nome,

      ent.unm_nome       AS local_entrega,
      des.unm_nome       AS destino

    FROM cmp_requisicao r
    LEFT JOIN cmp_ordem_compra o
      ON o.orc_req_id = r.req_id
     AND o.orc_req_versao = r.req_versao
    LEFT JOIN dbcredor dcred
      ON dcred.cod_credor = r.req_cod_credor
    LEFT JOIN dbcompradores dcmp
      ON dcmp.codcomprador = r.req_codcomprador
    LEFT JOIN cad_unidade_melo ent
      ON ent.unm_id = r.req_unm_id_entrega
    LEFT JOIN cad_unidade_melo des
      ON des.unm_id = r.req_unm_id_destino

    ${whereSQL}
    ORDER BY r.req_data DESC, r.req_id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length};
  `;

  // Query para contar total de registros para paginação
  const countSql = `
    SELECT COUNT(*) AS total
    FROM cmp_requisicao r
    LEFT JOIN dbcredor dcred ON dcred.cod_credor = r.req_cod_credor
    LEFT JOIN dbcompradores dcmp ON dcmp.codcomprador = r.req_codcomprador
    ${whereSQL};
  `;

  try {
    const client = await pool.connect();
    const { rows } = await client.query<RawRequisition>(sql, params);
    // O parâmetro da busca deve ser só o termo, não o limit/offset!
    const countRes = await client.query<{ total: string }>(
      countSql,
      search ? [params[0]] : [],
    );
    client.release();

    const total = parseInt(countRes.rows[0].total, 10);
    const lastPage = total > 0 ? Math.ceil(total / perPage) : 1;

    res.status(200).json({
      data: rows,
      meta: { total, lastPage, currentPage: page, perPage },
    });
  } catch (err) {
    console.error('Erro ao buscar requisições:', err);
    res.status(500).json({ error: 'Falha ao buscar requisições de compra.' });
  }
}
