/**
 * GET /api/entrada/recebimento/disponiveis?busca=
 * Entradas que podem ser recebidas agora (lista da tela de Recebimento), com busca por
 * número da nota, chave, fornecedor (nome/CNPJ) ou número da entrada.
 * Regra: entrada gerada e não cancelada, com ou sem preço confirmado
 * (lib/recebimentoEntrada/status.ts). Só leitura.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { poolRecebimento } from '@/lib/recebimentoEntrada/filial';
import { STATUS_PODE_RECEBER } from '@/lib/recebimentoEntrada/status';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const busca = String(req.query.busca || '').trim();
  const digitos = busca.replace(/\D/g, '');
  const soNumero = busca !== '' && digitos.length === busca.replace(/[\s.\-/]/g, '').length;

  const { pool } = poolRecebimento(req);
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const r = await client.query(
      `SELECT e.codent,
              e.chave,
              COALESCE(n.nnf::text, '') AS nfe_numero,
              COALESCE(n.serie::text, '') AS nfe_serie,
              COALESCE(emit.xnome, 'Fornecedor não identificado') AS fornecedor,
              COALESCE(emit.cpf_cnpj, '') AS cnpj,
              COALESCE(e.totalnf, 0)::numeric AS valor_total,
              (SELECT COUNT(*) FROM dbitent i WHERE i.codent = e.codent)::int AS qtd_itens,
              e.dtent AS data_entrada,
              n.demi AS data_emissao,
              rec.status,
              rec.data_confirmacao_preco IS NOT NULL AS preco_confirmado
         FROM dbent e
         JOIN dbent_recebimento rec ON rec.codent = e.codent
         LEFT JOIN dbnfe_ent n ON n.chave = e.chave
         LEFT JOIN dbnfe_ent_emit emit ON emit.codnfe_ent = n.codnfe_ent
        WHERE rec.status = ANY($1::text[])
          AND COALESCE(e.status, '') <> 'C'
          AND (
                $2 = ''
                OR ($3::boolean AND (
                      n.nnf::text = ltrim($4, '0')
                   OR n.nnf::text LIKE $4 || '%'
                   OR e.chave LIKE '%' || $4 || '%'
                   OR e.codent LIKE '%' || $4 || '%'
                   OR regexp_replace(COALESCE(emit.cpf_cnpj, ''), '\\D', '', 'g') LIKE $4 || '%'))
                OR (NOT $3::boolean AND (
                      emit.xnome ILIKE '%' || $2 || '%'
                   OR emit.xfant ILIKE '%' || $2 || '%'))
              )
        ORDER BY e.dtent DESC NULLS LAST, e.codent DESC
        LIMIT 100`,
      [STATUS_PODE_RECEBER, busca, soNumero, digitos],
    );
    return res.status(200).json({
      data: r.rows.map((x) => ({
        ...x,
        valor_total: Number(x.valor_total || 0),
      })),
    });
  } catch (error: any) {
    console.error('Erro em entrada/recebimento/disponiveis:', error);
    return res.status(500).json({ error: 'Erro ao listar entradas para receber' });
  } finally {
    if (client) client.release();
  }
}
