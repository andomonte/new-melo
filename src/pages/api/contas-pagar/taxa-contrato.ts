/**
 * GET /api/contas-pagar/taxa-contrato?contratos=000619988142,567389966
 *
 * Busca, no Contas a Pagar (títulos internacionais), a taxa usada por contrato de
 * câmbio — a fonte PRIMÁRIA da Taxa Dólar na aba Contratos de Câmbio da Importação.
 *
 * Retorna um mapa { "<contrato informado>": { taxa_conversao, moeda, valor_moeda,
 * id_titulo } }. O número do contrato é casado ignorando não-dígitos e zeros à
 * esquerda (o XML traz "000619988142"; o dbpgto pode ter "619988142").
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

const norm = (s: string) => (s || '').replace(/\D/g, '').replace(/^0+/, '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const raw = String(req.query.contratos || '');
  const contratos = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (contratos.length === 0) {
    return res.status(200).json({ map: {} });
  }

  // Lista normalizada (dígitos, sem zeros à esquerda) -> contrato(s) original(is)
  const normToOriginais: Record<string, string[]> = {};
  for (const c of contratos) {
    const n = norm(c);
    if (!n) continue;
    (normToOriginais[n] ||= []).push(c);
  }
  const normList = Object.keys(normToOriginais);
  if (normList.length === 0) {
    return res.status(200).json({ map: {} });
  }

  try {
    const result = await pool.query(
      `SELECT nro_contrato, taxa_conversao, moeda, valor_moeda, cod_pgto,
              COALESCE(dt_pgto, dt_emissao, dt_venc) AS data_ref
         FROM dbpgto
        WHERE eh_internacional = 'S'
          AND (cancel IS NULL OR cancel != 'S')
          AND nro_contrato IS NOT NULL
          AND ltrim(regexp_replace(nro_contrato, '\\D', '', 'g'), '0') = ANY($1::text[])
        ORDER BY COALESCE(dt_pgto, dt_emissao, dt_venc) DESC NULLS LAST`,
      [normList],
    );

    // Para cada contrato informado, pega a 1ª linha (mais recente) que casa.
    const map: Record<string, any> = {};
    for (const row of result.rows) {
      const n = norm(row.nro_contrato);
      const originais = normToOriginais[n];
      if (!originais) continue;
      for (const orig of originais) {
        if (map[orig]) continue; // já tem o mais recente (ORDER BY dt_venc DESC)
        map[orig] = {
          id_titulo: row.cod_pgto,
          moeda: row.moeda || null,
          taxa_conversao: row.taxa_conversao != null ? parseFloat(String(row.taxa_conversao)) : null,
          valor_moeda: row.valor_moeda != null ? parseFloat(String(row.valor_moeda)) : null,
          data_ref: row.data_ref ? new Date(row.data_ref).toISOString().slice(0, 10) : null,
        };
      }
    }

    return res.status(200).json({ map });
  } catch (error: any) {
    console.error('Erro ao buscar taxa por contrato:', error);
    return res.status(500).json({ message: error.message || 'Erro ao buscar taxa por contrato' });
  }
}
