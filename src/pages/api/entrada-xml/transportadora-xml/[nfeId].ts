import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { nfeId } = req.query;

  if (!nfeId || typeof nfeId !== 'string') {
    return res.status(400).json({ error: 'NFE ID é obrigatório' });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Buscar dados da transportadora do XML
    const result = await client.query(`
      SELECT
        codnfe_ent,
        cpf_cnpj,
        xnome,
        ie,
        xender,
        xmun,
        uf,
        rntc,
        placa,
        uf_placa,
        rntc_reb,
        placa_reb,
        uf_placa_reb,
        vagao_reb,
        balsa_reb,
        especie,
        marca,
        numeracao,
        lacre,
        vserv,
        vbcret,
        picmsret,
        vicmsret,
        cfop,
        cmunfg
      FROM dbnfe_ent_tran
      WHERE codnfe_ent = $1
    `, [nfeId]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Nenhum dado de transportadora encontrado no XML'
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        cpf_cnpj: row.cpf_cnpj,
        xnome: row.xnome,
        ie: row.ie,
        xender: row.xender,
        xmun: row.xmun,
        uf: row.uf,
        rntc: row.rntc,
        placa: row.placa,
        uf_placa: row.uf_placa,
        especie: row.especie,
        marca: row.marca,
        numeracao: row.numeracao,
        lacre: row.lacre,
        vserv: row.vserv,
        vbcret: row.vbcret,
        picmsret: row.picmsret,
        vicmsret: row.vicmsret,
        cfop: row.cfop,
        cmunfg: row.cmunfg,
        // Dados do reboque
        rntc_reb: row.rntc_reb,
        placa_reb: row.placa_reb,
        uf_placa_reb: row.uf_placa_reb,
        vagao_reb: row.vagao_reb,
        balsa_reb: row.balsa_reb
      }
    });

  } catch (error: any) {
    console.error('[transportadora-xml] Erro:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados da transportadora do XML',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
