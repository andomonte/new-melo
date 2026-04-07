import React, { useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import type { BoletoGerado } from '@/lib/boleto/calculoBoleto';

interface BoletoVisualizadorProps {
  boleto: BoletoGerado;
  dadosEmpresa?: {
    nome: string;
    endereco: string;
    cidade: string;
    cnpj: string;
  };
}

/**
 * Componente para visualizar e imprimir boleto bancário
 * Baseado no layout padrão FEBRABAN
 */
export default function BoletoVisualizador({ boleto, dadosEmpresa }: BoletoVisualizadorProps) {
  const codigoBarrasRef = useRef<SVGSVGElement>(null);
  
  // Gerar código de barras quando o componente montar
  useEffect(() => {
    if (codigoBarrasRef.current && boleto.codigoBarras) {
      try {
        JsBarcode(codigoBarrasRef.current, boleto.codigoBarras, {
          format: 'ITF',
          width: 2,
          height: 50,
          displayValue: false,
        });
      } catch (error) {
        console.error('Erro ao gerar código de barras:', error);
      }
    }
  }, [boleto.codigoBarras]);
  
  // Formatar valores
  const formatarMoeda = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };
  
  const formatarData = (data: Date): string => {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
  };
  
  const dados = boleto.dadosOriginais;
  const nomeBanco = dados.banco === '0' ? 'Bradesco' : 
                    dados.banco === '1' ? 'Banco do Brasil' : 'Itaú';
  const codigoBanco = dados.banco === '0' ? '237' : 
                       dados.banco === '1' ? '001' : '341';
  
  // Handler para imprimir
  const handleImprimir = () => {
    window.print();
  };
  
  return (
    <div className="boleto-container">
      {/* Botão de impressão (não aparece na impressão) */}
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={handleImprimir}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
        >
          🖨️ Imprimir Boleto
        </button>
      </div>
      
      <div className="boleto-page bg-white p-4 mx-auto" style={{ maxWidth: '800px' }}>
        {/* ========== FICHA DE COMPENSAÇÃO ========== */}
        <div className="border-2 border-black">
          
          {/* Cabeçalho do banco */}
          <div className="flex items-center border-b-2 border-dashed border-black p-2">
            <div className="text-2xl font-bold w-32">{codigoBanco}-9</div>
            <div className="border-l-2 border-black h-8 mx-2"></div>
            <div className="flex-1 text-right font-bold text-lg">
              {nomeBanco}
            </div>
          </div>
          
          {/* Linha digitável */}
          <div className="bg-gray-100 p-3 border-b-2 border-dashed border-black">
            <div className="text-xs text-gray-600 mb-1">Linha Digitável</div>
            <div className="text-lg font-mono font-bold tracking-wider">
              {boleto.linhaDigitavel}
            </div>
          </div>
          
          {/* Dados do boleto */}
          <div className="grid grid-cols-3 border-b border-gray-300">
            <div className="col-span-2 border-r border-gray-300 p-2">
              <div className="text-xs text-gray-600">Local de Pagamento</div>
              <div className="text-sm font-semibold">PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO</div>
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-600">Vencimento</div>
              <div className="text-sm font-bold">{formatarData(dados.dtVencimento)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 border-b border-gray-300">
            <div className="col-span-2 border-r border-gray-300 p-2">
              <div className="text-xs text-gray-600">Cedente</div>
              <div className="text-sm font-semibold">
                {dadosEmpresa?.nome || 'SUA EMPRESA LTDA'}
              </div>
              <div className="text-xs text-gray-500">
                CNPJ: {dadosEmpresa?.cnpj || '00.000.000/0000-00'}
              </div>
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-600">Agência/Código Cedente</div>
              <div className="text-sm font-mono">
                {dados.agencia} / {dados.nroConta}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-6 border-b border-gray-300">
            <div className="p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Data Documento</div>
              <div className="text-sm">{formatarData(dados.dtEmissao)}</div>
            </div>
            <div className="col-span-2 p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Número do Documento</div>
              <div className="text-sm font-mono">{dados.nroDoc}</div>
            </div>
            <div className="p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Espécie Doc</div>
              <div className="text-sm">DM</div>
            </div>
            <div className="p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Aceite</div>
              <div className="text-sm">N</div>
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-600">Data Processamento</div>
              <div className="text-sm">{formatarData(dados.dtEmissao)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-6 border-b border-gray-300">
            <div className="col-span-2 p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Uso do Banco</div>
              <div className="text-sm">&nbsp;</div>
            </div>
            <div className="p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Carteira</div>
              <div className="text-sm">{dados.carteira || '09'}</div>
            </div>
            <div className="p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Espécie</div>
              <div className="text-sm">R$</div>
            </div>
            <div className="p-2 border-r border-gray-300">
              <div className="text-xs text-gray-600">Quantidade</div>
              <div className="text-sm">&nbsp;</div>
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-600">Valor Documento</div>
              <div className="text-sm font-bold">{formatarMoeda(dados.valor)}</div>
            </div>
          </div>
          
          {/* Instruções */}
          <div className="grid grid-cols-3 border-b border-gray-300">
            <div className="col-span-2 border-r border-gray-300 p-2">
              <div className="text-xs text-gray-600 mb-1">Instruções (Texto de responsabilidade do Cedente)</div>
              <div className="text-xs space-y-1">
                {dados.instrucoes?.map((instrucao, index) => (
                  <div key={index}>• {instrucao}</div>
                )) || (
                  <>
                    <div>• Não receber após o vencimento</div>
                    <div>• Após vencimento cobrar multa de 2%</div>
                    <div>• Após vencimento cobrar juros de 0,067% ao dia</div>
                  </>
                )}
              </div>
            </div>
            <div className="p-2 space-y-2">
              <div>
                <div className="text-xs text-gray-600">(-) Desconto/Abatimento</div>
                <div className="text-sm">&nbsp;</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">(+) Mora/Multa</div>
                <div className="text-sm">{formatarMoeda(boleto.valorMora)}/dia</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">(=) Valor Cobrado</div>
                <div className="text-sm font-bold">&nbsp;</div>
              </div>
            </div>
          </div>
          
          {/* Dados do sacado */}
          <div className="p-2 border-b border-gray-300">
            <div className="text-xs text-gray-600 mb-1">Sacado</div>
            <div className="text-sm font-semibold">{dados.nomeCli}</div>
            <div className="text-xs text-gray-600">
              CPF/CNPJ: {dados.cpfCnpj || 'Não informado'}
            </div>
            <div className="text-xs mt-1">
              {dados.endereco && `${dados.endereco}, `}
              {dados.bairro && `${dados.bairro} - `}
              {dados.cidade}/{dados.uf}
              {dados.cep && ` - CEP: ${dados.cep}`}
            </div>
          </div>
          
          {/* Sacador/Avalista */}
          <div className="p-2 border-b-2 border-black">
            <div className="text-xs text-gray-600">Sacador/Avalista</div>
            <div className="text-sm">&nbsp;</div>
          </div>
          
          {/* Código de barras */}
          <div className="p-4 bg-white">
            <div className="text-xs text-gray-600 text-center mb-2">Código de Barras</div>
            <div className="flex justify-center">
              <svg ref={codigoBarrasRef}></svg>
            </div>
          </div>
          
        </div>
        
        {/* Linha pontilhada de corte */}
        <div className="border-t-2 border-dashed border-gray-400 my-4"></div>
        
        {/* ========== RECIBO DO SACADO ========== */}
        <div className="border-2 border-black p-4">
          <div className="text-sm font-bold mb-2">RECIBO DO SACADO</div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-600">Nosso Número</div>
              <div className="text-sm font-mono font-bold">{boleto.nossoNumero}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Vencimento</div>
              <div className="text-sm font-bold">{formatarData(dados.dtVencimento)}</div>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-xs text-gray-600">Valor do Documento</div>
            <div className="text-lg font-bold">{formatarMoeda(dados.valor)}</div>
          </div>
          
          <div className="mb-2">
            <div className="text-xs text-gray-600">Sacado</div>
            <div className="text-sm font-semibold">{dados.nomeCli}</div>
            <div className="text-xs">{dados.endereco}, {dados.cidade}/{dados.uf}</div>
          </div>
          
          <div className="text-xs text-gray-500 mt-4">
            <strong>Autenticação Mecânica</strong> - Este recibo deverá ser entregue ao sacado após a quitação do boleto.
          </div>
        </div>
      </div>
      
      {/* Estilos para impressão */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .boleto-page, .boleto-page * {
            visibility: visible;
          }
          .boleto-page {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            padding: 10mm;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
