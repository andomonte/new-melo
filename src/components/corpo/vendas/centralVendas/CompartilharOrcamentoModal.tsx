'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Mail, MessageCircle, ExternalLink, Loader2, X, FileText, Image as ImageIcon } from 'lucide-react';
import ModalEnviarEmail from '@/components/corpo/faturamento/ConsultaFatura/ModalEnviarEmail';
import { mostrarAlerta } from '@/components/common/AlertaCentralGlobal';

type FormatoZap = 'pdf' | 'imagem';
const LS_FORMATO_ZAP = 'orcamento_whatsapp_formato';

interface DadosOrcamento {
  codvenda: string;
  cliente_nome: string;
  total: number;
  total_com_impostos: number;
  data: string;
  codcli?: string;
}

interface CompartilharOrcamentoModalProps {
  open: boolean;
  onClose: () => void;
  pdfId: string;
  pdfUrl: string;
  nomeArquivo?: string;
  draftId?: string;
  codvenda?: string;
  dados: DadosOrcamento;
}

const CompartilharOrcamentoModal: React.FC<CompartilharOrcamentoModalProps> = ({
  open,
  onClose,
  pdfId,
  pdfUrl,
  nomeArquivo,
  draftId,
  codvenda,
  dados,
}) => {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);
  const [emailAberto, setEmailAberto] = useState(false);
  const [enviandoZap, setEnviandoZap] = useState(false);
  // escolha PDF / Imagem antes de enviar pelo WhatsApp (lembra a última do vendedor)
  const [escolhaZap, setEscolhaZap] = useState(false);
  const [formatoZap, setFormatoZap] = useState<FormatoZap>(() => {
    try {
      return localStorage.getItem(LS_FORMATO_ZAP) === 'imagem' ? 'imagem' : 'pdf';
    } catch {
      return 'pdf';
    }
  });

  // Escape fecha o modal (não enquanto a tela de email estiver aberta por cima)
  React.useEffect(() => {
    if (!open || emailAberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (escolhaZap) setEscolhaZap(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, emailAberto, escolhaZap]);

  if (!open) return null;

  // URL completa do PDF
  const fullPdfUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${pdfUrl}`
    : pdfUrl;

  // Mensagem para compartilhamento — SEM link do sistema (o PDF vai como arquivo)
  const mensagem = `Olá! Segue o orçamento Nº ${dados.codvenda}\n\nCliente: ${dados.cliente_nome}\nValor: R$ ${dados.total_com_impostos.toFixed(2)}\nData: ${dados.data}`;
  const nomePdf = nomeArquivo ? `${nomeArquivo}.pdf` : `orcamento_${dados.codvenda}.pdf`;

  // Copiar link
  const handleCopyLink = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(fullPdfUrl);
      toast({
        title: 'Link copiado!',
        description: 'O link do orçamento foi copiado para a área de transferência.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    } finally {
      setCopying(false);
    }
  };

  // WhatsApp: manda o orçamento como ARQUIVO — PDF ou imagem, à escolha do vendedor —
  // e nunca o link do sistema.
  // 1) Compartilhamento nativo (Windows/Android/iOS) com o arquivo → o vendedor escolhe
  //    o WhatsApp e o contato, e o arquivo já vai anexado.
  // 2) Sem suporte no navegador: baixa o(s) arquivo(s) (imagem de 1 página também vai
  //    para a área de transferência, para colar com Ctrl+V) e abre o WhatsApp com o texto.
  // (O link wa.me não aceita anexo — anexar sozinho só com a API paga do WhatsApp Business.)
  const enviarWhatsApp = async (formato: FormatoZap) => {
    setEscolhaZap(false);
    setFormatoZap(formato);
    try {
      localStorage.setItem(LS_FORMATO_ZAP, formato);
    } catch {
      /* sem localStorage, segue */
    }
    setEnviandoZap(true);
    try {
      const resp = await fetch(pdfUrl);
      if (!resp.ok) throw new Error('O PDF do orçamento expirou. Gere o PDF novamente.');
      const blob = await resp.blob();

      let arquivos: File[];
      if (formato === 'imagem') {
        const { pdfParaImagens } = await import('@/lib/pdf/pdfParaImagens');
        arquivos = await pdfParaImagens(blob, nomePdf.replace(/\.pdf$/i, ''));
      } else {
        arquivos = [new File([blob], nomePdf, { type: 'application/pdf' })];
      }

      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: arquivos })) {
        try {
          await nav.share({ files: arquivos, title: `Orçamento Nº ${dados.codvenda}`, text: mensagem });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return; // vendedor fechou a janela de compartilhar
          // outro erro → cai no plano B
        }
      }

      // Plano B: baixa e abre o WhatsApp só com o texto
      let copiada = false;
      if (formato === 'imagem' && arquivos.length === 1 && (window as any).ClipboardItem && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': arquivos[0] })]);
          copiada = true;
        } catch {
          /* sem permissão de área de transferência, segue só com o download */
        }
      }
      arquivos.forEach((arq, i) => {
        setTimeout(() => {
          const url = URL.createObjectURL(arq);
          const el = document.createElement('a');
          el.href = url;
          el.download = arq.name;
          el.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }, i * 300);
      });
      window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');

      const nomes = arquivos.map((x) => x.name).join(', ');
      const oque = formato === 'imagem' ? (arquivos.length > 1 ? `as ${arquivos.length} imagens` : 'a imagem') : 'o PDF';
      mostrarAlerta({
        tipo: 'warning',
        titulo: `Anexe ${oque} no WhatsApp`,
        mensagem: copiada
          ? `A imagem do orçamento foi copiada e baixada (${nomes}).\nNo WhatsApp, escolha o contato e cole com Ctrl+V.`
          : `Baixado: ${nomes}.\nNo WhatsApp, escolha o contato e anexe (clipe ou arrastando da pasta Downloads).`,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao compartilhar', description: e?.message || 'Não foi possível preparar o orçamento.', variant: 'destructive' });
    } finally {
      setEnviandoZap(false);
    }
  };

  const handleWhatsApp = () => setEscolhaZap(true);

  // Email: tela de envio (mesma do comprovante do contas a receber) com o PDF em anexo
  const handleEmail = () => setEmailAberto(true);

  // Download do PDF com diálogo "Salvar como" (escolha de pasta)
  const handleDownload = async () => {
    const fileName = nomePdf;

    // Tenta usar showSaveFilePicker (Chrome/Edge) para abrir diálogo de pasta
    if ('showSaveFilePicker' in window) {
      try {
        const resp = await fetch(pdfUrl);
        const blob = await resp.blob();
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast({ title: 'PDF salvo com sucesso!' });
        return;
      } catch (err: any) {
        // Usuário cancelou ou não suportado — fallback abaixo
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback: download normal
    const resp = await fetch(pdfUrl);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Abrir PDF em nova aba
  const handleOpenPdf = () => {
    window.open(pdfUrl, '_blank');
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[96vw] h-[90vh] flex flex-col p-6">
        {/* Cabeçalho do Modal */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Compartilhar Orçamento Nº {dados.codvenda}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Fechar modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info do orçamento */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 py-4 border-b border-gray-200 dark:border-zinc-700">
          <span>
            Cliente: <strong className="text-gray-800 dark:text-gray-100">{dados.cliente_nome}</strong>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            Total: <strong className="text-green-600 dark:text-green-400">R$ {dados.total_com_impostos.toFixed(2)}</strong>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            Data: <strong className="text-gray-800 dark:text-gray-100">{dados.data}</strong>
          </span>
        </div>

        {/* Preview do PDF */}
        <div className="flex-grow overflow-hidden mt-4 bg-gray-100 dark:bg-zinc-800 rounded-lg">
          <iframe
            src={pdfUrl}
            className="w-full h-full rounded-lg"
            title="Preview do Orçamento"
          />
        </div>

        {/* Botões de ação */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-zinc-700 mt-4">
          <button
            onClick={handleCopyLink}
            disabled={copying}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {copying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Copiar Link
          </button>

          <button
            onClick={handleWhatsApp}
            disabled={enviandoZap}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            {enviandoZap ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            WhatsApp
          </button>

          <button
            onClick={handleEmail}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>

          <button
            onClick={handleOpenPdf}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Nova Aba
          </button>
        </div>

        {/* Aviso de expiração */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
          Este link expira em 24 horas. Após esse período, será necessário gerar um novo PDF.
        </p>
      </div>

      {/* Escolha do formato para o WhatsApp */}
      {escolhaZap && (
        <div className="fixed inset-0 z-[55] bg-black/40 flex justify-center items-center p-4" onClick={() => setEscolhaZap(false)}>
          <div
            className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Enviar pelo WhatsApp</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Como o cliente vai receber o orçamento?</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { f: 'pdf' as FormatoZap, Icone: FileText, titulo: 'PDF', desc: 'arquivo para abrir/imprimir' },
                { f: 'imagem' as FormatoZap, Icone: ImageIcon, titulo: 'Imagem', desc: 'aparece direto na conversa' },
              ]).map(({ f, Icone, titulo, desc }) => (
                <button
                  key={f}
                  autoFocus={formatoZap === f}
                  onClick={() => enviarWhatsApp(f)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-4 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    formatoZap === f
                      ? 'border-green-600 bg-green-50 dark:bg-green-950/30'
                      : 'border-gray-200 dark:border-zinc-700 hover:border-green-400'
                  }`}
                >
                  <Icone className="w-7 h-7 text-green-700 dark:text-green-400" />
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{titulo}</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 text-center">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ModalEnviarEmail
        open={emailAberto}
        onClose={() => setEmailAberto(false)}
        tipo="orcamento"
        pdfId={pdfId}
        nomeArquivo={nomeArquivo || `orcamento_${dados.codvenda}`}
        codcli={dados.codcli || undefined}
        nomeCliente={dados.cliente_nome || undefined}
        numeroNota={dados.codvenda}
      />
    </div>
  );
};

export default CompartilharOrcamentoModal;
