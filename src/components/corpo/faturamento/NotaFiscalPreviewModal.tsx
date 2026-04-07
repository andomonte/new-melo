import React, { useEffect, useState } from 'react';
import { gerarPreviewNF } from '@/utils/gerarPreviewNF';
import { gerarPreviewCupomFiscal } from '@/utils/gerarPDFCupomFiscal'; 
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fatura: any;
  produtos: any[];
  venda: any;
}

export default function NotaFiscalPreviewModal({ isOpen, onClose, fatura, produtos, venda }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregarEGerarPDF = async () => {
      // Verificar se temos dados de venda ou fatura
      const temVenda = venda?.codvenda || venda?.nrovenda;
      const temFatura = fatura?.codfat;
      
      if (!temVenda && !temFatura) return;
      
      setIsLoading(true); 
      setPdfUrl(null);
      setErro(null);

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
          fone: dadosCompletos.dbclien?.contato || dadosCompletos.dbclien?.fone || '',
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
        
        let doc;
        if (isPessoaFisica) {
          // Pessoa física - gerar Cupom Fiscal (NFC-e)
          console.log('📄 Gerando Cupom Fiscal (NFC-e) para pessoa física...');
          doc = await gerarPreviewCupomFiscal(
            faturaCompleta,
            dadosCompletos.dbitvenda,
            dadosCompletos.dbvenda,
            dadosEmpresa
          );
        } else {
          // Pessoa jurídica (empresa) - gerar NFe
          console.log('📄 Gerando NF-e para pessoa jurídica...');
          doc = await gerarPreviewNF(
            faturaCompleta,
            dadosCompletos.dbitvenda,
            dadosCompletos.dbvenda,
            dadosEmpresa
          );
        }

        if (doc) {
          const pdfBlob = doc.output('blob');
          const url = URL.createObjectURL(pdfBlob);
          setPdfUrl(url);
          console.log(' PDF gerado com sucesso!');
        } else {
          throw new Error('Erro ao gerar o PDF');
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 bg-white dark:bg-zinc-900">
        <DialogHeader className="p-4 border-b border-gray-200 dark:border-zinc-800 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl font-semibold text-gray-800 dark:text-white">
            Preview da Nota Fiscal - {
              fatura?.codfat ? `Fatura ${fatura.codfat}` : 
              venda?.codvenda ? `Venda ${venda.codvenda}` : 
              venda?.nrovenda ? `Venda ${venda.nrovenda}` : 
              'Sem Código'
            }
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
