/**
 * Converte um PDF em imagens PNG (uma por página), no navegador, com pdf.js.
 * Usado no compartilhamento do orçamento pelo WhatsApp ("Enviar como imagem").
 * A biblioteca só é carregada quando chamada (import dinâmico) — não pesa nas telas.
 */
export async function pdfParaImagens(
  pdf: Blob,
  nomeBase: string,
  opcoes: { escala?: number } = {},
): Promise<File[]> {
  // @ts-ignore — o build legado (v3) não traz .d.ts para este caminho
  const pdfjs: any = await import('pdfjs-dist/build/pdf');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
  }

  const dados = new Uint8Array(await pdf.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  // Escala 2 ≈ 1190×1684 px numa página A4: legível no celular sem ficar pesado.
  const escala = opcoes.escala ?? 2;
  const arquivos: File[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const viewport = pagina.getViewport({ scale: escala });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Navegador sem suporte a canvas.');
      // fundo branco (PNG transparente fica preto em alguns visualizadores)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport }).promise;

      const blob: Blob = await new Promise((ok, falha) =>
        canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Falha ao gerar a imagem.'))), 'image/png'),
      );
      const sufixo = doc.numPages > 1 ? `_pag${n}` : '';
      arquivos.push(new File([blob], `${nomeBase}${sufixo}.png`, { type: 'image/png' }));
      pagina.cleanup();
    }
  } finally {
    doc.destroy();
  }
  return arquivos;
}
