import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
//import SelecionarDesconto from './selectDesconto';
import { DataTableColumnHeader } from './data-table/data-table-column-header';
import { BadgePercent } from 'lucide-react';
import { FaGift } from 'react-icons/fa';
import PopoverInfoPromo from './PopoverInfoPromo'; // mesmo que no tableProd

export type Payment = {
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
};
import ConfirmaCompra from './confirmaCompra';
import MascaraReal from '@/utils/mascaraReal';

import { FaPlus, FaMinus, FaPencilAlt } from 'react-icons/fa';
//import { BsShop } from 'react-icons/bs';
import { LuShoppingBasket } from 'react-icons/lu';

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'codigo',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" min-w-20  text-center text-sm"
        column={column}
        title="Código"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center min-w-20">{row.getValue('codigo')}</div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'descrição',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" min-w-32  text-center text-sm"
        column={column}
        title="Descrição"
      />
    ),
    cell: ({ row }) => (
      <div className="uppercase min-w-32">{row.getValue('descrição')}</div>
    ),
  },
  {
    accessorKey: 'marca',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" min-w-28  text-center text-sm"
        column={column}
        title="Marca"
      />
    ),
    cell: ({ row }) => (
      <div className="uppercase min-w-28">{row.getValue('marca')}</div>
    ),
  },
  {
    accessorKey: 'estoque',
    header: ({ column }) => (
      <DataTableColumnHeader
        className="  text-center text-sm"
        column={column}
        title="Estoque"
      />
    ),
    cell: ({ row }) => <div className="">{row.getValue('estoque')}</div>,
  },
  {
    accessorKey: 'preço',
    header: ({ column }) => (
      <DataTableColumnHeader
        className=" flex justify-center text-sm"
        column={column}
        title="preço"
      />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('preço'));
      // Format the amount as a dollar amount
      const formatted = new Intl.NumberFormat('pt-br', {
        style: 'currency',
        currency: 'BRL',
      }).format(amount);

      return (
        <div className="text-center text-sm">
          {row.getValue('preço') ? formatted : '-'}
        </div>
      );
    },
  },
];

//interface EnumServiceItems extends Array<EnumServiceItem> {}

