import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

/**
 * Substitui um produto por outro (espelha spSUBSTITUIR_PRODUTO do Delphi).
 * Efeito no banco: grava o vínculo em dbprod_substituir (não mexe em excluido
 * nem em estoque — "excluir" é uma operação separada no legado) e registra a
 * auditoria em xaud_produto_substituir.
 *
 * Regras (iguais ao Delphi):
 *  - não pode substituir um produto por ele mesmo;
 *  - o substituto não pode já ser "substituído" nem "substituto" de outro;
 *  - a marca do original e do substituto deve ser a mesma.
 *
 * Se o original já tinha um substituto, o vínculo é atualizado (modifica).
 *
 * POST /api/produtos/substituir
 * Body: { codprod_original, codprod_substituto }
 */

interface UserInfo {
  codusr: string;
  nomeusr: string;
}

function lerUsuario(req: NextApiRequest): UserInfo {
  try {
    const raw = req.headers['x-user-data'];
    if (typeof raw === 'string' && raw) {
      const u = JSON.parse(raw);
      return {
        codusr: String(u.codigo ?? u.cod ?? u.codusr ?? u.usuario ?? ''),
        nomeusr: String(u.nome ?? u.nomeusr ?? u.usuario ?? ''),
      };
    }
  } catch {
    /* ignore */
  }
  return { codusr: '', nomeusr: '' };
}

const SEL_PROD = `
  SELECT p.codprod, p.ref, p.codmarca, p.qtest, p.inf,
         COALESCE((SELECT m.descr FROM db_manaus.dbmarcas m
                    WHERE m.codmarca = p.codmarca LIMIT 1), '') AS marca_nome
    FROM db_manaus.dbprod p WHERE p.codprod = $1`;

async function auditar(
  client: PoolClient,
  user: UserInfo,
  orig: any,
  subs: any,
  operacao: number,
) {
  try {
    await client.query(
      `INSERT INTO db_manaus.xaud_produto_substituir
         (id, codusr, nomeusr, data,
          orig_codprod, orig_ref, orig_marca, orig_qtest, orig_inf,
          subs_codprod, subs_ref, subs_marca, subs_qtest, subs_inf, operacao)
       VALUES (
          COALESCE((SELECT MAX(id) FROM db_manaus.xaud_produto_substituir), 0) + 1,
          $1, $2, NOW(),
          $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13)`,
      [
        // trunca para o tamanho das colunas (evita "valor muito longo" — que,
        // rodando DENTRO da transação, abortava tudo e revertia a substituição)
        String(user.codusr ?? '').slice(0, 4),
        String(user.nomeusr ?? '').slice(0, 20),
        orig.codprod,
        String(orig.ref ?? '').slice(0, 20),
        String(orig.codmarca ?? '').slice(0, 5), // coluna é o CÓDIGO da marca (5), não o nome
        orig.qtest,
        orig.inf ?? '',
        subs.codprod,
        String(subs.ref ?? '').slice(0, 20),
        String(subs.codmarca ?? '').slice(0, 5),
        subs.qtest,
        subs.inf ?? '',
        operacao,
      ],
    );
  } catch (e) {
    // auditoria não deve bloquear a operação principal
    console.error('Falha ao auditar substituição:', e);
  }
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codprod_original, codprod_substituto } = req.body || {};
  const original = String(codprod_original ?? '').trim();
  const substituto = String(codprod_substituto ?? '').trim();

  if (!original || !substituto) {
    return res.status(400).json({ error: 'Produtos não informados' });
  }
  if (original === substituto) {
    return res.status(400).json({
      error: 'Você NÃO pode substituir um produto por ele mesmo.',
    });
  }

  const user = lerUsuario(req);
  const client = await getPgPool().connect();
  try {
    const po = await client.query(SEL_PROD, [original]);
    const ps = await client.query(SEL_PROD, [substituto]);
    if (po.rows.length === 0 || ps.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    const prodOrig = po.rows[0];
    const prodSubs = ps.rows[0];

    // marca precisa ser igual
    if (String(prodOrig.codmarca) !== String(prodSubs.codmarca)) {
      return res.status(400).json({
        error: 'Produto com marca diferente. A operação não poderá ser concluída.',
      });
    }

    // o substituto não pode já estar envolvido em outra substituição
    const jaEnvolvido = await client.query(
      `SELECT codprod_orig, codprod_subs FROM db_manaus.dbprod_substituir
        WHERE codprod_orig = $1 OR codprod_subs = $1 LIMIT 1`,
      [substituto],
    );
    if (jaEnvolvido.rows.length > 0) {
      const row = jaEnvolvido.rows[0];
      const msg =
        row.codprod_orig === substituto
          ? 'Este produto foi substituído. A operação não poderá ser concluída.'
          : 'Este produto é substituto de outro produto. A operação não poderá ser concluída.';
      return res.status(400).json({ error: msg });
    }

    await client.query('BEGIN');
    // se o original já tinha substituto, atualiza (remove o antigo)
    await client.query(
      `DELETE FROM db_manaus.dbprod_substituir WHERE codprod_orig = $1`,
      [original],
    );
    await client.query(
      `INSERT INTO db_manaus.dbprod_substituir (codprod_orig, codprod_subs)
       VALUES ($1, $2)`,
      [original, substituto],
    );
    // Marca o original como SUBSTITUÍDO (inf='S'), igual ao Delphi — assim ele
    // é bloqueado ao ser adicionado em requisição. Ver memória
    // produto-status-ativo-inativo.
    await client.query(
      `UPDATE db_manaus.dbprod SET inf = 'S' WHERE codprod = $1`,
      [original],
    );
    await client.query('COMMIT');
    // Auditoria FORA da transação: se falhar, não reverte a substituição
    // (antes rodava dentro do BEGIN e um erro abortava tudo).
    await auditar(client, user, prodOrig, prodSubs, 1);

    res.status(200).json({ message: 'Operação realizada com sucesso.' });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao substituir produto:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
