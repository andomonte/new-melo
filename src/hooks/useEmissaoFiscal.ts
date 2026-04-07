/**
 * Hook personalizado para emissão fiscal automática
 * Detecta CPF/CNPJ e chama a API apropriada
 */

import { useState } from 'react';
import { identificarTipoDocumento } from '@/utils/validarDocumento';

interface DadosEmissao {
  dbfatura: any;
  dbclien: any;
  dbitvenda: any[];
  dbvenda: any;
  emitente: any;
  total?: any;
}

interface ResultadoEmissao {
  sucesso: boolean;
  status?: string;
  motivo?: string;
  protocolo?: string;
  chaveAcesso?: string;
  pdfBase64?: string;
  tipoEmissao?: 'NFE' | 'NFCE';
  modelo?: '55' | '65';
  descricao?: string;
  erro?: string;
}

export function useEmissaoFiscal() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEmissao | null>(null);

  /**
   * Emite documento fiscal (NF-e ou NFC-e) automaticamente
   */
  const emitirDocumentoFiscal = async (dados: DadosEmissao): Promise<ResultadoEmissao> => {
    setCarregando(true);
    setErro(null);
    setResultado(null);

    try {
      // Validar dados básicos
      if (!dados.dbclien?.cpf_cnpj && !dados.dbclien?.cnpj && !dados.dbclien?.cpf) {
        throw new Error('CPF ou CNPJ do cliente não informado');
      }

      const documento = dados.dbclien.cpf_cnpj || dados.dbclien.cnpj || dados.dbclien.cpf;
      const tipoDoc = identificarTipoDocumento(documento);

      console.log('📋 Iniciando emissão fiscal:', {
        documento,
        tipoDocumento: tipoDoc,
        codfat: dados.dbfatura?.codfat
      });

      // Chamar API unificada
      const response = await fetch('/api/fiscal/emitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados),
      });

      const resultadoApi: ResultadoEmissao = await response.json();

      if (!response.ok) {
        throw new Error(resultadoApi.erro || 'Erro ao emitir documento fiscal');
      }

      setResultado(resultadoApi);
      return resultadoApi;

    } catch (error: any) {
      const mensagemErro = error.message || 'Erro desconhecido ao emitir documento fiscal';
      setErro(mensagemErro);
      console.error('❌ Erro na emissão fiscal:', error);
      
      return {
        sucesso: false,
        erro: mensagemErro
      };
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Emite NF-e diretamente (para CNPJ)
   */
  const emitirNFe = async (dados: DadosEmissao): Promise<ResultadoEmissao> => {
    setCarregando(true);
    setErro(null);

    try {
      const response = await fetch('/api/faturamento/emitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados),
      });

      const resultado: ResultadoEmissao = await response.json();

      if (!response.ok) {
        throw new Error(resultado.erro || 'Erro ao emitir NF-e');
      }

      setResultado(resultado);
      return resultado;

    } catch (error: any) {
      const mensagemErro = error.message || 'Erro ao emitir NF-e';
      setErro(mensagemErro);
      return {
        sucesso: false,
        erro: mensagemErro
      };
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Emite NFC-e diretamente (para CPF)
   */
  const emitirNFCe = async (dados: DadosEmissao): Promise<ResultadoEmissao> => {
    setCarregando(true);
    setErro(null);

    try {
      const response = await fetch('/api/faturamento/emitir-cupom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados),
      });

      const resultado: ResultadoEmissao = await response.json();

      if (!response.ok) {
        throw new Error(resultado.erro || 'Erro ao emitir NFC-e');
      }

      setResultado(resultado);
      return resultado;

    } catch (error: any) {
      const mensagemErro = error.message || 'Erro ao emitir NFC-e';
      setErro(mensagemErro);
      return {
        sucesso: false,
        erro: mensagemErro
      };
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Limpa os estados
   */
  const limpar = () => {
    setCarregando(false);
    setErro(null);
    setResultado(null);
  };

  return {
    emitirDocumentoFiscal,
    emitirNFe,
    emitirNFCe,
    limpar,
    carregando,
    erro,
    resultado
  };
}
