import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Salva a tela "Alterar Campos Lista" (frmAlteraCampoProduto do Delphi):
 * cada produto pode receber um valor diferente (edição linha a linha, tipo
 * Excel). Ao contrário do update-massa (um valor para todos), aqui cada linha
 * traz seu próprio valor.
 *
 * POST /api/produtos/update-campos-lista
 * Body simples:  { campo: string, rows: [{ codprod, valor }] }
 * Body fiscal:   { campo: 'clasfiscal', rows: [{ codprod, clasfiscal, pis, cofins, percsubst, cest }] }
 */

// campo -> tipo de conversão do valor único
const CAMPOS_SIMPLES: Record<string, 'text' | 'number' | 'integer'> = {
  descr: 'text',
  prcompra: 'number',
  prfabr: 'number',
  prcustoatual: 'number',
  qtestmin: 'integer',
  qtembal: 'integer',
  margem: 'number',
  margempromo: 'number',
  strib: 'text',
  isentoipi: 'text',
  naotemst: 'text',
  hanan: 'text',
};

function converte(tipo: 'text' | 'number' | 'integer', valor: any): any {
  if (valor === null || valor === undefined || valor === '') {
    return tipo === 'text' ? '' : null;
  }
  if (tipo === 'text') return String(valor);
  const s = String(valor).replace(',', '.');
  if (tipo === 'integer') {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  }
  const f = parseFloat(s);
  return Number.isNaN(f) ? null : f;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { campo, rows } = req.body || {};

  if (!campo || typeof campo !== 'string') {
    return res.status(400).json({ error: 'Campo é obrigatório' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha para alterar' });
  }

  const isFiscal = campo === 'clasfiscal';
  if (!isFiscal && !CAMPOS_SIMPLES[campo]) {
    return res.status(400).json({ error: `Campo "${campo}" não permitido` });
  }

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    let alterados = 0;

    if (isFiscal) {
      for (const row of rows) {
        if (!row?.codprod) continue;
        const r = await client.query(
          `UPDATE dbprod
              SET clasfiscal = $1, pis = $2, cofins = $3, percsubst = $4, cest = $5
            WHERE codprod = $6`,
          [
            String(row.clasfiscal ?? '').replace(/\D/g, ''),
            converte('number', row.pis),
            converte('number', row.cofins),
            converte('number', row.percsubst),
            String(row.cest ?? '').replace(/\D/g, ''),
            String(row.codprod),
          ],
        );
        alterados += r.rowCount || 0;
      }
    } else if (campo === 'descr') {
      // Na tela de Descrição a Referência também pode ser alterada (Delphi)
      for (const row of rows) {
        if (!row?.codprod) continue;
        const temRef = row.ref !== undefined && row.ref !== null;
        const r = temRef
          ? await client.query(
              `UPDATE dbprod SET descr = $1, ref = $2 WHERE codprod = $3`,
              [String(row.valor ?? ''), String(row.ref ?? ''), String(row.codprod)],
            )
          : await client.query(
              `UPDATE dbprod SET descr = $1 WHERE codprod = $2`,
              [String(row.valor ?? ''), String(row.codprod)],
            );
        alterados += r.rowCount || 0;
      }
    } else {
      const tipo = CAMPOS_SIMPLES[campo];
      for (const row of rows) {
        if (!row?.codprod) continue;
        const r = await client.query(
          `UPDATE dbprod SET ${campo} = $1 WHERE codprod = $2`,
          [converte(tipo, row.valor), String(row.codprod)],
        );
        alterados += r.rowCount || 0;
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Alterações salvas', campo, alterados });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Erro update-campos-lista:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
