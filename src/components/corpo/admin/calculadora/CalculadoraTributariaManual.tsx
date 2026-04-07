// src/components/corpo/admin/calculadora/CalculadoraTributariaManual.tsx
/**
 * Tela de Calculadora Tributária Manual
 * Permite calcular impostos informando todos os dados manualmente
 */

import React, { useState } from 'react';
import { Calculator, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface ImpostoCalculado {
  tipo: string;
  aliquota: number;
  base: number;
  valor: number;
}

interface ResultadoCalculo {
  sucesso: boolean;
  produto: {
    descricao: string;
    ncm: string;
    cest?: string;
  };
  operacao: {
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    ufOrigem: string;
    ufDestino: string;
  };
  impostos: ImpostoCalculado[];
  totalImpostos: number;
  valorTotalComImpostos: number;
  erro?: string;
}

export default function CalculadoraTributariaManual() {
  const [formData, setFormData] = useState({
    descricaoProduto: '',
    ncm: '',
    cest: '',
    quantidade: '1',
    valorUnitario: '',
    ufOrigem: 'AM',
    ufDestino: 'AM',
    tipoOperacao: 'venda',
    finalidade: 'consumo',
    regimeTributario: 'simples_nacional',
  });

  const [isCalculando, setIsCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpar resultado ao mudar os campos
    if (resultado) {
      setResultado(null);
    }
    if (erro) {
      setErro(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCalculando(true);
    setErro(null);
    setResultado(null);

    try {
      const response = await fetch('/api/impostos/calculadora-governo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ncm: formData.ncm,
          cest: formData.cest || undefined,
          quantidade: parseFloat(formData.quantidade),
          valorUnitario: parseFloat(formData.valorUnitario),
          descricaoProduto: formData.descricaoProduto,
          ufOrigem: formData.ufOrigem,
          ufDestino: formData.ufDestino,
          tipoOperacao: formData.tipoOperacao,
          finalidade: formData.finalidade,
          regimeTributario: formData.regimeTributario,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao calcular impostos');
      }

      if (!data.sucesso) {
        throw new Error(data.erro || 'Erro ao calcular impostos');
      }

      setResultado(data);
    } catch (error) {
      const mensagemErro = error instanceof Error ? error.message : 'Erro desconhecido';
      setErro(mensagemErro);
      console.error('Erro ao calcular impostos:', error);
    } finally {
      setIsCalculando(false);
    }
  };

  const handleLimpar = () => {
    setFormData({
      descricaoProduto: '',
      ncm: '',
      cest: '',
      quantidade: '1',
      valorUnitario: '',
      ufOrigem: 'AM',
      ufDestino: 'AM',
      tipoOperacao: 'venda',
      finalidade: 'consumo',
      regimeTributario: 'simples_nacional',
    });
    setResultado(null);
    setErro(null);
  };

  const valorTotal = parseFloat(formData.quantidade || '0') * parseFloat(formData.valorUnitario || '0');
  const percentualImpostos = resultado ? (resultado.totalImpostos / resultado.operacao.valorTotal) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">
              Calculadora Tributária - Governo Federal
            </h1>
          </div>
          <p className="text-gray-600">
            Calcule impostos (IBS, CBS, ICMS, PIS, COFINS) usando a API oficial do governo
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Dados para Cálculo
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Descrição do Produto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição do Produto (opcional)
                </label>
                <input
                  type="text"
                  name="descricaoProduto"
                  value={formData.descricaoProduto}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Notebook Dell Inspiron"
                />
              </div>

              {/* NCM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NCM <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ncm"
                  value={formData.ncm}
                  onChange={handleChange}
                  required
                  maxLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="8 dígitos - Ex: 84714900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Código NCM do produto (8 dígitos)
                </p>
              </div>

              {/* CEST */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEST (opcional)
                </label>
                <input
                  type="text"
                  name="cest"
                  value={formData.cest}
                  onChange={handleChange}
                  maxLength={7}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 0100100"
                />
              </div>

              {/* Quantidade e Valor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantidade"
                    value={formData.quantidade}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Unitário (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="valorUnitario"
                    value={formData.valorUnitario}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Valor Total (readonly) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Total
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-lg font-semibold text-gray-800">
                  R$ {valorTotal.toFixed(2)}
                </div>
              </div>

              {/* UFs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UF Origem <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="ufOrigem"
                    value={formData.ufOrigem}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {UFS.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UF Destino <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="ufDestino"
                    value={formData.ufDestino}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {UFS.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tipo de Operação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Operação
                </label>
                <select
                  name="tipoOperacao"
                  value={formData.tipoOperacao}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="venda">Venda</option>
                  <option value="importacao">Importação</option>
                  <option value="industrializacao">Industrialização</option>
                </select>
              </div>

              {/* Finalidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Finalidade
                </label>
                <select
                  name="finalidade"
                  value={formData.finalidade}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="consumo">Consumo</option>
                  <option value="revenda">Revenda</option>
                  <option value="industrializacao">Industrialização</option>
                </select>
              </div>

              {/* Regime Tributário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Regime Tributário
                </label>
                <select
                  name="regimeTributario"
                  value={formData.regimeTributario}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="simples_nacional">Simples Nacional</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                </select>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isCalculando || !formData.ncm || !formData.valorUnitario}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {isCalculando ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Calcular Impostos
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLimpar}
                  disabled={isCalculando}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
                >
                  Limpar
                </button>
              </div>
            </form>
          </div>

          {/* Resultado */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Resultado do Cálculo
            </h2>

            {!resultado && !erro && !isCalculando && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Calculator className="w-16 h-16 mb-3" />
                <p>Preencha os dados e clique em "Calcular Impostos"</p>
              </div>
            )}

            {isCalculando && (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3" />
                <p className="text-gray-600">Calculando impostos...</p>
              </div>
            )}

            {erro && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-medium">Erro ao calcular impostos</p>
                  <p className="text-red-600 text-sm mt-1">{erro}</p>
                </div>
              </div>
            )}

            {resultado && (
              <div className="space-y-4">
                {/* Resumo */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-800 font-medium">
                      Impostos calculados com sucesso!
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded">
                        <span className="text-sm text-gray-600">Valor do Produto</span>
                        <p className="text-xl font-bold text-gray-800">
                          R$ {resultado.operacao.valorTotal.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <span className="text-sm text-gray-600">Total de Impostos</span>
                        <p className="text-xl font-bold text-orange-600">
                          R$ {resultado.totalImpostos.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600">
                          ({percentualImpostos.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <span className="text-sm text-gray-600">Valor Final (Com Impostos)</span>
                      <p className="text-2xl font-bold text-blue-700">
                        R$ {resultado.valorTotalComImpostos.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detalhamento */}
                {resultado.impostos.length > 0 && (
                  <div>
                    <button
                      onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-3"
                    >
                      {mostrarDetalhes ? '▼' : '▶'} Detalhamento dos Impostos
                    </button>

                    {mostrarDetalhes && (
                      <div className="space-y-2">
                        {resultado.impostos.map((imposto, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                          >
                            <div>
                              <p className="font-medium text-gray-800">
                                {imposto.tipo}
                              </p>
                              <p className="text-sm text-gray-600">
                                Alíquota: {imposto.aliquota.toFixed(4)}%
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-800">
                                R$ {imposto.valor.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-600">
                                Base: R$ {imposto.base.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Informações adicionais */}
                <div className="text-xs text-gray-500 border-t pt-3 space-y-1">
                  <p><strong>Produto:</strong> {resultado.produto.descricao}</p>
                  <p><strong>NCM:</strong> {resultado.produto.ncm}</p>
                  {resultado.produto.cest && (
                    <p><strong>CEST:</strong> {resultado.produto.cest}</p>
                  )}
                  <p>
                    <strong>Rota:</strong> {resultado.operacao.ufOrigem} → {resultado.operacao.ufDestino}
                  </p>
                  <p>
                    <strong>Quantidade:</strong> {resultado.operacao.quantidade} x R$ {resultado.operacao.valorUnitario.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
