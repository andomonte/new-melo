// src/lib/entradas/impressaoEntrada.ts
// Dados e HTML para impressão da Entrada + Romaneio (por armazém, com LOCAÇÃO).
// Porte do Delphi Print_Entrada/Print_Romaneio (mesma lógica do robô de separação).
import type { Pool } from 'pg';

export interface ItemEntrada {
  codprod: string;
  ref: string;
  reffabrica: string;
  descmarca: string;
  descr: string;
  quantant: number;
  quant: number;
  prunit: number;
}
export interface RomaneioArmazem {
  arm_id: number;
  arm_descricao: string;
  itens: { codprod: string; qtd: number; locacao: string }[];
}
export interface DadosImpressaoEntrada {
  empresa: { nome: string; municipio: string };
  entrada: {
    codent: string;
    nmcredor: string;
    nmtransp: string;
    dtent: string | null;
    nroform: string;
    totalprod: number;
    obs: string;
    status: string;
  };
  itens: ItemEntrada[];
  romaneio: RomaneioArmazem[];
}

const SQL_ITENS = `
  SELECT i.codprod, i.quant, i.quantant, i.prunit,
         COALESCE(p.ref,'') AS ref, COALESCE(p.descr,'') AS descr,
         COALESCE(m.descr,'') AS descmarca,
         (SELECT rf.referencia
            FROM dbprod_ref_fabrica prf
            JOIN dbref_fabrica rf ON rf.cod_id = prf.cod_id
           WHERE prf.codprod = i.codprod
           ORDER BY (rf.codcredor::text = $1) DESC, rf.cod_id
           LIMIT 1) AS reffabrica
  FROM dbitent i
  LEFT JOIN dbprod p ON i.codprod = p.codprod
  LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
  WHERE i.codent = $2
  ORDER BY i.codprod`;

const SQL_ROMANEIO = `
  SELECT da.codprod, da.arm_id, ca.arm_descricao, SUM(da.qtd) AS qtd,
         COALESCE(NULLIF(MAX(loc.apl_descricao), ''), MAX(da.localizacao), '') AS locacao
  FROM dbitent_armazem da
  JOIN cad_armazem ca ON ca.arm_id = da.arm_id
  LEFT JOIN cad_armazem_produto_locacao loc
    ON loc.apl_arm_id = da.arm_id AND loc.apl_codprod = da.codprod
  WHERE da.codent = $1
  GROUP BY da.codprod, da.arm_id, ca.arm_descricao`;

export async function getDadosImpressaoEntrada(
  pool: Pool,
  codent: string,
): Promise<DadosImpressaoEntrada | null> {
  const entRes = await pool.query(
    `SELECT e.codent, e.cod_credor, e.codtransp, e.dtent, e.nroform, e.totalprod, e.obs, e.status,
            COALESCE(cr.nome,'') AS nmcredor, COALESCE(tr.nome,'') AS nmtransp
     FROM dbent e
     LEFT JOIN dbcredor cr ON cr.cod_credor = e.cod_credor
     LEFT JOIN dbtransp tr ON tr.codtransp = e.codtransp
     WHERE e.codent = $1`,
    [codent],
  );
  if (entRes.rows.length === 0) return null;
  const e = entRes.rows[0];

  const empRes = await pool.query(
    `SELECT COALESCE(nomecontribuinte,'') AS nome, COALESCE(municipio,'') AS municipio FROM dadosempresa LIMIT 1`,
  );
  const empresa = empRes.rows[0] || { nome: '', municipio: '' };

  let itens: ItemEntrada[] = [];
  try {
    const r = await pool.query(SQL_ITENS, [String(e.cod_credor || ''), codent]);
    itens = r.rows.map(mapItem);
  } catch {
    // Sem tabela de ref. de fábrica: segue sem a coluna REF. NF
    const sqlSemRef = SQL_ITENS.replace(/\(SELECT rf\.referencia[\s\S]*?LIMIT 1\)/, `NULL`);
    const r = await pool.query(sqlSemRef, [String(e.cod_credor || ''), codent]);
    itens = r.rows.map(mapItem);
  }

  const romRes = await pool.query(SQL_ROMANEIO, [codent]);
  const porArm = new Map<number, RomaneioArmazem>();
  for (const row of romRes.rows) {
    const armId = Number(row.arm_id);
    if (!porArm.has(armId)) {
      porArm.set(armId, { arm_id: armId, arm_descricao: row.arm_descricao || '', itens: [] });
    }
    porArm.get(armId)!.itens.push({
      codprod: row.codprod,
      qtd: Number(row.qtd) || 0,
      locacao: row.locacao || '',
    });
  }
  const romaneio = Array.from(porArm.values()).sort((a, b) =>
    b.arm_descricao.localeCompare(a.arm_descricao),
  );

  return {
    empresa,
    entrada: {
      codent: e.codent,
      nmcredor: e.nmcredor,
      nmtransp: e.nmtransp,
      dtent: e.dtent,
      nroform: e.nroform || '',
      totalprod: Number(e.totalprod) || 0,
      obs: e.obs || '',
      status: e.status || '',
    },
    itens,
    romaneio,
  };
}

