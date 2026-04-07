import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { registrarHistoricoNfe } from '@/lib/nfe/historicoNfeHelper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId, userId, userName } = req.body;

  if (!nfeId || !userId || !userName) {
    return res.status(400).json({
      error: 'nfeId, userId e userName sao obrigatorios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Verificar se a NFe ja esta sendo processada por outro usuario
    const nfeResult = await client.query(
      `SELECT processando_por, processando_nome, exec
       FROM dbnfe_ent WHERE codnfe_ent = $1`,
      [nfeId]
    );

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({ error: 'NFe nao encontrada' });
    }

    const nfe = nfeResult.rows[0];

    // Se ja esta sendo processada por outro usuario
    if (nfe.processando_por && nfe.processando_por !== userId) {
      return res.status(409).json({
        error: 'NFe ja esta sendo processada por outro usuario',
        processandoPor: nfe.processando_nome || nfe.processando_por,
        bloqueado: true
      });
    }

    // Se ja esta sendo processada pelo mesmo usuario, apenas retorna sucesso
    if (nfe.processando_por === userId) {
      return res.status(200).json({
        success: true,
        message: 'Voce ja esta processando esta NFe',
        jaAssumida: true
      });
    }

    // OTIMIZADO: Assumir o processamento e registrar histórico em PARALELO
    await Promise.all([
      client.query(
        `UPDATE dbnfe_ent
         SET processando_por = $1,
             processando_nome = $2,
             processando_desde = NOW()
         WHERE codnfe_ent = $3`,
        [userId, userName, nfeId]
      ),
      registrarHistoricoNfe(client, {
        codNfeEnt: parseInt(nfeId),
        tipoAcao: 'ASSUMIU_PROCESSAMENTO',
        previousStatus: nfe.exec,
        newStatus: nfe.exec,
        userId,
        userName,
        comments: { acao: 'Usuario assumiu o processamento da NFe' }
      })
    ]);

    res.status(200).json({
      success: true,
      message: 'NFe assumida com sucesso'
    });

  } catch (err) {
    console.error('Erro ao assumir NFe:', err);
    res.status(500).json({
      error: 'Falha ao assumir NFe',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
