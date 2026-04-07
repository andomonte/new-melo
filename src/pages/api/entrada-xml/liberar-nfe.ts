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

  const { nfeId, userId, userName, forcarLiberacao } = req.body;

  if (!nfeId || !userId) {
    return res.status(400).json({
      error: 'nfeId e userId sao obrigatorios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Verificar o estado atual da NFe
    const nfeResult = await client.query(
      `SELECT processando_por, processando_nome, exec
       FROM dbnfe_ent WHERE codnfe_ent = $1`,
      [nfeId]
    );

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({ error: 'NFe nao encontrada' });
    }

    const nfe = nfeResult.rows[0];

    // Se nao esta sendo processada, apenas retorna sucesso
    if (!nfe.processando_por) {
      return res.status(200).json({
        success: true,
        message: 'NFe ja esta livre',
        jaLivre: true
      });
    }

    // Se esta sendo processada por outro usuario e nao e forcado
    if (nfe.processando_por !== userId && !forcarLiberacao) {
      return res.status(403).json({
        error: 'Voce nao pode liberar uma NFe que esta sendo processada por outro usuario',
        processandoPor: nfe.processando_nome || nfe.processando_por
      });
    }

    // Liberar o processamento
    await client.query(
      `UPDATE dbnfe_ent
       SET processando_por = NULL,
           processando_nome = NULL,
           processando_desde = NULL
       WHERE codnfe_ent = $1`,
      [nfeId]
    );

    // Registrar no historico
    await registrarHistoricoNfe(client, {
      codNfeEnt: parseInt(nfeId),
      tipoAcao: 'LIBEROU_PROCESSAMENTO',
      previousStatus: nfe.exec,
      newStatus: nfe.exec,
      userId,
      userName: userName || userId,
      comments: {
        acao: forcarLiberacao
          ? `Usuario forcou liberacao da NFe (estava com ${nfe.processando_nome || nfe.processando_por})`
          : 'Usuario liberou o processamento da NFe'
      }
    });

    res.status(200).json({
      success: true,
      message: 'NFe liberada com sucesso'
    });

  } catch (err) {
    console.error('Erro ao liberar NFe:', err);
    res.status(500).json({
      error: 'Falha ao liberar NFe',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
