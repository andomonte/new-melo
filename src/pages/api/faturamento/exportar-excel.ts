import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import ExcelJS from 'exceljs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') return res.status(405).end();

  const { filtros = [], colunas = [] } = req.body;

  if (!colunas || colunas.length === 0) {
    return res
      .status(400)
      .json({ error: 'Nenhuma coluna selecionada para exportação.' });
  }

  const nomesAmigaveis: Record<string, string> = {
    codfat: 'Código da Fatura',
    nroform: 'Formulário',
    cliente_nome: 'Cliente',
    totalnf: 'Total',
    data: 'Data',
    codvend: 'Vendedor',
    codtransp: 'Transportadora',
    cancel: 'Cancelado',
    cobranca: 'Cobrança',
    denegada: 'Denegada',
    agp: 'Agrupada',
  };

  const values: any[] = [];
  const whereClauses: string[] = [];

  filtros.forEach(({ campo, tipo, valor }: any, i: number) => {
    const paramIndex = i + 1;
    const field = campo === 'cliente_nome' ? 'c.nome' : `f.${campo}`;
    if (tipo === 'contém') {
      whereClauses.push(`${field} ILIKE $${paramIndex}`);
      values.push(`%${valor}%`);
    } else if (tipo === 'igual') {
      whereClauses.push(`${field} = $${paramIndex}`);
      values.push(valor);
    }
  });

  const where = whereClauses.length
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const selectedCols = colunas
    .map((c: string) =>
      c === 'cliente_nome' ? 'c.nome AS cliente_nome' : `f.${c}`,
    )
    .join(', ');

  const query = `
    SELECT ${selectedCols}
    FROM dbfatura f
    LEFT JOIN dbclien c ON f.codcli = c.codcli
    ${where}
    LIMIT 1000
  `;

  const client = await getPgPool().connect();
  try {
    const result = await client.query(query, values);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Faturas');

    if (result.rows.length) {
      sheet.columns = Object.keys(result.rows[0]).map((key) => ({
        header: nomesAmigaveis[key] ?? key.toUpperCase(),
        key,
      }));
    }

    sheet.addRows(result.rows);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=faturas.xlsx');

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=faturas.xlsx');
    res.end(buffer);
  } catch (err) {
    console.error('Erro ao exportar Excel:', err);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  } finally {
    client.release();
  }
}
