import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const filtrosRaw = req.query.filtros;
  const offset = (page - 1) * perPage;

  let filtros: { campo: string; tipo: string; valor: string }[] = [];

  try {
    if (typeof filtrosRaw === 'string') {
      const parsed = JSON.parse(filtrosRaw);
      if (Array.isArray(parsed)) filtros = parsed;
    }
  } catch {
    // Ignore parse errors
  }

  const client = await pool.connect();
  try {
    // Construir WHERE baseado nos filtros
    const conditions: string[] = [];
    const values: any[] = [];

    filtros.forEach(({ campo, tipo, valor }) => {
      const paramIndex = values.length + 1;
      
      let coluna = campo;
      // Mapear campos para colunas reais
      if (campo === 'cliente_nome') coluna = 'c.nome';
      if (campo === 'chave') coluna = 'n.chave';
      if (campo === 'status') coluna = 'n.status';
      if (campo === 'modelo') coluna = 'n.modelo';
      if (campo === 'numprotocolo') coluna = 'n.numprotocolo';
      
      if (tipo === 'igual') {
        conditions.push(`${coluna} = $${paramIndex}`);
        values.push(valor);
      } else if (tipo === 'contém') {
        conditions.push(`${coluna}::text ILIKE $${paramIndex}`);
        values.push(`%${valor}%`);
      } else if (tipo === 'nao_nulo') {
        conditions.push(`${coluna} IS NOT NULL`);
      }
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM db_manaus.dbfat_nfe n
      LEFT JOIN db_manaus.dbfatura f ON n.codfat = f.codfat
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Buscar dados
    const dataQuery = `
      SELECT 
        n.codfat,
        n.nrodoc_fiscal,
        n.chave,
        n.status,
        n.numprotocolo,
        n.motivo,
        n.modelo,
        n.data,
        n.dthrprotocolo,
        n.dthrcancelamento,
        n.motivocancelamento,
        n.emailenviado,
        f.nroform,
        f.totalnf,
        f.codcli,
        c.nome AS cliente_nome,
        c.cpfcgc AS cliente_cpfcgc,
        c.email AS cliente_email,
        CASE 
          WHEN n.modelo = '65' THEN 'NFC-e'
          WHEN n.modelo = '55' THEN 'NF-e'
          ELSE 'Outros'
        END AS tipo_documento
      FROM db_manaus.dbfat_nfe n
      LEFT JOIN db_manaus.dbfatura f ON n.codfat = f.codfat
      LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
      ${whereClause}
      ORDER BY n.data DESC NULLS LAST
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const result = await client.query(dataQuery, [...values, perPage, offset]);

    return res.status(200).json({
      notas: result.rows,
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar histórico de notas:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico de notas fiscais' });
  } finally {
    client.release();
  }
}
