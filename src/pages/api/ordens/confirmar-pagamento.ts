import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    ordem_id,
    valor_pagamento,
    data_pagamento,
    observacoes,
    status_pagamento
  } = req.body;

  if (!ordem_id || !valor_pagamento || !data_pagamento) {
    return res.status(400).json({
      success: false,
      message: 'Dados obrigatórios: ordem_id, valor_pagamento, data_pagamento'
    });
  }

  const ordemId = Number(ordem_id);

  if (isNaN(ordemId)) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem deve ser um número válido'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    // Verificar se a ordem existe e buscar dados completos
    const checkResult = await client.query(`
      SELECT
        o.orc_id,
        o.orc_status,
        o.orc_data,
        r.req_cod_credor,
        r.req_id_composto,
        c.nome as fornecedor_nome,
        r.req_observacao,
        SUM(ri.itr_quantidade * ri.itr_pr_unitario) as valor_total
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      INNER JOIN cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
      LEFT JOIN dbcredor c ON c.cod_credor = r.req_cod_credor
      WHERE o.orc_id = $1
      GROUP BY o.orc_id, o.orc_status, o.orc_data, r.req_cod_credor, r.req_id_composto, c.nome, r.req_observacao
    `, [ordemId]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    const ordem = checkResult.rows[0];

    // Verificar se já existe conta a pagar para esta ordem
    const contaExistente = await client.query(`
      SELECT pe.codpgto
      FROM dbpgto_ent pe
      WHERE pe.codent = $1
    `, [ordemId.toString()]);

    if (contaExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Já existe conta a pagar para esta ordem'
      });
    }

    // Atualizar status da ordem para 'C' (Confirmado)
    const updateResult = await client.query(
      `UPDATE cmp_ordem_compra
       SET orc_status = 'C'
       WHERE orc_id = $1
       RETURNING orc_id, orc_status`,
      [ordemId]
    );

    // 🏦 GERAR CONTA A PAGAR AUTOMATICAMENTE
    console.log('💰 Gerando conta a pagar para ordem com pagamento antecipado...');

    // Calcular data de vencimento (30 dias da data atual para pagamentos antecipados)
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 30);

    // Gerar próximo código de pagamento
    const maxCodResult = await client.query(`
      SELECT COALESCE(MAX(CAST(cod_pgto AS INTEGER)), 0) + 1 as next_cod
      FROM dbpgto
      WHERE cod_pgto ~ '^[0-9]+$'
    `);
    const nextCod = maxCodResult.rows[0].next_cod.toString().padStart(9, '0');

    // Inserir conta a pagar
    const contaPagarResult = await client.query(`
      INSERT INTO dbpgto (
        cod_pgto,
        cod_credor,
        cod_conta,
        cod_ccusto,
        dt_venc,
        dt_emissao,
        valor_pgto,
        valor_pago,
        nro_nf,
        obs,
        tem_nota,
        tipo,
        paga,
        cancel,
        codcomprador,
        valor_juros,
        pag_cof_id
      ) VALUES (
        $1, $2, '0001', '0001', $3, $4, $5, 0, NULL, $6, 'N', 'F', 'N', 'N', '000', 0, 1
      ) RETURNING cod_pgto
    `, [
      nextCod,
      ordem.req_cod_credor,
      dataVencimento.toISOString().split('T')[0],
      data_pagamento,
      parseFloat(valor_pagamento),
      `Conta gerada automaticamente da ordem ${ordemId} - Pagamento antecipado: R$ ${parseFloat(valor_pagamento).toFixed(2)}`
    ]);

    const codPgto = contaPagarResult.rows[0].cod_pgto;
    console.log(`💰 Conta a pagar criada com código: ${codPgto}`);

    // Inserir ligação ordem x conta a pagar
    await client.query(`
      INSERT INTO dbpgto_ent (codent, codpgto)
      VALUES ($1, $2)
    `, [ordemId.toString(), codPgto]);

    console.log(`🔗 Ligação criada: Ordem ${ordemId} → Conta ${codPgto}`);
    console.log(`✅ Conta a pagar gerada: R$ ${parseFloat(valor_pagamento).toFixed(2)} - Vencimento: ${dataVencimento.toLocaleDateString('pt-BR')}`);

    await client.query('COMMIT');

    const updatedOrder = updateResult.rows[0];

    console.log('DEBUG - Pagamento confirmado:', {
      ordemId: updatedOrder.orc_id,
      novoStatus: updatedOrder.orc_status,
      valorPagamento: valor_pagamento,
      dataPagamento: data_pagamento,
      contaPagarGerada: codPgto
    });

    res.status(200).json({
      success: true,
      message: 'Pagamento confirmado e conta a pagar gerada com sucesso',
      data: {
        ordemId: updatedOrder.orc_id,
        status: updatedOrder.orc_status,
        valorPagamento: valor_pagamento,
        dataPagamento: data_pagamento,
        observacoes: observacoes,
        contaPagarId: codPgto,
        dataVencimento: dataVencimento.toISOString().split('T')[0]
      }
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao confirmar pagamento:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao confirmar pagamento',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}