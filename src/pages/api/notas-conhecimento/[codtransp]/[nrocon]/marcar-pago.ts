import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { codtransp, nrocon } = req.query;
  const { dt_pgto, valor_pgto, banco, obs } = req.body;

  if (!codtransp || !nrocon) {
    return res.status(400).json({ erro: 'Código da transportadora e número do conhecimento são obrigatórios' });
  }

  if (!dt_pgto || !valor_pgto) {
    return res.status(400).json({ erro: 'Data e valor do pagamento são obrigatórios' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar se a nota de conhecimento existe
    const checkNota = await client.query(
      `SELECT * FROM db_manaus.dbconhecimentoent 
       WHERE codtransp = $1 AND nrocon = $2`,
      [codtransp, nrocon]
    );

    if (checkNota.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Nota de conhecimento não encontrada' });
    }

    const nota = checkNota.rows[0];

    // Verificar se já está cancelada
    if (nota.cancel === 'S') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Nota de conhecimento está cancelada' });
    }

    // Verificar se já está paga
    if (nota.pago === 'S') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Nota de conhecimento já está paga' });
    }

    // 2. Criar registro na tabela dbpgto
    const maxCodResult = await client.query(
      'SELECT COALESCE(MAX(cod_pgto::integer), 0) + 1 as next_cod FROM db_manaus.dbpgto'
    );
    const nextCodPgto = maxCodResult.rows[0].next_cod.toString().padStart(9, '0');

    const maxPagCofResult = await client.query(
      'SELECT COALESCE(MAX(pag_cof_id), 0) + 1 as next_pag_cof_id FROM db_manaus.dbpgto'
    );
    const nextPagCofId = maxPagCofResult.rows[0].next_pag_cof_id;

    // Inserir pagamento em dbpgto
    await client.query(
      `INSERT INTO db_manaus.dbpgto (
        cod_pgto,
        pag_cof_id,
        tipo,
        cod_transp,
        dt_venc,
        dt_pgto,
        dt_emissao,
        valor_pgto,
        paga,
        cancel,
        obs,
        banco
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        nextCodPgto,
        nextPagCofId,
        'T', // Tipo Transportadora
        codtransp,
        dt_pgto, // dt_venc = dt_pgto para notas já emitidas
        dt_pgto,
        new Date().toISOString().split('T')[0], // dt_emissao = hoje
        valor_pgto,
        'S', // paga = S
        'N', // cancel = N
        obs || `Pagamento CT-e ${nrocon}`,
        banco
      ]
    );

    // 3. Criar relacionamento em dbconhecimento
    await client.query(
      `INSERT INTO db_manaus.dbconhecimento (codpgto, codtransp, nrocon)
       VALUES ($1, $2, $3)
       ON CONFLICT (codpgto, codtransp, nrocon) DO NOTHING`,
      [nextCodPgto, codtransp, nrocon]
    );

    // 4. Atualizar dbconhecimentoent marcando como pago
    await client.query(
      `UPDATE db_manaus.dbconhecimentoent 
       SET pago = 'S'
       WHERE codtransp = $1 AND nrocon = $2`,
      [codtransp, nrocon]
    );

    await client.query('COMMIT');

    res.status(200).json({
      sucesso: true,
      mensagem: 'Nota de conhecimento marcada como paga',
      cod_pgto: nextCodPgto,
      codtransp,
      nrocon
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao marcar nota de conhecimento como paga:', error);
    res.status(500).json({
      erro: 'Erro ao processar pagamento',
      detalhes: error.message
    });
  } finally {
    client.release();
  }
}
