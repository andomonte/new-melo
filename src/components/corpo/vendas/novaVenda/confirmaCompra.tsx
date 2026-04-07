import * as React from 'react';
import { FaPlus, FaMinus, FaEdit } from 'react-icons/fa';
import { AuthContext } from '@/contexts/authContexts';

interface ChildProps {
  data2: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string; // ex.: "0.93" do backend
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string; // ex.: "0.93"
    tipoPreço: string;
    desconto: number;
    origem: string;
    margemMinima?: number; // percentual (ex.: 10 -> 10%)
  }[];
  indexItem: number;
  readonly handleDialogo: (show: boolean) => void;
  cliente: string;
  readonly handleCarrinho2: (item: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string;
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string;
    tipoPreço: string;
    desconto: number;
    origem: string;
    margemMinima?: number;
  }) => void;
}

const ConfirmaCompra: React.FC<ChildProps> = ({
  data2,
  indexItem,
  handleDialogo,
  handleCarrinho2,
}) => {
  // =========================
  // Helpers de número pt-BR
  // =========================
  function parsePtNumber(v: any): number {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').trim();
    if (!s) return 0;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma) {
      // pt-BR: ponto = milhar, vírgula = decimal
      return Number(s.replace(/\./g, '').replace(',', '.'));
    }
    if (hasDot) {
      // "1.234" / "12.345.678" = padrão milhar
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
      // caso geral: ponto decimal (ex.: "0.93")
      return Number(s);
    }
    // apenas dígitos
    return Number(s);
  }

  function formatPt(n: number): string {
    const x = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(x);
  }

  // Pequeno componente para o ícone do label
  const EditBadge: React.FC = () => (
    <span
      title="Editável"
      aria-label="Editável"
      className="inline-flex items-center ml-1 align-middle text-emerald-600"
    >
      <FaEdit className="w-3.5 h-3.5" />
    </span>
  );

  // =========================
  // Estado inicial do item
  // =========================
  const dadosItem = {
    codigo: data2[indexItem].codigo,
    descrição: data2[indexItem].descrição,
    marca: data2[indexItem].marca,
    estoque: data2[indexItem].estoque,
    preço: data2[indexItem].preço,
    ref: data2[indexItem].ref,
    quantidade: data2[indexItem].quantidade,
    descriçãoEditada: data2[indexItem].descriçãoEditada,
    totalItem: data2[indexItem].totalItem,
    precoItemEditado: data2[indexItem].precoItemEditado,
    tipoPreço: data2[indexItem].tipoPreço,
    margemMinima: data2[indexItem].margemMinima,
    // NÃO alteramos desconto neste componente
    desconto: Number.isFinite(data2[indexItem].desconto)
      ? data2[indexItem].desconto
      : 0,
  };

  const { user } = React.useContext(AuthContext);
  const hasMPV = !!user?.funcoes?.includes('MPV'); // pode vender abaixo do mínimo

  const [item, setItem] = React.useState(dadosItem);

  // Texto cru digitado no campo PREÇO (sem formatar durante digitação)
  const [precoText, setPrecoText] = React.useState<string>(
    item.precoItemEditado || item.preço || '',
  );

  // opcional: realce quando estiver abaixo do mínimo E for permitido por MPV
  const [belowMin, setBelowMin] = React.useState(false);

  // sincroniza quando muda o item/linha
  React.useEffect(() => {
    setItem(dadosItem);
    setPrecoText(dadosItem.precoItemEditado || dadosItem.preço || '');
    setBelowMin(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexItem, data2]);

  const precoEfetivo = React.useMemo(() => {
    return parsePtNumber(precoText || item.preço);
  }, [precoText, item.preço]);

  React.useEffect(() => {
    const qtd = parsePtNumber(item.quantidade);
    const preco = precoEfetivo;

    const total = qtd > 0 && preco >= 0 ? qtd * preco : 0;
    const totalStr = formatPt(total);

    // evita setState em loop quando o valor não mudou
    setItem((old) =>
      old.totalItem === totalStr ? old : { ...old, totalItem: totalStr },
    );
  }, [item.quantidade, precoEfetivo]);

  // =========================
  // Commit do preço (onBlur e Enter)
  // =========================
  function commitPreco(rawText?: string) {
    const precoTabela = parsePtNumber(item.preço);
    const precoDigitado = parsePtNumber((rawText ?? precoText) || item.preço);
    const margemMin = Number(item.margemMinima) || 0;
    const pMin = precoTabela * (1 - margemMin / 100);

    // Se tem MPV, mantém o que digitou; senão, ajusta para o mínimo
    const precoAjustado = hasMPV
      ? precoDigitado
      : Math.max(precoDigitado, pMin);

    const fmt = formatPt(precoAjustado);
    setPrecoText(fmt);
    setItem((old) => ({
      ...old,
      // guardamos formatado para exibição; ao salvar no carrinho normalizamos com ponto
      precoItemEditado: fmt,
    }));
    setBelowMin(precoAjustado < pMin);
  }

  const handleAddCarrinho = () => {
    // cópia rasa do array, mas vamos **mutar** o mesmo objeto do item
    const novoArr = data2?.map((v) => v);

    data2?.forEach((_, index) => {
      if (index === indexItem) {
        const target = novoArr[index]; // mesmo objeto do carrinho/data2

        // quantidade: usa a do item (digitada) ou a já existente no carrinho
        const qRaw = item.quantidade ?? target.quantidade ?? '0';

        // normaliza números (sua helper já lida com vírgula/ponto)
        const qtdNum = parsePtNumber(qRaw);
        const precoNum = parsePtNumber(precoText || item.preço);
        const totalNum = qtdNum > 0 && precoNum >= 0 ? qtdNum * precoNum : 0;

        // atualiza **campo a campo** (sem criar novo objeto)
        target.codigo = item.codigo;
        target.descrição = item.descrição;
        target.marca = item.marca;
        target.estoque = item.estoque;
        target.preço = item.preço; // preço de tabela original
        target.ref = item.ref;
        target.quantidade = qRaw; // mantém a quantidade atual
        target.totalItem = formatPt(totalNum); // total já recalculado
        target.precoItemEditado = String(precoNum); // ← normalizado com ponto
        // NÃO alterar desconto
        target.desconto = 0;
        target.descriçãoEditada = item.descriçãoEditada;
        target.tipoPreço = item.tipoPreço;
        target.margemMinima = item.margemMinima;
        target.origem = target.origem; // preserva se houver
      }
    });

    // mantém seu fluxo atual
    handleCarrinho2(data2[indexItem]);
    handleDialogo(false);
  };
  console.log();
  return (
    <div
      className="relative z-10"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
      />
      <div className="fixed inset-1 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="w-[80%] transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all">
            <div className="bg-[#347AB6] text-[16px] text-white font-bold flex justify-center px-4 py-3 sm:flex  sm:px-6 gap-3">
              <div className=""> ITEM SELECIONADO </div>
              <div className=""> CÓDIGO: {item.codigo}</div>
            </div>

            <div className="bg-white dark:bg-slate-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="w-full mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  {/* Referência / Descrição */}
                  <div className="flex w-full space-x-6">
                    {/* Referência — editável a todos */}
                    <div className="w-[15%] relative mt-0">
                      <label className="flex items-center gap-1 mb-1 text-xs text-slate-600 dark:text-slate-200">
                        <span>Referência</span> <EditBadge />
                      </label>
                      <div className="relative w-[100%]">
                        <input
                          id="referencia"
                          type="text"
                          value={item.ref}
                          onChange={(e) =>
                            setItem((old) => ({ ...old, ref: e.target.value }))
                          }
                          className="h-10 text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-gray-900 dark:text-slate-200 w-full bg-transparent placeholder:text-slate-400 border border-slate-200 rounded-md pl-3 py-0 focus:outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Descrição — editável a todos */}
                    <div className="w-[85%] relative mt-0">
                      <label className="flex items-center gap-1 mb-1 text-xs text-slate-600 dark:text-slate-200">
                        <span>Descrição</span> <EditBadge />
                      </label>
                      <div className="relative w-[100%]">
                        <input
                          id="descrição"
                          autoComplete="off"
                          type="text"
                          value={item.descriçãoEditada}
                          className="text-xs sm:text-sm md:text-sm lg:text-base leading-6 text-gray-900 dark:text-slate-200 w-full bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-200 border border-slate-200 rounded-md pl-3 py-2 focus:outline-none uppercase"
                          onChange={(e) =>
                            setItem((old) => ({
                              ...old,
                              descriçãoEditada: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Marca / Quantidade Disponível */}
                  <div className="mt-5 flex w-full space-x-1 md:space-x-6">
                    {/* Marca */}
                    <div className="w-[80%] relative mt-0">
                      <label className="block mb-1 text-xs text-slate-600 dark:text-slate-200">
                        Marca
                      </label>
                      <div className="relative w-[100%]">
                        <input
                          id="marca"
                          type="text"
                          disabled
                          defaultValue={data2[indexItem].marca}
                          className="bg-gray-50 dark:bg-slate-600 text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-gray-900 dark:text-slate-200 w-full placeholder:text-slate-400 border border-slate-200 rounded-md pl-3 py-2 focus:outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Quantidade Disponível */}
                    <div className="w-[25%] max-w-sm relative mt-0">
                      <label className="block mb-1 text-xs text-slate-600 dark:text-slate-200">
                        Quantidade Disponível
                      </label>
                      <div className="w-[100%]">
                        <input
                          id="estoque"
                          type="text"
                          disabled
                          defaultValue={data2[indexItem].estoque}
                          className="text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-gray-900 dark:text-slate-200 w-full bg-gray-50 dark:bg-slate-600 placeholder:text-slate-400 border border-slate-200 rounded-md pl-3 py-2 focus:outline-none uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quantidade / Preços / Total */}
                  <div className="mt-5 flex w-full space-x-1 md:space-x-6">
                    {/* Quantidade */}
                    <div className="w-[25%] relative mt-0">
                      <label className="block text-sm text-slate-600 dark:text-slate-200">
                        Quantidade
                      </label>
                      <div className="relative w-[100%]">
                        <button
                          id="decreaseButton"
                          className="absolute right-11 top-[0.4rem] rounded bg-slate-800 p-1.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-slate-700 focus:shadow-none active:bg-slate-700 hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                          type="button"
                          onClick={() => {
                            const qtd = parsePtNumber(item.quantidade);
                            const novo = Math.max(0, qtd - 1);
                            setItem((old) => ({
                              ...old,
                              quantidade: String(novo),
                            }));
                          }}
                        >
                          <FaMinus className="w-4 h-4" />
                        </button>

                        <input
                          id="amountInput"
                          type="number"
                          value={item.quantidade}
                          className="text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-gray-900 dark:text-slate-200 w-full bg-transparent placeholder:text-slate-400 border border-slate-200 rounded-md pl-3 py-2 uppercase focus:border-yellow-300 focus:border-2 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          onChange={(e) =>
                            setItem((old) => ({
                              ...old,
                              quantidade: e.target.value,
                            }))
                          }
                        />

                        <button
                          id="increaseButton"
                          className="absolute right-2 top-[0.4rem] rounded bg-slate-800 p-1.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-slate-700 focus:shadow-none active:bg-slate-700 hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                          type="button"
                          onClick={() => {
                            const qtd = parsePtNumber(item.quantidade);
                            const novo = qtd + 1;
                            setItem((old) => ({
                              ...old,
                              quantidade: String(novo),
                            }));
                          }}
                        >
                          <FaPlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Preço da Tabela */}
                    <div className="w-[25%] relative mt-0">
                      <label className="block mb-1 text-xs text-slate-600 dark:text-slate-200">
                        Preço da Tabela
                      </label>
                      <div className="w-[100%] bg-gray-50 dark:bg-slate-800">
                        <div className="absolute dark:text-slate-200 left-2 top-[17px] py-3 px-2 text-xs sm:text-sm md:text-base lg:text-lg text-gray-600">
                          R$
                        </div>
                        <input
                          id="preco-tabela"
                          disabled
                          type="text"
                          value={formatPt(parsePtNumber(item.preço))}
                          className="text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-black-600 shadow-xs placeholder-gray-300 w-full bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-200 border border-slate-200 rounded-md pl-12 py-2 transition duration-300 ease focus:outline-none hover:border-slate-300 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Preço — editável; MPV permite abaixo do mínimo */}
                    <div className="w-[25%] max-w-sm relative mt-0">
                      <label className="flex items-center gap-1 mb-1 text-xs text-slate-600 dark:text-slate-200">
                        <span>Preço</span> <EditBadge />
                      </label>
                      <div className="w-[100%]">
                        <div className="absolute dark:text-slate-200 left-2 top-[17px] py-3 px-2 text-xs sm:text-sm md:text-base lg:text-lg text-gray-600">
                          R$
                        </div>

                        <input
                          id="preco"
                          type="text"
                          autoComplete="off"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={precoText}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d.,]/g, '');
                            setPrecoText(raw);
                          }}
                          onBlur={() => commitPreco()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitPreco();
                            }
                          }}
                          className={`text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-black-600 shadow-xs w-full bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-200 border rounded-md pl-12 py-2 transition duration-300 ease focus:outline-none hover:border-slate-300 shadow-sm
                          ${
                            belowMin && hasMPV
                              ? 'border-emerald-400 ring-1 ring-emerald-300'
                              : 'border-slate-200'
                          }`}
                        />

                        {/* Aviso sutil quando abaixo do mínimo por permissão MPV */}
                        {belowMin && hasMPV && (
                          <p className="mt-1 text-[11px] text-emerald-600">
                            Preço abaixo do mínimo aceito (perm.: MPV).
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Valor Total */}
                    <div className="w-[25%] relative mt-0">
                      <label className="block mb-1 text-xs text-slate-600 dark:text-slate-200">
                        Valor Total
                      </label>
                      <div className="w-[100%]">
                        <div className="absolute left-2 top-[17px] py-3 px-2 text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 dark:text-slate-100">
                          R$
                        </div>
                        <input
                          id="total"
                          type="text"
                          autoComplete="off"
                          disabled
                          value={item.totalItem}
                          className="text-xs sm:text-sm md:text-base lg:text-lg leading-6 text-black-600 shadow-xs w-full bg-gray-50 dark:bg-slate-800 placeholder:text-slate-400 border border-slate-200 rounded-md pl-12 py-2 transition duration-300 ease focus:outline-none hover:border-slate-300 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="bg-gray-50 dark:bg-slate-800 px-4 py-8 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className={`inline-flex w-56 justify-center items-center rounded-md ${
                  item.quantidade !== '' && item.quantidade !== '0'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-yellow-600'
                } px-3 py-2 text-xs sm:text-sm md:text-base font-semibold text-white shadow-sm sm:ml-3`}
                onClick={handleAddCarrinho}
              >
                {parsePtNumber(item.quantidade) > 0
                  ? 'Adicionar ao Carrinho'
                  : 'Retirar do Carrinho'}
              </button>
              <button
                onClick={() => handleDialogo(false)}
                type="button"
                className="w-36 items-center text-xs sm:text-sm md:text-base mt-3 inline-flex bg-red-600 justify-center rounded-md px-3 py-2 font-semibold text-gray-50 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-400 sm:mt-0"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmaCompra;
