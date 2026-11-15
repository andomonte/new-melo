import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { PromocaoComItensFixos } from '@/data/promocoes/promocoes';

interface ModalVerItensPromocaoProps {
  isOpen: boolean;
  onClose: () => void;
  promocao: PromocaoComItensFixos | null;
}

const ModalVerItensPromocao: React.FC<ModalVerItensPromocaoProps> = ({
  isOpen,
  onClose,
  promocao,
}) => {
  // Referência copiada por último (o ícone vira "check" por um instante).
  const [copiada, setCopiada] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copiarReferencia = async (ref: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ref);
      } else {
        // fallback p/ navegador sem Clipboard API (página em http)
        const ta = document.createElement('textarea');
        ta.value = ref;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiada(ref);
      toast.success(`Referência ${ref} copiada.`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiada(null), 1500);
    } catch {
      toast.error('Não foi possível copiar a referência.');
    }
  };

  if (!isOpen || !promocao) return null;

  const itens = promocao.itens_promocao || [];

  // Helpers (compatíveis com variações de payload)
  const getCod = (i: any) =>
    i?.codigo ?? i?.codprod ?? i?.produto?.codprod ?? '-';

  const getPrecoNumber = (i: any) => {
    const p = i?.prvenda ?? i?.preco ?? 0;
    const n = typeof p === 'number' ? p : Number(p);
    return Number.isFinite(n) ? n : 0;
  };

  // Key SEMPRE única (mesmo com id_promocao_item repetido)
  const rowKey = (i: any, idx: number) =>
    `${i?.id_promocao_item ?? 'noid'}-${i?.codigo ?? 'nocod'}-${idx}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-[100vw] h-[96vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col p-4">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Produtos Adicionados
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-grow overflow-hidden mt-4">
          {itens.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-300 py-10">
              <p>Nenhum item associado a esta promoção.</p>
            </div>
          ) : (
            <div className="overflow-x-auto h-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      REFERÊNCIA
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      PRODUTO
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      DESCONTO
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      QUANTIDADE
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      QTD. MÍNIMA
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      QTD. MÁXIMA
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                  {itens.map((item, index) => (
                    <tr
                      key={rowKey(item, index)}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        {item.ref ? (
                          <button
                            type="button"
                            onClick={() => copiarReferencia(String(item.ref))}
                            title="Copiar referência"
                            className="group inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-base font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
                          >
                            <span className="select-all">{item.ref}</span>
                            {copiada === String(item.ref) ? (
                              <Check size={16} className="text-green-600 dark:text-green-400" />
                            ) : (
                              <Copy size={16} className="opacity-60 group-hover:opacity-100" />
                            )}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              item.origem === 'N'
                                ? '/images/brasil.png'
                                : '/images/importado.png'
                            }
                            alt="origem"
                            className="w-5 h-[14px] object-contain"
                          />

                          <div className="flex flex-col text-left">
                            <span className="text-gray-800 dark:text-gray-100 font-semibold text-sm">
                              {item.descricao || '-'}
                            </span>
                            <span className="text-gray-600 dark:text-gray-300 text-xs">
                              COD: {getCod(item)} | Estoque:{' '}
                              {item.qtddisponivel ?? '-'} | Marca:{' '}
                              {item.marca || '-'} | R${' '}
                              {getPrecoNumber(item)
                                .toFixed(2)
                                .replace('.', ',')}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                        {item.valor_desconto_item != null
                          ? item.tipo_desconto_item === 'PERC'
                            ? `${item.valor_desconto_item}%`
                            : `R$ ${Number(item.valor_desconto_item)
                                .toFixed(2)
                                .replace('.', ',')}`
                          : '-'}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                        {item.qtd_total_item ?? '-'}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                        {item.qtde_minima_item ?? '-'}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-200">
                        {item.qtde_maxima_item ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalVerItensPromocao;
