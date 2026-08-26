import React, { useEffect, useRef, useState } from 'react';
import { gerarDanfeHtmlNFe } from '@/lib/danfe/gerarDanfeHtml';
import { extrairTelefone } from '@/utils/extrairTelefone';
import { gerarNfceHtml } from '@/lib/danfe/gerarNfceHtml';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, X, History, CheckCircle2, XCircle } from 'lucide-react';
import ModalEventosNota from './ModalEventosNota';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fatura: any;
  produtos: any[];
  venda: any;
}

export default function NotaFiscalPreviewModal({ isOpen, onClose, fatura, produtos, venda }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null); // NF-e HTML (layout MELO)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  // Status da nota (cancelada/denegada) + histórico de eventos.
  const [statusNota, setStatusNota] = useState<'CANCELADA' | 'DENEGADA' | null>(null);
  // Resumo da NF-e p/ o banner (chave, protocolo, datas, motivo do cancelamento).
  const [infoNfe, setInfoNfe] = useState<any | null>(null);
  const [eventosAbertos, setEventosAbertos] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const carregarEGerarPDF = async () => {
      // Verificar se temos dados de venda ou fatura
      const temVenda = venda?.codvenda || venda?.nrovenda;
      const temFatura = fatura?.codfat;
      
      if (!temVenda && !temFatura) return;
      
      setIsLoading(true);
      setPdfUrl(null);
      setHtmlContent(null);
      setErro(null);
      setStatusNota(null);
      setInfoNfe(null);

      try {
        console.log('🏢 Buscando dados da empresa...');
        const resEmpresa = await axios.get('/api/faturamento/dadosempresa');
        const dadosEmpresa = resEmpresa.data;

        if (!dadosEmpresa) {
          throw new Error("Dados da empresa não foram carregados.");
        }

        let dadosCompletos;
        
        if (temFatura) {
          // Se temos código da fatura, usar endpoint de fatura
          console.log('🔍 Buscando dados completos da fatura por codfat...');
          const resDados = await axios.get(`/api/faturamento/dados-fatura-completos?codfat=${fatura.codfat}`);
          dadosCompletos = resDados.data;
        } else {
          // Se temos dados de venda, usar endpoint detalhes-venda (já tem resumoFinanceiro)
          console.log('🔍 Buscando dados completos da venda via detalhes-venda...');
          const parametro = venda.nrovenda || venda.codvenda;
          const resDados = await axios.get(`/api/faturamento/detalhes-venda?nrovenda=${parametro}`);
          dadosCompletos = resDados.data;
        }

        console.log(' Dados completos da venda carregados:', {
          venda: dadosCompletos.dbvenda?.codvenda,
          cliente: dadosCompletos.dbclien?.nomefant || dadosCompletos.dbclien?.nome,
          produtos: dadosCompletos.dbitvenda?.length || 0,
          primeiro_produto: dadosCompletos.dbitvenda?.[0] ? {
            codprod: dadosCompletos.dbitvenda[0].codprod,
            descr: dadosCompletos.dbitvenda[0].descr,
            descr_dbprod: dadosCompletos.dbitvenda[0].dbprod?.descr
          } : 'NENHUM'
        });

        console.log('📋 Gerando PDF com dados da API...');
        
        // Mesclar dados do cliente na fatura para compatibilidade com gerarPreviewNF
        const faturaCompleta = {
          ...dadosCompletos.dbfatura,
          // Dados do cliente
          nomefant: dadosCompletos.dbclien?.nomefant,
          nome: dadosCompletos.dbclien?.nome,
          cpfcgc: dadosCompletos.dbclien?.cpfcgc,
          ender: dadosCompletos.dbclien?.ender,
          bairro: dadosCompletos.dbclien?.bairro,
          cidade: dadosCompletos.dbclien?.cidade,
          uf: dadosCompletos.dbclien?.uf,
          cep: dadosCompletos.dbclien?.cep,
          email: dadosCompletos.dbclien?.email,
          fone: extrairTelefone(
            dadosCompletos.dbclien?.contato ??
              dadosCompletos.dbclien?.fone ??
              dadosCompletos.dbclien?.telefone ??
              '',
          ),
          iest: dadosCompletos.dbclien?.iest || '',
          // Data da fatura/venda para exibição de data/hora de saída
          data: dadosCompletos.dbfatura?.data || dadosCompletos.dbvenda?.data || new Date().toISOString(),
          // Dados adicionais da nota
          natureza: 'Venda de mercadoria',
          numero: dadosCompletos.dbclien?.numero || 'S/N',
          // 🆕 Dados de impostos IBS/CBS (Nova Lei Complementar nº 214/2025)
          aliquota_ibs: dadosCompletos.resumoFinanceiro?.totalAliquotaIBS ?? 0.1,
          valor_ibs: dadosCompletos.resumoFinanceiro?.totalValorIBS ?? 0,
          aliquota_cbs: dadosCompletos.resumoFinanceiro?.totalAliquotaCBS ?? 0.9,
          valor_cbs: dadosCompletos.resumoFinanceiro?.totalValorCBS ?? 0,
          ibs_estadual: dadosCompletos.resumoFinanceiro?.totalIBSEstadual ?? 0,
          ibs_municipal: dadosCompletos.resumoFinanceiro?.totalIBSMunicipal ?? 0,
          // 🆕 Dados de ICMS/IPI
          baseicms: dadosCompletos.resumoFinanceiro?.totalBaseICMS ?? 0,
          valor_icms: dadosCompletos.resumoFinanceiro?.totalICMS ?? 0,
          baseicms_subst: 0,
          totalprod: dadosCompletos.resumoFinanceiro?.totalProdutos ?? 0,
          vlrfrete: dadosCompletos.resumoFinanceiro?.frete ?? 0,
          vlrseg: dadosCompletos.resumoFinanceiro?.seguro ?? 0,
          vlrdesp: dadosCompletos.resumoFinanceiro?.acrescimo ?? 0,
          valor_ipi: dadosCompletos.resumoFinanceiro?.totalIPI ?? 0,
          totalnf: dadosCompletos.resumoFinanceiro?.totalGeral ?? dadosCompletos.dbvenda?.total ?? 0,
        };
        
        console.log('📊 Dados de impostos adicionados à fatura:', {
          aliquota_ibs: faturaCompleta.aliquota_ibs,
          valor_ibs: faturaCompleta.valor_ibs,
          aliquota_cbs: faturaCompleta.aliquota_cbs,
          valor_cbs: faturaCompleta.valor_cbs,
          totalprod: faturaCompleta.totalprod,
          totalnf: faturaCompleta.totalnf,
        });
        
        console.log('📋 Fatura completa montada:', {
          tem_nomefant: !!faturaCompleta.nomefant,
          tem_cpfcgc: !!faturaCompleta.cpfcgc,
          tem_ender: !!faturaCompleta.ender,
          nomefant: faturaCompleta.nomefant,
          cpfcgc: faturaCompleta.cpfcgc
        });
        
        // Verificar se é pessoa física (CPF) ou jurídica (CNPJ) pelo tamanho do documento
        // CPF tem 11 dígitos, CNPJ tem 14 dígitos
        const cpfcgcLimpo = (faturaCompleta.cpfcgc || '').replace(/\D/g, '');
        const isPessoaFisica = cpfcgcLimpo.length === 11;
        
        console.log('🔍 Tipo de cliente:', {
          cpfcgc: faturaCompleta.cpfcgc,
          cpfcgcLimpo,
          tamanho: cpfcgcLimpo.length,
          isPessoaFisica,
          tipoDocumento: isPessoaFisica ? 'NFC-e (Cupom Fiscal)' : 'NF-e'
        });
        
        // Status da nota → tarja no DANFE + badge no cabeçalho. Uma nota CANCELADA
        // continua sendo a mesma nota autorizada: mantém chave/protocolo e só ganha
        // a tarja "CANCELADA".
        const notaCancelada =
          !!(faturaCompleta as any).cancelada || fatura?.cancel === 'S';
        const notaDenegada = fatura?.denegada === 'S';
        setStatusNota(
          notaCancelada ? 'CANCELADA' : notaDenegada ? 'DENEGADA' : null,
        );
        // Resumo p/ o banner do preview (só quando a nota foi autorizada).
        const dnfe = (faturaCompleta as any).dadosNFe;
        if (dnfe?.chaveAcesso) {
          setInfoNfe({
            codfat: fatura?.codfat,
            chave: dnfe.chaveAcesso,
            protocolo: dnfe.protocolo,
            tipoDocumento: dnfe.tipoDocumento || 'NF-e',
            dataAutorizacao: dnfe.dataAutorizacao || dnfe.dataEmissao,
            cancelada: !!dnfe.cancelada || notaCancelada,
            nfeValida: !!dnfe.nfeValida,
            dataCancelamento: dnfe.dataCancelamento,
            motivoCancelamento: dnfe.motivoCancelamento,
          });
        }

        if (isPessoaFisica) {
          // Pessoa física - NFC-e em HTML (layout MELO, reconstruído do Rave)
          console.log('📄 Gerando NFC-e (HTML) para pessoa física...');
          const dadosNFePrev = (faturaCompleta as any).dadosNFe || undefined;
          const chaveNum = String(
            dadosNFePrev?.chaveAcesso || (faturaCompleta as any).chave_acesso || '',
          ).replace(/\D/g, '');
          let qrCodeDataUrl = '';
          try {
            const conteudoQr =
              chaveNum.length >= 20
                ? `https://www.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe=${chaveNum}`
                : 'PREVIEW - SEM VALIDADE';
            qrCodeDataUrl = await QRCode.toDataURL(conteudoQr, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
          } catch { /* sem QR no preview */ }
          const html = gerarNfceHtml(
            faturaCompleta,
            dadosCompletos.dbitvenda,
            dadosCompletos.dbvenda,
            dadosEmpresa,
            dadosNFePrev,
            { logoSrc: `${window.location.origin}/images/logoPdf.png`, qrCodeDataUrl },
          );
          setHtmlContent(html);
        } else {
          // Pessoa jurídica - NF-e em HTML (layout MELO, reconstruído do Rave)
          console.log('📄 Gerando NF-e (HTML) para pessoa jurídica...');
          const dadosNFePrev = (faturaCompleta as any).dadosNFe || undefined;
          const chaveNum = String(
            dadosNFePrev?.chaveAcesso || (faturaCompleta as any).chave_acesso || '',
          ).replace(/\D/g, '');
          let barcodeSvg = '';
          if (chaveNum.length >= 20) {
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            try {
              JsBarcode(svgEl as any, chaveNum, { format: 'CODE128C', displayValue: false, margin: 0, height: 40, width: 1.4 });
              barcodeSvg = svgEl.outerHTML;
            } catch { /* sem barcode no preview sem chave */ }
          }
          const html = gerarDanfeHtmlNFe(
            faturaCompleta,
            dadosCompletos.dbitvenda,
            dadosCompletos.dbvenda,
            dadosEmpresa,
            dadosNFePrev,
            {
              logoSrc: `${window.location.origin}/images/logoPdf.png`,
              barcodeSvg,
              cancelada: notaCancelada,
              marcaDagua: notaDenegada ? 'DENEGADA' : undefined,
              // HOMOLOGAÇÃO (tpAmb=2): força "SEM VALOR FISCAL" + nome do destinatário
              // padrão. Antes não era passado → a reimpressão saía sem a tarja.
              homologacao: String(dadosEmpresa?.ambiente ?? '2') === '2',
            },
          );
          setHtmlContent(html);
        }

      } catch (error) {
        console.error(' Erro ao gerar preview:', error);
        setErro(`Erro ao gerar preview: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      carregarEGerarPDF();
    }
  }, [isOpen, venda?.codvenda, venda?.nrovenda, fatura?.codfat]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  // Gera o PDF da NF-e HTML no SERVIDOR (puppeteer, landscape garantido — o print do
  // navegador ignora @page e sai em retrato).
  const gerarPdfBlob = async (): Promise<Blob> => {
    const codigo = fatura?.codfat || venda?.codvenda || venda?.nrovenda || 'danfe';
    const resp = await axios.post(
      '/api/faturamento/danfe-html-pdf',
      { html: htmlContent, filename: `nota-${codigo}` },
      { responseType: 'blob' },
    );
    return resp.data as Blob;
  };

  // Salvar PDF (download)
  const handleSalvarPdf = async () => {
    if (!htmlContent || gerandoPdf || imprimindo) return;
    setGerandoPdf(true);
    try {
      const codigo = fatura?.codfat || venda?.codvenda || venda?.nrovenda || 'danfe';
      const url = URL.createObjectURL(await gerarPdfBlob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `nota-${codigo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error('Erro ao gerar PDF da nota:', e);
      alert('Erro ao gerar o PDF da nota.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // Imprimir direto (sem salvar): imprime o PDF em paisagem num iframe oculto
  const handleImprimir = async () => {
    if (!htmlContent || gerandoPdf || imprimindo) return;
    setImprimindo(true);
    try {
      const url = URL.createObjectURL(await gerarPdfBlob());
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      iframe.src = url;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            /* noop */
          }
        }, 300);
      };
      document.body.appendChild(iframe);
      // limpa depois de um tempo (dá tempo do diálogo de impressão)
      setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
      }, 60000);
    } catch (e) {
      console.error('Erro ao imprimir a nota:', e);
      alert('Erro ao imprimir a nota.');
    } finally {
      setImprimindo(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      const codigo = fatura?.codfat || venda?.codvenda || venda?.nrovenda || 'preview';
      link.download = `nota-fiscal-${codigo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Abre o modal de eventos (histórico) da nota — o ModalEventosNota faz o fetch.
  const abrirEventos = () => {
    if (!fatura?.codfat) return;
    setEventosAbertos(true);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 bg-white dark:bg-zinc-900">
        <DialogHeader className="p-4 border-b border-gray-200 dark:border-zinc-800 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
            Preview da Nota Fiscal - {
              fatura?.codfat ? `Fatura ${fatura.codfat}` :
              venda?.codvenda ? `Venda ${venda.codvenda}` :
              venda?.nrovenda ? `Venda ${venda.nrovenda}` :
              'Sem Código'
            }
            {statusNota && (
              <span
                className={`ml-3 inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold ${
                  statusNota === 'CANCELADA'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                {statusNota}
              </span>
            )}
          </DialogTitle>
          <div className="flex gap-2">
            {pdfUrl && (
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Download size={16} />
                Download PDF
              </Button>
            )}
            {htmlContent && (
              <>
                <Button
                  onClick={handleImprimir}
                  disabled={gerandoPdf || imprimindo}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                  size="sm"
                >
                  <Printer size={16} />
                  {imprimindo ? 'Preparando...' : 'Imprimir'}
                </Button>
                <Button
                  onClick={handleSalvarPdf}
                  disabled={gerandoPdf || imprimindo}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                  size="sm"
                >
                  <Download size={16} />
                  {gerandoPdf ? 'Gerando PDF...' : 'Salvar PDF'}
                </Button>
              </>
            )}
            {fatura?.codfat && (
              <Button
                onClick={abrirEventos}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <History size={16} />
                Evento
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <X size={16} />
              Fechar
            </Button>
          </div>
        </DialogHeader>

        {/* Resumo da NF-e: dados da autorização e, se cancelada, linha do tempo */}
        {infoNfe && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {infoNfe.cancelada ? (
              <>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                    <CheckCircle2 size={16} /> Autorizada
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                    <XCircle size={16} /> {infoNfe.nfeValida ? 'Faturamento cancelado' : 'Cancelada'}
                  </span>
                  {infoNfe.nfeValida && (
                    <span className="ml-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
                      NF-e permanece VÁLIDA na SEFAZ
                    </span>
                  )}
                </div>
                <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                  <div><b>Chave de Acesso:</b> {infoNfe.chave}</div>
                  <div><b>Protocolo:</b> {infoNfe.protocolo}</div>
                  <div><b>Autorizada em:</b> {infoNfe.dataAutorizacao ? new Date(infoNfe.dataAutorizacao).toLocaleString('pt-BR') : '—'}</div>
                  <div><b>Cancelada em:</b> {infoNfe.dataCancelamento ? new Date(infoNfe.dataCancelamento).toLocaleString('pt-BR') : '—'}</div>
                  {infoNfe.motivoCancelamento && (
                    <div className="md:col-span-2"><b>Motivo do cancelamento:</b> {infoNfe.motivoCancelamento}</div>
                  )}
                  <div><b>Fatura:</b> {infoNfe.codfat}</div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                  <CheckCircle2 size={16} /> {infoNfe.tipoDocumento} Autorizada
                </div>
                <div className="mt-1.5 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                  <div className="md:col-span-2"><b>Chave de Acesso:</b> {infoNfe.chave}</div>
                  <div><b>Protocolo:</b> {infoNfe.protocolo}</div>
                  <div><b>Autorizada em:</b> {infoNfe.dataAutorizacao ? new Date(infoNfe.dataAutorizacao).toLocaleString('pt-BR') : '—'}</div>
                  <div><b>Fatura:</b> {infoNfe.codfat}</div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex-1 bg-gray-100 dark:bg-zinc-950 p-4 overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col justify-center items-center bg-white/80 dark:bg-black/50 z-10 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">Gerando preview da nota fiscal...</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Aguarde um momento</p>
            </div>
          )}

          {erro && (
            <div className="flex justify-center items-center h-full">
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-red-100 dark:border-red-900/30">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Erro ao gerar preview</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">{erro}</p>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🔄 Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {pdfUrl && !erro && (
            <div className="h-full w-full bg-white dark:bg-zinc-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-zinc-700">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Preview da Nota Fiscal"
              />
            </div>
          )}

          {htmlContent && !erro && (
            <div className="h-full w-full bg-white rounded-lg shadow-sm overflow-auto border border-gray-200 dark:border-zinc-700">
              <iframe
                ref={iframeRef}
                srcDoc={htmlContent}
                className="w-full h-full border-0 bg-white"
                title="Preview da Nota Fiscal (NF-e)"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Histórico de eventos (autorização, cancelamento, rejeições, cartas de correção) */}
    <ModalEventosNota
      open={eventosAbertos}
      onClose={() => setEventosAbertos(false)}
      codfat={fatura?.codfat}
    />
    </>
  );
}
