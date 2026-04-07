import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import type { BoletoGerado } from '@/lib/boleto/calculoBoleto';
import BoletoVisualizador from './BoletoVisualizador';

interface GerarBoletoButtonProps {
  codfat: string;
  valor?: number;
  vencimento?: string; // formato: YYYY-MM-DD
  banco?: '0' | '1' | '2';
  descricao?: string;
  onSucesso?: (boleto: BoletoGerado) => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Botão para gerar boleto bancário
 * Usa a lógica legada do sistema Delphi
 */
export function GerarBoletoButton({
  codfat,
  valor,
  vencimento,
  banco,
  descricao,
  onSucesso,
  className = '',
  children,
}: GerarBoletoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [boleto, setBoleto] = useState<BoletoGerado | null>(null);
  const [mostrarBoleto, setMostrarBoleto] = useState(false);

  const gerarBoleto = async () => {
    setLoading(true);
    
    try {
      console.log('🎫 Gerando boleto para fatura:', codfat);
      
      const response = await axios.post('/api/boleto/gerar-legado', {
        codfat,
        valor,
        vencimento,
        banco,
        descricao,
      });

      if (response.data.sucesso && response.data.boleto) {
        const boletoGerado = response.data.boleto;
        setBoleto(boletoGerado);
        setMostrarBoleto(true);
        
        toast.success('Boleto gerado com sucesso!', {
          description: `Nosso Número: ${boletoGerado.nossoNumero}`,
        });
        
        if (onSucesso) {
          onSucesso(boletoGerado);
        }
      } else {
        throw new Error(response.data.erro || 'Erro desconhecido ao gerar boleto');
      }
    } catch (error: any) {
      console.error('Erro ao gerar boleto:', error);
      
      const mensagemErro = error.response?.data?.erro || error.message || 'Erro ao gerar boleto';
      
      toast.error('Erro ao gerar boleto', {
        description: mensagemErro,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFecharBoleto = () => {
    setMostrarBoleto(false);
  };

  return (
    <>
      <button
        onClick={gerarBoleto}
        disabled={loading}
        className={`
          inline-flex items-center justify-center
          px-4 py-2 rounded-lg font-medium
          transition-all duration-200
          ${loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700 active:scale-95'
          }
          text-white shadow-md hover:shadow-lg
          ${className}
        `}
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Gerando...
          </>
        ) : (
          <>
            {children || (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gerar Boleto
              </>
            )}
          </>
        )}
      </button>

      {/* Modal para exibir boleto */}
      {mostrarBoleto && boleto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Boleto Bancário - Fatura {codfat}
              </h2>
              <button
                onClick={handleFecharBoleto}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <BoletoVisualizador 
                boleto={boleto}
                dadosEmpresa={{
                  nome: process.env.NEXT_PUBLIC_NOME_EMPRESA || 'SUA EMPRESA LTDA',
                  endereco: process.env.NEXT_PUBLIC_ENDERECO_EMPRESA || '',
                  cidade: process.env.NEXT_PUBLIC_CIDADE_EMPRESA || '',
                  cnpj: process.env.NEXT_PUBLIC_CNPJ_EMPRESA || '',
                }}
              />
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <strong>Linha Digitável:</strong>
                <div className="font-mono text-xs mt-1 break-all">
                  {boleto.linhaDigitavel}
                </div>
              </div>
              <button
                onClick={handleFecharBoleto}
                className="ml-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
/*
<GerarBoletoButton
  codfat="000002828"
  valor={1500.00}
  vencimento="2025-01-30"
  onSucesso={(boleto) => {
    console.log('Boleto gerado:', boleto);
  }}
  onErro={(erro) => {
    alert(`Erro: ${erro}`);
  }}
/>
*/
