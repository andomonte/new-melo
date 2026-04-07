/**
 * RESUMO DAS MODIFICAÇÕES NO CUPOM FISCAL (NFC-e)
 * 
 * ✅ ALTERAÇÕES IMPLEMENTADAS:
 * 
 * 1. CABEÇALHO:
 *    - Mudou de "DANFE" para "NFC-e"
 *    - Texto alterado para "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA"
 *    - REMOVIDO: "CONTROLE DO FISCO" com código de barras
 *    - ADICIONADO: QR CODE no lugar do controle de fisco (80x80 pts)
 *    - QR Code aponta para: https://www.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe={chave}
 * 
 * 2. SEÇÕES REMOVIDAS:
 *    - ❌ CÁLCULO DO IMPOSTO (toda a seção removida)
 *    - ❌ TRANSPORTADOR/VOLUMES TRANSPORTADOS (toda a seção removida)
 * 
 * 3. SEÇÃO MODIFICADA:
 *    - DADOS ADICIONAIS → ÁREA DE MENSAGEM FISCAL
 *    - Agora exibe:
 *      * Número e Série da NFC-e
 *      * Data e hora de emissão
 *      * "Via do Consumidor"
 *      * Link de consulta: http://sistemas.sefaz.am.gov.br/nfceweb/formConsulta.do
 *      * CHAVE DE ACESSO (formatada em grupos de 4 dígitos)
 *      * Informações complementares (venda, vendedor)
 * 
 * 4. FUNCIONALIDADE QR CODE:
 *    - QR Code é pré-gerado de forma assíncrona antes de criar o PDF
 *    - Biblioteca usada: 'qrcode'
 *    - Configuração: errorCorrectionLevel: 'M', margin: 1, width: 300
 *    - O QR Code é passado como parâmetro para a função desenharCabecalhoCompletoCupom
 * 
 * 5. ESTRUTURA MANTIDA:
 *    - ✅ Dados do Emitente (com logo)
 *    - ✅ Dados do Destinatário
 *    - ✅ Tabela de Produtos
 *    - ✅ Dados Adicionais de Tributos sobre Serviços (se aplicável)
 *    - ✅ Marca d'água "SEM VALIDADE" para preview
 * 
 * ARQUIVOS MODIFICADOS:
 * - c:\Users\lucas\site-melo\src\utils\gerarPDFCupomFiscal.ts
 * 
 * FUNÇÕES PRINCIPAIS:
 * - desenharCabecalhoCompletoCupom(doc, dadosEmpresa, fatura, dadosNota, pageNumber, qrCodeDataUrl?)
 * - gerarPreviewCupomFiscal(fatura, produtos, venda, dadosEmpresa, tipoNota, dadosNFe?)
 * 
 * USO:
 * ```typescript
 * const cupomPDF = await gerarPreviewCupomFiscal(
 *   fatura,
 *   produtos,
 *   venda,
 *   dadosEmpresa,
 *   'valida', // ou 'preview'
 *   {
 *     chaveAcesso: '13250504618800019265001000170180112643814270737376',
 *     protocolo: '135210000123456',
 *     numeroNFe: '001701801',
 *     serieNFe: '3',
 *     dataEmissao: '2025-05-10T16:03:39',
 *     valorTotal: 16.20
 *   }
 * );
 * ```
 * 
 * PRÓXIMOS PASSOS:
 * 1. Testar a geração do cupom fiscal com dados reais
 * 2. Integrar com a API de emissão (emitir-cupom.ts)
 * 3. Implementar gerarXmlCupomFiscal.ts (XML NFC-e modelo 65)
 * 4. Implementar enviarCupomParaSefaz.ts (submissão SEFAZ)
 */

// Este arquivo serve apenas como documentação
export const CUPOM_FISCAL_NFC_E_INFO = {
  tipo: 'NFC-e',
  modelo: '65',
  diferenças_nf_e: [
    'QR Code em vez de código de barras',
    'Sem cálculo de impostos detalhado',
    'Sem dados de transportador',
    'Área de mensagem fiscal simplificada',
    'Destinatário apenas CPF (consumidor final)'
  ],
  status: 'IMPLEMENTADO ✅'
};
