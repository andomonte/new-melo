// Garantia de Produto — detalhe, alteração de situação e cancelamento.
// Porte das abas Alteração/Operações do TFrmGarantiaProd do Delphi.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import {
  STATUS_GARANTIA,
  devolverEstoque,
  registrarAcao,
} from '@/lib/vendas/garantia';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const codgar = String(req.query.codgar ?? '').trim();
  if (!codgar) return res.status(400).json({ error: 'Garantia não informada.' });

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    if (req.method === 'GET') return obter(client, codgar, res);
    if (req.method === 'PUT') return alterarSituacao(client, codgar, req, res);
    if (req.method === 'DELETE') return cancelar(client, codgar, req, res);

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (erro: any) {
    console.error('Erro na garantia:', erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function obter(client: PoolClient, codgar: string, res: NextApiResponse) {
  const cab = await client.query(
    `SELECT g.codgar, g.nrodoc, g.codcli, c.nome AS cliente,
            g.dt_gar, g.status, g.obs, g.cancel, g.codusr
     FROM dbgarantiaprod g
     LEFT JOIN dbclien c ON c.codcli = g.codcli
     WHERE g.codgar = $1`,
    [codgar],
  );

  if (!cab.rows.length) {
    return res.status(404).json({ error: 'Garantia não encontrada.' });
  }

  // Mesmas colunas do grid DbgItGar do Delphi: Referência, Descrição, Marca,
  // Quant., Pç. Unit.
  const itens = await client.query(
    `SELECT i.codprod, p.ref, p.descr, m.descr AS marca,
            i.qtde, i.prunit, (i.qtde * i.prunit) AS total,
            i.arm_id, a.arm_descricao AS armazem
     FROM dbitgarantiaprod i
     LEFT JOIN dbprod p ON p.codprod = i.codprod
     LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
     LEFT JOIN cad_armazem a ON a.arm_id = i.arm_id
     WHERE i.codgar = $1
     ORDER BY p.ref`,
    [codgar],
  );

  return res.status(200).json({ ...cab.rows[0], itens: itens.rows });
}

async function alterarSituacao(
  client: PoolClient,
  codgar: string,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const status = String(req.body?.status ?? '').trim().toUpperCase();
  if (!STATUS_GARANTIA[status]) {
    return res.status(400).json({ error: 'Situação inválida.' });
  }

  // Alt_Status_Garantia só troca o status — não mexe em estoque.
  const { rowCount } = await client.query(
    `UPDATE dbgarantiaprod SET status = $2 WHERE codgar = $1 AND cancel = 'N'`,
    [codgar, status],
  );

  if (!rowCount) {
    return res
      .status(404)
      .json({ error: 'Garantia não encontrada ou já cancelada.' });
  }

  await registrarAcao(
    client, req.body?.codusr, 'ALTERA STATUS DA GARANTIA', 'DBGARANTIAPROD', `COD:${codgar}`,
  );

  return res
    .status(200)
    .json({ success: true, message: 'Situação alterada com sucesso.' });
}

async function cancelar(
  client: PoolClient,
  codgar: string,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Canc_Gar do Oracle: DEVOLVE o estoque de cada item e só então marca
  // cancel='S' (não exclui — o filtro da listagem usa g.cancel = 'N').
  try {
    await client.query('BEGIN');

    // Trava a garantia para não cancelar duas vezes e devolver estoque dobrado.
    const alvo = await client.query(
      `SELECT codgar FROM dbgarantiaprod WHERE codgar = $1 AND cancel = 'N' FOR UPDATE`,
      [codgar],
    );
    if (!alvo.rows.length) {
      await client.query('ROLLBACK');
      return res
        .status(404)
        .json({ error: 'Garantia não encontrada ou já cancelada.' });
    }

    await devolverEstoque(client, codgar);

    await client.query(
      `UPDATE dbgarantiaprod SET cancel = 'S' WHERE codgar = $1`,
      [codgar],
    );

    await registrarAcao(
      client, req.body?.codusr, 'CANCELAR GARANTIA DE PRODUTO', 'DBGARANTIAPROD', `COD:${codgar}`,
    );

    await client.query('COMMIT');
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => {});
    throw erro;
  }

  return res.status(200).json({
    success: true,
    message: 'Garantia cancelada e estoque devolvido.',
  });
}
