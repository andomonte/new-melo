import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/emails-cliente?codcli=   (ou ?codfat=)
 * Retorna os emails do cliente para pré-preencher a tela de envio:
 *  - principais: dbclien.email e dbclien.emailnfe
 *  - secundários: dbclien_email (vários por cliente)
 * Deduplicados (case-insensitive) e só os que parecem email válido.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  let codcli = String(req.query.codcli || '').trim();
  const codfat = String(req.query.codfat || '').trim();
  if (!codcli && !codfat) return res.status(400).json({ erro: 'Informe codcli ou codfat.' });

  const client = await getPgPool().connect();
  try {
    if (!codcli && codfat) {
      const r = await client.query(`SELECT codcli FROM dbfatura WHERE codfat=$1`, [codfat]);
      codcli = r.rows[0]?.codcli || '';
      if (!codcli) return res.status(404).json({ erro: 'Fatura não encontrada.' });
    }

    const cli = await client.query(
      `SELECT nome, email, emailnfe FROM dbclien WHERE codcli=$1`,
      [codcli],
    );
    const sec = await client.query(
      `SELECT email FROM dbclien_email WHERE codcli=$1 ORDER BY email`,
      [codcli],
    );

    const brutos: string[] = [
      cli.rows[0]?.email,
      cli.rows[0]?.emailnfe,
      ...sec.rows.map((x) => x.email),
    ];

    // normaliza, valida e deduplica (minúsculas p/ comparação; guarda o original)
    const vistos = new Set<string>();
    const emails: string[] = [];
    for (const e of brutos) {
      const v = String(e || '').trim();
      if (!v || !EMAIL_RE.test(v)) continue;
      const key = v.toLowerCase();
      if (vistos.has(key)) continue;
      vistos.add(key);
      emails.push(v.toLowerCase());
    }

    return res.status(200).json({
      codcli,
      nome_cliente: cli.rows[0]?.nome || null,
      emails,
    });
  } catch (error: any) {
    console.error('Erro ao buscar emails do cliente:', error);
    return res.status(500).json({ erro: 'Erro ao buscar emails do cliente', detalhes: error.message });
  } finally {
    client.release();
  }
}
