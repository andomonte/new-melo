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
      pag_cof_id,
      cod_ccusto,
      // mesmos campos do cadastro (criar.ts): transportadora, comprador e internacional
      cod_transp,
      cod_comprador,
      eh_internacional,
      moeda,
      taxa_conversao,
      valor_moeda,
      nro_invoice,
      nro_contrato
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
           FROM dbfpgto f 
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

    if (pag_cof_id !== undefined) {
      // Vazio/inválido → NULL (coluna aceita NULL); senão o número da conta financeira
      const cofNum =
        pag_cof_id != null && String(pag_cof_id).trim() !== '' && !isNaN(parseInt(String(pag_cof_id), 10))
          ? parseInt(String(pag_cof_id), 10)
          : null;
      updates.push(`pag_cof_id = $${paramIndex}`);
      params.push(cofNum as any);
      paramIndex++;
    }

    // Texto: '' limpa o campo (NULL); corta no tamanho da coluna.
    const texto = (v: any, max: number) => {
      const t = v == null ? '' : String(v).trim();
      return t === '' ? null : t.slice(0, max);
    };
    const numero = (v: any) => {
      if (v == null || String(v).trim() === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? null : n;
    };
    const setar = (col: string, valor: any) => {
      updates.push(`${col} = $${paramIndex}`);
      params.push(valor);
      paramIndex++;
    };
    if (cod_transp !== undefined) setar('cod_transp', texto(cod_transp, 5));
    if (cod_comprador !== undefined) setar('codcomprador', texto(cod_comprador, 3));
    if (eh_internacional !== undefined) {
      const inter = eh_internacional === true || eh_internacional === 'S';
      setar('eh_internacional', inter ? 'S' : 'N');
      if (inter) {
        if (moeda !== undefined) setar('moeda', texto(moeda, 3));
        if (taxa_conversao !== undefined) setar('taxa_conversao', numero(taxa_conversao));
        if (valor_moeda !== undefined) setar('valor_moeda', numero(valor_moeda));
        if (nro_invoice !== undefined) setar('nro_invoice', texto(nro_invoice, 30));
        if (nro_contrato !== undefined) setar('nro_contrato', texto(nro_contrato, 30));
      } else {
        // deixou de ser internacional: limpa os campos de moeda estrangeira
        setar('moeda', null); setar('taxa_conversao', null); setar('valor_moeda', null);
        setar('nro_invoice', null); setar('nro_contrato', null);
      }
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