/**
 * Exemplo de componente React para emissão fiscal automática
 * Detecta CPF/CNPJ e emite o documento apropriado
 */

import React, { useState } from 'react';
import { useEmissaoFiscal } from '@/hooks/useEmissaoFiscal';
import { identificarTipoDocumento } from '@/utils/validarDocumento';
import { FaFilePdf } from 'react-icons/fa6';

interface Props {
  fatura: any;
  cliente: any;
  produtos: any[];
  venda: any;
  emitente: any;
  onSucesso?: (resultado: any) => void;
  onErro?: (erro: string) => void;
}

export function BotaoEmitirDocumentoFiscal({
  fatura,
  cliente,
  produtos,
  venda,
  emitente,
  onSucesso,
  onErro
}: Props) {
  const { emitirDocumentoFiscal, carregando, erro, resultado } = useEmissaoFiscal();
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  // Identificar tipo de documento
  const documento = cliente?.cpf_cnpj || cliente?.cnpj || cliente?.cpf || '';
  const tipoDocumento = identificarTipoDocumento(documento);

  const handleEmitir = async () => {
    const dadosEmissao = {
      dbfatura: fatura,
      dbclien: cliente,
      dbitvenda: produtos,
      dbvenda: venda,
      emitente: emitente
    };

    const resultado = await emitirDocumentoFiscal(dadosEmissao);

    if (resultado.sucesso) {
      onSucesso?.(resultado);
    } else {
      onErro?.(resultado.erro || 'Erro ao emitir documento');
    }
  };

  const getBadgeColor = () => {
    if (tipoDocumento === 'CPF') return 'bg-blue-500';
    if (tipoDocumento === 'CNPJ') return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getTipoEmissao = () => {
    if (tipoDocumento === 'CPF') return 'NFC-e (Cupom Fiscal)';
    if (tipoDocumento === 'CNPJ') return 'NF-e (Nota Fiscal)';
    return 'Não identificado';
  };

  return (
    <div className="space-y-4">
      {/* Informações do documento */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Tipo de Emissão</p>
            <p className="font-semibold">{getTipoEmissao()}</p>
          </div>
          <span className={`${getBadgeColor()} text-white px-3 py-1 rounded-full text-sm`}>
            {tipoDocumento || 'N/A'}
          </span>
        </div>
        
        {tipoDocumento && (
          <div className="mt-2 text-xs text-gray-500">
            <p>Documento: {documento}</p>
            <p>Modelo: {tipoDocumento === 'CPF' ? '65 (NFC-e)' : '55 (NF-e)'}</p>
          </div>
        )}
      </div>

      {/* Botão de emissão */}
      <button
        onClick={handleEmitir}
        disabled={carregando || !tipoDocumento}
        className={`
          w-full px-6 py-3 rounded-lg font-semibold text-white
          ${carregando 
            ? 'bg-gray-400 cursor-not-allowed' 
            : tipoDocumento === 'CPF'
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-green-600 hover:bg-green-700'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
        `}
      >
        {carregando ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Emitindo...
          </span>
        ) : (
          `Emitir ${getTipoEmissao()}`
        )}
      </button>

      {/* Erro */}
      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-semibold">Erro ao emitir documento</p>
          <p className="text-sm">{erro}</p>
        </div>
      )}

      {/* Sucesso */}
      {resultado?.sucesso && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">✅ Documento emitido com sucesso!</p>
              <p className="text-sm mt-1">
                {resultado.descricao} - Modelo {resultado.modelo}
              </p>
            </div>
            <button
              onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
              className="text-sm underline"
            >
              {mostrarDetalhes ? 'Ocultar' : 'Ver detalhes'}
            </button>
          </div>

          {mostrarDetalhes && (
            <div className="mt-3 text-xs space-y-1 bg-white p-3 rounded">
              <p><strong>Status:</strong> {resultado.status}</p>
              <p><strong>Motivo:</strong> {resultado.motivo}</p>
              <p><strong>Protocolo:</strong> {resultado.protocolo}</p>
              <p><strong>Chave de Acesso:</strong> {resultado.chaveAcesso}</p>
              
              {resultado.pdfBase64 && (
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `data:application/pdf;base64,${resultado.pdfBase64}`;
                    link.download = `${resultado.tipoEmissao}_${resultado.chaveAcesso}.pdf`;
                    link.click();
                  }}
                  className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                 <FaFilePdf /> Baixar PDF
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Informação adicional */}
      {!tipoDocumento && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded text-sm">
          ⚠️ Documento do cliente não identificado. Verifique se o CPF ou CNPJ está correto.
        </div>
      )}
    </div>
  );
}
