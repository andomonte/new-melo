/**
 * URLs oficiais da SEFAZ Amazonas para NF-e e NFC-e (versão 4.00)
 *
 * IMPORTANTE: NFC-e usa endpoint DIFERENTE de NF-e no Amazonas!
 *
 * ⚠️ NOTA IMPORTANTE (29/10/2025):
 * URLs atualizadas com base na documentação oficial da SEFAZ-AM.
 * Se receber "Please enable REST support", indica que serviços SOAP podem estar temporariamente desabilitados.
 *
 * Fonte: Documentação oficial SEFAZ-AM (portalnfce.sefaz.am.gov.br)
 */

export const SEFAZ_AM_URLS = {
  HOMOLOGACAO: {
    // NF-e
    NFE_AUTORIZACAO: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
    NFE_CONSULTA: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    NFE_STATUS: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeStatusServico4',

    // NFC-e (URLs CORRETAS - endpoint específico para NFC-e)
    NFCE_AUTORIZACAO: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
    NFCE_CONSULTA: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4',
    NFCE_RET_AUTORIZACAO: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4',
    NFCE_STATUS: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
    NFCE_RECEPCAO_EVENTO: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4',
    NFCE_INUTILIZACAO: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeInutilizacao4',

    // API REST fallback (caso SEFAZ migre para REST)
    NFCE_REST: 'https://homnfe.sefaz.am.gov.br/nfce/api/v1/autorizacao',

    // URLs alternativas (para contingência)
    NFCE_ALT1: 'https://homnfce.sefaz.am.gov.br/nfce/services/NfeAutorizacao4',
  },
  PRODUCAO: {
    // NF-e
    NFE_AUTORIZACAO: 'https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
    NFE_CONSULTA: 'https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    NFE_STATUS: 'https://nfe.sefaz.am.gov.br/services2/services/NfeStatusServico4',

    // NFC-e (URLs CORRETAS - endpoint específico para NFC-e)
    NFCE_AUTORIZACAO: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
    NFCE_CONSULTA: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4',
    NFCE_RET_AUTORIZACAO: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4',
    NFCE_STATUS: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
    NFCE_RECEPCAO_EVENTO: 'https://nfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4',
    NFCE_INUTILIZACAO: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeInutilizacao4',

    // API REST fallback
    NFCE_REST: 'https://nfe.sefaz.am.gov.br/nfce/api/v1/autorizacao',

    // URLs alternativas
    NFCE_ALT1: 'https://nfce.sefaz.am.gov.br/nfce/services/NfeAutorizacao4',
  }
};

// Função helper para obter URL por tipo de serviço
export function getSefazUrl(ambiente: 'HOMOLOGACAO' | 'PRODUCAO', tipo: keyof typeof SEFAZ_AM_URLS.HOMOLOGACAO): string {
  return SEFAZ_AM_URLS[ambiente][tipo] || SEFAZ_AM_URLS[ambiente].NFCE_AUTORIZACAO;
}
