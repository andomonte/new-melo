import React, { useState, useEffect, useRef, useCallback } from 'react';
// MANTENHA APENAS ESTA IMPORTAÇÃO DA INTERFACE ItemPromocao
import { ItemPromocao } from '@/data/promocoes/promocoes';
import { Button } from '@/components/ui/button';
import { Minus, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// REMOVA O BLOCO DE CÓDIGO DA INTERFACE ItemPromocao DAQUI!
// Ele estava assim:
/*
interface ItemPromocao {
  codprod?: string;
  descricao?: string;
  qtddisponivel?: number;
  marca?: string;
  preco?: number;
  valor_desconto_item?: number | null; 
  tipo_desconto_item?: string;
  qtde_minima_item?: number | null;   
  qtde_maxima_item?: number | null;   
  qtd_total_item?: number | null;     
  origem?: string;
  // ... other properties you might have
}
*/

interface ModalViewPromocaoItemsEditavelProps {
  itens: ItemPromocao[];
  onClose: () => void;
  onConfirm: (itensAtualizados: ItemPromocao[]) => void;
}

const ModalViewPromocaoItemsEditavel: React.FC<
  ModalViewPromocaoItemsEditavelProps
> = ({ itens, onClose, onConfirm }) => {
  const [itensEditados, setItensEditados] = useState<ItemPromocao[]>([]);
  const [alterado, setAlterado] = useState(false);
  const descontoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const selecionarConteudo = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [selecionadosIniciais, setSelecionadosIniciais] = useState<string[]>(
    [],
  );

  useEffect(() => {
    const codigos = itens.map((item) => item.codprod ?? '').filter(Boolean);
    // Ensure numeric values are numbers, not Decimal objects if coming from backend
    setItensEditados(
      itens.map((item) => ({
        ...item,
        // Garanta que essas propriedades são realmente números no ItemPromocao original
        valor_desconto_item: Number(item.valor_desconto_item) || null,
        qtde_minima_item: Number(item.qtde_minima_item) || null,
        qtde_maxima_item: Number(item.qtde_maxima_item) || null,
        qtd_total_item: Number(item.qtd_total_item) || null,
      })),
    );
    setSelecionados(codigos);
    setSelecionadosIniciais(codigos);
  }, [itens]);

  useEffect(() => {
    const mudou =
      JSON.stringify(itensEditados) !==
      JSON.stringify(itens.map((item) => ({ ...item })));
    setAlterado(mudou);
  }, [itensEditados, itens]);

  const haMudanca = (novos: ItemPromocao[], sel: string[]): boolean => {
    const itensIguais =
      JSON.stringify(novos) ===
      JSON.stringify(itens.map((item) => ({ ...item })));
    const selecaoIgual =
      JSON.stringify(sel.sort()) ===
      JSON.stringify(selecionadosIniciais.sort());
    return !itensIguais || !selecaoIgual;
  };

  const handleCampoChange = useCallback(
    (
      index: number,
      campo: keyof ItemPromocao,
      valor: string | number | boolean,
      shouldFocus = false,
    ) => {
      setItensEditados((prev) => {
        const novos = [...prev];
        let valorProcessado: string | number | boolean | null = valor; // Adicionado 'null' ao tipo

        // Determine if the field is numeric and needs conversion
        const numericFields: Array<keyof ItemPromocao> = [
          'valor_desconto_item',
          'qtde_minima_item',
          'qtde_maxima_item',
          'qtd_total_item',
        ];

        if (numericFields.includes(campo)) {
          const numValue = Number(valor);
          valorProcessado = isNaN(numValue) ? null : numValue;
        }

        // Specific validation for qtde_maxima_item
        if (campo === 'qtde_maxima_item') {
          // Garanta que o item atual existe e qtd_total_item é um número ou 0
          const qtdTotal = Number(novos[index]?.qtd_total_item) || 0;
          const novoValorMax = Number(valorProcessado);
          if (novoValorMax > qtdTotal) {
            valorProcessado = qtdTotal;
          }
        }

        novos[index] = { ...novos[index], [campo]: valorProcessado };
        return novos;
      });
      setAlterado(true);

      if (shouldFocus && descontoRefs.current[index]) {
        descontoRefs.current[index]?.focus();
      }
    },
    [],
  );

  const handleIncremento = (
    index: number,
    campo: keyof ItemPromocao,
    passo: number = 1,
  ) => {
    const atual = Number(itensEditados[index]?.[campo]) || 0; // Adicionado optional chaining
    let novoValor = atual + passo;

    // Validação específica para qtde_maxima_item no incremento
    if (campo === 'qtde_maxima_item') {
      const qtdTotal = Number(itensEditados[index]?.qtd_total_item) || 0; // Adicionado optional chaining
      if (novoValor > qtdTotal) {
        novoValor = qtdTotal;
      }
    }
    handleCampoChange(index, campo, novoValor);
  };

  const handleDecremento = (
    index: number,
    campo: keyof ItemPromocao,
    passo: number = 1,
  ) => {
    const atual = Number(itensEditados[index]?.[campo]) || 0; // Adicionado optional chaining
    handleCampoChange(index, campo, Math.max(0, atual - passo));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-[100vw] h-[96vh] bg-white dark:bg-black rounded-lg shadow-xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <h2 className="text-xl font-bold">Produtos Adicionados</h2>
          <div className="flex items-center gap-2">
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!alterado}
              onClick={() =>
                onConfirm(
                  itensEditados.filter((item) =>
                    selecionados.includes(item.codprod ?? ''),
                  ),
                )
              }
            >
              Alterar Itens
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="ml-4"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Corpo com tabela */}
        <div className="flex-1 overflow-auto">
          <div className="max-h-full overflow-y-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-700 z-10">
                <tr>
                  <th className="p-2 text-left">AÇÕES</th>
                  <th className="p-2 text-left">PRODUTO</th>
                  <th className="p-2 text-center">DESCONTO</th>
                  <th className="p-2 text-center">QUANTIDADE</th>
                  <th className="p-2 text-center">QTD. MÍNIMA</th>
                  <th className="p-2 text-center">QTD. MÁXIMA</th>
                </tr>
              </thead>
              <tbody>
                {itensEditados.map((item, idx) => (
                  <tr
                    key={item.codprod || idx}
                    className="border-b border-gray-200 dark:border-zinc-600"
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(item.codprod ?? '')}
                        onChange={(e) => {
                          const cod = item.codprod ?? '';
                          setSelecionados((prev) => {
                            const novos = e.target.checked
                              ? [...prev, cod]
                              : prev.filter((id) => id !== cod);

                            setAlterado(haMudanca(itensEditados, novos));
                            return novos;
                          });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        <img
                          src={
                            item.origem === 'N'
                              ? '/images/brasil.png'
                              : '/images/importado.png'
                          }
                          alt="origem"
                          className="w-5 h-[28px] object-contain"
                        />
                        <div className="flex flex-col justify-center">
                          <span className="font-bold text-sm">
                            {item.descricao}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            COD: {item.codprod} | Estoque:{' '}
                            {item.qtddisponivel ?? '-'} | Marca:{' '}
                            {item.marca ?? '-'} | R$ {item.preco ?? '-'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* DESCONTO */}
                    <td className="p-2 text-center">
                      <div className="relative flex items-center justify-center h-8 w-40 mx-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-purple-50 dark:bg-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900"
                          onClick={() =>
                            handleDecremento(idx, 'valor_desconto_item')
                          }
                          title="Diminuir desconto"
                          disabled={Number(item.valor_desconto_item) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="text"
                          onFocus={selecionarConteudo}
                          value={item.valor_desconto_item ?? ''}
                          onChange={(e) =>
                            handleCampoChange(
                              idx,
                              'valor_desconto_item',
                              e.target.value,
                            )
                          }
                          className="w-full text-center pl-8 pr-16 [&::-webkit-inner-spin-button]:appearance-none appearance-none"
                          placeholder="0"
                          ref={(el) => {
                            descontoRefs.current[idx] = el;
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            handleIncremento(idx, 'valor_desconto_item')
                          }
                          title="Aumentar desconto"
                          className="absolute right-8 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-purple-50 dark:bg-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // 1) troca o tipo
                            handleCampoChange(
                              idx,
                              'tipo_desconto_item',
                              item.tipo_desconto_item === 'PERC'
                                ? 'VALO'
                                : 'PERC',
                            );

                            // 2) zera o valor do desconto do input ao lado
                            handleCampoChange(
                              idx,
                              'valor_desconto_item',
                              0,
                              true,
                            );
                          }}
                          title={`Mudar para desconto em ${
                            item.tipo_desconto_item === 'PERC'
                              ? 'Reais (R$)'
                              : 'Porcentagem (%)'
                          }`}
                          className="h-6 w-8 text-[10px] flex items-center justify-center border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 absolute right-0 top-1/2 -translate-y-1/2 mr-1"
                        >
                          {item.tipo_desconto_item === 'PERC' ? '%' : 'R$'}
                        </Button>
                      </div>
                    </td>

                    {/* QUANTIDADE (qtd_total_item) */}
                    <td className="p-2 text-center">
                      <div className="relative flex items-center justify-center h-8 w-32 mx-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-blue-50 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900"
                          onClick={() =>
                            handleDecremento(idx, 'qtd_total_item')
                          }
                          title="Diminuir quantidade"
                          disabled={Number(item.qtd_total_item) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="text"
                          onFocus={selecionarConteudo}
                          value={item.qtd_total_item ?? ''}
                          onChange={(e) =>
                            handleCampoChange(
                              idx,
                              'qtd_total_item',
                              e.target.value,
                            )
                          }
                          className="w-full text-center pl-8 pr-8 [&::-webkit-inner-spin-button]:appearance-none appearance-none"
                          placeholder="0"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-blue-50 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900"
                          onClick={() =>
                            handleIncremento(idx, 'qtd_total_item')
                          }
                          title="Aumentar quantidade"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>

                    {/* QTD MÍNIMA */}
                    <td className="p-2 text-center">
                      <div className="relative flex items-center justify-center h-8 w-32 mx-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-green-50 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-900"
                          onClick={() =>
                            handleDecremento(idx, 'qtde_minima_item')
                          }
                          title="Diminuir quantidade mínima"
                          disabled={Number(item.qtde_minima_item) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="text"
                          onFocus={selecionarConteudo}
                          value={item.qtde_minima_item ?? ''}
                          onChange={(e) =>
                            handleCampoChange(
                              idx,
                              'qtde_minima_item',
                              e.target.value,
                            )
                          }
                          className="w-full text-center pl-8 pr-8 [&::-webkit-inner-spin-button]:appearance-none appearance-none"
                          placeholder="0"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-green-50 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-900"
                          onClick={() =>
                            handleIncremento(idx, 'qtde_minima_item')
                          }
                          title="Aumentar quantidade mínima"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>

                    {/* QTD MÁXIMA */}
                    <td className="p-2 text-center">
                      <div className="relative flex items-center justify-center h-8 w-32 mx-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute left-0 top-1/2 -translate-y-1/2 ml-1 p-0 h-6 w-6 bg-red-50 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-900"
                          onClick={() =>
                            handleDecremento(idx, 'qtde_maxima_item')
                          }
                          title="Diminuir quantidade máxima"
                          disabled={Number(item.qtde_maxima_item) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="text"
                          onFocus={selecionarConteudo}
                          value={item.qtde_maxima_item ?? ''}
                          onChange={(e) =>
                            handleCampoChange(
                              idx,
                              'qtde_maxima_item',
                              e.target.value,
                            )
                          }
                          className="w-full text-center pl-8 pr-8 [&::-webkit-inner-spin-button]:appearance-none appearance-none"
                          placeholder="0"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-0 h-6 w-6 bg-red-50 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-900"
                          onClick={() =>
                            handleIncremento(idx, 'qtde_maxima_item')
                          }
                          title="Aumentar quantidade máxima"
                          disabled={
                            Number(item.qtde_maxima_item) >=
                            Number(item.qtd_total_item)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{' '}
        </div>
      </div>
    </div>
  );
};

export default ModalViewPromocaoItemsEditavel;
