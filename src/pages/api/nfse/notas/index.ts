import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pg';
import { gerarTitulosNfs, lancarNotaServico, NfsValidacaoError } from '@/lib/nfse/notasServico';

/**
 * Notas Fiscais de Serviço PRESTADAS (Faturamento > Notas de Serviço).
 *   GET  ?de=&ate=&base=emissao|lancamento&situacao=ativas|canceladas|todas&q=&page=&limit=
 *        q busca no nº, verificação, cliente (nome/código) e discriminação.
 *   POST { nota: EntradaNota, cobranca?: { banco, forma, prazos[] } }
 *        lança a nota e, se vier "cobranca", já gera os títulos (mesma transação).
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return listar(req, res);
  if (req.method === 'POST') return lancar(req, res);
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ erro: 'Método não permitido' });
}

async function listar(req: NextApiRequest, res: NextApiResponse) {
  const q = req.query as Record<string, string>;
  const cond: string[] = ['1=1'];
  const vals: any[] = [];
  const add = (v: any) => { vals.push(v); return `$${vals.length}`; };
  const col = q.base === 'lancamento' ? 'n.data' : 'n.dtemissao';
  if (q.de) cond.push(`${col} >= ${add(q.de)}`);
  if (q.ate) cond.push(`${col} <= ${add(q.ate)}`);
  if ((q.situacao || 'ativas') === 'ativas') cond.push(`n.cancel = 'N'`);
  else if (q.situacao === 'canceladas') cond.push(`n.cancel = 'S'`);
  const termo = String(q.q || '').trim();
  if (termo) {
    const p = add(`%${termo}%`);
    cond.push(`(n.nroform ILIKE ${p} OR n.verificacao ILIKE ${p} OR n.chave_acesso ILIKE ${p} OR c.nome ILIKE ${p} OR n.codcli ILIKE ${p}
               OR n.codfat ILIKE ${p} OR EXISTS (SELECT 1 FROM nfs_nota_servico s WHERE s.codfat = n.codfat AND s.descr ILIKE ${p}))`);
  }
  const limit = Math.min(Math.max(parseInt(q.limit || '50', 10) || 50, 1), 1000);
  const page = Math.max(parseInt(q.page || '1', 10) || 1, 1);
  const where = cond.join(' AND ');
  try {
    const base = `FROM nfs_nota n LEFT JOIN dbclien c ON c.codcli = n.codcli WHERE ${where}`;
    const tot = (await pool.query(
      `SELECT count(*)::int qtd, COALESCE(sum(n.valor_servico),0) servico, COALESCE(sum(n.issqn_valor),0) iss,
              COALESCE(sum(n.valor_servico - n.valor_desconto - n.totalfat),0) retencoes, COALESCE(sum(n.totalfat),0) liquido
         ${base}`, vals)).rows[0];
    const rows = (await pool.query(
      `SELECT n.codfat, n.nroform, n.verificacao, n.chave_acesso, n.dtemissao::text, n.competencia, n.data::text AS data,
              n.codcli, c.nome AS nome_cliente, n.valor_servico, n.valor_desconto, n.issqn_aliquota, n.issqn_retido,
              n.issqn_valor, (n.valor_servico - n.valor_desconto - n.totalfat) AS retencoes, n.totalfat AS valor_liquido,
              n.cancel, n.origem, n.frmfat,
              s.descr, sv.sen_codigo, sv.sen_atividade,
              (SELECT count(*) FROM dbreceb t WHERE t.tipo = 'S' AND t.cod_fat = n.codfat AND COALESCE(t.cancel,'N') <> 'S')::int AS qtd_titulos,
              (SELECT COALESCE(sum(t.valor_rec),0) FROM dbreceb t WHERE t.tipo = 'S' AND t.cod_fat = n.codfat AND COALESCE(t.cancel,'N') <> 'S') AS recebido
         ${base.replace('WHERE', `LEFT JOIN LATERAL (SELECT descr, sen_id FROM nfs_nota_servico x WHERE x.codfat = n.codfat ORDER BY x.id LIMIT 1) s ON true
                                  LEFT JOIN dbservico_nfs sv ON sv.sen_id = s.sen_id WHERE`)}
        ORDER BY n.dtemissao DESC NULLS LAST, n.codfat DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`, vals)).rows;
    const num = (o: any, ...ks: string[]) => { ks.forEach((k) => { o[k] = Number(o[k] || 0); }); return o; };
    return res.status(200).json({
      notas: rows.map((r) => num(r, 'valor_servico', 'valor_desconto', 'issqn_aliquota', 'issqn_valor', 'retencoes', 'valor_liquido', 'recebido')),
      totais: num(tot, 'servico', 'iss', 'retencoes', 'liquido'),
      paginacao: { page, limit, total: tot.qtd, totalPaginas: Math.max(1, Math.ceil(tot.qtd / limit)) },
    });
  } catch (e: any) {
    if (e?.code === '42P01') return res.status(200).json({ notas: [], totais: { qtd: 0 }, paginacao: { page: 1, limit, total: 0, totalPaginas: 1 } });
    console.error('Erro ao listar notas de serviço:', e);
    return res.status(500).json({ erro: 'Erro ao listar notas de serviço', detalhes: e?.message });
  }
}

async function lancar(req: NextApiRequest, res: NextApiResponse) {
  const { nota, cobranca } = req.body || {};
  if (!nota) return res.status(400).json({ erro: 'Dados da nota não informados.' });
  const codusr = req.body?.codusr || parseCookies({ req }).codusr || null;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const r = await lancarNotaServico(db, nota, codusr);
    const titulos = cobranca ? await gerarTitulosNfs(db, r.codfat, cobranca) : null;
    await db.query('COMMIT');
    return res.status(200).json({ sucesso: true, codfat: r.codfat, valores: r.valores, cobranca: titulos });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof NfsValidacaoError) return res.status(400).json({ erro: e.message });
    console.error('Erro ao lançar nota de serviço:', e);
    return res.status(500).json({ erro: 'Erro ao lançar a nota de serviço', detalhes: e?.message });
  } finally {
    db.release();
  }
}
