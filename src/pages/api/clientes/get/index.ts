import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 10, search = '' } = req.query;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const searchTerm = `%${search}%`;
    // Busca por CNPJ/CPF: limpa pontuação para comparar só dígitos
    const searchDigits = String(search).replace(/\D/g, '');
    const searchDigitsTerm = searchDigits.length >= 3 ? `%${searchDigits}%` : null;

    // Query simples — enriquecimento feito no JavaScript após a query
    const query = `
      SELECT *
      FROM dbclien
      WHERE
        codcli ILIKE $1 OR
        nome ILIKE $1 OR
        cpfcgc ILIKE $1
        ${searchDigitsTerm ? `OR REPLACE(REPLACE(REPLACE(REPLACE(cpfcgc, '.', ''), '-', ''), '/', ''), ' ', '') ILIKE $4` : ''}
      ORDER BY nome ASC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM dbclien
      WHERE
        codcli ILIKE $1 OR
        nome ILIKE $1 OR
        cpfcgc ILIKE $1
        ${searchDigitsTerm ? `OR REPLACE(REPLACE(REPLACE(REPLACE(cpfcgc, '.', ''), '-', ''), '/', ''), ' ', '') ILIKE $4` : ''};
    `;

    // Executa as queries em paralelo
    const queryParams = searchDigitsTerm
      ? [searchTerm, limit, offset, searchDigitsTerm]
      : [searchTerm, limit, offset];
    const countParams = searchDigitsTerm
      ? [searchTerm, searchDigitsTerm]
      : [searchTerm];
    // Ajustar countQuery params — $4 no count vira $2
    const countQueryFinal = searchDigitsTerm
      ? countQuery.replace('$4', '$2')
      : countQuery;

    const [result, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQueryFinal, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0', 10);
    
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Buscar lookups para enriquecer (com try/catch para não quebrar se tabela não existir)
    const lookups: Record<string, Record<string, string>> = {};
    try {
      const classeResult = await client.query('SELECT codcc, descr FROM dbcclien');
      classeResult.rows.forEach((r: any) => { lookups[`cc_${String(r.codcc).trim()}`] = String(r.descr || '').trim(); });
    } catch { /* tabela pode não existir */ }
    try {
      const paisResult = await client.query('SELECT codpais, descricao FROM dbpais');
      paisResult.rows.forEach((r: any) => { lookups[`pais_${String(r.codpais).trim()}`] = String(r.descricao || '').trim(); });
    } catch { /* tabela pode não existir */ }
    try {
      const vendResult = await client.query('SELECT codvend, nome FROM dbvend');
      vendResult.rows.forEach((r: any) => { lookups[`vend_${String(r.codvend).trim()}`] = String(r.nome || '').trim(); });
    } catch { /* tabela pode não existir */ }
    try {
      const bancoResult = await client.query('SELECT banco, nome FROM dbbanco_cobranca');
      bancoResult.rows.forEach((r: any) => { lookups[`banco_${String(r.banco).trim()}`] = String(r.nome || '').trim(); });
    } catch { /* tabela pode não existir */ }

    // Mapas estáticos
    const tipoClienteMap: Record<string, string> = { R: 'R - REVENDA', F: 'F - CLIENTE FINAL', L: 'L - PROD. RURAL', S: 'S - SOLIDÁRIO', X: 'X - EXPORTAÇÃO' };
    const sitTribMap: Record<string, string> = { '1': '1 - NÃO CONTRIBUINTE', '2': '2 - LUCRO PRESUMIDO', '3': '3 - LUCRO REAL', '4': '4 - SIMPLES NACIONAL' };

    // Enriquecer dados: "código - nome" como Delphi
    const clientes = result.rows.map((c: any) => {
      const ccKey = `cc_${String(c.codcc || '').trim()}`;
      const paisKey = `pais_${String(c.codpais || '').trim()}`;
      const vendKey = `vend_${String(c.codvend || '').trim()}`;
      const bancoKey = `banco_${String(c.banco || '').trim()}`;

      if (c.codcc && lookups[ccKey]) c.codcc = `${String(c.codcc).trim()} - ${lookups[ccKey]}`;
      if (c.codpais && lookups[paisKey]) c.codpais = `${String(c.codpais).trim()} - ${lookups[paisKey]}`;
      if (c.codvend && lookups[vendKey]) c.codvend = `${String(c.codvend).trim()} - ${lookups[vendKey]}`;
      if (c.banco && lookups[bancoKey]) c.banco = `${String(c.banco).trim()} - ${lookups[bancoKey]}`;

      if (c.tipocliente && tipoClienteMap[c.tipocliente]) c.tipocliente = tipoClienteMap[c.tipocliente];
      if (c.sit_tributaria && sitTribMap[String(c.sit_tributaria)]) c.sit_tributaria = sitTribMap[String(c.sit_tributaria)];

      return c;
    });

    res.status(200).json({
      data: clientes,
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / limit) : 1,
        currentPage: total > 0 ? Number(page) : 1,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
