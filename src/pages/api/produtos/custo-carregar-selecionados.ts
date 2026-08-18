import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Carrega os produtos SELECIONADOS na lista (por codprod) para o "Atualizar Custo
 * da Mercadoria" — modo sem planilha. Traz os dados atuais do dbprod (preços de
 * fábrica, NCM, IPI/PIS/COFINS, descrição) para o usuário ajustar os preços e
 * recalcular o custo. Complementa o custo-carregar (que resolve por referência+marca).
 *
 * POST /api/produtos/custo-carregar-selecionados
 * Body: { codprods: string[] }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const codprods: string[] = Array.isArray(req.body?.codprods)
    ? req.body.codprods.filter(Boolean).map(String)
    : [];
  if (codprods.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto selecionado.' });
  }

  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `SELECT codprod, ref, descr, aplic_extendida, prfabr, preconf, precosnf,
              clasfiscal, ipi, pis, cofins
         FROM db_manaus.dbprod
        WHERE codprod = ANY($1) AND excluido = 0`,
      [codprods],
    );

    const num = (v: any) => {
      const f = parseFloat(String(v ?? '').replace(',', '.'));
      return Number.isNaN(f) ? 0 : f;
    };

    // Já no shape do GridRow do modal (IPI/PIS/COFINS do dbprod já vêm em %).
    const produtos = r.rows.map((p: any) => ({
      codprod: String(p.codprod),
      ref: p.ref || '',
      descricao: p.descr || p.aplic_extendida || '',
      ncm: p.clasfiscal || '',
      ipi: num(p.ipi),
      pis: num(p.pis),
      cofins: num(p.cofins),
      barras: '',
      aplicacao: p.aplic_extendida || '',
      prBruto: num(p.prfabr),
      prNF: num(p.preconf),
      prSNF: num(p.precosnf),
      custo: 0,
      custoFE: 0,
      custoZF: 0,
    }));

    res.status(200).json({ produtos });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
