import React, { useState } from 'react';
import { useParcelasPagamento, ParcelaPagamento, ParcelaInput } from '@/hooks/useParcelasPagamento';

interface Props {
  codvenda: string;
}

export default function GerenciadorParcelas({ codvenda }: Props) {
  const {
    parcelas,
    loading,
    error,
    salvarParcelas,
    atualizarParcela,
    removerParcelas,
  } = useParcelasPagamento(codvenda);

  const [novasParcelas, setNovasParcelas] = useState<ParcelaInput[]>([
    { dia: 30 },
    { dia: 60 },
    { dia: 90 },
  ]);

  const handleSalvarParcelas = async () => {
    await salvarParcelas(codvenda, novasParcelas);
  };

  const handleAtualizarParcela = async (id: number, novoDia: number) => {
    await atualizarParcela(id, novoDia);
  };

  const handleRemoverParcelas = async () => {
    if (window.confirm('Tem certeza que deseja remover todas as parcelas?')) {
      await removerParcelas(codvenda);
    }
  };

  const adicionarParcela = () => {
    setNovasParcelas([...novasParcelas, { dia: 30 }]);
  };

  const removerParcelaInput = (index: number) => {
    setNovasParcelas(novasParcelas.filter((_, i) => i !== index));
  };

  const atualizarParcelaInput = (index: number, dia: number) => {
    const updated = [...novasParcelas];
    updated[index] = { dia };
    setNovasParcelas(updated);
  };

  if (loading) {
    return <div>Carregando parcelas...</div>;
  }

  if (error) {
    return <div className="text-red-500">Erro: {error}</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Gerenciador de Parcelas - Venda {codvenda}</h2>

      {/* Parcelas Existentes */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Parcelas Existentes</h3>
        {parcelas.length === 0 ? (
          <p className="text-gray-500">Nenhuma parcela cadastrada</p>
        ) : (
          <div className="space-y-2">
            {parcelas.map((parcela) => (
              <div key={parcela.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">Parcela {parcela.id}</span>
                  <span className="ml-4 text-sm text-gray-600">
                    Vence em: {new Date(parcela.data).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm">Dias:</label>
                  <input
                    type="number"
                    min="0"
                    value={parcela.dia}
                    onChange={(e) => handleAtualizarParcela(parcela.id, parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar Novas Parcelas */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Adicionar Parcelas</h3>
        <div className="space-y-2">
          {novasParcelas.map((parcela, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span>Parcela {index + 1}:</span>
              <input
                type="number"
                min="0"
                value={parcela.dia}
                onChange={(e) => atualizarParcelaInput(index, parseInt(e.target.value) || 0)}
                placeholder="Dias para vencimento"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={() => removerParcelaInput(index)}
                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                disabled={novasParcelas.length === 1}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={adicionarParcela}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + Adicionar Parcela
        </button>
      </div>

      {/* Ações */}
      <div className="flex space-x-4">
        <button
          onClick={handleSalvarParcelas}
          className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Salvar Parcelas
        </button>
        {parcelas.length > 0 && (
          <button
            onClick={handleRemoverParcelas}
            className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Remover Todas
          </button>
        )}
      </div>

      {/* Informações */}
      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h4 className="font-semibold mb-2">Como funciona:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• As parcelas são salvas na tabela <code>dbprazo_pagamento</code></li>
          <li>• A data de vencimento é calculada automaticamente baseada nos dias</li>
          <li>• Ao alterar os dias, a data é recalculada automaticamente</li>
          <li>• As parcelas continuam sendo salvas também na tabela <code>dbreceb</code> (sistema antigo)</li>
        </ul>
      </div>
    </div>
  );
}