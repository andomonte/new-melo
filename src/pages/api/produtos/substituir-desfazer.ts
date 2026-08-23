import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

/**
 * Desfaz a substituição (espelha spSUBSTITUIR_PRODUTO_DESFAZER do Delphi):
 * remove o vínculo de dbprod_substituir e registra a auditoria (operacao=2).
 *
 * POST /api/produtos/substituir-desfazer
 * Body: { codprod_original, codprod_substituto }
 */

function lerUsuario(req: NextApiRequest): { codusr: string; nomeusr: string } {
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
         COALESCE((SELECT m.descr FROM dbmarcas m
                    WHERE m.codmarca = p.codmarca LIMIT 1), '') AS marca_nome
    FROM dbprod p WHERE p.codprod = $1`;

async function auditar(
  client: PoolClient,
  user: { codusr: string; nomeusr: string },
  orig: any,
  subs: any,
) {
  try {
    await client.query(
      `INSERT INTO xaud_produto_substituir
         (id, codusr, nomeusr, data,
          orig_codprod, orig_ref, orig_marca, orig_qtest, orig_inf,
          subs_codprod, subs_ref, subs_marca, subs_qtest, subs_inf, operacao)
       VALUES (
          COALESCE((SELECT MAX(id) FROM xaud_produto_substituir), 0) + 1,
          $1, $2, NOW(),
          $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 2)`,
      [
        // trunca para o tamanho das colunas (ver comentário em substituir.ts)
        String(user.codusr ?? '').slice(0, 4),
        String(user.nomeusr ?? '').slice(0, 20),
        orig?.codprod ?? '',
        String(orig?.ref ?? '').slice(0, 20),
        String(orig?.codmarca ?? '').slice(0, 5), // CÓDIGO da marca (5), não o nome
        orig?.qtest ?? 0,
        orig?.inf ?? '',
        subs?.codprod ?? '',
        String(subs?.ref ?? '').slice(0, 20),
        String(subs?.codmarca ?? '').slice(0, 5),
        subs?.qtest ?? 0,
        subs?.inf ?? '',
      ],
    );
  } catch (e) {
    console.error('Falha ao auditar desfazer substituição:', e);
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

  const user = lerUsuario(req);
  const client = await getPgPool().connect();
  try {
    const po = await client.query(SEL_PROD, [original]);
    const ps = await client.query(SEL_PROD, [substituto]);

    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM dbprod_substituir
        WHERE codprod_orig = $1 AND codprod_subs = $2`,
      [original, substituto],
    );
    if ((del.rowCount || 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Substituição não encontrada.' });
    }
    // Reativa o original: sai de SUBSTITUÍDO ('S') para SEM INFORMATIVO ('-'),
    // mesma convenção do Ativar. Só mexe se estiver em 'S' (marca da
    // substituição), para não clobber um inf mudado por outro motivo.
    await client.query(
      `UPDATE dbprod SET inf = '-' WHERE codprod = $1 AND inf = 'S'`,
      [original],
    );
    await client.query('COMMIT');
    // Auditoria FORA da transação (ver substituir.ts).
    await auditar(client, user, po.rows[0], ps.rows[0]);

    res.status(200).json({ message: 'Operação realizada com sucesso.' });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao desfazer substituição:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
