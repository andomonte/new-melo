  import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();
// API para editar um título a receber existente
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ erro: 'Método não permitido. Use PUT.' });
  }

  try {
    const { cod_receb } = req.query;
    const {
      dt_venc,
      dt_emissao,
      valor_pgto,
      nro_doc,
      codcli,
      rec_cof_id
    } = req.body;

    if (!cod_receb) {
      return res.status(400).json({ erro: 'cod_receb é obrigatório.' });
    }

    // Verificar se o título existe e pode ser editado
    const checkQuery = `
      SELECT 
        r.cod_receb,
        r.rec,
        r.cancel,
        r.nro_doc,
        COALESCE(
          (SELECT SUM(f.valor) 
           FROM db_manaus.dbfreceb f 
           WHERE f.cod_receb = r.cod_receb
          ), 0
        ) as total_recebido
      FROM db_manaus.dbreceb r
      WHERE r.cod_receb = $1
    `;
    const checkResult = await pool.query(checkQuery, [cod_receb]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Título a receber não encontrado.' });
    }

    const titulo = checkResult.rows[0];

    // ✅ REGRA CORRETA (conforme Oracle): Não permite editar se JÁ TEM RECEBIMENTOS registrados no histórico
    if (parseFloat(titulo.total_recebido) > 0) {
      return res.status(400).json({ 
        erro: 'Não é possível editar um título que já possui recebimentos registrados.',
        detalhes: `Total recebido: R$ ${parseFloat(titulo.total_recebido).toFixed(2)}`
      });
    }

    if (titulo.cancel === 'S') {
      return res.status(400).json({ erro: 'Não é possível editar um título cancelado.' });
    }

    // Construir query de atualização dinâmica
    const updates = [];
    const params = [cod_receb];
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

    if (nro_doc !== undefined) {
      updates.push(`nro_doc = $${paramIndex}`);
      params.push(nro_doc);
      paramIndex++;
    }

    if (codcli !== undefined) {
      updates.push(`codcli = $${paramIndex}`);
      params.push(codcli);
      paramIndex++;
    }

    if (rec_cof_id !== undefined) {
      updates.push(`rec_cof_id = $${paramIndex}`);
      params.push(rec_cof_id);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar foi fornecido.' });
    }

    const updateQuery = `
      UPDATE db_manaus.dbreceb
      SET ${updates.join(', ')}
      WHERE cod_receb = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, params);

    // 📝 Auditoria (seguindo padrão do contas a pagar)
    const auditoriaQuery = `
      INSERT INTO db_manaus.dbusuario_acoes (codusr, acao, tabela, detalhes, dt_acao)
      VALUES (
        'SYSTEM',
        'UPDATE',
        'DBRECEB',
        $1,
        NOW()
      )
    `;
    const detalhesAuditoria = `Editado título ${cod_receb}: ${updates.join(', ')}`;
    
    try {
      await pool.query(auditoriaQuery, [detalhesAuditoria]);
    } catch (audError) {
      // Auditoria não deve falhar a operação principal
      console.warn('⚠️ Falha ao registrar auditoria:', audError);
    }

    res.status(200).json({
      sucesso: true,
      mensagem: 'Título a receber atualizado com sucesso.',
      titulo: updateResult.rows[0]
    });

  } catch (error: any) {
    console.error('❌ Erro ao editar título a receber:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
