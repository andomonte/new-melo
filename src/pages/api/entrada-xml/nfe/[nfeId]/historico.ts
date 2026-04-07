import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { buscarHistoricoNfe, STATUS_NFE_LABELS, TIPO_ACAO_LABELS, TipoAcaoNfe } from '@/lib/nfe/historicoNfeHelper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Metodo nao permitido' });
  }

  const { nfeId } = req.query;

  if (!nfeId || Array.isArray(nfeId)) {
    return res.status(400).json({ erro: 'ID da NFe invalido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'manaus';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Definir search_path
    await client.query('SET search_path TO db_manaus');

    // Buscar dados da NFe
    const nfeQuery = `
      SELECT
        n.codnfe_ent,
        n.nnf,
        n.serie,
        n.chave,
        n.vnf,
        n.exec,
        n.dtimport,
        n.demi,
        e.xnome as emitente
      FROM dbnfe_ent n
      LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
      WHERE n.codnfe_ent = $1
    `;

    const nfeResult = await client.query(nfeQuery, [nfeId]);

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({ erro: 'NFe nao encontrada' });
    }

    const nfe = nfeResult.rows[0];

    // Buscar histórico
    const historico = await buscarHistoricoNfe(client, parseInt(nfeId));

    // Formatar resposta
    const response = {
      success: true,
      nfe: {
        id: nfe.codnfe_ent,
        numeroNf: nfe.nnf,
        serie: nfe.serie,
        chave: nfe.chave,
        valorTotal: nfe.vnf ? parseFloat(nfe.vnf) : 0,
        status: nfe.exec,
        statusLabel: STATUS_NFE_LABELS[nfe.exec] || nfe.exec,
        dataUpload: nfe.dtimport,
        dataEmissao: nfe.demi,
        emitente: nfe.emitente
      },
      historico: historico.map(h => ({
        id: h.id,
        tipoAcao: h.tipo_acao,
        tipoAcaoLabel: TIPO_ACAO_LABELS[h.tipo_acao as TipoAcaoNfe] || h.tipo_acao,
        statusAnterior: h.previous_status,
        statusAnteriorLabel: h.status_label_anterior,
        statusNovo: h.new_status,
        statusNovoLabel: h.status_label_novo,
        userId: h.user_id,
        userName: h.user_name,
        comments: h.comments,
        createdAt: h.created_at
      }))
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Erro ao buscar historico da NFe:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar historico',
      detalhes: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
