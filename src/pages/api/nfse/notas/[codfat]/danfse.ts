import type { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';
import { getPgPool } from '@/lib/pg';
import { certificadoAdn } from '@/lib/nfse/adn/certificado';
import { cnpjPadraoAdn } from '@/lib/nfse/adn/distribuicao';

/**
 * Impressão da nota de serviço.
 *   Nota nacional (chave de 50 dígitos): tenta a DANFSe OFICIAL no ADN (GET /danfse/{chave}, PDF).
 *   Se não houver chave, ou o serviço oficial falhar (ex.: 503), devolve uma página própria para
 *   imprimir com os mesmos blocos (prestador, tomador, discriminação, valores, retenções, chave).
 *   ?proprio=1 força a página própria.
 */
const pool = getPgPool();

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const moeda = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (s?: string | null) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '-'; };
const doc = (s?: string | null) => {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return s || '-';
};

function baixarOficial(agent: https.Agent, host: string, chave: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const req = https.request({ host, path: `/danfse/${chave}`, method: 'GET', agent, timeout: 30000, headers: { Accept: 'application/pdf' } }, (res) => {
      const b: Buffer[] = [];
      res.on('data', (c) => b.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(b);
        const pdf = res.statusCode === 200 && buf.slice(0, 4).toString() === '%PDF';
        resolve(pdf ? buf : null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const codfat = String(req.query.codfat || '').trim();
  try {
    const n = (await pool.query(
      `SELECT n.*, n.dtemissao::text AS dtemissao, c.nome AS nome_cliente, c.cpfcgc, c.ender, c.numero AS cli_numero, c.bairro AS cli_bairro,
              c.cidade AS cli_cidade, c.uf AS cli_uf, c.cep AS cli_cep, c.email AS cli_email
         FROM nfs_nota n LEFT JOIN dbclien c ON c.codcli = n.codcli WHERE n.codfat = $1`, [codfat])).rows[0];
    if (!n) return res.status(404).send('Nota não encontrada.');
    const chave = String(n.chave_acesso || '').replace(/\D/g, '');

    if (chave.length === 50 && !req.query.proprio) {
      try {
        const cert0 = process.env.NFSE_TESTE_PFX ? await certificadoAdn(pool, '') : null;
        const cnpj = await cnpjPadraoAdn(pool, cert0?.cnpjCertificado);
        const cert = cert0 || await certificadoAdn(pool, cnpj);
        const host = n.ambiente_nfse === 'RESTRITA' ? 'adn.producaorestrita.nfse.gov.br' : 'adn.nfse.gov.br';
        const pdf = await baixarOficial(cert.agent, host, chave);
        if (pdf) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="DANFSe-${n.nroform || codfat}.pdf"`);
          return res.status(200).send(pdf);
        }
      } catch { /* cai na página própria */ }
    }

    const serv = (await pool.query(
      `SELECT s.descr, sv.sen_codigo, sv.sen_atividade, sv.sen_ctribnac, sv.sen_ctribmun FROM nfs_nota_servico s
         LEFT JOIN dbservico_nfs sv ON sv.sen_id = s.sen_id WHERE s.codfat = $1 ORDER BY s.id`, [codfat])).rows;
    const emp = (await pool.query(
      `SELECT cgc, nomecontribuinte, inscricaomunicipal, logradouro, numero, bairro, municipio, uf, cep, telefone, email
         FROM dadosempresa WHERE "certificadoKey" IS NOT NULL ORDER BY cgc LIMIT 1`)).rows[0] || {};
    const retido = n.issqn_retido === 'S';
    const fed = Number(n.pis_valor) + Number(n.cofins_valor) + Number(n.csll_valor) + Number(n.ir_valor) + Number(n.inss_valor) + Number(n.outros_valor);
    const totalRet = (retido ? Number(n.issqn_valor) : 0) + fed;
    // DPS: Id = "DPS" + cMun(7) + tipo(1) + inscrição(14) + série(5) + nº(15)
    const dps = /^DPS\d{42}$/.test(String(n.dps_id || '')) ? { serie: String(Number(n.dps_id.slice(25, 30))), numero: String(Number(n.dps_id.slice(30))) } : null;
    const ctn = String(serv[0]?.sen_ctribnac || '');
    const codNac = ctn.length === 6 ? `${ctn.slice(0, 2)}.${ctn.slice(2, 4)}.${ctn.slice(4)}` : '';
    const pFed = Number(String(process.env.NFSE_PTOTTRIB_FED ?? '13.45').replace(',', '.')) || 0;
    const consulta = chave.length === 50 ? `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}` : '';
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>NFS-e ${esc(n.nroform || codfat)}</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:16px}
 .doc{max-width:800px;margin:auto;border:1px solid #333}
 .sec{border-top:1px solid #333;padding:6px 8px}.sec:first-child{border-top:0}
 h1{font-size:15px;margin:0}h2{font-size:11px;margin:0 0 4px;text-transform:uppercase;background:#eee;padding:2px 4px}
 .g{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 10px}.l{color:#555;font-size:9px}.v{font-weight:bold}
 table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:3px 4px;text-align:right}th{background:#f3f3f3;font-size:9px}
 .aviso{color:#a00;font-weight:bold}.mono{font-family:monospace;word-break:break-all}
 @media print{button{display:none}body{margin:0}}
</style></head><body>
<button onclick="window.print()" style="margin-bottom:8px">Imprimir</button>
<div class="doc">
 <div class="sec"><h1>NOTA FISCAL DE SERVIÇO ELETRÔNICA — NFS-e</h1>
  <div class="g" style="margin-top:6px">
   <div><div class="l">Número</div><div class="v">${esc(n.nroform || '-')}</div></div>
   <div><div class="l">Emissão</div><div class="v">${dataBR(n.dtemissao)}</div></div>
   <div><div class="l">Competência</div><div class="v">${esc(n.competencia || '-')}</div></div>
   <div><div class="l">${chave ? 'Ambiente' : 'Código de verificação'}</div><div class="v">${chave ? (n.ambiente_nfse === 'RESTRITA' ? '<span class="aviso">TESTES — SEM VALOR FISCAL</span>' : 'Produção') : esc(n.verificacao || '-')}</div></div>
  </div>
  ${dps ? `<div class="g" style="margin-top:4px"><div><div class="l">Número da DPS</div><div class="v">${esc(dps.numero)}</div></div><div><div class="l">Série da DPS</div><div class="v">${esc(dps.serie)}</div></div></div>` : ''}
  ${chave ? `<div style="margin-top:4px"><span class="l">Chave de acesso: </span><span class="mono v">${chave}</span></div>` : ''}
  ${n.cancel === 'S' ? '<div class="aviso" style="margin-top:4px">NOTA CANCELADA</div>' : ''}
 </div>
 <div class="sec"><h2>Prestador de serviços</h2>
  <div class="v">${esc(emp.nomecontribuinte || '')}</div>
  <div>CNPJ ${doc(emp.cgc)} · Inscrição municipal ${esc(emp.inscricaomunicipal || '-')}</div>
  <div>${esc([emp.logradouro, emp.numero, emp.bairro].filter(Boolean).join(', '))} · ${esc(emp.municipio || '')}/${esc(emp.uf || '')} · CEP ${esc(emp.cep || '')}</div>
 </div>
 <div class="sec"><h2>Tomador de serviços</h2>
  <div class="v">${esc(n.nome_cliente || n.codcli)}</div>
  <div>CPF/CNPJ ${doc(n.cpfcgc)}</div>
  <div>${esc([n.ender, n.cli_numero, n.cli_bairro].filter(Boolean).join(', '))} · ${esc(n.cli_cidade || '')}/${esc(n.cli_uf || '')} · CEP ${esc(n.cli_cep || '')}</div>
 </div>
 <div class="sec"><h2>Discriminação do serviço</h2>
  <div style="white-space:pre-wrap">${esc(serv.map((s) => s.descr).join('\n'))}</div>
  ${serv[0] ? `<div class="g" style="margin-top:6px">
   <div style="grid-column:span 2"><div class="l">Código de tributação nacional</div><div>${esc(codNac || serv[0].sen_codigo || '-')} - ${esc(serv[0].sen_atividade || '')}</div></div>
   <div><div class="l">Código de tributação municipal</div><div>${esc(serv[0].sen_ctribmun || '-')}</div></div>
   <div><div class="l">Local da prestação</div><div>${esc(emp.municipio || '')}${emp.uf ? ` - ${esc(emp.uf)}` : ''}</div></div>
  </div>` : ''}
 </div>
 <div class="sec"><h2>Valores</h2>
  <table><tr><th>Valor do serviço</th><th>Desconto</th><th>Deduções</th><th>Base de cálculo</th><th>Alíquota ISS</th><th>Valor do ISS</th></tr>
   <tr><td>${moeda(n.valor_servico)}</td><td>${moeda(n.valor_desconto)}</td><td>${moeda(n.valor_deducoes)}</td><td>${moeda(n.issqn_basecalculo)}</td><td>${moeda(n.issqn_aliquota)}%</td><td>${moeda(n.issqn_valor)}${retido ? ' (retido)' : ''}</td></tr></table>
  <table style="margin-top:4px"><tr><th>PIS</th><th>COFINS</th><th>CSLL</th><th>IRRF</th><th>INSS</th><th>Outras</th><th>Total retido</th><th>Valor líquido</th></tr>
   <tr><td>${moeda(n.pis_valor)}</td><td>${moeda(n.cofins_valor)}</td><td>${moeda(n.csll_valor)}</td><td>${moeda(n.ir_valor)}</td><td>${moeda(n.inss_valor)}</td><td>${moeda(n.outros_valor)}</td><td>${moeda(totalRet)}</td><td><b>${moeda(n.totalfat)}</b></td></tr></table>
 </div>
 <div class="sec"><h2>Outras informações</h2>
  ${chave ? `<div>Totais aproximados dos tributos: federais ${moeda(pFed)}% · estaduais 0,00% · municipais ${moeda(n.issqn_aliquota)}%</div>` : ''}
  <div>ISS de responsabilidade do ${retido ? 'tomador (retido)' : 'prestador'}.${n.obs ? ` ${esc(n.obs)}` : ''}</div>
  ${consulta ? `<div>Consulte a autenticidade em <span class="mono">${consulta}</span></div>` : ''}
  ${chave ? '<div class="l" style="margin-top:4px">Representação gerada pelo sistema; a DANFSe oficial estava indisponível no portal no momento da impressão.</div>' : ''}
 </div>
</div></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e: any) {
    console.error('Erro na impressão da NFS-e:', e);
    return res.status(500).send('Erro ao gerar a impressão da nota.');
  }
}
