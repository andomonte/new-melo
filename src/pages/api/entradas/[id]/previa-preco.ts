/**
 * GET /api/entradas/[id]/previa-preco
 *
 * Prévia SOMENTE INFORMATIVA do Confirmar Preço de uma entrada: itens com o custo e o
 * "antes → depois" de cada produto (custo de compra, taxa do dólar, custo em R$ e preço
 * de venda ZFM).
 *
 * Para o "depois" sair idêntico ao que a confirmação grava, roda o MESMO motor
 * (confirmarPrecoEntrada + aplicarCustoImportacao) dentro de uma transação que é
 * SEMPRE desfeita (ROLLBACK). Nada é gravado.
 *
 * Entrada já confirmada: devolve os valores atuais (sem simular).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { confirmarPrecoEntrada } from '@/lib/compras/gerarEntradaDbent';
import { aplicarCustoImportacao } from '@/lib/importacao/custoImportacao';

const n = (v: any) => (v == null ? null : Number(v));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  const codent = String(req.query.id || '').trim();
  if (!codent) return res.status(400).json({ message: 'Entrada não informada' });

  const cookies = parseCookies({ req });
  const pool = getPgPool(cookies.filial_melo || cookies.filial || 'MANAUS');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);

    const ent = (
      await client.query(
        `SELECT e.codent, e.status, e.cod_credor, c.nome AS credor_nome, e.nroform, e.nrodi,
                e.valordolar, rec.status AS rec_status
           FROM dbent e
           LEFT JOIN dbcredor c ON c.cod_credor = e.cod_credor
           LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
          WHERE e.codent = $1`,
        [codent],
      )
    ).rows[0];
    if (!ent) return res.status(404).json({ message: `Entrada ${codent} não encontrada` });

    const itens = (
      await client.query(
        `SELECT ie.codprod, ie.codreq, ie.quant, ie.prunit, p.ref, p.descr, p.dolar
           FROM dbitent ie LEFT JOIN dbprod p ON p.codprod = ie.codprod
          WHERE ie.codent = $1 ORDER BY ie.codprod, ie.codreq`,
        [codent],
      )
    ).rows;
    const cods = [...new Set(itens.map((i) => i.codprod))];

    const lerProdutos = async () => {
      const rows = (
        await client.query(
          `SELECT codprod, prcompra, txdolarcompra, prvenda, dolar FROM dbprod WHERE codprod = ANY($1)`,
          [cods],
        )
      ).rows;
      return new Map(rows.map((r) => [r.codprod, r]));
    };
    const lerCustosItens = async () =>
      new Map(
        (
          await client.query(
            `SELECT codprod, codreq, prcusto FROM dbitent WHERE codent = $1`, [codent])
        ).rows.map((r) => [`${r.codprod}|${r.codreq}`, n(r.prcusto)]),
      );

    const antes = await lerProdutos();
    const pendente = ent.status === 'A' && (!ent.rec_status || ent.rec_status === 'PENDENTE');

    let depois = antes;
    let custosItens = await lerCustosItens();
    if (pendente) {
      // Simulação: o mesmo motor da confirmação; desfeito no finally (ROLLBACK).
      const empRow = await client.query(`SELECT uf FROM dadosempresa LIMIT 1`);
      const uf = empRow.rows[0]?.uf || 'AM';
      const zonaRow = await client.query(`SELECT "ZONA_ISENTIVADA" AS zona FROM dbuf_n WHERE "UF" = $1`, [uf]);
      await confirmarPrecoEntrada(client, codent, { uf, zona_isentivada: zonaRow.rows[0]?.zona || 'S' }, 0);
      await aplicarCustoImportacao(client, codent);
      depois = await lerProdutos();
      custosItens = await lerCustosItens();
    }

    const produto = (mapa: Map<string, any>, cod: string) => {
      const p = mapa.get(cod) || {};
      const prcompra = n(p.prcompra) ?? 0;
      const tx = p.dolar === 'S' ? n(p.txdolarcompra) ?? 0 : null;
      return {
        prcompra,
        txdolar: tx,
        custoReais: tx != null ? Math.round(prcompra * tx * 100) / 100 : prcompra,
        prvenda: n(p.prvenda),
      };
    };

    const linhas = itens.map((i) => ({
      codprod: i.codprod,
      ref: i.ref,
      descr: i.descr,
      ordem: i.codreq,
      quant: n(i.quant),
      custoUnit: n(i.prunit),
      total: Math.round((n(i.prunit) ?? 0) * (n(i.quant) ?? 0) * 100) / 100,
      custoItem: custosItens.get(`${i.codprod}|${i.codreq}`) ?? null,
      dolar: i.dolar === 'S',
      antes: produto(antes, i.codprod),
      depois: produto(depois, i.codprod),
    }));

    return res.status(200).json({
      success: true,
      entrada: {
        codent: ent.codent,
        codCredor: ent.cod_credor,
        credorNome: ent.credor_nome,
        nroform: ent.nroform,
        nrodi: ent.nrodi,
        cotacao: n(ent.valordolar),
        confirmada: !pendente,
      },
      simulado: pendente,
      itens: linhas,
    });
  } catch (e: any) {
    console.error('[previa-preco] erro:', e);
    return res.status(500).json({ message: e.message || 'Erro ao montar a prévia do preço' });
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
