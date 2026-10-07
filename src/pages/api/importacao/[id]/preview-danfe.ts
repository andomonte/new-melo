/**
 * POST /api/importacao/[id]/preview-danfe
 *
 * Prévia do DANFE (PDF) da nota de nacionalização — "SEM VALOR FISCAL".
 * Reusa a construção compartilhada (`construirNotasNacionalizacao`) + o DANFE
 * fiel ao MELO (`gerarDanfeHtmlNFe` → `renderHtmlToPdf`). NÃO numera nem transmite.
 *
 * Body: { grupos?: Array<Array<number|string>>, notaIndex?: number }
 * Resposta: application/pdf (a nota do índice informado; default 0).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';
import { construirNotasNacionalizacao } from '@/lib/compras/construirNotasNacionalizacao';
import { gerarDanfeHtmlNFe } from '@/lib/danfe/gerarDanfeHtml';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';

const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const importacaoId = parseInt(String(req.query.id), 10);
  if (!importacaoId) return res.status(400).json({ message: 'ID de importação inválido' });

  const grupos = Array.isArray(req.body?.grupos)
    ? (req.body.grupos as Array<Array<number | string>>)
    : undefined;
  const notaIndex = Number(req.body?.notaIndex) || 0;

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const r = await construirNotasNacionalizacao(client, importacaoId, grupos);
    if (!r.ok) return res.status(r.status).json({ message: r.message });

    const { emp, di, notas } = r.data;
    if (notas.length === 0) return res.status(422).json({ message: 'Sem itens para gerar a nota.' });
    const nota = notas[Math.min(Math.max(notaIndex, 0), notas.length - 1)];

    // Totais da nota
    const totalProd = r2(nota.itensNfe.reduce((s, it) => s + r2(it.vUnit * it.qtd), 0));
    const totalNota = r2(totalProd + nota.vOutro);

    // Shapes do DANFE (destinatário = exportador EXTERIOR)
    const fatura = {
      natureza: 'COMPRA PARA COMERCIALIZACAO',
      nroform: '0',
      serie: '1',
      cfop2: '3102',
      // destinatário exterior
      nomefant: nota.dest.nome || 'EXTERIOR',
      cpfcgc: '',
      ender: nota.dest.xLgr || 'EXTERIOR',
      numero: nota.dest.nro || '',
      bairro: nota.dest.xBairro || 'EXTERIOR',
      cep: nota.dest.cep || '99999999',
      cidade: 'EXTERIOR',
      uf: 'EX',
      iest: 'ISENTO',
      fone: '',
      // totais
      totalprod: totalProd,
      baseicms: 0,
      valor_icms: 0,
      baseicms_subst: 0,
      valor_icms_st: 0,
      valor_ipi: 0,
      vlrfrete: 0,
      vlrseg: 0,
      desconto: 0,
      vlrdesp: nota.vOutro,
      totalnf: totalNota,
      destfrete: 10, // base 1 → modFrete 9 (sem ocorrência)
      dupTexto: 'A VISTA',
      nomevendedor: '',
      aliquota_ibs: 0.1,
      aliquota_cbs: 0.9,
    };

    const produtos = nota.itensNfe.map((it) => ({
      codprod: it.codprod,
      descr: it.descricao,
      ref: it.ref,
      ncm: it.ncm,
      origem: '1',
      cst: '60',
      cfop: it.cfop,
      unimed: it.unidade,
      qtd: it.qtd,
      prunit: it.vUnit,
      total_item: r2(it.vUnit * it.qtd),
      baseicms: 0,
      totalicms: 0,
      totalipi: 0,
      aliquota_icms: 0,
      aliquota_ipi: 0,
      aliquota_ibs: 0.1,
      aliquota_cbs: 0.9,
    }));

    const venda = { nrovenda: '', obs: `NACIONALIZACAO DI ${di.nro_di} | PEDIDOS ${nota.pedidos.join(',')}`, transp: '' };
    const dadosNFe = { numeroNFe: '0', serieNFe: '1', chaveAcesso: '', protocolo: 'SEM VALIDADE', dataEmissao: '' };

    const html = gerarDanfeHtmlNFe(fatura, produtos, venda, emp, dadosNFe, {
      marcaDagua: 'SEM VALOR FISCAL',
      entrada: true,
    });
    const pdf = await renderHtmlToPdf(html, { landscape: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="previa-nacionalizacao-${di.nro_di}.pdf"`);
    return res.status(200).send(pdf);
  } catch (e: any) {
    console.error('[preview-danfe] erro:', e);
    return res.status(500).json({ message: 'Erro ao gerar prévia do DANFE', detail: e.message });
  } finally {
    if (client) client.release();
  }
}
