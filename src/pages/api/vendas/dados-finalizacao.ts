import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/vendas/dados-finalizacao?codvenda=XXX
 * Retorna dados da venda para o modal de finalização/liberação
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { codvenda } = req.query;
  if (!codvenda || typeof codvenda !== 'string') return res.status(400).json({ error: 'codvenda obrigatório' });

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Dados da venda
    const vendaResult = await client.query(
      `SELECT v.*,
        COALESCE(c.nome, '') as cliente_nome,
        COALESCE(c.nomefant, '') as cliente_nomefant,
        COALESCE(c.cpfcgc, '') as cliente_cpfcgc,
        COALESCE(c.limite, 0) as cliente_limite,
        COALESCE(c.debito, 0) as cliente_debito,
        COALESCE(c.claspgto, '') as cliente_claspgto
      FROM dbvenda v
      LEFT JOIN dbclien c ON v.codcli = c.codcli
      WHERE v.codvenda = $1`,
      [codvenda]
    );

    if (vendaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    const v = vendaResult.rows[0];

    // Vendedor e operador
    const vvendResult = await client.query(
      `SELECT vv.*, u.nomeusr as nome
       FROM dbvvend vv
       LEFT JOIN dbusuario u ON vv.codvend = u.codusr
       WHERE vv.codvenda = $1`,
      [codvenda]
    );

    // Prazos
    const prazosResult = await client.query(
      `SELECT * FROM dbprazo_pagamento WHERE codvenda = $1 ORDER BY dia`,
      [codvenda]
    );

    // Transportadoras disponíveis
    const transpResult = await client.query(
      `SELECT codtptransp, descr FROM dbtptransp ORDER BY descr`
    );

    // Formas de pagamento
    const fpResult = await client.query(
      `SELECT id, descricao FROM dbtipo_documento WHERE descricao IS NOT NULL AND descricao <> '' ORDER BY descricao`
    );

    return res.status(200).json({
      venda: {
        codvenda: v.codvenda,
        nrovenda: v.nrovenda,
        codcli: v.codcli,
        data: v.data ? new Date(v.data).toISOString() : null,
        total: Number(v.total) || 0,
        status: v.status,
        bloqueada: v.bloqueada,
        operacao: v.operacao,
        tipo: v.tipo,
        transp: v.transp || '',
        codtptransp: v.codtptransp || '',
        vlrfrete: Number(v.vlrfrete) || 0,
        prazo: v.prazo || '',
        obs: v.obs || '',
        obsfat: v.obsfat || '',
        pedido: v.pedido || '',
        tele: v.tele || 'N',
        localentregacliente: v.localentregacliente || '',
        codvend: v.codvend || '',
        formaPagamento: '',
      },
      cliente: {
        codcli: v.codcli,
        nome: v.cliente_nome,
        nomefant: v.cliente_nomefant,
        cpfcgc: v.cliente_cpfcgc,
        limite: Number(v.cliente_limite) || 0,
        debito: Number(v.cliente_debito) || 0,
        limite_disponivel: Math.max(0, (Number(v.cliente_limite) || 0) - (Number(v.cliente_debito) || 0)),
        claspgto: v.cliente_claspgto,
      },
      vendedores: vvendResult.rows.map((vv: any) => ({
        codvend: vv.codvend,
        nome: vv.nome || '',
        tipo: vv.tipo || 'V',
      })),
      prazos: prazosResult.rows.map((p: any) => ({
        data: p.data ? new Date(p.data).toISOString() : null,
        dia: Number(p.dia) || 0,
        valor: Number(p.valor) || 0,
      })),
      transportadoras: transpResult.rows.map((t: any) => ({
        codigo: t.codtptransp,
        descricao: t.descr,
      })),
      formasPagamento: fpResult.rows.map((f: any) => ({
        id: String(f.id),
        descricao: f.descricao,
      })),
    });
  } catch (error: any) {
    console.error('Erro dados-finalizacao:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
