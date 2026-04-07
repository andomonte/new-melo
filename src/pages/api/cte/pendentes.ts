/**
 * API para buscar CTes pendentes (importados pelo robô)
 *
 * GET /api/cte/pendentes - Lista CTes pendentes no banco
 * GET /api/cte/pendentes?chavenfe=xxx - Busca CTe que contenha a NFe pela chave
 * GET /api/cte/pendentes?nfeId=xxx - Busca CTe que contenha a NFe pelo ID (codnfe_ent)
 *
 * Busca na tabela dbconhecimentoent CTes que ainda não foram vinculados a entradas
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

interface CtePendente {
  codtransp: string;
  nrocon: string;
  serie: string;
  cfop: string;
  dtcon: string;
  totalcon: number;
  totaltransp: number;
  baseicms: number;
  icms: number;
  cif: 'S' | 'N';
  tipocon: string;
  chave: string;
  protocolo: string;
  kg: number;
  kgcub: number;
  transp_nome: string;
  transp_cnpj: string;
  nfes_vinculadas: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { chavenfe, codtransp, nfeId } = req.query;

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Se tem nfeId, busca a chavenfe correspondente primeiro
    let chaveNfeBusca = chavenfe;
    if (nfeId && typeof nfeId === 'string' && !chavenfe) {
      const nfeResult = await client.query(`
        SELECT chave_nfe FROM db_manaus.cad_nfe_entrada WHERE codnfe_ent = $1
      `, [nfeId]);

      if (nfeResult.rows.length > 0) {
        chaveNfeBusca = nfeResult.rows[0].chave_nfe;
      }
    }

    // Se tem chavenfe, busca CTe que contenha essa NFe
    if (chaveNfeBusca && typeof chaveNfeBusca === 'string') {
      // Buscar CTe que tenha essa NFe vinculada
      const cteResult = await client.query(`
        SELECT
          c.codtransp,
          c.nrocon,
          c.serie,
          c.cfop,
          c.dtcon,
          c.totalcon,
          c.totaltransp,
          c.baseicms,
          c.icms,
          c.cif,
          c.tipocon,
          c.chave,
          c.protocolo,
          c.kg,
          c.kgcub,
          COALESCE(c.nome_emit, t.nome, 'N/I') as transp_nome,
          COALESCE(c.cnpj_emit, t.cnpj_cpf) as transp_cnpj
        FROM db_manaus.dbconhecimentoent c
        LEFT JOIN db_manaus.dbtransp t ON c.codtransp = t.codtransp
        INNER JOIN db_manaus.dbconhecimentoentnf nf ON (
          nf.codtransp = c.codtransp AND nf.nrocon = c.nrocon
        )
        WHERE nf.chavenfe = $1
        LIMIT 1
      `, [chaveNfeBusca]);

      if (cteResult.rows.length === 0) {
        return res.status(200).json({
          success: true,
          found: false,
          message: 'Nenhum CTe encontrado para esta NFe',
          data: null
        });
      }

      const cte = cteResult.rows[0];

      // Buscar todas as NFes vinculadas a esse CTe
      const nfesResult = await client.query(`
        SELECT chavenfe
        FROM db_manaus.dbconhecimentoentnf
        WHERE codtransp = $1 AND nrocon = $2
        ORDER BY sequencia
      `, [cte.codtransp, cte.nrocon]);

      const ctePendente: CtePendente = {
        codtransp: cte.codtransp,
        nrocon: cte.nrocon,
        serie: cte.serie || '1',
        cfop: cte.cfop || '6352',
        dtcon: cte.dtcon ? new Date(cte.dtcon).toISOString().split('T')[0] : '',
        totalcon: parseFloat(cte.totalcon) || 0,
        totaltransp: parseFloat(cte.totaltransp) || 0,
        baseicms: parseFloat(cte.baseicms) || 0,
        icms: parseFloat(cte.icms) || 0,
        cif: cte.cif || 'N',
        tipocon: cte.tipocon || '08',
        chave: cte.chave || '',
        protocolo: cte.protocolo || '',
        kg: parseFloat(cte.kg) || 0,
        kgcub: parseFloat(cte.kgcub) || 0,
        transp_nome: cte.transp_nome || '',
        transp_cnpj: cte.transp_cnpj || '',
        nfes_vinculadas: nfesResult.rows.map(r => r.chavenfe)
      };

      return res.status(200).json(serializeBigInt({
        success: true,
        found: true,
        message: `CTe ${cte.nrocon} encontrado para esta NFe`,
        data: ctePendente
      }));
    }

    // Lista todos CTes pendentes (não vinculados a entrada)
    let whereClause = `WHERE (c.pago IS NULL OR c.pago = 'N')`;
    const params: any[] = [];
    let paramIndex = 1;

    if (codtransp) {
      whereClause += ` AND c.codtransp = $${paramIndex}`;
      params.push(codtransp);
      paramIndex++;
    }

    const ctesResult = await client.query(`
      SELECT
        c.codtransp,
        c.nrocon,
        c.serie,
        c.cfop,
        c.dtcon,
        c.totalcon,
        c.totaltransp,
        c.baseicms,
        c.icms,
        c.cif,
        c.tipocon,
        c.chave,
        c.protocolo,
        c.kg,
        c.kgcub,
        COALESCE(c.nome_emit, t.nome, 'N/I') as transp_nome,
        COALESCE(c.cnpj_emit, t.cnpj_cpf) as transp_cnpj,
        (
          SELECT COUNT(*)::int
          FROM db_manaus.dbconhecimentoentnf nf
          WHERE nf.codtransp = c.codtransp AND nf.nrocon = c.nrocon
        ) as qtd_nfes
      FROM db_manaus.dbconhecimentoent c
      LEFT JOIN db_manaus.dbtransp t ON c.codtransp = t.codtransp
      ${whereClause}
      ORDER BY c.dtcon DESC NULLS LAST
      LIMIT 50
    `, params);

    const ctesPendentes: CtePendente[] = [];

    for (const cte of ctesResult.rows) {
      // Buscar NFes vinculadas
      const nfesResult = await client.query(`
        SELECT chavenfe
        FROM db_manaus.dbconhecimentoentnf
        WHERE codtransp = $1 AND nrocon = $2
        ORDER BY sequencia
      `, [cte.codtransp, cte.nrocon]);

      ctesPendentes.push({
        codtransp: cte.codtransp,
        nrocon: cte.nrocon,
        serie: cte.serie || '1',
        cfop: cte.cfop || '6352',
        dtcon: cte.dtcon ? new Date(cte.dtcon).toISOString().split('T')[0] : '',
        totalcon: parseFloat(cte.totalcon) || 0,
        totaltransp: parseFloat(cte.totaltransp) || 0,
        baseicms: parseFloat(cte.baseicms) || 0,
        icms: parseFloat(cte.icms) || 0,
        cif: cte.cif || 'N',
        tipocon: cte.tipocon || '08',
        chave: cte.chave || '',
        protocolo: cte.protocolo || '',
        kg: parseFloat(cte.kg) || 0,
        kgcub: parseFloat(cte.kgcub) || 0,
        transp_nome: cte.transp_nome || '',
        transp_cnpj: cte.transp_cnpj || '',
        nfes_vinculadas: nfesResult.rows.map(r => r.chavenfe)
      });
    }

    return res.status(200).json(serializeBigInt({
      success: true,
      total: ctesPendentes.length,
      data: ctesPendentes
    }));

  } catch (error) {
    console.error('Erro ao buscar CTes pendentes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar CTes pendentes',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
