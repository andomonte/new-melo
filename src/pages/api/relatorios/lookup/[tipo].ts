import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Busca de cadastros para os filtros dos relatórios. GET /api/relatorios/lookup/<vendedor|marca|grupo|cliente|fornecedor|comprador|produto|segmento|grupofunc>?search=
 * Devolve { itens: [{ value, label }] } (formato do Autocomplete).
 */
const pool = getPgPool();

const FONTES: Record<string, { tabela: string; cod: string; nome: string; extra?: string }> = {
  vendedor: { tabela: 'dbvend', cod: 'codvend', nome: 'nome' },
  marca: { tabela: 'dbmarcas', cod: 'codmarca', nome: 'descr' },
  grupo: { tabela: 'dbgpprod', cod: 'codgpp', nome: 'descr' },
  cliente: { tabela: 'dbclien', cod: 'codcli', nome: 'nome', extra: 'cpfcgc' },
  fornecedor: { tabela: 'dbcredor', cod: 'cod_credor', nome: 'nome', extra: 'cpf_cgc' },
  comprador: { tabela: 'dbcompradores', cod: 'codcomprador', nome: 'nome' },
  produto: { tabela: 'dbprod', cod: 'codprod', nome: 'descr', extra: 'ref' },
  segmento: { tabela: 'dbsegmento', cod: 'codseg', nome: 'descricao' },
  grupofunc: { tabela: 'dbgpfunc', cod: 'codgpf', nome: 'descr' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  const f = FONTES[String(req.query.tipo || '')];
  if (!f) return res.status(400).json({ erro: 'Tipo de busca inválido.' });
  const q = String(req.query.q || req.query.search || '').trim();
  try {
    const params: any[] = [];
    let onde = '';
    if (q) {
      params.push(`%${q}%`, q);
      onde = `WHERE ${f.nome} ILIKE $1 OR ${f.cod}::text = $2 OR ${f.cod}::text ILIKE $2 || '%'${f.extra ? ` OR ${f.extra}::text ILIKE $1` : ''}`;
    }
    const r = await pool.query(
      `SELECT ${f.cod}::text AS cod, ${f.nome} AS nome${f.extra ? `, ${f.extra}::text AS extra` : ''}
         FROM ${f.tabela} ${onde} ORDER BY ${q ? `(${f.cod}::text = $2) DESC, ` : ''}${f.nome} LIMIT 30`, params);
    return res.status(200).json({
      itens: r.rows.map((x) => ({
        value: x.cod,
        label: `${x.cod} - ${x.nome || ''}${x.extra ? ` (${x.extra})` : ''}`.trim(),
      })),
    });
  } catch (e: any) {
    console.error('Erro na busca do relatório:', e);
    return res.status(500).json({ erro: 'Erro na busca' });
  }
}
