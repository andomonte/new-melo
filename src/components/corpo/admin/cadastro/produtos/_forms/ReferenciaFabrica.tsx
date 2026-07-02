import React, { useState, useEffect } from 'react';
import { Produto } from '@/data/produtos/produtos';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';

export interface ReferenciaItem {
  id?: string;
  cod_id?: number;
  referencia: string;
  codmarca?: string;
  codcredor?: string;
  marca_nome?: string;
}

interface ReferenciaFabricaProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

const ReferenciaFabrica: React.FC<ReferenciaFabricaProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  const [referencias, setReferencias] = useState<ReferenciaItem[]>([]);
  const [novaReferencia, setNovaReferencia] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Carregar referências do banco ao editar produto existente
  useEffect(() => {
    if (produto.codprod && produto.codprod !== '') {
      setCarregando(true);
      fetch(`/api/produtos/ref-fabrica?codprod=${produto.codprod}`)
        .then((r) => r.ok ? r.json() : { referencias: [] })
        .then((data) => {
          const refs = (data.referencias || []).map((r: any) => ({
            cod_id: r.cod_id,
            referencia: r.referencia || '',
            codmarca: r.codmarca || '',
            codcredor: r.codcredor || '',
            marca_nome: r.marca_nome || r.codmarca || '',
          }));
          setReferencias(refs);
          // Sincroniza com o produto pai
          handleProdutoChange({ ...produto, referenciasFabrica: refs });
        })
        .catch(() => setReferencias([]))
        .finally(() => setCarregando(false));
    } else {
      // Novo produto — usa as referências que já estão no produto (se houver)
      setReferencias(produto.referenciasFabrica || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto.codprod]);

  const adicionarReferencia = () => {
    if (!novaReferencia.trim()) return;

    const novaRef: ReferenciaItem = {
      id: Date.now().toString(),
      referencia: novaReferencia.toUpperCase().trim(),
      codmarca: produto.codmarca || '',
      codcredor: '',
    };

    const novasRefs = [...referencias, novaRef];
    setReferencias(novasRefs);
    handleProdutoChange({ ...produto, referenciasFabrica: novasRefs });
    setNovaReferencia('');
  };

  const removerReferencia = (index: number) => {
    const novasRefs = referencias.filter((_, i) => i !== index);
    setReferencias(novasRefs);
    handleProdutoChange({ ...produto, referenciasFabrica: novasRefs });
  };

  return (
    <div className="form-compact space-y-4">
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2 border-b pb-2">
        Referências de Fábrica
      </h3>

      {/* Campos para adicionar nova referência */}
      <div className="grid grid-cols-4 gap-3 items-end">
        <div className="col-span-3">
          <Label>Referência</Label>
          <Input
            type="text"
            placeholder="Digite a referência de fábrica"
            value={novaReferencia}
            onChange={(e) => setNovaReferencia(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionarReferencia();
              }
            }}
          />
        </div>
        <div>
          <button
            type="button"
            onClick={adicionarReferencia}
            disabled={!novaReferencia.trim()}
            className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-xs rounded transition-colors h-[30px]"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>
      </div>

      {error?.referencia && (
        <span className="text-red-500 text-xs">{error.referencia}</span>
      )}

      {/* Tabela de referências */}
      <div className="border border-gray-200 dark:border-zinc-700 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                Código
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                Referência
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                Marca
              </th>
              <th className="px-3 py-2 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase w-20">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
            {carregando ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  Carregando referências...
                </td>
              </tr>
            ) : referencias.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  Nenhuma referência cadastrada
                </td>
              </tr>
            ) : (
              referencias.map((ref, index) => (
                <tr key={ref.cod_id || ref.id || index} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                  <td className="px-3 py-2">{ref.cod_id ?? '-'}</td>
                  <td className="px-3 py-2">{ref.referencia}</td>
                  <td className="px-3 py-2">
                    {ref.codmarca
                      ? `${ref.codmarca}${ref.marca_nome ? ' - ' + ref.marca_nome : ''}`
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removerReferencia(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="Remover referência"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        {referencias.length} referência{referencias.length !== 1 ? 's' : ''} cadastrada{referencias.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default ReferenciaFabrica;
