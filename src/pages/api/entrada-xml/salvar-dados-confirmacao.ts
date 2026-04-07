import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { z } from 'zod';

const bodySchema = z.object({
  nfeId: z.string().min(1, "NFE ID é obrigatório"),
  operacao: z.number().min(0).max(10),
  codcomprador: z.string().optional(),
  codcredor: z.string().optional(),
  codtransp: z.string().optional(),
  custofin: z.number().default(0),
  desconto: z.number().default(0),
  acrescimo: z.number().default(0),
  verba_tmk: z.number().default(0),
  cfop: z.number().nullable().optional(),
  desconto_icms: z.string().default('N'),
  desconto_st: z.string().default('N'),
  zerar_ipi: z.string().default('N'),
  zerar_st: z.string().default('N'),
  temcusto: z.string().default('S'),
  complementar: z.number().default(0),
  devolucao: z.number().default(0),
  dev_codfat: z.string().nullable().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const validation = bodySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: validation.error.flatten()
    });
  }

  const data = validation.data;

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Verificar se a NFe existe
    const nfeResult = await client.query(`
      SELECT codnfe_ent FROM dbnfe_ent WHERE codnfe_ent = $1
    `, [data.nfeId]);

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'NFe não encontrada'
      });
    }

    // Verificar se já existe registro em dbnfe_ent_aux
    const auxResult = await client.query(`
      SELECT codnfe_ent FROM dbnfe_ent_aux WHERE codnfe_ent = $1
    `, [data.nfeId]);

    if (auxResult.rows.length > 0) {
      // UPDATE
      await client.query(`
        UPDATE dbnfe_ent_aux SET
          codcomprador = $2,
          codcredor = $3,
          codtransp = $4,
          operacao = $5,
          custofin = $6,
          desconto = $7,
          acrescimo = $8,
          verba_tmk = $9,
          desconto_icms = $10,
          desconto_st = $11,
          zerar_ipi = $12,
          zerar_st = $13,
          temcusto = $14,
          cfop = $15,
          complementar = $16,
          devolucao = $17,
          dev_codfat = $18
        WHERE codnfe_ent = $1
      `, [
        data.nfeId,
        data.codcomprador || null,
        data.codcredor || null,
        data.codtransp || null,
        data.operacao,
        data.custofin,
        data.desconto,
        data.acrescimo,
        data.verba_tmk,
        data.desconto_icms,
        data.desconto_st,
        data.zerar_ipi,
        data.zerar_st,
        data.temcusto,
        data.cfop,
        data.complementar,
        data.devolucao,
        data.dev_codfat || null
      ]);

      console.log(`[salvar-dados-confirmacao] UPDATE em dbnfe_ent_aux para NFe ${data.nfeId}`);
    } else {
      // INSERT
      await client.query(`
        INSERT INTO dbnfe_ent_aux (
          codnfe_ent,
          codcomprador,
          codcredor,
          codtransp,
          operacao,
          custofin,
          desconto,
          acrescimo,
          verba_tmk,
          desconto_icms,
          desconto_st,
          zerar_ipi,
          zerar_st,
          temcusto,
          cfop,
          complementar,
          devolucao,
          dev_codfat
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        data.nfeId,
        data.codcomprador || null,
        data.codcredor || null,
        data.codtransp || null,
        data.operacao,
        data.custofin,
        data.desconto,
        data.acrescimo,
        data.verba_tmk,
        data.desconto_icms,
        data.desconto_st,
        data.zerar_ipi,
        data.zerar_st,
        data.temcusto,
        data.cfop,
        data.complementar,
        data.devolucao,
        data.dev_codfat || null
      ]);

      console.log(`[salvar-dados-confirmacao] INSERT em dbnfe_ent_aux para NFe ${data.nfeId}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Dados de confirmação salvos com sucesso'
    });

  } catch (error: any) {
    console.error('[salvar-dados-confirmacao] Erro:', error);
    return res.status(500).json({
      error: 'Erro ao salvar dados de confirmação',
      details: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
