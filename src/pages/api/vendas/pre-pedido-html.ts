import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/vendas/pre-pedido-html?codvenda=XXX
 * Retorna HTML do pré-pedido para impressão matricial (mesmo layout do Delphi)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const codvenda = String(req.query.codvenda || '').trim();
  if (!codvenda) return res.status(400).json({ error: 'codvenda é obrigatório' });

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Dados da empresa
    const emp = await client.query('SELECT nomecontribuinte, cgc FROM dadosempresa LIMIT 1');
    const empresa = emp.rows[0] || { nomecontribuinte: 'MELO DISTRIBUIDORA DE PECAS LTDA', cgc: '' };

    // Dados da venda
    const venda = await client.query(
      `SELECT v.codvenda, v.data, v.total, v.codcli, v.codusr, v.codvend, v.prazo, v.obs, v.obsfat,
              v.transp, v.vlrfrete, v.pedido, v.localentregacliente,
              u.nome as vendedor_nome, u2.nome as operador_nome
       FROM dbvenda v
       LEFT JOIN dbvend u ON ltrim(v.codvend::text,'0') = ltrim(u.codvend::text,'0')
       LEFT JOIN dbvend u2 ON ltrim(v.codusr::text,'0') = ltrim(u2.codvend::text,'0')
       WHERE v.codvenda = $1`, [codvenda]);

    if (venda.rows.length === 0) return res.status(404).json({ error: 'Venda não encontrada' });
    const v = venda.rows[0];

    // Dados do cliente
    const cli = await client.query(
      `SELECT codcli, nome, nomefant, cpfcgc, ender, bairro, cidade, uf, cep, iest, obs
       FROM dbclien WHERE codcli = $1`, [v.codcli]);
    const c = cli.rows[0] || {};

    // Itens da venda com localização
    const itens = await client.query(
      `SELECT i.codprod, i.qtd, i.prunit, i.ref, i.descr, i.arm_id,
              p.unimed, p.codmarca, p.local as locacao,
              m.descr as marca_nome
       FROM dbitvenda i
       LEFT JOIN dbprod p ON i.codprod = p.codprod
       LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
       WHERE i.codvenda = $1
       ORDER BY i.codprod`, [codvenda]);

    // Armazém
    const armResult = await client.query(
      `SELECT arm_descricao FROM cad_armazem WHERE arm_id = $1`,
      [itens.rows[0]?.arm_id || 1]);
    const armazem = armResult.rows[0]?.arm_descricao || 'GERAL';

    // Formatar data
    const dataStr = String(v.data || '').substring(0, 10);
    const dataParts = dataStr.split('-');
    const dataFormatada = dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : dataStr;
    const now = new Date();
    const horaVenda = String(v.data || '').substring(11, 19) || '00:00:00';
    const horaImpressao = now.toTimeString().substring(0, 8);
    const dataImpressao = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

    // Calcular totais
    const totalItens = itens.rows.length;
    const totalValor = itens.rows.reduce((acc: number, it: any) => acc + Number(it.qtd) * Number(it.prunit), 0);

    // Montar linhas dos itens
    const linhasItens = itens.rows.map((it: any) => {
      const loc = (it.locacao || '').substring(0, 30);
      const un = (it.unimed || 'PC').substring(0, 2);
      const qtd = String(Number(it.qtd)).padStart(4, ' ');
      const ref = (it.ref || it.codprod || '').substring(0, 14);
      const descr = (it.descr || '').substring(0, 42);
      const marca = (it.marca_nome || '').substring(0, 10);
      const prunit = Number(it.prunit).toFixed(2).padStart(9, ' ');
      const total = (Number(it.qtd) * Number(it.prunit)).toFixed(2).padStart(10, ' ');
      return { loc, un, qtd, ref, descr, marca, prunit, total };
    });

    // Gerar HTML que simula impressão matricial
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PRE-PEDIDO ${codvenda}</title>
  <style>
    @media print {
      @page { margin: 5mm 10mm; size: auto; }
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 15px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { margin-bottom: 2px; }
    .sep { color: #999; letter-spacing: 1px; white-space: nowrap; }
    .line { white-space: pre; overflow: visible; }
    .items-header { font-weight: bold; }
    .total-line { font-weight: bold; }
    .footer { margin-top: 10px; }
    .signatures { margin-top: 40px; }
    .btn-print {
      position: fixed; top: 10px; right: 10px; z-index: 100;
      padding: 8px 20px; background: #347AB6; color: #fff; border: none;
      border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;
    }
    .btn-print:hover { background: #2563eb; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir</button>

  <div class="header">
    <div class="line">${pad(empresa.nomecontribuinte, 40)} *** SEM VALOR FISCAL ***</div>
    <div class="line">PRE-PEDIDO: ${codvenda}         EMISSAO: ${dataFormatada}          HORA:    ${horaVenda}</div>
    <div class="line">DATA:       ${dataFormatada}          USUARIO: ${pad(v.operador_nome || v.codusr || '', 20)} ARMAZEM: ${armazem}</div>
    <div class="line">ESTE FORMULARIO FOI IMPRESSO AS ${horaImpressao} DE ${dataImpressao}</div>
  </div>

  <div class="sep">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

  <div>
    <div class="line">CLIENTE:     ${pad(c.codcli || '', 5)} - ${pad(c.nome || '', 40)}  NOME FANT.: ${c.nomefant || ''}</div>
    <div class="line">ENDERECO:    ${pad(c.ender || '', 50)}</div>
    <div class="line">CIDADE:      ${pad(c.cidade || '', 20)}                        BAIRRO:     ${c.bairro || ''}</div>
    <div class="line">                                                           UF:         ${c.uf || ''} - CEP: ${c.cep || ''}</div>
    <div class="line">COMPLEMENTO:</div>
    <div class="line">C.N.P.J.:    ${pad(c.cpfcgc || '', 40)}                     INSC. EST:  ${c.iest || ''}</div>
    <div class="line">OBS. Cliente: ${c.obs || ''}</div>
    <div class="line">VEND. RESP.: ${v.codvend || ''} - ${v.vendedor_nome || ''}             O.C.:       ${v.pedido || ''}</div>
    <div class="line">VEND. TEL.:</div>
  </div>

  <div class="sep">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

  <div class="items-header">
    <div class="line">${pad('LOCACAO', 32)}UN ${pad('QTD', 4)} ${pad('REFERENCIA', 14)} ${pad('DESCRICAO', 43)} ${pad('MARCA', 10)}${pad('PC UNIT', 9)}${pad('TOTAL', 10)}</div>
  </div>

  <div class="sep">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

  <div>
${linhasItens.map(it =>
  `    <div class="line">${pad(it.loc, 32)}${it.un} ${it.qtd} ${pad(it.ref, 14)} ${pad(it.descr, 43)} ${pad(it.marca, 10)}${it.prunit} ${it.total}</div>`
).join('\n')}
  </div>

  <div class="sep">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

  <div class="total-line">
    <div class="line">                                                                     TOTAL ITENS:  ${String(totalItens).padStart(3, ' ')}       TOTAL :   ${totalValor.toFixed(2).padStart(10, ' ')}</div>
  </div>

  <div class="sep">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

  <div class="footer">
    <div class="line">OPERADOR:   ${v.codusr || ''} - ${v.operador_nome || ''}</div>
    <div class="line">VEND. TEL.:</div>
    <div class="line">OBS. FINANCEIRA: ${v.obsfat || ''}</div>
    <div class="line"></div>
    <div class="line">OBSERVACAO: ${v.obs || ''}</div>
    <div class="line">PRAZO:      ${v.prazo || ''}</div>
    <div class="line">TRANSPORTE: ${v.transp || 'CLIENTE RETIRA'}          TAXA ENTREGA: R$ ${Number(v.vlrfrete || 0).toFixed(2)}</div>
  </div>

  <div class="signatures">
    <div class="line">QUANTIDADE DE ITEM(NS): ${totalItens}</div>
    <div class="line" style="height:40px"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="line">SEPARADOR: ___/___/___   ___:___   ________________________________________</span>
      <span style="display:flex;flex-direction:column;align-items:center">
        <span class="line">________________________________________</span>
        <span class="line">ACEITE DO CLIENTE</span>
      </span>
    </div>
    <div class="line" style="height:40px"></div>
    <div class="line">CONFERENTE: ___/___/___  ___:___   ________________________________________</div>
    <div class="line" style="height:40px"></div>
    <div class="line">MOTORISTA:  ___/___/___  ___:___   ________________________________________</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error: any) {
    console.error('Erro ao gerar pré-pedido:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

function pad(str: string, len: number): string {
  return (str || '').substring(0, len).padEnd(len, ' ');
}
