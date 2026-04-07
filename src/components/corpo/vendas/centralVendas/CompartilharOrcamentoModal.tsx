'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Mail, MessageCircle, ExternalLink, Loader2, X } from 'lucide-react';

interface DadosOrcamento {
  codvenda: string;
  cliente_nome: string;
  total: number;
  total_com_impostos: number;
  data: string;
}

interface CompartilharOrcamentoModalProps {
  open: boolean;
  onClose: () => void;
  pdfId: string;
  pdfUrl: string;
  dados: DadosOrcamento;
}

const CompartilharOrcamentoModal: React.FC<CompartilharOrcamentoModalProps> = ({
  open,
  onClose,
  pdfUrl,
  dados,
}) => {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);

  if (!open) return null;

  // URL completa do PDF
  const fullPdfUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${pdfUrl}`
    : pdfUrl;

  // Mensagem para compartilhamento
  const mensagem = `Olá! Segue o orçamento Nº ${dados.codvenda}\n\nCliente: ${dados.cliente_nome}\nValor: R$ ${dados.total_com_impostos.toFixed(2)}\nData: ${dados.data}\n\nAcesse o PDF: ${fullPdfUrl}`;

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

  // Compartilhar via WhatsApp
  const handleWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Compartilhar via Email
  const handleEmail = () => {
    const subject = `Orçamento Nº ${dados.codvenda} - Melo Distribuidora`;
    const body = mensagem;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  // Download do PDF
  const handleDownload = () => {
    const downloadUrl = `${pdfUrl}?download=true`;
    window.open(downloadUrl, '_blank');
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
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
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
    </div>
  );
};

export default CompartilharOrcamentoModal;
