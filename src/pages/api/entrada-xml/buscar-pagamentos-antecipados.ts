/**
 * API de Busca de Pagamentos Antecipados para NFe
 *
 * Busca ordens de compra com pagamento antecipado (parcela 0) do mesmo fornecedor da NFe.
 * Usado quando o usuário quer configurar pagamento ANTES de associar a NFe a uma ordem.
 *
 * @method POST
 * @route /api/entrada-xml/buscar-pagamentos-antecipados
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { z } from 'zod';

const bodySchema = z.object({
  nfeId: z.string().min(1, "NFE ID é obrigatório"),
});

interface PagamentoAntecipado {
  ordem_id: number;
  req_id_composto: string;
  valor: number;
  vencimento: string;
  data_emissao: string;
  status: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  cod_pgto: string;
}

interface ResponseBody {
  success: boolean;
  data?: {
    pagamentos: PagamentoAntecipado[];
    nfe_info: {
      numero: string;
      valor_total: number;
      fornecedor_cnpj: string;
      fornecedor_nome: string;
    };
  };
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  const validation = bodySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'NFE ID é obrigatório'
    });
  }

  const { nfeId } = validation.data;

  console.log(`\n🔍 ===== BUSCANDO PAGAMENTOS ANTECIPADOS PARA NFe ${nfeId} =====`);

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // 1. Buscar informações da NFe e fornecedor (emitente)
    const nfeResult = await client.query(`
      SELECT
        nfe.codnfe_ent,
        nfe.nnf as numero,
        nfe.vnf as valor_total,
        emit.cpf_cnpj as fornecedor_cnpj,
        emit.xnome as fornecedor_nome
      FROM dbnfe_ent nfe
      LEFT JOIN dbnfe_ent_emit emit ON nfe.codnfe_ent = emit.codnfe_ent
      WHERE nfe.codnfe_ent = $1
    `, [nfeId]);

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NFe não encontrada no sistema'
      });
    }

    const nfeInfo = nfeResult.rows[0];
    const cnpjFornecedor = nfeInfo.fornecedor_cnpj?.replace(/\D/g, '');

    if (!cnpjFornecedor) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível identificar o CNPJ do fornecedor da NFe'
      });
    }

    console.log(`📄 NFe: ${nfeInfo.numero} - R$ ${parseFloat(nfeInfo.valor_total || 0).toFixed(2)}`);
    console.log(`🏢 Fornecedor: ${nfeInfo.fornecedor_nome} (${cnpjFornecedor})`);

    // 2. Buscar o código do credor pelo CNPJ
    const credorResult = await client.query(`
      SELECT cod_credor, nome
      FROM dbcredor
      WHERE REPLACE(REPLACE(REPLACE(cpf_cgc, '.', ''), '-', ''), '/', '') = $1
      LIMIT 1
    `, [cnpjFornecedor]);

    if (credorResult.rows.length === 0) {
      console.log(`⚠️ Fornecedor não encontrado na base de credores`);
      return res.status(200).json({
        success: true,
        data: {
          pagamentos: [],
          nfe_info: {
            numero: nfeInfo.numero || '',
            valor_total: parseFloat(nfeInfo.valor_total || 0),
            fornecedor_cnpj: cnpjFornecedor,
            fornecedor_nome: nfeInfo.fornecedor_nome || ''
          }
        },
        message: 'Fornecedor não encontrado na base de credores. Nenhum pagamento antecipado disponível.'
      });
    }

    const codCredor = credorResult.rows[0].cod_credor;
    console.log(`👤 Código do credor: ${codCredor}`);

    // 3. Buscar pagamentos antecipados (parcela 0) do mesmo fornecedor
    // que ainda não foram pagos e não estão cancelados
    const pagamentosResult = await client.query(`
      SELECT DISTINCT
        opc.orc_id as ordem_id,
        CONCAT(r.req_id, '.', r.req_versao) as req_id_composto,
        p.valor_pgto as valor,
        p.dt_venc as vencimento,
        p.dt_emissao as data_emissao,
        CASE
          WHEN p.paga = 'S' THEN 'PAGO'
          WHEN p.cancel = 'S' THEN 'CANCELADO'
          ELSE 'PENDENTE'
        END as status,
        c.nome as fornecedor_nome,
        c.cpf_cgc as fornecedor_cnpj,
        p.cod_pgto
      FROM dbpgto p
      INNER JOIN ordem_pagamento_conta opc ON p.cod_pgto = opc.cod_pgto
      INNER JOIN cmp_ordem_compra o ON opc.orc_id = o.orc_id
      INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      LEFT JOIN dbcredor c ON p.cod_credor = c.cod_credor
      WHERE opc.numero_parcela = 0
        AND p.paga = 'N'
        AND p.cancel = 'N'
        AND p.cod_credor = $1
        AND o.orc_status NOT IN ('CANCELADA', 'REPROVADA')
      ORDER BY p.dt_emissao DESC, opc.orc_id DESC
    `, [codCredor]);

    const pagamentos: PagamentoAntecipado[] = pagamentosResult.rows.map(row => ({
      ordem_id: Number(row.ordem_id),
      req_id_composto: row.req_id_composto || '',
      valor: parseFloat(row.valor || 0),
      vencimento: row.vencimento ? new Date(row.vencimento).toISOString() : '',
      data_emissao: row.data_emissao ? new Date(row.data_emissao).toISOString() : '',
      status: row.status || 'PENDENTE',
      fornecedor_nome: row.fornecedor_nome || '',
      fornecedor_cnpj: row.fornecedor_cnpj || '',
      cod_pgto: row.cod_pgto || ''
    }));

    console.log(`✅ Encontrado(s) ${pagamentos.length} pagamento(s) antecipado(s)`);

    if (pagamentos.length > 0) {
      const valorTotal = pagamentos.reduce((acc, p) => acc + p.valor, 0);
      console.log(`💰 Valor total disponível: R$ ${valorTotal.toFixed(2)}`);
    }

    return res.status(200).json({
      success: true,
      data: {
        pagamentos,
        nfe_info: {
          numero: nfeInfo.numero || '',
          valor_total: parseFloat(nfeInfo.valor_total || 0),
          fornecedor_cnpj: cnpjFornecedor,
          fornecedor_nome: nfeInfo.fornecedor_nome || ''
        }
      },
      message: pagamentos.length > 0
        ? `Encontrado(s) ${pagamentos.length} pagamento(s) antecipado(s)`
        : 'Nenhum pagamento antecipado encontrado para este fornecedor'
    });

  } catch (error) {
    console.error('❌ Erro ao buscar pagamentos antecipados:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar pagamentos antecipados',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
