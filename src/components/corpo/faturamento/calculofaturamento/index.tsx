import React, { useState, useEffect, ChangeEvent } from 'react';
import { DefaultButton } from '@/components/common/Buttons';
import DataTable from '@/components/common/DataTable';
import { Meta } from '@/data/common/meta';

interface ProdutoFaturamento {
  codProduto: string;
  descricao: string;
  referencia: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
}

export default function TelaCalculoProdutos() {
  const [produtos, setProdutos] = useState<ProdutoFaturamento[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoFaturamento | null>(null);
  const [meta, setMeta] = useState<Meta>({ currentPage: 1, lastPage: 1, perPage: 10, total: 1 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    // TODO: buscar produtos da venda atual (mock por enquanto)
    const produtosMock = [
      {
        codProduto: '200305',
        descricao: 'KIT TRANS MOTO YS250 FAZER 250 428HX132L/15X45Z AC',
        referencia: '21076',
        unidade: 'KT',
        quantidade: 1,
        precoUnitario: 58.0,
      },
    ];
    setProdutos(produtosMock);
    setMeta({ currentPage: 1, lastPage: 1, perPage: 10, total: produtosMock.length });
  }, []);

  const totalItem =
    produtoSelecionado?.quantidade && produtoSelecionado?.precoUnitario
      ? produtoSelecionado.quantidade * produtoSelecionado.precoUnitario
      : 0;

  const headers = ['Código', 'Descrição', 'Qtd', 'R$ Unit.', 'Ações'];
  const rows = produtos.map((p) => ({
    Código: p.codProduto,
    Descrição: p.descricao,
    Qtd: p.quantidade,
    'R$ Unit.': `R$ ${p.precoUnitario.toFixed(2)}`,
    Ações: (
      <button
        onClick={() => setProdutoSelecionado(p)}
        className="text-blue-400 hover:underline"
      >
        Calcular
      </button>
    ),
  }));

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-white">Cálculo dos Faturamentos</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-800 p-4 rounded-md">
          <DataTable
            headers={headers}
            rows={rows}
            meta={meta}
            onPageChange={(page) => setMeta((prev: any) => ({ ...prev, currentPage: page }))}
            onPerPageChange={(perPage) => setMeta((prev: any) => ({ ...prev, perPage }))}
            onSearch={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>

        <div className="bg-zinc-800 p-4 rounded-md">
          <h2 className="text-white font-semibold mb-2">Cálculo do Produto</h2>
          {produtoSelecionado ? (
            <div className="space-y-2 text-white text-sm">
              <p><strong>Produto:</strong> {produtoSelecionado.descricao}</p>
              <p><strong>Qtd:</strong> {produtoSelecionado.quantidade}</p>
              <p><strong>Valor Unitário:</strong> R$ {produtoSelecionado.precoUnitario.toFixed(2)}</p>
              <p><strong>Total:</strong> R$ {totalItem.toFixed(2)}</p>
              <p><strong>CFOP:</strong> 5405</p>
              <p><strong>Base IPI:</strong> 0.00</p>
              <p><strong>ICMS:</strong> 0.00</p>
              <p><strong>MVA:</strong> 0.00</p>
            </div>
          ) : (
            <p className="text-zinc-400">Selecione um produto para calcular.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-4">
        <DefaultButton text="Abandonar" variant="cancel" onClick={() => console.log('Abandonar')} />
        <DefaultButton text="Continuar" variant="confirm" onClick={() => console.log('Próxima etapa')} />
      </div>
    </div>
  );
}
