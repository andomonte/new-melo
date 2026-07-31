import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import ExcelJS from 'exceljs';

/**
 * GET /api/compras/ordens/[id]/exportar-pedido-fornecedor?layout=bosch|sabo|randon|mahle
 *
 * Gera o arquivo de pedido no layout do fornecedor, para subir no sistema dele.
 *  - bosch  → TXT posicional (porte fiel do Delphi uniPedido.pas — linhas de 128 bytes)
 *  - sabo   → TXT delimitado por ';' (CNPJ;Numero do Pedido;Data;Item;Quantidade)
 *  - randon → CSV delimitado por ';' (Codigo;Quantidade;CNPJ;Numero do pedido) — sem cabeçalho
 *  - mahle  → XLSX com o cabeçalho oficial (a Mahle importa .xls no site deles)
 *
 * Referência exportada: referência de fábrica do fornecedor (dbref_fabrica) com
 * fallback para a nossa (dbprod.ref).
 */

const CNPJ_MELO_PADRAO = '04618302000189'; // Melo Manaus (fallback)

const soDigitos = (s: any) => String(s ?? '').replace(/\D/g, '');

// FormatBosch: 'N' = só dígitos, zero à esquerda até n; 'X' = trim + espaços à direita até n.
const fmtBosch = (str: any, n: number, tipo: 'N' | 'X') => {
  if (tipo === 'N') {
    const v = String(str ?? '').replace(/[.,/\-:]/g, '').replace(/\s/g, '');
    return v.length >= n ? v : '0'.repeat(n - v.length) + v;
  }
  const v = String(str ?? '').trim();
  return v.length >= n ? v : v + ' '.repeat(n - v.length);
};
const sp = (n: number) => ' '.repeat(n);
const p2 = (n: number) => String(n).padStart(2, '0');

const ddMMyy = (d: Date) => `${p2(d.getDate())}${p2(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}`;
const ddMMyyHHmmss = (d: Date) =>
  `${p2(d.getDate())}${p2(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
const dataBR = (d?: Date | null) => (d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}` : '');

