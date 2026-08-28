import type { NextApiRequest, NextApiResponse } from 'next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/faturamento/resumo-gp-pdf?codgp=X&via=N
 *
 * Gera o "Resumo GP" (fiel ao Delphi FATURAMENTO_IMPRESSAO.RESUMO_GP): cabeçalho
 * empresa/cliente/vendedor + tabela das faturas do grupo (Data, Tipo, Formulário,
 * Produtos, Impostos, Frete, Total, Prazo). Retorna { pdf: base64, codgp, via }.
 *
 * Regras portadas:
 *  - Impostos = Total − Produtos − Frete (calculado, não é coluna)
 *  - Total = totalnf (NFE) / totalfat (FAG); Formulário = nroform (NFE) / codfat (FAG)
 *  - Prazo = dias das parcelas do grupo (dbreceb: dt_venc − dt_emissao), juntos por '/'
 *  - Via dinâmica (default 1ª); o rótulo é "{via}ª VIA".
 */
const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  const codgp = String(req.query.codgp || '').trim();
  const via = Math.max(1, Number(req.query.via) || 1);
  if (!codgp) return res.status(400).json({ erro: 'Informe codgp.' });

  const client = await getPgPool().connect();
  try {
    // Faturas reais do grupo (exclui o container sintético 'GP...' sem nroform).
    const { rows } = await client.query(
      `SELECT f.codfat, f.data, f.tipofat, f.nroform,
              f.totalprod, f.totalnf, f.totalfat, f.totalfrete,
              c.codcli, c.nome AS cliente_nome,
              v.nome AS vendedor,
              e.nomecontribuinte, e.uf AS empresa_uf
         FROM dbfatura f
         JOIN dbclien c ON TRIM(c.codcli) = TRIM(f.codcli)
         LEFT JOIN dbvend v ON TRIM(v.codvend) = TRIM(f.codvend)
         CROSS JOIN LATERAL (SELECT nomecontribuinte, uf FROM dadosempresa LIMIT 1) e
        WHERE f.codgp = $1 AND f.nroform IS NOT NULL AND TRIM(f.nroform) <> ''
        ORDER BY f.data, f.nroform`,
      [codgp],
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: `Nenhuma fatura encontrada para a GP ${codgp}.` });
    }

    // Prazo do grupo = dias distintos das parcelas (dbreceb), ordenados, juntos por '/'.
    const pz = await client.query(
      `SELECT DISTINCT (dt_venc::date - dt_emissao::date) AS dias
         FROM dbreceb
        WHERE codgp = $1 AND dt_venc IS NOT NULL AND dt_emissao IS NOT NULL
        ORDER BY 1`,
      [codgp],
    );
    const prazo = pz.rows.map((r) => r.dias).filter((d) => d != null).join('/');

    const first = rows[0];
    const empresa = `${first.nomecontribuinte || 'MELO'}${first.empresa_uf ? ` - ${first.empresa_uf}` : ''}`;
    const cliente = `${String(first.codcli).trim()} - ${first.cliente_nome || ''}`.trim();
    const vendedor = String(first.vendedor || '').trim();

    const linhas = rows.map((r) => {
      const tipofat = Number(r.tipofat);
      const ehFag = tipofat === 3;
      const produtos = Number(r.totalprod) || 0;
      const frete = Number(r.totalfrete) || 0;
      const total = Number(ehFag ? r.totalfat : r.totalnf) || 0;
      const impostos = Math.round((total - produtos - frete) * 100) / 100;
      return {
        data: r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '',
        tipo: ehFag ? 'FAG' : 'NFE',
        formulario: String(ehFag ? r.codfat : r.nroform || '').trim(),
        produtos,
        impostos,
        frete,
        total,
        prazo,
      };
    });

    // ===== PDF (jsPDF + autoTable) =====
    const doc = new jsPDF('portrait', 'pt', 'a4');
    const marginX = 40;
    let y = 40;

    // Logo (opcional — mesmo arquivo da DANFE).
    try {
      const fs = require('fs');
      const path = require('path');
      const logoPath = path.join(process.cwd(), 'public', 'images', 'MeloLogo.png');
      if (fs.existsSync(logoPath)) {
        const logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
        doc.addImage(logoBase64, 'PNG', marginX, y - 8, 120, 48);
      }
    } catch {
      /* segue sem logo */
    }

    // Título "Resumo GP - Nro {codgp} {via}ª VIA" (à direita do logo).
    doc.setFont('helvetica', 'bold').setFontSize(15);
    doc.text(`Resumo GP - Nro ${codgp}  ${via}ª VIA`, doc.internal.pageSize.getWidth() - marginX, y + 12, {
      align: 'right',
    });

    // Cabeçalho: empresa / cliente / vendedor.
    y += 56;
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text(empresa, marginX, y);
    y += 15;
    doc.text(`CLIENTE: ${cliente}`, marginX, y);
    y += 15;
    doc.text(`VENDEDOR: ${vendedor}`, marginX, y);
    y += 8;

    autoTable(doc, {
      startY: y + 6,
      margin: { left: marginX, right: marginX },
      head: [['Data', 'Tipo', 'Formulário', 'Produtos', 'Impostos', 'Frete', 'Total', 'Prazo']],
      body: linhas.map((l) => [
        l.data,
        l.tipo,
        l.formulario,
        brl(l.produtos),
        brl(l.impostos),
        brl(l.frete),
        brl(l.total),
        l.prazo,
      ]),
      styles: { fontSize: 9, cellPadding: 4, lineColor: [180, 180, 180], lineWidth: 0.5 },
      headStyles: { fillColor: [235, 235, 235], textColor: [20, 20, 20], fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });

    // Rodapé: total do grupo.
    const totalGrupo = linhas.reduce((s, l) => s + l.total, 0);
    const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text(
      `TOTAL DO GRUPO: R$ ${brl(totalGrupo)}`,
      doc.internal.pageSize.getWidth() - marginX,
      finalY + 20,
      { align: 'right' },
    );

    const pdfBase64 = doc.output('datauristring').split(',')[1];
    return res.status(200).json({ sucesso: true, codgp, via, pdf: pdfBase64 });
  } catch (error: any) {
    console.error('Erro ao gerar Resumo GP:', error);
    return res.status(500).json({ erro: 'Erro ao gerar o Resumo GP', detalhes: error.message });
  } finally {
    client.release();
  }
}