function mapItem(r: any): ItemEntrada {
  return {
    codprod: r.codprod,
    ref: r.ref || '',
    reffabrica: r.reffabrica || '',
    descmarca: r.descmarca || '',
    descr: r.descr || '',
    quantant: Number(r.quantant) || 0,
    quant: Number(r.quant) || 0,
    prunit: Number(r.prunit) || 0,
  };
}

// ---------- HTML ----------
const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fmtData = (d: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('pt-BR');
};
const fmtNum = (n: number, dec = 2) =>
  Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtQtd = (n: number) => fmtNum(n, 0);

export function gerarHtmlImpressaoEntrada(
  d: DadosImpressaoEntrada,
  opts: { entrada?: boolean; romaneio?: boolean } = { entrada: true, romaneio: true },
): string {
  const geradoEm = new Date().toLocaleString('pt-BR');
  const secoes: string[] = [];

  if (opts.entrada) {
    const linhasItens = d.itens
      .map(
        (it) => `
        <tr>
          <td class="mono">${esc(it.ref)}</td>
          <td class="mono">${esc(it.reffabrica)}</td>
          <td>${esc(it.descmarca)}</td>
          <td>${esc(it.descr)}</td>
          <td class="num">${fmtQtd(it.quantant)}</td>
          <td class="num">${fmtQtd(it.quant)}</td>
          <td class="num">${fmtNum(it.prunit)}</td>
        </tr>`,
      )
      .join('');
    secoes.push(`
      <section class="doc">
        <h2>ENTRADA DE PRODUTOS PARA LOCAÇÃO</h2>
        <div class="cab">
          <div><b>No. Entrada:</b> ${esc(d.entrada.codent)}</div>
          <div><b>Data Entrada:</b> ${fmtData(d.entrada.dtent)}</div>
          <div><b>Nota Fiscal:</b> ${esc(d.entrada.nroform)}</div>
          <div class="w2"><b>Fornecedor:</b> ${esc(d.entrada.nmcredor)}</div>
          <div class="w2"><b>Transportadora:</b> ${esc(d.entrada.nmtransp) || '—'}</div>
          <div><b>Situação:</b> ${d.entrada.status === 'A' ? 'ABERTA — CONFIRMAR' : 'CONFIRMADA'}</div>
        </div>
        <table>
          <thead><tr>
            <th>Referência</th><th>Ref. NF</th><th>Marca</th><th>Descrição</th>
            <th class="num">Est.At</th><th class="num">Quant</th><th class="num">Pr.Unit</th>
          </tr></thead>
          <tbody>${linhasItens || '<tr><td colspan="7" class="vazio">Sem itens.</td></tr>'}</tbody>
        </table>
        <div class="total"><b>TOTAL ENTRADA:</b> ${fmtNum(d.entrada.totalprod)}</div>
        ${d.entrada.obs ? `<div class="obs"><b>OBS:</b> ${esc(d.entrada.obs)}</div>` : ''}
        <div class="assin">
          <div>CONFERENTE: ___/___/____  ____:____  ____________________</div>
          <div>LOCADOR: ___/___/____  ____:____  ____________________</div>
          <div>COMPRADOR: ___/___/____  ____:____  ____________________</div>
        </div>
      </section>`);
  }

  if (opts.romaneio) {
    for (const arm of d.romaneio) {
      const mapQtd = new Map(arm.itens.map((i) => [i.codprod, i]));
      const linhas = d.itens
        .map((it) => {
          const r = mapQtd.get(it.codprod);
          return `
          <tr>
            <td class="mono">${esc(it.ref)}</td>
            <td class="mono">${esc(it.reffabrica)}</td>
            <td>${esc(it.descmarca)}</td>
            <td>${esc(it.descr)}</td>
            <td class="num">${fmtQtd(it.quantant)}</td>
            <td class="num">${r ? fmtQtd(r.qtd) : '0'}</td>
            <td class="mono loc">${esc(r?.locacao || '')}</td>
          </tr>`;
        })
        .join('');
      secoes.push(`
        <section class="doc quebra">
          <h2>ROMANEIO DE ENTRADA PARA LOCAÇÃO — ARMAZÉM: ${esc(arm.arm_descricao)}</h2>
          <div class="cab">
            <div><b>No. Entrada:</b> ${esc(d.entrada.codent)}</div>
            <div><b>Data Entrada:</b> ${fmtData(d.entrada.dtent)}</div>
            <div><b>Nota Fiscal:</b> ${esc(d.entrada.nroform)}</div>
            <div class="w2"><b>Fornecedor:</b> ${esc(d.entrada.nmcredor)}</div>
          </div>
          <table>
            <thead><tr>
              <th>Referência</th><th>Ref. NF</th><th>Marca</th><th>Descrição</th>
              <th class="num">Est.At</th><th class="num">Quantidade</th><th>Locação</th>
            </tr></thead>
            <tbody>${linhas || '<tr><td colspan="7" class="vazio">Sem itens.</td></tr>'}</tbody>
          </table>
          <div class="assin">
            <div>CONFERENTE: ___/___/____  ____:____  ____________________</div>
            <div>LOCADOR: ___/___/____  ____:____  ____________________</div>
          </div>
        </section>`);
    }
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>Entrada ${esc(d.entrada.codent)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; margin: 0; }
    .doc { padding: 6px 4px 14px; }
    .quebra { page-break-before: always; }
    .empresa { font-size: 11px; font-weight: bold; border-bottom: 2px solid #111; padding-bottom: 3px; margin-bottom: 4px; display:flex; justify-content:space-between; }
    h2 { font-size: 11px; margin: 2px 0 6px; }
    .cab { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 12px; margin-bottom: 6px; }
    .cab .w2 { grid-column: span 2; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 2px 4px; text-align: left; vertical-align: top; }
    th { background: #eee; font-size: 9px; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.mono { font-family: 'Courier New', monospace; }
    td.loc { font-weight: bold; }
    .total { text-align: right; margin-top: 4px; font-size: 11px; }
    .obs { margin-top: 4px; }
    .assin { margin-top: 16px; display: grid; gap: 10px; font-family: 'Courier New', monospace; }
    .vazio { text-align: center; color: #777; }
    @media print { .quebra { page-break-before: always; } }
  </style></head><body>
  <div class="empresa"><span>${esc(d.empresa.nome)}</span><span>Gerado em ${esc(geradoEm)}</span></div>
  ${secoes.join('\n')}
  </body></html>`;
}