interface ItemPedido {
  ref: string;
  qtd: number;
  descr: string;
}
interface DadosPedido {
  orcId: string;
  dataOrdem: Date | null;
  previsao: Date | null;
  cnpjFornecedor: string;
  cnpjMelo: string;
  itens: ItemPedido[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id, layout = 'bosch' } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID (orc_id) da ordem é obrigatório' });
  }
  const lay = String(layout).toLowerCase();
  if (!['bosch', 'sabo', 'randon', 'mahle'].includes(lay)) {
    return res.status(400).json({ error: 'Layout inválido. Use bosch|sabo|randon|mahle.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Cabeçalho da ordem + fornecedor
    const head = await client.query(
      `SELECT oc.orc_id, oc.orc_data, oc.orc_req_id, oc.orc_req_versao,
              r.req_previsao_chegada, r.req_cod_credor,
              f.cpf_cgc AS forn_cnpj, f.nome AS forn_nome
         FROM cmp_ordem_compra oc
         JOIN cmp_requisicao r ON oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao
         LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
        WHERE oc.orc_id = $1`,
      [id],
    );
    if (head.rows.length === 0) {
      return res.status(404).json({ error: 'Ordem de compra não encontrada' });
    }
    const h = head.rows[0];

    // CNPJ da Melo (dadosempresa) — fallback para o padrão de Manaus
    let cnpjMelo = CNPJ_MELO_PADRAO;
    try {
      const emp = await client.query(`SELECT * FROM db_manaus.dadosempresa LIMIT 1`);
      const row = emp.rows[0] || {};
      const c = soDigitos(row.cnpj || row.cpf_cgc || row.cgc || row.cpfcgc);
      if (c.length === 14) cnpjMelo = c;
    } catch {
      /* mantém o padrão */
    }

    // Itens: referência de fábrica do fornecedor (fallback dbprod.ref) + quantidade
    const itensRes = await client.query(
      `SELECT
         p.codprod,
         p.descr,
         itr.itr_quantidade AS quant,
         COALESCE(
           (SELECT rf.referencia
              FROM db_manaus.dbprod_ref_fabrica prf
              JOIN db_manaus.dbref_fabrica rf ON rf.cod_id = prf.cod_id
             WHERE prf.codprod = p.codprod
               AND lpad(trim(rf.codcredor), 5, '0') = lpad(trim($3), 5, '0')
             ORDER BY rf.cod_id LIMIT 1),
           p.ref
         ) AS ref_export
       FROM cmp_it_requisicao itr
       JOIN db_manaus.dbprod p ON itr.itr_codprod = p.codprod
      WHERE itr.itr_req_id = $1 AND itr.itr_req_versao = $2
        AND COALESCE(itr.itr_quantidade, 0) > 0
      ORDER BY p.codprod`,
      [h.orc_req_id, h.orc_req_versao, h.req_cod_credor || ''],
    );

    const dados: DadosPedido = {
      orcId: String(h.orc_id),
      dataOrdem: h.orc_data ? new Date(h.orc_data) : null,
      previsao: h.req_previsao_chegada ? new Date(h.req_previsao_chegada) : null,
      cnpjFornecedor: soDigitos(h.forn_cnpj),
      cnpjMelo,
      itens: itensRes.rows.map((it) => ({
        ref: String(it.ref_export || '').trim(),
        qtd: Math.max(0, Math.round(Number(it.quant) || 0)),
        descr: it.descr || '',
      })),
    };

    if (dados.itens.length === 0) {
      return res.status(400).json({ error: 'A ordem não tem itens com quantidade para exportar.' });
    }

    const nomeBase = `pedido-${lay}-${dados.orcId}`;

    // ===================== BOSCH (TXT posicional) =====================
    if (lay === 'bosch') {
      const agora = new Date();
      const prazo = dados.previsao || dados.dataOrdem || agora;
      const linhas: string[] = [];

      // ITP
      linhas.push(
        'ITP2621      ' + ddMMyyHHmmss(agora) +
        fmtBosch(dados.cnpjMelo, 14, 'N') + fmtBosch(dados.cnpjFornecedor, 14, 'N') + sp(75),
      );
      // PC1 — nº do pedido: >10 dígitos usa Copy(6,6); senão zero-pad 6 (como no Delphi)
      const orc = dados.orcId.replace(/\D/g, '');
      const codReqField = orc.length > 10 ? orc.substring(5, 11) : orc.padStart(6, '0');
      linhas.push(
        'PC1' + '01' + fmtBosch(dados.cnpjMelo, 14, 'N') + '  ' + codReqField + sp(20) +
        '02' + ddMMyy(prazo) + fmtBosch(String(dados.itens.length), 5, 'N') + '   ' +
        fmtBosch('', 3, 'X') + sp(27) + '0' + sp(14) + '  ' +
        fmtBosch('', 4, 'X') + fmtBosch('', 4, 'X') + sp(10),
      );
      // PC2 — itens (ref 10 + qtd 5, numéricos zero à esquerda)
      for (const it of dados.itens) {
        linhas.push('PC2' + fmtBosch(it.ref, 10, 'N') + fmtBosch(String(it.qtd), 5, 'N') + sp(110));
      }
      // TE707 — dados de cobrança/endereço da Melo (fixos, como no Delphi)
      linhas.push(
        'TE707' + fmtBosch('RUA TEFE 487 PRACA 14 DE JANEIRO', 40, 'X') + '69020' +
        fmtBosch('MANAUS', 20, 'X') + 'AM' + fmtBosch('100561012', 14, 'X') + sp(42),
      );
      // FTP2 — trailer com o total de linhas (inclui o próprio trailer)
      linhas.push('FTP2     ' + fmtBosch(String(linhas.length + 1), 9, 'N') + sp(110));

      const conteudo = linhas.join('\r\n') + '\r\n';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${nomeBase}.txt`);
      return res.status(200).send(conteudo);
    }

    // ===================== SABO (TXT ; ) =====================
    if (lay === 'sabo') {
      const dataPed = dataBR(dados.dataOrdem);
      const linhas = ['CNPJ;Numero do Pedido;Data do Pedido;Item;Quantidade'];
      for (const it of dados.itens) {
        linhas.push([dados.cnpjMelo, dados.orcId, dataPed, it.ref, it.qtd].join(';'));
      }
      const conteudo = linhas.join('\r\n') + '\r\n';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${nomeBase}.txt`);
      return res.status(200).send(conteudo);
    }

    // ===================== RANDON (CSV ; ) — só dados (sem cabeçalho) =====================
    if (lay === 'randon') {
      const linhas: string[] = [];
      for (const it of dados.itens) {
        // Codigo do material;Quantidade;CNPJ;Numero do pedido
        linhas.push([it.ref, it.qtd, dados.cnpjMelo, dados.orcId].join(';'));
      }
      const conteudo = linhas.join('\r\n') + '\r\n';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${nomeBase}.csv`);
      return res.status(200).send('﻿' + conteudo);
    }

    // ===================== MAHLE (XLSX) =====================
    // A Mahle importa .xls no site; geramos XLSX com o cabeçalho oficial.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Pedido');
    ws.addRow([
      'Canal de Distr (VTWEG) Distribution Channel Canal distribución ',
      'Só Material do mercado (BISMT) Part Number Material',
      'Quantidade (MENGE)    Quantity           Cantidad',
      'Pedido Cliente (BSTKD)    PO Number                         Nº de pedido',
      'Data de entrega (BSTDK)   Delivery Date                          Fecha de entrega',
      'Solicitante (BNAME)  Name              Nombre',
      'Telefone Telephone Teléfono',
      'Item Ped. PO Item Pos. Ped.',
    ]);
    ws.getRow(1).font = { bold: true };
    const dataEntrega = dataBR(dados.previsao || dados.dataOrdem);
    dados.itens.forEach((it, idx) => {
      ws.addRow(['', it.ref, it.qtd, dados.orcId, dataEntrega, '', '', idx + 1]);
    });
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${nomeBase}.xlsx`);
    res.setHeader('Content-Length', buf.byteLength);
    return res.status(200).send(buf);
  } catch (error) {
    console.error('Erro ao exportar pedido do fornecedor:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    });
  } finally {
    if (client) client.release();
  }
}
