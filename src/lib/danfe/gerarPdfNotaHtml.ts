// src/lib/danfe/gerarPdfNotaHtml.ts
//
// Helper SERVER-SIDE: monta o PDF da nota (NF-e mod.55 ou NFC-e mod.65) a partir do
// HTML (layout MELO) e renderiza via puppeteer (A4 paisagem). Usado na EMISSÃO
// (PDF guardado no banco + anexo do e-mail). O jsPDF segue como fallback nos endpoints.
import { readFileSync } from 'fs';
import path from 'path';
import { gerarDanfeHtmlNFe } from './gerarDanfeHtml';
import { gerarNfceHtml } from './gerarNfceHtml';
import { renderHtmlToPdf } from './renderHtmlToPdf';

let _logo: string | null = null;
function logoDataUri(): string {
  if (_logo != null) return _logo;
  try {
    const buf = readFileSync(path.resolve(process.cwd(), 'public/images/logoPdf.png'));
    _logo = 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    _logo = '';
  }
  return _logo;
}

let _jsbarcode: string | null = null;
function jsBarcodeSrc(): string {
  if (_jsbarcode != null) return _jsbarcode;
  try {
    _jsbarcode = readFileSync(
      path.resolve(process.cwd(), 'node_modules/jsbarcode/dist/JsBarcode.all.min.js'),
      'utf8',
    );
  } catch {
    _jsbarcode = '';
  }
  return _jsbarcode;
}

export async function gerarPdfNotaHtml(
  tipo: 'nfe' | 'nfce',
  fatura: any,
  produtos: any[],
  venda: any,
  dadosEmpresa: any,
  dadosNFe?: any,
  opts: { homologacao?: boolean } = {},
): Promise<Buffer> {
  const logoSrc = logoDataUri();
  const homologacao = !!opts.homologacao;
  let html: string;

  if (tipo === 'nfce') {
    let qrCodeDataUrl = '';
    const chaveNum = String(dadosNFe?.chaveAcesso || '').replace(/\D/g, '');
    try {
      const QRCode: any = (await import('qrcode')).default;
      const conteudo =
        chaveNum.length >= 20
          ? `https://www.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe=${chaveNum}`
          : 'SEM VALIDADE';
      qrCodeDataUrl = await QRCode.toDataURL(conteudo, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
    } catch {
      /* segue sem QR */
    }
    html = gerarNfceHtml(fatura, produtos, venda, dadosEmpresa, dadosNFe, { logoSrc, qrCodeDataUrl, homologacao });
  } else {
    html = gerarDanfeHtmlNFe(fatura, produtos, venda, dadosEmpresa, dadosNFe, {
      logoSrc,
      jsBarcodeSrc: jsBarcodeSrc(),
      homologacao,
    });
  }

  return await renderHtmlToPdf(html);
}
