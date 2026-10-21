import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';

/**
 * Espelho da Fatura (read-only) — equivalente ao "CONSULTAR FATURA UNIFICADO - ZOOM"
 * do Delphi. Agrega, numa chamada:
 *  - cabeçalho da fatura (dbfatura) + cliente/vendedor/transportadora
 *  - valores (base/valor ICMS, subst., produtos, IPI, frete, desconto, acréscimo, total NF)
 *  - status da NF-e (dbfat_nfe: chave, status, protocolo, cancelamento, ...)
 *  - itens da fatura (dbprodfat)
 *  - vendas faturadas (via fatura_venda → dbvenda) — join CORRETO
 *  - cobrança / parcelas (dbreceb por cod_fat)
 */
const n = (v: any) => (v == null ? 0 : Number(v));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const codfat = String(req.query.codfat || '').trim();
  if (!codfat) return res.status(400).json({ error: 'Código da fatura é obrigatório.' });

  const pool = await getPgPoolFilial(req);
  const client = await pool.connect();
  try {
    // 1) Cabeçalho + cliente/vendedor/transportadora
    const fRes = await client.query(
      `SELECT f.*,
              vd.nome AS nome_vendedor,
              tr.nome AS nome_transp,
              cli.nome AS nome_cliente, cli.uf AS cli_uf, cli.cpfcgc AS cli_doc,
              cli.cidade AS cli_cidade, cli.tipocliente AS cli_tipo, cli.iest AS cli_iest
         FROM dbfatura f
         LEFT JOIN dbvend vd ON vd.codvend = f.codvend
         LEFT JOIN dbtransp tr ON tr.codtransp = f.codtransp
         LEFT JOIN dbclien cli ON cli.codcli = f.codcli
        WHERE f.codfat = $1
        LIMIT 1`,
      [codfat],
    );
    if (fRes.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada.' });
    const f = fRes.rows[0];

    // 2) NF-e (a mais recente da fatura)
    const nfeRes = await client.query(
      `SELECT chave, status, modelo, motivo, data AS data_envio, dthrprotocolo, numprotocolo,
              numrecebimento, dthrcancelamento, motivocancelamento, numcancelamento,
              situacaovenda, usuariocancelamento, emailenviado
         FROM dbfat_nfe
        WHERE codfat = $1
        ORDER BY data DESC NULLS LAST
        LIMIT 1`,
      [codfat],
    );
    const nfe = nfeRes.rows[0] || null;

    // 3) Itens da fatura (dbprodfat)
    const itRes = await client.query(
      `SELECT pf.codprod, pf.ref, COALESCE(pf.descr, pr.descr) AS descr,
              pf.qtde::numeric AS qtd, pf.prunit::numeric, pf.desconto::numeric,
              pf.totalproduto::numeric AS total, pf.cfop, pf.ncm, mk.descr AS marca
         FROM dbprodfat pf
         LEFT JOIN dbprod pr ON pr.codprod = pf.codprod
         LEFT JOIN dbmarcas mk ON mk.codmarca = pr.codmarca
        WHERE pf.codfat = $1
        ORDER BY pf.ref`,
      [codfat],
    );

    // 4) Vendas faturadas (join CORRETO via fatura_venda)
    const vRes = await client.query(
      `SELECT dv.codvenda, dv.nrovenda, dv.data, dv.status, dv.total::numeric AS total,
              dv.pedido, dv.codvend, vd.nome AS nome_vendedor, fv.valor_venda::numeric AS valor_venda
         FROM fatura_venda fv
         JOIN dbvenda dv ON dv.codvenda = fv.codvenda
         LEFT JOIN dbvend vd ON vd.codvend = dv.codvend
        WHERE fv.codfat = $1 AND COALESCE(fv.status,'ativo') = 'ativo'
        ORDER BY dv.nrovenda`,
      [codfat],
    );

    // 5) Cobrança / parcelas (dbreceb)
    const cRes = await client.query(
      `SELECT cod_receb, nro_doc, dt_emissao, dt_venc, valor_pgto::numeric AS valor,
              rec, cancel, banco, tipo
         FROM dbreceb
        WHERE cod_fat = $1
        ORDER BY dt_venc, nro_doc`,
      [codfat],
    );

    return res.status(200).json({
      fatura: {
        codfat: f.codfat,
        documento: f.codfat,
        formulario: f.nroform,
        serie: f.serie,
        data: f.data,
        tipofat: f.tipofat,
        tiponf: f.tiponf,
        frmfat: f.frmfat,
        pedido: f.pedido,
        cfop1: f.cfop1,
        cfop2: f.cfop2,
        descrcfop: f.descrcfop,
        obs: f.info_compl || f.obsdesconto || '',
        cancel: f.cancel,
        agrupada: f.agp === 'S' || (f.codgp != null && String(f.codgp).trim() !== '') ? 'S' : 'N',
        codgp: f.codgp,
        insc07: f.insc07,
        cobranca: f.cobranca,
        banco: f.cod_banco,
        foi_banco: f.cod_banco != null && String(f.cod_banco).trim() !== '' ? 'S' : 'N',
        importado: f.import,
        denegada: f.denegada,
        estorno: f.estorno,
        importacao_id: f.importacao_id,
        cliente: { codcli: f.codcli, nome: f.nome_cliente, uf: f.cli_uf, doc: f.cli_doc, cidade: f.cli_cidade, tipo: f.cli_tipo, iest: f.cli_iest },
        vendedor: { cod: f.codvend, nome: f.nome_vendedor },
        transportadora: { cod: f.codtransp, nome: f.nome_transp },
      },
      valores: {
        baseicms: n(f.baseicms),
        valor_icms: n(f.valor_icms),
        baseicms_subst: n(f.baseicms_subst),
        valoricms_subst: n(f.valoricms_subst),
        totalprod: n(f.totalprod),
        totalfat: n(f.totalfat),
        frete: n(f.totalfrete),
        desconto: n(f.desconto),
        acrescimo: n(f.acrescimo),
        totalipi: n(f.totalipi),
        totalnf: n(f.totalnf),
      },
      nfe: nfe
        ? {
            chave: nfe.chave,
            status: nfe.status,
            modelo: nfe.modelo,
            motivo: nfe.motivo,
            data_envio: nfe.data_envio,
            dthrprotocolo: nfe.dthrprotocolo,
            numprotocolo: nfe.numprotocolo,
            dthrcancelamento: nfe.dthrcancelamento,
            motivocancelamento: nfe.motivocancelamento,
            numcancelamento: nfe.numcancelamento,
            situacaovenda: nfe.situacaovenda,
            usuariocancelamento: nfe.usuariocancelamento,
          }
        : null,
      itens: itRes.rows.map((r) => ({
        ref: r.ref,
        codprod: r.codprod,
        descr: r.descr,
        marca: r.marca,
        qtd: n(r.qtd),
        prunit: n(r.prunit),
        desconto: n(r.desconto),
        total: n(r.total),
        cfop: r.cfop,
        ncm: r.ncm,
      })),
      vendas: vRes.rows.map((r) => ({
        codvenda: r.codvenda,
        nrovenda: r.nrovenda,
        data: r.data,
        status: r.status,
        total: n(r.total),
        pedido: r.pedido,
        vendedor: r.nome_vendedor || r.codvend,
        valor_venda: n(r.valor_venda),
      })),
      cobranca: cRes.rows.map((r) => ({
        cod_receb: r.cod_receb,
        nro_doc: r.nro_doc,
        dt_emissao: r.dt_emissao,
        dt_venc: r.dt_venc,
        valor: n(r.valor),
        rec: r.rec,
        cancel: r.cancel,
        banco: r.banco,
        tipo: r.tipo,
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar espelho da fatura:', error);
    return res.status(500).json({ error: 'Erro ao buscar espelho da fatura.', detalhe: error.message });
  } finally {
    client.release();
  }
}
