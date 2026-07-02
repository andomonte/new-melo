import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

/**
 * Crédito Temporário de clientes (tabela dbclien_creditotmp).
 * Equivalente ao package Oracle CREDITO_TEMPORARIO do sistema Delphi.
 *
 * GET  -> lista os créditos ativos (status='A') com o nome do cliente
 * POST -> adiciona um crédito temporário para um cliente
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const pool = getPgPool(filial);

  // ---------- LISTAR ----------
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        `SELECT t.id,
                t.codcli,
                c.nome,
                t.data,
                t.datavencimento,
                COALESCE(t.limite, 0)        AS limite,
                COALESCE(t.limite_usado, 0)  AS limite_usado,
                t.status
           FROM dbclien_creditotmp t
           LEFT JOIN dbclien c ON c.codcli = t.codcli
          WHERE t.status = 'A'
          ORDER BY t.datavencimento ASC, t.codcli ASC`,
      );
      return res.status(200).json(serializeBigInt(rows));
    } catch (error: any) {
      console.error('Erro ao listar crédito temporário:', error.message);
      return res
        .status(500)
        .json({ error: 'Erro ao listar crédito temporário', detail: error.message });
    }
  }

  // ---------- ADICIONAR ----------
  if (req.method === 'POST') {
    const codusr = cookies.codusr_melo || 'SYS';
    const { codcli, limite, datavencimento } = req.body || {};

    const codcliStr = String(codcli || '').trim();
    const limiteNum = Number(limite);

    if (!codcliStr) {
      return res.status(400).json({ error: 'Cliente é obrigatório.' });
    }
    if (!limiteNum || limiteNum <= 0) {
      return res.status(400).json({ error: 'Adicione um limite válido.' });
    }
    if (!datavencimento) {
      return res.status(400).json({ error: 'Data de vencimento é obrigatória.' });
    }

    // Data de vencimento não pode ser anterior a hoje (igual ao Delphi)
    const venc = new Date(`${String(datavencimento).slice(0, 10)}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (isNaN(venc.getTime()) || venc < hoje) {
      return res.status(400).json({ error: 'Data de vencimento incorreta.' });
    }

    const client = await pool.connect();
    try {
      // Cliente existe?
      const cli = await client.query(
        'SELECT nome FROM dbclien WHERE codcli = $1 LIMIT 1',
        [codcliStr],
      );
      if (cli.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }

      // Já possui crédito temporário ativo? (igual ao Delphi)
      const existe = await client.query(
        "SELECT 1 FROM dbclien_creditotmp WHERE codcli = $1 AND status = 'A' LIMIT 1",
        [codcliStr],
      );
      if (existe.rows.length > 0) {
        return res
          .status(409)
          .json({ error: 'O cliente já possui crédito temporário.' });
      }

      const inserted = await client.query(
        `INSERT INTO dbclien_creditotmp
            (codcli, codusr, data, datavencimento, limite, limite_usado, status)
         VALUES ($1, $2, NOW(), $3, $4, 0, 'A')
         RETURNING id, codcli, data, datavencimento, limite, limite_usado, status`,
        [codcliStr, codusr, venc, limiteNum],
      );

      return res.status(201).json(
        serializeBigInt({
          ...inserted.rows[0],
          nome: cli.rows[0].nome,
        }),
      );
    } catch (error: any) {
      console.error('Erro ao adicionar crédito temporário:', error.message);
      return res
        .status(500)
        .json({ error: 'Erro ao adicionar crédito temporário', detail: error.message });
    } finally {
      client.release();
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Método não permitido' });
}
