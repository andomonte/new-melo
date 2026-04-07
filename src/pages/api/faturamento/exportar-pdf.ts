import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Método não permitido' });

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

  const where = filtros
    .filter((f: any) => f.campo && f.valor)
    .map((f: any, i: number) => {
      const campo = f.campo === 'cliente_nome' ? 'c.nome' : `f.${f.campo}`;
      return `${campo} ILIKE $${i + 1}`;
    })
    .join(' AND ');

  const values = filtros.map((f: any) => `%${f.valor}%`);

  const client = await getPgPool().connect();
  try {
    const query = `
      SELECT ${
        colunas.includes('cliente_nome') ? 'c.nome AS cliente_nome,' : ''
      } ${colunas
      .filter((c: string) => c !== 'cliente_nome')
      .map((c: any) => `f.${c}`)
      .join(', ')}
      FROM dbfatura f
      LEFT JOIN dbclien c ON f.codcli = c.codcli
      ${where ? `WHERE ${where}` : ''}
      ORDER BY f.codfat DESC
      LIMIT 500
    `;

    const result = await client.query(query, values);
    const faturas = result.rows;

    const doc = new jsPDF();
    const tableData = faturas.map((f: any) =>
      colunas.map((col: string) => {
        if (col === 'totalnf') return `R$ ${Number(f[col] || 0).toFixed(2)}`;
        if (col === 'data') return new Date(f[col]).toLocaleDateString();
        return f[col] ?? '';
      }),
    );

    autoTable(doc, {
      head: [
        colunas.map((col: string) => nomesAmigaveis[col] ?? col.toUpperCase()),
      ],
      body: tableData,
      styles: { fontSize: 8 },
      theme: 'grid',
    });

    const pdfData = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=faturas.pdf');
    res.end(Buffer.from(pdfData));
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  } finally {
    client.release();
  }
}
