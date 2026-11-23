/**
 * Configurações → Orçamento: prazo máximo de validade do orçamento por filial.
 *   GET  /api/parametros/orcamento          → { filiais: [{ filial, prazo }] }
 *   PUT  /api/parametros/orcamento          { prazo, filiais: ['MANAUS', ...] }
 *
 * Parâmetro tb_parametros.prazo_validade_orcamento (lido pela Nova Venda ao salvar o
 * orçamento). Cada filial tem o seu (schema próprio).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { poolDaFilial } from '@/lib/estacaoDb';
import { getUserFromRequest } from '@/lib/authHelper';

const FILIAIS = ['MANAUS', 'RORAIMA', 'RONDONIA'];
const CHAVE = 'prazo_validade_orcamento';
const PRAZO_MIN = 1;
const PRAZO_MAX = 60;

async function lerPrazo(filial: string): Promise<number | null> {
  const r = await poolDaFilial(filial).query(`SELECT valor FROM tb_parametros WHERE chave = $1 LIMIT 1`, [CHAVE]);
  const v = Number(r.rows[0]?.valor);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const filiais = await Promise.all(
        FILIAIS.map(async (filial) => ({ filial, prazo: await lerPrazo(filial).catch(() => null) })),
      );
      return res.status(200).json({ filiais, minimo: PRAZO_MIN, maximo: PRAZO_MAX });
    }

    if (req.method === 'PUT') {
      const user = getUserFromRequest(req);
      if (!user?.login_user_login) return res.status(401).json({ error: 'Faça login para alterar.' });

      const prazo = Math.floor(Number(req.body?.prazo));
      if (!Number.isFinite(prazo) || prazo < PRAZO_MIN || prazo > PRAZO_MAX) {
        return res.status(400).json({ error: `O prazo deve ser de ${PRAZO_MIN} a ${PRAZO_MAX} dias.` });
      }
      const alvo: string[] = (Array.isArray(req.body?.filiais) ? req.body.filiais : [])
        .map((f: any) => String(f || '').trim().toUpperCase())
        .filter((f: string) => FILIAIS.includes(f));
      if (alvo.length === 0) return res.status(400).json({ error: 'Escolha ao menos uma filial.' });

      for (const filial of alvo) {
        const pool = poolDaFilial(filial);
        const upd = await pool.query(
          `UPDATE tb_parametros SET valor = $2, updated_at = now() WHERE chave = $1`,
          [CHAVE, String(prazo)],
        );
        if (upd.rowCount === 0) {
          await pool.query(
            `INSERT INTO tb_parametros (chave, valor, tipo, descricao)
             VALUES ($1, $2, 'INT', 'Prazo máximo de validade do orçamento em dias')`,
            [CHAVE, String(prazo)],
          );
        }
      }
      console.log(`Prazo do orçamento = ${prazo} dia(s) em ${alvo.join(', ')} por ${user.login_user_login}`);
      return res.status(200).json({ ok: true, prazo, filiais: alvo });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e: any) {
    console.error('Erro em parametros/orcamento:', e);
    return res.status(500).json({ error: 'Erro ao gravar o prazo do orçamento' });
  }
}
