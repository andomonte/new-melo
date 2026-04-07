import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import {
  registrarHistoricoNfe,
  TipoAcaoNfe
} from '@/lib/nfe/historicoNfeHelper';

interface RegistrarHistoricoRequest {
  codNfeEnt: number;
  tipoAcao: TipoAcaoNfe;
  previousStatus?: string;
  newStatus?: string;
  userId: string;
  userName: string;
  comments?: object;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Metodo nao permitido' });
  }

  const {
    codNfeEnt,
    tipoAcao,
    previousStatus,
    newStatus,
    userId,
    userName,
    comments
  }: RegistrarHistoricoRequest = req.body;

  if (!codNfeEnt || !tipoAcao || !userId || !userName) {
    return res.status(400).json({
      erro: 'Campos obrigatorios: codNfeEnt, tipoAcao, userId, userName'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'manaus';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const historicoId = await registrarHistoricoNfe(client, {
      codNfeEnt,
      tipoAcao,
      previousStatus,
      newStatus,
      userId,
      userName,
      comments
    });

    return res.status(200).json({
      success: true,
      historicoId
    });

  } catch (error: any) {
    console.error('Erro ao registrar historico:', error);
    return res.status(500).json({
      erro: 'Erro ao registrar historico',
      detalhes: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
