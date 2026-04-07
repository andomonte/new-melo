import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * API para validar CEST contra NCM
 *
 * Regra do Delphi (spVALIDA_CEST):
 * - Verifica se NCM existe
 * - Verifica se CEST é compatível com o NCM
 *
 * Retorna:
 * - OK: CEST válido para este NCM
 * - NOK1: NCM inválido
 * - NOK2: CEST inválido para este NCM
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { ncm, cest } = req.body;

  // Se não informou CEST, não precisa validar
  if (!cest || cest === '') {
    return res.status(200).json({ resultado: 'OK', message: 'CEST não informado' });
  }

  // Se não informou NCM, não pode validar CEST
  if (!ncm || ncm === '') {
    return res.status(200).json({
      resultado: 'NOK1',
      message: 'NCM não informado. CEST requer NCM válido.'
    });
  }

  try {
    const pool = getPgPool('MANAUS');
    const client = await pool.connect();

    try {
      // 1. Verificar se NCM existe
      const ncmResult = await client.query(`
        SELECT COUNT(*) as count
        FROM db_manaus.dbnmcfiscal
        WHERE ncm = $1
      `, [ncm]);

      const ncmExists = parseInt(ncmResult.rows[0]?.count || '0') > 0;

      if (!ncmExists) {
        return res.status(200).json({
          resultado: 'NOK1',
          message: `NCM ${ncm} não encontrado na tabela de classificações fiscais`
        });
      }

      // 2. Verificar se CEST é compatível com NCM
      const cestResult = await client.query(`
        SELECT COUNT(*) as count
        FROM db_manaus.cest
        WHERE cest = $1 AND ncm = $2
      `, [cest, ncm]);

      const cestValid = parseInt(cestResult.rows[0]?.count || '0') > 0;

      if (!cestValid) {
        return res.status(200).json({
          resultado: 'NOK2',
          message: `CEST ${cest} não é válido para o NCM ${ncm}`
        });
      }

      // Sucesso
      return res.status(200).json({
        resultado: 'OK',
        message: 'CEST válido para este NCM'
      });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Erro ao validar CEST:', error);
    return res.status(500).json({
      error: 'Erro ao validar CEST',
      message: error.message
    });
  }
}
