import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ erro: 'Método não permitido. Use PUT.' });
  }

  try {
    const { id } = req.query;
    const {
      dt_venc,
      dt_emissao,
      valor_pgto,
      obs,
      nro_nf,
      nro_dup,
      cod_credor,
      cod_conta,
      cod_ccusto
    } = req.body;

    if (!id) {
      return res.status(400).json({ erro: 'ID da conta a pagar é obrigatório.' });
    }

    // Verificar se a conta existe e pode ser editada
    const checkQuery = `
      SELECT 
        p.paga, 
        p.cancel,
        p.nro_dup,
        COALESCE(
          (SELECT SUM(f.valor_pgto) 
           FROM db_manaus.dbfpgto f 
           WHERE f.cod_pgto = p.cod_pgto 
             AND (f.cancel IS NULL OR f.cancel != 'S')
          ), 0
        ) as total_pago
      FROM dbpgto p
      WHERE p.cod_pgto = $1
    `;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta a pagar não encontrada.' });
    }

    const conta = checkResult.rows[0];

    // ✅ REGRA CORRETA: Não permite editar se JÁ TEM PAGAMENTOS registrados no histórico
    if (parseFloat(conta.total_pago) > 0) {
      return res.status(400).json({ 
        erro: 'Não é possível editar uma conta que já possui pagamentos registrados.',
        detalhes: `Total pago: R$ ${parseFloat(conta.total_pago).toFixed(2)}`
      });
    }

    if (conta.cancel === 'S') {
      return res.status(400).json({ erro: 'Não é possível editar uma conta cancelada.' });
    }

    // Construir query de atualização dinâmica
    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (dt_venc !== undefined) {
      updates.push(`dt_venc = $${paramIndex}`);
      params.push(dt_venc);
      paramIndex++;
    }

    if (dt_emissao !== undefined) {
      updates.push(`dt_emissao = $${paramIndex}`);
      params.push(dt_emissao);
      paramIndex++;
    }

    if (valor_pgto !== undefined) {
      updates.push(`valor_pgto = $${paramIndex}`);
      params.push(valor_pgto);
      paramIndex++;
    }

    if (obs !== undefined) {
      updates.push(`obs = $${paramIndex}`);
      params.push(obs);
      paramIndex++;
    }

    if (nro_nf !== undefined) {
      updates.push(`nro_nf = $${paramIndex}`);
      params.push(nro_nf);
      paramIndex++;
    }

    if (nro_dup !== undefined) {
      updates.push(`nro_dup = $${paramIndex}`);
      params.push(nro_dup);
      paramIndex++;
    }

    if (cod_credor !== undefined) {
      updates.push(`cod_credor = $${paramIndex}`);
      params.push(cod_credor);
      paramIndex++;
    }

    if (cod_conta !== undefined) {
      updates.push(`cod_conta = $${paramIndex}`);
      params.push(cod_conta);
      paramIndex++;
    }

    if (cod_ccusto !== undefined) {
      updates.push(`cod_ccusto = $${paramIndex}`);
      params.push(cod_ccusto);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar foi fornecido.' });
    }

    const updateQuery = `
      UPDATE dbpgto
      SET ${updates.join(', ')}
      WHERE cod_pgto = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, params);

    res.status(200).json({
      sucesso: true,
      mensagem: 'Conta a pagar atualizada com sucesso.',
      conta: updateResult.rows[0]
    });

  } catch (error: any) {
    console.error('❌ Erro ao editar conta a pagar:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}