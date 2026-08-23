import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Resolve os produtos de uma importação de "Atualizar Custo da Mercadoria"
 * pela Referência + Marca (equivale ao spConsulta_Excecao + spCarregar_Produto
 * do Delphi). Para cada referência informa o status:
 *   - OK         -> 1 produto encontrado (retorna codprod + descr atual)
 *   - DUPLICADO  -> mais de 1 produto com a mesma ref+marca
 *   - INEXISTENTE-> nenhum produto com a ref+marca
 *
 * POST /api/produtos/custo-carregar
 * Body: { codmarca: string, refs: string[] }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const codmarca = String(req.body?.codmarca ?? '').trim();
  const refs: unknown = req.body?.refs;
  if (!codmarca) return res.status(400).json({ error: 'Marca é obrigatória' });
  if (!Array.isArray(refs) || refs.length === 0) {
    return res.status(400).json({ error: 'Nenhuma referência informada' });
  }

  const client = await getPgPool().connect();
  try {
    const resultados: Array<{
      ref: string;
      status: 'OK' | 'DUPLICADO' | 'INEXISTENTE';
      codprod?: string;
      descr?: string;
    }> = [];

    for (const rawRef of refs) {
      const ref = String(rawRef ?? '').trim();
      if (!ref) continue;
      const r = await client.query(
        `SELECT codprod, descr FROM dbprod
          WHERE UPPER(ref) = UPPER($1) AND codmarca = $2 AND excluido = 0`,
        [ref, codmarca],
      );
      if (r.rows.length === 0) {
        resultados.push({ ref, status: 'INEXISTENTE' });
      } else if (r.rows.length > 1) {
        resultados.push({ ref, status: 'DUPLICADO' });
      } else {
        resultados.push({
          ref,
          status: 'OK',
          codprod: r.rows[0].codprod,
          descr: r.rows[0].descr,
        });
      }
    }

    res.status(200).json({ resultados });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
