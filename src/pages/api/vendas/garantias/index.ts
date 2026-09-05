// Garantia de Produto — listagem e inclusão.
// Porte do TFrmGarantiaProd do Delphi (abas Garantia/Filtrar e Cadastro).

import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import {
  ErroGarantia,
  STATUS_INCLUSAO,
  baixarEstoque,
  normalizarItens,
  proximoCodGar,
  registrarAcao,
} from '@/lib/vendas/garantia';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') return listar(req, res);
  if (req.method === 'POST') {
    const body = req.body ?? {};
    // O GenericCrudPage/DataTable lista via POST; a inclusão vem com itens.
    const ehListagem =
      'page' in body || 'filtros' in body || ('search' in body && !('itens' in body));
    return ehListagem ? listar(req, res) : incluir(req, res);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

async function listar(req: NextApiRequest, res: NextApiResponse) {
  const source = req.method === 'POST' ? req.body : req.query;
  const page = Math.max(1, Number(source.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(source.perPage) || 10));
  const search = String(source.search ?? '').trim();
  const status = String(source.status ?? '').trim().toUpperCase();
  const de = String(source.de ?? '').trim();
  const ate = String(source.ate ?? '').trim();
  // O filtro do Delphi (btnFiltrarClick) sempre traz g.cancel = 'N'.
  const incluirCanceladas = String(source.incluirCanceladas ?? '') === 'true';

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    const params: any[] = [];
    const where: string[] = [];

    if (!incluirCanceladas) where.push(`g.cancel = 'N'`);

    if (search) {
      params.push(`%${search}%`);
      where.push(`(g.codgar ILIKE $${params.length}
                   OR g.nrodoc ILIKE $${params.length}
                   OR c.nome ILIKE $${params.length}
                   OR g.codcli ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`g.status = $${params.length}`);
    }
    if (de) {
      params.push(de);
      where.push(`g.dt_gar >= $${params.length}::date`);
    }
    if (ate) {
      params.push(ate);
      where.push(`g.dt_gar < ($${params.length}::date + interval '1 day')`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `FROM dbgarantiaprod g
                  LEFT JOIN dbclien c ON c.codcli = g.codcli
                  ${whereSql}`;

    const total = Number(
      (await client.query(`SELECT COUNT(*) AS n ${from}`, params)).rows[0].n,
    );

    const { rows } = await client.query(
      `SELECT g.codgar, g.nrodoc, g.codcli, c.nome AS cliente,
              g.dt_gar, g.status, g.obs, g.cancel,
              (SELECT COUNT(*) FROM dbitgarantiaprod i WHERE i.codgar = g.codgar) AS itens,
              (SELECT COALESCE(SUM(i.qtde * i.prunit), 0)
                 FROM dbitgarantiaprod i WHERE i.codgar = g.codgar) AS total_garantia
       ${from}
       ORDER BY g.dt_gar DESC, g.codgar DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, (page - 1) * perPage],
    );

    return res.status(200).json({
      data: rows,
      meta: {
        total,
        perPage,
        currentPage: total > 0 ? page : 1,
        lastPage: total > 0 ? Math.ceil(total / perPage) : 1,
        firstPage: 1,
      },
    });
  } catch (erro: any) {
    console.error('Erro ao listar garantias:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function incluir(req: NextApiRequest, res: NextApiResponse) {
  const { nrodoc, codcli, obs, status, dt_gar, codusr } = req.body ?? {};

  let client: PoolClient | undefined;
  try {
    // Mesmas recusas do BtConfClick, na mesma ordem.
    const cliente = String(codcli ?? '').trim();
    if (!cliente) throw new ErroGarantia('Informe o cliente.');

    const documento = String(nrodoc ?? '').trim();
    if (!documento) throw new ErroGarantia('Informe o nº do documento.');

    const situacao = String(status ?? '').trim().toUpperCase();
    if (!STATUS_INCLUSAO.includes(situacao as any)) {
      throw new ErroGarantia('Informe a situação da garantia (Provisório ou Melo).');
    }

    const itens = normalizarItens(req.body?.itens);

    client = await getPgPool().connect();
    await client.query('BEGIN');

    const existeCli = await client.query(
      'SELECT 1 FROM dbclien WHERE codcli = $1 LIMIT 1',
      [cliente],
    );
    if (!existeCli.rows.length) throw new ErroGarantia('Cliente inválido.');

    const codgar = await proximoCodGar(client);

    await client.query(
      `INSERT INTO dbgarantiaprod (codgar, nrodoc, codcli, dt_gar, obs, status, cancel, codusr)
       VALUES ($1, $2, $3, COALESCE($4::timestamp, CURRENT_TIMESTAMP), $5, $6, 'N', $7)`,
      [
        codgar,
        documento.slice(0, 15),
        cliente,
        dt_gar || null,
        String(obs ?? '').trim().slice(0, 60) || null,
        situacao,
        String(codusr ?? '').trim().slice(0, 20) || null,
      ],
    );

    // Baixa o estoque revalidando o saldo, como o inc_garantia do Oracle.
    await baixarEstoque(client, itens);

    for (const item of itens) {
      await client.query(
        `INSERT INTO dbitgarantiaprod (codgar, codprod, qtde, prunit, arm_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [codgar, item.codprod, item.qtde, item.prunit, item.arm_id],
      );
    }

    await registrarAcao(client, codusr, 'INCLUIR GARANTIA', 'DBGARANTIAPROD', `COD:${codgar}`);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      codgar,
      message: `O número da garantia é: ${codgar}`,
    });
  } catch (erro: any) {
    await client?.query('ROLLBACK').catch(() => {});
    if (erro instanceof ErroGarantia) {
      return res.status(400).json({ error: erro.message });
    }
    if (erro?.code === '23503') {
      return res.status(400).json({ error: 'Cliente, produto ou armazém inválido.' });
    }
    console.error('Erro ao incluir garantia:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}