interface ChildProps {
  descontoTodos: boolean;
  data2: {
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
  }[];
  readonly produtoSelecionado: (arg0: string) => void;
  readonly telaSelecionada: (arg0: string) => void;
  readonly handleCarrinho: (arg0: {
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
  tela: string;
  cliente: string;
  kickback: boolean;
  // Estado compartilhado de kickback
  kickbackMarcadoPorProduto: Record<string, boolean>;
  setKickbackMarcadoPorProduto: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  precosOriginais: Record<string, string>;
  setPrecosOriginais: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const dataT: Payment[] = [
  {
    codigo: '',
    descrição: '',
    marca: '',
    estoque: '',
    preço: '',
    ref: '',
    quantidade: '',
    descriçãoEditada: '',
    totalItem: '',
    precoItemEditado: '',
    tipoPreço: '',
    desconto: 0,
    origem: '',
  },
];
const DataTablecolumns: React.FC<ChildProps> = ({
  data2,
  descontoTodos,
  produtoSelecionado,
  cliente,
  handleCarrinho,
  kickback,
  // Props compartilhadas de kickback
  kickbackMarcadoPorProduto,
  setKickbackMarcadoPorProduto,
  precosOriginais,
  setPrecosOriginais,
}) => {
  const quantT = data2.map((val) => val.quantidade);
  const descT = data2.map((val) => val.desconto);
  const [quant, setQuant] = React.useState(quantT);
  const [desc, setDesc] = React.useState(descT);
  const [openContextMenu, setOpenContextMenu] = React.useState(false);

  const [promocaoSelecionada, setPromocaoSelecionada] = React.useState<
    any | null
  >(null);
  const [popoverPosition, setPopoverPosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [openConfirma, setOpenConfirma] = React.useState(false);
  const [data, setData] = React.useState(dataT);
  const [indexPagina] = React.useState(0);
  const [indexItem, setIndexItem] = React.useState(0);
  const [points, setPoints] = React.useState({ x: 0, y: 0 });

  //const [columns, setColumns] = React.useState(columnsT);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // === HELPERS COMUNS ==========================================================
  // Soma percentual de impostos (ICMS, IPI, ST, PIS, COFINS) — em %.
  function getPercentImpostos(item: any): number {
    const imp = item?.impostos || {};
    const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

    // alguns backends já mandam total em %, então priorize
    if (imp.totalImpostos !== undefined) return n(imp.totalImpostos);

    // fallback: soma dos componentes (em %)
    return (
      n(imp.valorICMS) +
      n(imp.valorIPI) +
      n(imp.valorICMS_Subst) +
      n(imp.valorPIS) +
      n(imp.valorCOFINS)
    );
  }

  // Calcula valores em R$ a partir do subtotal do item
  function calcularTotaisComImpostos(item: any) {
    const subtotal = Number(item?.totalItem ?? 0);

    // Se já tem impostos calculados pela API IBS/CBS, usa eles
    if (item?.impostos?.totalComImpostos) {
      return {
        subtotal,
        perc: subtotal > 0 ? (item.impostos.valorImpostos / subtotal) * 100 : 0,
        valorImpostos: Number(item.impostos.valorImpostos ?? 0),
        totalComImpostos: Number(item.impostos.totalComImpostos),
      };
    }

    // Fallback: calcula manualmente (caso antigo)
    const perc = getPercentImpostos(item);
    const valorImpostos = +(subtotal * (perc / 100)).toFixed(2);
    const totalComImpostos = +(subtotal + valorImpostos).toFixed(2);
    return { subtotal, perc, valorImpostos, totalComImpostos };
  }

  // Tooltip detalhado (mostra % e R$ de cada componente + total c/ impostos)
  function getTooltipTotalComImpostos(item: any): string {
    const imp = item?.impostos || {};
    const aliq = item?.aliquotas || {};
    const { subtotal } = calcularTotaisComImpostos(item);

    const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const brl = (v: any) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(v || 0));

    const partes: Array<{ nome: string; perc: number }> = [
      { nome: 'ICMS', perc: n(imp.valorICMS) },
      { nome: 'IPI', perc: n(imp.valorIPI) },
      { nome: 'ST', perc: n(imp.valorICMS_Subst) },
      { nome: 'PIS', perc: n(imp.valorPIS) },
      { nome: 'COFINS', perc: n(imp.valorCOFINS) },
    ];

    const linhas: string[] = [];
    linhas.push(`Base (subtotal): ${brl(subtotal)}`);

    partes.forEach((p) => {
      if (!p.perc) return;
      const valor = subtotal * (p.perc / 100);
      linhas.push(`${p.nome}: ${p.perc}%  →  ${brl(valor)}`);
    });

    const { perc, valorImpostos, totalComImpostos } =
      calcularTotaisComImpostos(item);
    linhas.push(`\nTotal de impostos: ${perc}%  →  ${brl(valorImpostos)}`);
    linhas.push(`Total c/ impostos: ${brl(totalComImpostos)}`);

    // usa 'aliq' para evitar o warning e enriquecer o tooltip
    const refAliq: string[] = [];
    if (aliq.icms != null) refAliq.push(`ICMS ${aliq.icms}%`);
    if (aliq.ipi != null) refAliq.push(`IPI ${aliq.ipi}%`);
    if (aliq.pis != null) refAliq.push(`PIS ${aliq.pis}%`);
    if (aliq.cofins != null) refAliq.push(`COFINS ${aliq.cofins}%`);
    if (aliq.agregado != null) refAliq.push(`MVA ${aliq.agregado}%`);
    if (refAliq.length)
      linhas.push(`\nAlíquotas de referência: ${refAliq.join(', ')}`);

    return linhas.join('\n');
  }

  // número seguro (aceita "2,51", "2.51", "003.0000" etc.)
  function toNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && isFinite(v)) return v;

    const s = String(v).trim();

    // 1) Se há só um separador (ponto OU vírgula), ele é decimal
    //    "3.0000" -> 3     | "2,51" -> 2.51
    if (/^-?\d+(?:[.,]\d+)?$/.test(s)) {
      return parseFloat(s.replace(',', '.'));
    }

    // 2) Se há formatação BR (milhares+decimal), remove pontos e troca vírgula
    //    "1.234,56" -> 1234.56
    const normalized = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return isFinite(n) ? n : 0;
  }

  //inicio
  const isTipoBalcao = (tipo: any) =>
    String(tipo ?? '')
      .trim()
      .toUpperCase() === 'BALCÃO' ||
    String(tipo ?? '')
      .trim()
      .toUpperCase() === 'BALCAO';

  function calcularTotalComPromocao(item: any, quantidade: number) {
    const qtd = Math.max(0, toNum(quantidade));
    const base = toNum(
      item?.precoItemEditado ?? item?.preço ?? item?.preco ?? 0,
    );

    if (isTipoBalcao(item?.tipoPreço)) {
      const subtotal = Number((qtd * base).toFixed(2));
      return {
        promoQty: 0,
        normalQty: qtd,
        unitPromo: null,
        unitBase: base,
        subtotal,
      };
    }

    const promo = getPromocao(item);
    const ativa = !!promo?.ativa;
    if (!promo || !ativa) {
      const subtotal = Number((qtd * base).toFixed(2));
      return {
        promoQty: 0,
        normalQty: qtd,
        unitPromo: null,
        unitBase: base,
        subtotal,
      };
    }

    const minima = Math.max(1, toNum(promo?.qtde_minima_item ?? 1));
    const maxima = toNum(promo?.qtde_maxima_item ?? 0); // 0 => sem teto
    const disp = getDisponivelPromo(promo);

    if (qtd < minima || disp <= 0) {
      const subtotal = Number((qtd * base).toFixed(2));
      return {
        promoQty: 0,
        normalQty: qtd,
        unitPromo: null,
        unitBase: base,
        subtotal,
      };
    }

    const unitPromo = getPrecoPromocional(item) ?? base;
    const capPorMax = maxima > 0 ? maxima : qtd;
    const promoQty = Math.min(qtd, capPorMax, disp);
    const normalQty = Math.max(0, qtd - promoQty);

    const subtotal = Number(
      (promoQty * unitPromo + normalQty * base).toFixed(2),
    );
    return { promoQty, normalQty, unitPromo, unitBase: base, subtotal };
  }

  //fim

  function getPromocao(item: any) {
    return (
      (Array.isArray(item?.promocoes) && item.promocoes[0]) ||
      item?.promocao ||
      null
    );
  }

  function getDisponivelPromo(promo: any) {
    const total = toNum(promo?.qtd_total_item ?? 0);
    const vendido = toNum(promo?.qtdvendido ?? 0);
    return Math.max(0, total - vendido);
  }

  function getPrecoPromocional(item: any): number | null {
    const promo = getPromocao(item);
    if (!promo) return null;

    const base = toNum(
      item?.precoItemEditado ?? item?.preço ?? item?.preco ?? 0,
    );
    if (base <= 0) return null;

    const tipo = String(promo?.tipo_desconto_item ?? '').toUpperCase();
    const valor = toNum(promo?.valor_desconto_item ?? 0);

    if (tipo === 'PERC') {
      const perc = Math.max(0, Math.min(100, valor));
      return Number((base * (1 - perc / 100)).toFixed(2));
    }
    // qualquer outro tipo => valor informado já é o PREÇO FINAL
    return valor > 0 ? Number(valor.toFixed(2)) : null;
  }
  //------------fim dos helpers comuns----------------

  /**
   * Retorna o PREÇO UNITÁRIO promocional do item (number, com 2 casas),
   * ou null se não houver promoção suficiente para calcular.
   *
   * Regras:
   *  - tipo_desconto_item === 'PERC'  -> aplica percentual sobre o preço base
   *  - qualquer outro tipo            -> valor_desconto_item é o PREÇO FINAL
   */

  React.useEffect(() => {
    if (data2.length) {
      setData(data2);
    }
  }, [data2]);

  React.useEffect(() => {
    if (points.x && points.y) {
      setOpenContextMenu(true);
    }
  }, [points]);

  // Atualiza o desconto à vista (%) e recalcula o subtotal preservando a promoção
  const handleAtualizarDescF = (indexDesc: number, novoDesc: string) => {
    // guarda no estado de inputs (se você usa)
    if (typeof setDesc === 'function') {
      setDesc((old: any[]) => {
        const n = [...old];
        n[indexDesc] = toNum(novoDesc);
        return n;
      });
    }

    const atual = data2[indexDesc];
    if (!atual) return;

    const item: any = { ...atual, desconto: toNum(novoDesc) };
    const qtd = toNum(item?.quantidade ?? 0);

    // subtotal base com promoção
    const calc = calcularTotalComPromocao(item, qtd);

    // aplica o desconto à vista
    const subSemDesc = calc.subtotal;
    const subComDesc =
      item.desconto > 0
        ? Number((subSemDesc * (1 - item.desconto / 100)).toFixed(2))
        : subSemDesc;

    item.totalItem = subComDesc.toFixed(2);
    item.precoItemEditado = item.precoItemEditado ?? item.preço;
    item.descriçãoEditada = item.descriçãoEditada
      ? item.descriçãoEditada
      : item.descrição;

    handleCarrinho(item);
  };

  const handleAtualizarQuant = (indexQuant: number, novoQuant: string) => {
    if (novoQuant) {
      const novoArr = data2?.map((val) => val);
      data2?.map((val, ind) => {
        const index = ind;

        let newValor = '0';
        if (novoArr[index] && novoArr[index].desconto) {
          newValor = Number(
            Number(novoQuant) * Number(val.precoItemEditado) -
              (Number(novoQuant) *
                Number(val.precoItemEditado) *
                novoArr[index].desconto) /
                100,
          ).toFixed(2);
        }
        if (
          val?.codigo &&
          (val?.descrição || val.descrição === '') &&
          (val?.estoque || val.estoque === '') &&
          (val?.preço || val.preço === '')
        ) {
          if (index === indexQuant) {
            const qtd = toNum(novoQuant);
            const calc = calcularTotalComPromocao(val, qtd);

            const descPerc = toNum(novoArr[index]?.desconto ?? 0);
            const subSemDesc = calc.subtotal;
            const subComDesc =
              descPerc > 0
                ? Number((subSemDesc * (1 - descPerc / 100)).toFixed(2))
                : subSemDesc;

            newValor = subComDesc.toFixed(2);

            novoArr[index].codigo = val?.codigo;
            novoArr[index].descrição = val?.descrição;
            novoArr[index].estoque = val?.estoque;
            novoArr[index].preço = val?.preço;
            novoArr[index].ref = val?.ref;
            novoArr[index].quantidade = novoQuant;
            novoArr[index].totalItem = String(newValor);
            novoArr[index].precoItemEditado = val.precoItemEditado;
            novoArr[index].descriçãoEditada = val.descriçãoEditada
              ? val.descriçãoEditada
              : val.descrição;
          } else {
            if (novoArr[index] && novoArr[index].desconto) {
              novoArr[index].codigo = val?.codigo;
              novoArr[index].descrição = val?.descrição;
              novoArr[index].estoque = val?.estoque;
              novoArr[index].preço = val?.preço;
              novoArr[index].ref = val?.ref;
              novoArr[index].quantidade = val?.quantidade;
              novoArr[index].totalItem = val?.totalItem;
              novoArr[index].precoItemEditado = val?.precoItemEditado;
              novoArr[index].descriçãoEditada = val.descriçãoEditada
                ? val.descriçãoEditada
                : val.descrição;
            }
          }
        }
        return 0;
      });

      // BUGFIX: usar novoArr (atualizado) em vez de data2 (original)
      if (cliente) handleCarrinho(novoArr[indexQuant]);
    }
  };

  const handleAtualizar = (novoCar: {
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
  }) => {
    if (novoCar.codigo) {
      const novoArr = data2?.map((val) => val);
      const indPagina = Number(table.getState().pagination.pageIndex * 10);

      data2?.map((val, ind) => {
        const index = ind + indPagina;
        if (val.codigo === novoCar?.codigo && val.marca === novoCar?.marca) {
          novoArr[index].codigo = novoCar.codigo;
          novoArr[index].descrição = novoCar.descrição;
          novoArr[index].estoque = novoCar.estoque;
          novoArr[index].preço = novoCar.preço;
          novoArr[index].ref = novoCar.ref;
          novoArr[index].quantidade = novoCar.quantidade;
          novoArr[index].totalItem = novoCar.totalItem;
          novoArr[index].precoItemEditado = novoCar.precoItemEditado;
          novoArr[index].descriçãoEditada = novoCar.descriçãoEditada;
          novoArr[index].margemMinima =
            novoCar.margemMinima ?? novoArr[index].margemMinima; // <— NOVO
        }
        return 0;
      });

      //atualizara quantidade da tela do produto
      const quantT = data2.map((val) => val.quantidade);
      setQuant(quantT);
      const descT = data2.map((val) => val.desconto);
      setDesc(descT);
      // BUGFIX: usar novoArr (atualizado) em vez de data2 (original)
      handleCarrinho(novoArr[indexItem]);
      //------------------------------------------------
    }
  };

  const handleDialog = (novoValor: boolean) => {
    setOpenConfirma(novoValor);
  };

  const handleCarrinho2 = (novoCar: {
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
  }) => {
    handleAtualizar(novoCar);
  };

  {
    return (
      <div
        onClick={() => {
          setOpenContextMenu(false);
        }}
        className="w-[100%] select-none h-full text-[10px] lg:text-[12px]"
      >
        <div className="h-[100%] border-b border-t border-gray-300 w-[100%] flex justify-center items-center">
          <div className="w-[100%] h-[98%]">
            <div className="flex flex-col w-full h-[100%] dark:border-gray-800">
              <div className="flex-grow w-full h-[100%] overflow-auto">
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <div
                      key={Number(index + indexPagina)}
                      className="py-1 w-full relative"
                    >
                      {/* GRID DA LINHA — 2 colunas >= lg, 1 coluna < lg */}
                      <div
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setIndexItem(index);
                          setPoints({
                            x: e.pageX,
                            y: e.pageY,
                          });
                          setOpenContextMenu(true); // <-- garante abertura do menu
                        }}
                        className="w-full flex flex-col md:flex-row gap-2 border-b border-gray-300"
                      >
                        {/* --- BLOCO ESQUERDA (60%) com ESTOQUE fixo à direita --- */}
                        <div
                          id="col-esquerda"
                          className="w-full px-2 py-2 min-h-[56px] leading-tight"
                        >
                          {/* 2 colunas: 90% (conteúdo) | 10% (aside estoque) */}
                          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-x-3 items-start">
                            {/* ===== COLUNA A (90%) ===== */}
                            <div className="min-w-0">
                              {/* LINHA 1 — Descrição (sem truncate) */}
                              <div className="flex items-center gap-2">
                                <img
                                  src={
                                    data2[index + indexPagina]?.origem === 'N'
                                      ? '/images/brasil.png'
                                      : '/images/importado.png'
                                  }
                                  alt="origem"
                                  className="w-5 h-[14px] object-contain"
                                />
                                <span className="font-semibold whitespace-normal break-words">
                                  {data2[index + indexPagina]?.ref ??
                                    data2[index + indexPagina]?.codigo}
                                  {' — '}
                                  {data2[index + indexPagina]?.descrição}
                                </span>
                              </div>

                              {/* LINHA 2 — marca + preços (à esquerda) | ÍCONE encostado à direita */}
                              {(() => {
                                const item: any = data2[index + indexPagina];

                                const p =
                                  (item?.promocoes &&
                                    Array.isArray(item.promocoes) &&
                                    item.promocoes[0]) ||
                                  item?.promocao ||
                                  null;

                                const ehBalcao = isTipoBalcao?.(
                                  item?.tipoPreço,
                                );
                                const ativa = !!p?.ativa;

                                const quantidade = toNum(item?.quantidade ?? 0);
                                const qtdeMin = toNum(p?.qtde_minima_item ?? 1);
                                const disp = Math.max(
                                  0,
                                  toNum(p?.qtd_total_item ?? 0) -
                                    toNum(p?.qtdvendido ?? 0),
                                );

                                const podeMostrarPromo =
                                  ativa &&
                                  !ehBalcao &&
                                  quantidade >= qtdeMin &&
                                  disp > 0;

                                const precoBase = toNum(
                                  item?.precoItemEditado ?? item?.preço ?? 0,
                                );
                                let precoPromo: number | null = null;
                                if (podeMostrarPromo) {
                                  const tipo = String(
                                    p?.tipo_desconto_item || '',
                                  ).toUpperCase(); // 'PERC' | 'VALOR'
                                  const val = toNum(
                                    p?.valor_desconto_item ?? 0,
                                  );
                                  precoPromo =
                                    tipo === 'PERC'
                                      ? Number(
                                          (precoBase * (1 - val / 100)).toFixed(
                                            2,
                                          ),
                                        )
                                      : val; // valor absoluto
                                }

                                const cod =
                                  String(
                                    item?.CODPROD ??
                                      item?.codprod ??
                                      item?.codproduto ??
                                      item?.codigo ??
                                      index + indexPagina,
                                  ) || String(index + indexPagina);

                                const promoAtivaVisual = podeMostrarPromo;
                                const showKick =
                                  !promoAtivaVisual && !!kickback;

                                // Verifica se kickback está ativo para este produto
                                // No carrinho, usa APENAS item.usandoKickback como fonte de verdade
                                const precoKickbackItem = Number(item?.PRECO_KICKBACK ?? item?.preco_kickback ?? 0);
                                const temPrecoKickback = precoKickbackItem > 0;
                                const kickbackAtivo = showKick && temPrecoKickback && !!(item as any)?.usandoKickback;

                                // Preço original (antes de kickback) para exibir riscado
                                const precoOriginalItem = Number(
                                  (item as any)?.precoOriginalKickback ||
                                  item?.PRECOVENDA ??
                                  item?.precovenda ??
                                  precoBase
                                );

                                return (
                                  <div className="mt-1 flex items-center gap-2">
                                    {/* texto (esquerda), quebra natural de linha */}
                                    <div className="min-w-0 flex items-center flex-wrap gap-x-2 gap-y-1 text-slate-800">
                                      <span className="text-gray-400">
                                        marca:
                                      </span>
                                      <span className="whitespace-normal break-words">
                                        {(item?.marca ?? '').substring(0, 30)}
                                      </span>

                                      <span className="ml-3 text-gray-400">
                                        preço{' '}
                                        {String(
                                          item?.tipoPreço || '',
                                        ).toLowerCase()}
                                        :
                                      </span>
                                      <span
                                        className={
                                          podeMostrarPromo || kickbackAtivo
                                            ? 'line-through text-gray-400'
                                            : 'text-gray-600 dark:text-gray-300'
                                        }
                                      >
                                        {MascaraReal(kickbackAtivo ? precoOriginalItem : precoBase)}
                                      </span>

                                      {podeMostrarPromo &&
                                        precoPromo !== null && (
                                          <>
                                            <span className="ml-2 text-green-600 dark:text-green-400">
                                              preço promo:
                                            </span>
                                            <span className="font-semibold text-green-600 dark:text-green-400">
                                              {MascaraReal(precoPromo)}
                                            </span>
                                          </>
                                        )}

                                      {/* Exibe preço kickback quando ativo */}
                                      {kickbackAtivo && (
                                        <>
                                          <span className="ml-2 text-blue-600 dark:text-blue-400">
                                            preço kickback:
                                          </span>
                                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                                            {MascaraReal(precoKickbackItem)}
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    {/* ícone (direita da linha 2) */}
                                    <div className="ml-auto w-11 h-6 shrink-0 flex items-center justify-center">
                                      {promoAtivaVisual ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (p && !popoverPosition) {
                                              setPromocaoSelecionada(p);
                                              setPopoverPosition({
                                                x: e.pageX,
                                                y: e.pageY,
                                              });
                                            } else {
                                              setPromocaoSelecionada(null);
                                              setPopoverPosition(null);
                                            }
                                          }}
                                          aria-label="Informações da promoção"
                                          className="inline-flex items-center justify-center"
                                        >
                                          <BadgePercent className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                                        </button>
                                      ) : showKick ? (
                                        (() => {
                                          const precoKickback = Number(item?.PRECO_KICKBACK ?? item?.preco_kickback ?? 0);
                                          const temPrecoKickback = precoKickback > 0;
                                          // No carrinho, usa APENAS item.usandoKickback
                                          const ativoKb = !!(item as any)?.usandoKickback;

                                          // Se não tem preço kickback, não mostra ícone
                                          if (!temPrecoKickback) return null;

                                          return (
                                            <div className="relative group">
                                              <FaGift
                                                size={18}
                                                title={`KICKBACK: R$ ${precoKickback.toFixed(2)}`}
                                                className={`cursor-pointer transition-colors ${
                                                  ativoKb
                                                    ? 'text-green-500'
                                                    : 'text-zinc-400'
                                                }`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const novoAtivo = !ativoKb;

                                                  // Aplicar ou remover preço kickback
                                                  const itemAtual = { ...item } as any;
                                                  const qtd = toNum(itemAtual?.quantidade ?? 0);

                                                  // Preço original: usa precoOriginalKickback (do item) ou PRECOVENDA
                                                  const precoOriginalGuardado =
                                                    itemAtual?.precoOriginalKickback ||
                                                    String(itemAtual?.PRECOVENDA ?? itemAtual?.precovenda ?? itemAtual?.preço ?? '0');

                                                  if (novoAtivo) {
                                                    // Guardar preço original e aplicar kickback
                                                    if (!itemAtual.precoOriginalKickback) {
                                                      itemAtual.precoOriginalKickback = itemAtual?.preço ?? itemAtual?.precoItemEditado ?? precoOriginalGuardado;
                                                    }
                                                    // Atualizar preço para kickback
                                                    itemAtual.preço = String(precoKickback);
                                                    itemAtual.precoItemEditado = String(precoKickback);
                                                    itemAtual.usandoKickback = true;
                                                  } else {
                                                    // Restaurar preço original
                                                    itemAtual.preço = precoOriginalGuardado;
                                                    itemAtual.precoItemEditado = precoOriginalGuardado;
                                                    itemAtual.usandoKickback = false;
                                                  }

                                                  // Recalcular total com o novo preço
                                                  const calc = calcularTotalComPromocao(itemAtual, qtd);
                                                  const descPerc = toNum(itemAtual?.desconto ?? 0);
                                                  const subComDesc =
                                                    descPerc > 0
                                                      ? Number((calc.subtotal * (1 - descPerc / 100)).toFixed(2))
                                                      : calc.subtotal;
                                                  itemAtual.totalItem = subComDesc.toFixed(2);

                                                  // Notificar o pai para atualizar o carrinho
                                                  if (cliente) handleCarrinho(itemAtual);
                                                }}
                                                aria-label="Kickback"
                                              />
                                              {/* tooltip com preço kickback */}
                                              <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-10 shadow-lg">
                                                KBK: R$ {precoKickback.toFixed(2)}
                                              </span>
                                            </div>
                                          );
                                        })()
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* ===== COLUNA B (10%) — ASIDE FIXO DO ESTOQUE, atravessa as 2 linhas ===== */}
                            <aside
                              className="row-span-2 w-[112px] flex flex-col items-center justify-center cursor-pointer select-none"
                              role="button"
                              aria-label="Abrir menu do item"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIndexItem(index);
                                setPoints({ x: e.clientX, y: e.clientY });
                                setOpenContextMenu(true);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIndexItem(index);
                                setPoints({ x: e.clientX, y: e.clientY });
                                setOpenContextMenu(true);
                              }}
                            >
                              <span className="text-[10px] font-semibold text-slate-500">
                                Estoque
                              </span>
                              <span className="text-[14px] font-semibold text-slate-700 leading-tight whitespace-nowrap">
                                {data2[index + indexPagina]?.estoque}
                              </span>
                            </aside>
                          </div>
                        </div>

                        {/* --- BLOCO DIREITA (40%) — 4 colunas: 3fr / 3fr / 2fr / 2fr --- */}
                        <div
                          id="col-direita"
                          className="w-full px-2 py-2 min-h-[56px] leading-tight min-w-0"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-[3fr_3fr_2fr_2fr] items-start gap-2 md:gap-3 min-w-0">
                            {(() => {
                              const idx = index + indexPagina;
                              const item: any = data2[idx];

                              return (
                                <>
                                  {/* 1) DESCONTO */}
                                  {/* 1) DESCONTO */}
                                  <div className="min-w-0 basis-0 px-1 md:px-2">
                                    {/* 1) DESCONTO — trava quando promo ativa */}
                                    {(() => {
                                      const idx = index + indexPagina;
                                      const item: any = data2[idx];

                                      // === Detecta se promo bloqueia desconto ===
                                      const p = item?.promocoes?.[0];
                                      const ativa = !!p?.ativa;
                                      const ehBalcao = isTipoBalcao?.(
                                        item?.tipoPreço,
                                      );
                                      const qtd = toNum(item?.quantidade ?? 0);
                                      const min = toNum(
                                        p?.qtde_minima_item ?? 1,
                                      );
                                      const disp = Math.max(
                                        0,
                                        toNum(p?.qtd_total_item ?? 0) -
                                          toNum(p?.qtdvendido ?? 0),
                                      );

                                      // se a promoção está realmente valendo para este item
                                      const promoLock =
                                        ativa &&
                                        !ehBalcao &&
                                        qtd >= min &&
                                        disp > 0;
                                      // logo após o promoLock
                                      const editedLock =
                                        toNum(
                                          item?.precoItemEditado ??
                                            item?.preço ??
                                            0,
                                        ) < toNum(item?.preço ?? 0);

                                      // estado visual dos botões
                                      const btnDisabled =
                                        promoLock ||
                                        editedLock ||
                                        descontoTodos ||
                                        quant[idx] === '0';

                                      const btnBaseOn =
                                        'h-7 w-7 shrink-0 flex justify-center items-center rounded text-white';
                                      const btnOn =
                                        'bg-violet-600 dark:bg-violet-400 hover:bg-violet-500';
                                      const btnOff =
                                        'bg-gray-300 dark:bg-gray-600 cursor-not-allowed';

                                      return (
                                        <div className="min-w-0 basis-0 px-1 md:px-2">
                                          <div className="flex flex-col items-center">
                                            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                                              Desconto à vista
                                            </span>

                                            <div className="w-full flex items-center justify-center gap-1.5">
                                              {/* − */}
                                              <button
                                                disabled={btnDisabled}
                                                className={`${btnBaseOn} ${
                                                  btnDisabled ? btnOff : btnOn
                                                }`}
                                                onClick={() => {
                                                  if (btnDisabled) return; // trava
                                                  let v =
                                                    Number(desc[idx]) || 0;
                                                  v = Math.max(0, v - 1);
                                                  setDesc(
                                                    (old) => (
                                                      (old[idx] = v), [...old]
                                                    ),
                                                  );
                                                  handleAtualizarDescF(
                                                    idx,
                                                    String(v),
                                                  );
                                                }}
                                              >
                                                <FaMinus className="h-3 w-3" />
                                              </button>

                                              {/* INPUT (fica 0 e readOnly quando promo ativa) */}
                                              <input
                                                type="number"
                                                value={
                                                  promoLock || editedLock
                                                    ? 0
                                                    : item?.desconto ?? 0
                                                }
                                                readOnly={
                                                  promoLock || editedLock
                                                }
                                                className={`h-7 w-full min-w-0 bg-transparent border border-slate-200 rounded-md text-center text-sm
                        [&::-webkit-outer-spin-button]:appearance-none
                        [&::-webkit-inner-spin-button]:appearance-none
                        focus:outline-none
                        ${
                          promoLock
                            ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                            : ''
                        }`}
                                                onChange={(e) => {
                                                  if (promoLock || editedLock)
                                                    return; // trava
                                                  const v =
                                                    Number(e.target.value) || 0;
                                                  setDesc(
                                                    (old) => (
                                                      (old[idx] = v), [...old]
                                                    ),
                                                  );
                                                  handleAtualizarDescF(
                                                    idx,
                                                    String(v),
                                                  );
                                                }}
                                              />

                                              {/* + */}
                                              <button
                                                disabled={btnDisabled}
                                                className={`${btnBaseOn} ${
                                                  btnDisabled ? btnOff : btnOn
                                                }`}
                                                onClick={() => {
                                                  if (btnDisabled) return; // trava
                                                  let v =
                                                    Number(desc[idx]) || 0;
                                                  v += 1;
                                                  setDesc(
                                                    (old) => (
                                                      (old[idx] = v), [...old]
                                                    ),
                                                  );
                                                  handleAtualizarDescF(
                                                    idx,
                                                    String(v),
                                                  );
                                                }}
                                              >
                                                <FaPlus className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* 2) QUANTIDADE */}
                                  <div className="min-w-0 basis-0 px-1 md:px-2">
                                    <div className="flex flex-col items-center">
                                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                                        Quantidade
                                      </span>
                                      <div className="w-full flex items-center justify-center gap-1.5">
                                        <button
                                          className="h-7 w-7 shrink-0 flex justify-center items-center rounded bg-gray-600 hover:bg-gray-500 text-white"
                                          onClick={() => {
                                            const atual = toNum(
                                              item?.quantidade ?? 0,
                                            );
                                            handleAtualizarQuant(
                                              idx,
                                              String(Math.max(0, atual - 1)),
                                            );
                                          }}
                                        >
                                          <FaMinus className="h-3 w-3" />
                                        </button>

                                        {/* INPUT com overlay */}
                                        <div className="relative w-full min-w-0">
                                          <input
                                            type="number"
                                            value={item?.quantidade}
                                            className="h-7 w-full min-w-0 text-transparent caret-black bg-transparent border border-slate-200 rounded-md text-center text-sm
                     [&::-webkit-outer-spin-button]:appearance-none
                     [&::-webkit-inner-spin-button]:appearance-none
                     focus:outline-none"
                                            onChange={(e) => {
                                              let v = toNum(e.target.value);
                                              const est = toNum(
                                                item?.estoque ?? 0,
                                              );
                                              if (v > est) v = est;
                                              if (v < 0) v = 0;
                                              handleAtualizarQuant(
                                                idx,
                                                String(v),
                                              );
                                            }}
                                          />
                                          {(() => {
                                            const qtd = toNum(
                                              item?.quantidade ?? 0,
                                            );
                                            const c = calcularTotalComPromocao(
                                              item,
                                              qtd,
                                            );
                                            return (
                                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
                                                {c.promoQty > 0 ? (
                                                  <>
                                                    <span className="text-green-600 font-semibold">
                                                      {c.promoQty}
                                                    </span>
                                                    {c.normalQty > 0 && (
                                                      <span className="mx-1">
                                                        +
                                                      </span>
                                                    )}
                                                    {c.normalQty > 0 && (
                                                      <span>{c.normalQty}</span>
                                                    )}
                                                  </>
                                                ) : (
                                                  <span>{qtd}</span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        <button
                                          className="h-7 w-7 shrink-0 flex justify-center items-center rounded bg-gray-600 hover:bg-gray-500 text-white"
                                          onClick={() => {
                                            const atual = toNum(
                                              item?.quantidade ?? 0,
                                            );
                                            const est = toNum(
                                              item?.estoque ?? 0,
                                            );
                                            handleAtualizarQuant(
                                              idx,
                                              String(Math.min(est, atual + 1)),
                                            );
                                          }}
                                        >
                                          <FaPlus className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 3) TOTAL C/ IMPOSTOS */}
                                  {/* ===== TOTAL C/ IMPOSTOS ===== */}
                                  <div className="flex flex-col items-center text-center md:items-end md:text-right">
                                    <span className="text-[11px] font-semibold text-slate-500">
                                      Total c/ impostos
                                    </span>
                                    {(() => {
                                      const item = data2[
                                        index + indexPagina
                                      ] as any;
                                      const { totalComImpostos } =
                                        calcularTotaisComImpostos(item);
                                      const tooltip =
                                        getTooltipTotalComImpostos(item); // usa a função

                                      return (
                                        <span
                                          title={tooltip} // <-- tooltip visível no hover
                                          aria-label={tooltip} // mantém acessível (sem atrapalhar)
                                          className="text-[14px] font-semibold text-slate-700 whitespace-nowrap cursor-help select-none"
                                        >
                                          {MascaraReal(totalComImpostos)}
                                        </span>
                                      );
                                    })()}
                                  </div>

                                  {/* 4) SUBTOTAL */}
                                  <div className="min-w-0 basis-0 px-1 md:px-2">
                                    <div className="flex flex-col items-center md:items-end text-center md:text-right">
                                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                                        Subtotal
                                      </span>
                                      <span className="text-[14px] font-bold text-green-600 whitespace-nowrap">
                                        {MascaraReal(toNum(item?.totalItem))}
                                      </span>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* ===== MENU DE CONTEXTO (SUSPENSO) ===== */}
                      {openContextMenu && indexItem === index ? (
                        <div
                          className="fixed z-[9999]"
                          style={{ left: points.x + 10, top: points.y + 10 }}
                          onClick={(e) => e.stopPropagation()} // não fechar ao clicar no menu
                        >
                          <div className="w-auto min-w-40 text-[12px] max-w-[260px] h-auto max-h-[70vh]  rounded-md bg-[#fefefe] border shadow-lg border-gray-300 overflow-auto">
                            <div className="w-full">
                              <div className="px-2 dark:hover:text-blue-600 hover:text-blue-600 text-gray-400 dark:text-gray-300 hover:bg-gray-50 w-full h-10 flex justify-center items-center min-w-32">
                                <div className="h-full w-[100%] flex justify-center">
                                  <div className="w-full flex items-center">
                                    <div
                                      className="w-full"
                                      id="decreaseButton"
                                      onClick={() => {
                                        produtoSelecionado(String(indexItem));
                                        setOpenConfirma(true);
                                        setOpenContextMenu(false);
                                      }}
                                    >
                                      <div className="w-full flex justify-start">
                                        <div className="w-full space-x-2 flex justify-start items-center">
                                          <FaPencilAlt
                                            size={18}
                                            className="flex"
                                          />
                                          <div className="w-full flex">
                                            Editar
                                          </div>
                                          <div className="text-[11px] flex w-16 justify-end">
                                            Ctrl + E
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="px-2 border-t dark:hover:text-green-600 hover:text-green-600 text-gray-400 dark:text-gray-300 hover:bg-gray-50 w-full h-10 flex justify-center items-center min-w-32">
                                <div className="h-full w-[100%] flex justify-center">
                                  <div className="w-full flex items-center">
                                    <div
                                      className="w-full"
                                      onClick={() => {
                                        setQuant((oldArray) => {
                                          const newArray = [...oldArray];
                                          newArray[index - 1] = '0';
                                          return newArray;
                                        });
                                        handleAtualizarQuant(index, '0');
                                        setOpenContextMenu(false);
                                      }}
                                    >
                                      <div className="w-full flex justify-start">
                                        <div className="w-full space-x-1 flex justify-start items-center">
                                          <LuShoppingBasket
                                            size={20}
                                            className="flex"
                                          />
                                          <div className="flex w-full">
                                            Histórico de Pedidos
                                          </div>
                                          <div className="text-[11px] flex w-14 justify-end">
                                            Ctrl + H
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {/* ===== FIM MENU ===== */}
                    </div>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </td>
                  </tr>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          {openConfirma ? (
            <ConfirmaCompra
              handleDialogo={handleDialog}
              data2={data2}
              cliente={cliente}
              indexItem={indexItem}
              handleCarrinho2={handleCarrinho2}
            />
          ) : null}
        </div>

        {promocaoSelecionada && popoverPosition && (
          <PopoverInfoPromo
            promocao={promocaoSelecionada}
            position={popoverPosition}
            onClose={() => {
              setPromocaoSelecionada(null);
              setPopoverPosition(null);
            }}
          />
        )}
      </div>
    );
  }
};
export default DataTablecolumns;
