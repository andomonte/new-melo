import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/transferencia/criar-venda
 *   { codent, codcli_destino, username, transp?, codtptransp?, vlr_frete?, pedido?, obs?, itens:[{codprod,qtd,pr_transf,arm_id}] }
 * Cria a VENDA de transferência (operacao=TRANSFERENCIA) para o cliente-filial destino.
 * Campos fiscais de dbitvenda ficam nulos — o /api/faturamento/salvar recalcula na fatura.
 * NÃO gerencia estoque nem NF — isso é do salvar/emitir (chamados depois pelo orquestrador).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  const b = req.body || {};
  const codent = String(b.codent || '').trim();
  const codcli = String(b.codcli_destino || '').trim();
  const itens = Array.isArray(b.itens) ? b.itens : [];
  if (!codent || !codcli) return res.status(400).json({ erro: 'Obrigatórios: codent, codcli_destino.' });
  if (itens.length === 0) return res.status(400).json({ erro: 'Informe ao menos um item.' });

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    // emitente (origem) — CNPJ/IE da empresa
    const emp = await client.query(`SELECT cgc, inscricaoestadual FROM db_manaus.dadosempresa LIMIT 1`);
    const cnpjEmp = emp.rows[0]?.cgc || null;
    const ieEmp = emp.rows[0]?.inscricaoestadual || null;

    // próximos códigos (mesma lógica do finalizarVenda)
    const ids = await client.query(
      `SELECT
         (COALESCE(MAX(NULLIF(regexp_replace(codvenda,'\\D','','g'),'')::bigint),0)+1)::text AS c,
         (COALESCE(MAX(NULLIF(regexp_replace(nrovenda,'\\D','','g'),'')::bigint),0)+1)::text AS n
       FROM db_manaus.dbvenda`,
    );
    const codvenda = String(ids.rows[0].c).padStart(9, '0');
    const nrovenda = String(ids.rows[0].n).padStart(9, '0');
    const total = itens.reduce((s: number, it: any) => s + Number(it.pr_transf || 0) * Number(it.qtd || 0), 0);

    await client.query(
      // operacao=NULL: o tipo TRANSFERENCIA é aplicado no faturamento (tipo_operacao no salvar),
      // que decide o CFOP 6152. Aqui a venda é só o registro faturável.
      `INSERT INTO db_manaus.dbvenda
         (operacao, codvenda, codusr, codvend, nrovenda, codcli, data, total, pedido, status,
          transp, obs, tipo, tele, cancel, impresso, vlrfrete, codtptransp, bloqueada,
          estoque_virtual, statuspedido, cnpj_empresa, ie_empresa)
       VALUES
         (NULL,$1,$2,$3,$4,$5,NOW(),$6,$7,'N',
          $8,$9,'1','N','N','N',$10,$11,'0',
          'N',1,$12,$13)`,
      [codvenda, String(b.codusr || '0').slice(0, 4), String(b.codvend || '00025'), nrovenda, codcli, total,
       b.pedido ?? null, b.transp ?? null, b.obs ?? null, Number(b.vlr_frete || 0), b.codtptransp ?? null,
       cnpjEmp, ieEmp],
    );

    // itens — base + NCM/CFOP do produto; impostos ficam nulos (recalc no salvar)
    let nritem = 0;
    for (const it of itens) {
      nritem++;
      const prod = await client.query(
        `SELECT descr, ref, clasfiscal FROM db_manaus.dbprod WHERE codprod=$1`,
        [it.codprod],
      );
      await client.query(
        `INSERT INTO db_manaus.dbitvenda
           (codvenda, codprod, prunit, qtd, demanda, descr, arm_id, ref, nritem, ncm, cfop)
         VALUES ($1,$2,$3,$4,'N',$5,$6,$7,$8,$9,$10)`,
        [codvenda, it.codprod, Number(it.pr_transf || 0), Number(it.qtd || 0),
         prod.rows[0]?.descr ?? null, it.arm_id ?? null, prod.rows[0]?.ref ?? null,
         String(nritem), prod.rows[0]?.clasfiscal ?? null, '6152'],
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ sucesso: true, codvenda, nrovenda, total, itens: itens.length });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao criar venda de transferência:', error);
    return res.status(500).json({ erro: 'Erro ao criar venda de transferência', detalhes: error.message });
  } finally {
    client.release();
  }
}
