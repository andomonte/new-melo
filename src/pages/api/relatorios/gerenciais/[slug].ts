import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { RELATORIOS_GERENCIAIS_SERVIDOR } from '@/lib/relatorios/gerenciais/registro';
import { RelatorioValidacaoError, type FiltroDef } from '@/lib/relatorios/tipos';

/**
 * Relatórios › Gerenciais.
 *   GET  → definição do relatório (título, descrição, filtros, colunas, pendente) — sem SQL
 *   POST { filtros } → executa (transação SOMENTE LEITURA, limite de 120 s) e devolve as linhas
 * Os módulos ficam em src/lib/relatorios/gerenciais/<slug>.ts.
 */
const pool = getPgPool();
export const config = { api: { responseLimit: false } };

const LIMITE_LINHAS = 50000;

/** Confere os filtros obrigatórios e normaliza tipos (datas, números, listas). */
function normalizar(filtros: FiltroDef[], entrada: Record<string, any>): Record<string, any> {
  const p: Record<string, any> = {};
  const iso = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  for (const f of filtros) {
    if (f.tipo === 'periodo') {
      p.de = iso(entrada.de);
      p.ate = iso(entrada.ate);
      if (f.obrigatorio && (!p.de || !p.ate)) throw new RelatorioValidacaoError(`Informe o período (${f.rotulo}).`);
      if (p.de && p.ate && p.de > p.ate) throw new RelatorioValidacaoError('A data inicial é maior que a final.');
      continue;
    }
    let v = entrada[f.campo];
    if (f.tipo === 'data') v = iso(v);
    else if (f.tipo === 'mes') v = /^\d{4}-\d{2}$/.test(String(v || '')) ? String(v) : null;
    else if (f.tipo === 'numero') v = v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
    else if (f.tipo === 'checkbox') v = v === true || v === 'true' || v === 'S';
    else if (f.tipo === 'lookup' && f.multiplo) {
      v = (Array.isArray(v) ? v : v ? [v] : []).map((x: any) => String(x).trim()).filter(Boolean);
      if (!v.length) v = null;
    } else if (f.tipo === 'select') {
      v = v == null || v === '' ? null : String(v);
      if (v && f.opcoes && !f.opcoes.some((o) => o.valor === v)) throw new RelatorioValidacaoError(`Opção inválida em ${f.rotulo}.`);
    } else v = v == null || String(v).trim() === '' ? null : String(v).trim();
    if (v == null && f.padrao != null && f.tipo === 'select') v = String(f.padrao);
    if (f.obrigatorio && (v == null || v === '')) throw new RelatorioValidacaoError(`Informe ${f.rotulo}.`);
    p[f.campo] = v;
  }
  return p;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = String(req.query.slug || '');
  const rel = RELATORIOS_GERENCIAIS_SERVIDOR[slug];
  if (!rel) return res.status(404).json({ erro: 'Relatório não encontrado.' });

  if (req.method === 'GET') {
    const { executar: _executar, ...def } = rel;
    return res.status(200).json(def);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  if (rel.pendente || !rel.executar) return res.status(409).json({ erro: rel.pendente || 'Relatório indisponível.' });

  let params: Record<string, any>;
  try {
    params = normalizar(rel.filtros, req.body?.filtros || {});
  } catch (e: any) {
    return res.status(400).json({ erro: e.message });
  }

  const inicio = Date.now();
  const db = await pool.connect();
  try {
    await db.query('BEGIN READ ONLY');
    await db.query(`SET LOCAL statement_timeout = '120s'`);
    const r = await rel.executar(db, params);
    await db.query('COMMIT');
    const avisos = [...(r.avisos || [])];
    let linhas = r.linhas || [];
    if (linhas.length > LIMITE_LINHAS) {
      avisos.push(`Mostrando ${LIMITE_LINHAS.toLocaleString('pt-BR')} de ${linhas.length.toLocaleString('pt-BR')} linhas — refine os filtros.`);
      linhas = linhas.slice(0, LIMITE_LINHAS);
    }
    return res.status(200).json({ ...r, linhas, avisos, ms: Date.now() - inicio });
  } catch (e: any) {
    await db.query('ROLLBACK').catch(() => undefined);
    if (e instanceof RelatorioValidacaoError) return res.status(400).json({ erro: e.message });
    if (e?.code === '57014') return res.status(504).json({ erro: 'O relatório demorou demais (mais de 2 minutos). Reduza o período ou use mais filtros.' });
    console.error(`Erro no relatório ${slug}:`, e);
    return res.status(500).json({ erro: 'Erro ao gerar o relatório.', detalhes: e?.message });
  } finally {
    db.release();
  }
}
