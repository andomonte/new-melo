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
import { DataTablePagination } from './data-table/data-table-pagination';
import { BadgePercent } from 'lucide-react';
import PopoverInfoPromo from './PopoverInfoPromo'; // ajuste o caminho conforme necessário

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

import {
  FaPlus,
  FaMinus,
  FaPencilAlt,
  FaDoorOpen,
  FaGift,
} from 'react-icons/fa';
import { BsShop } from 'react-icons/bs';
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
type CtxArea = 'tableProd' | 'tableProdRef';
type CtxGlobal = {
  open: boolean;
  area: CtxArea | null;
  index: number | null;
  points?: { x: number; y: number };
};
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
  ctxGlobal: CtxGlobal;
  onCtxChange: (next: CtxGlobal) => void;
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
  kickback,
  handleCarrinho,
  onCtxChange,
  ctxGlobal,
}) => {
  const quantT = data2.map((val) => val.quantidade);
  const descT = data2.map((val) => val.desconto);
  const [quant, setQuant] = React.useState(quantT);
  const [desc, setDesc] = React.useState(descT);
  const [openContextMenu, setOpenContextMenu] = React.useState(false);

  //const [columns, setColumns] = React.useState(columnsT);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [kickbackMarcadoPorProduto, setKickbackMarcadoPorProduto] =
    React.useState<Record<string, boolean>>({});

  const [openConfirma, setOpenConfirma] = React.useState(false);
  const [data, setData] = React.useState(dataT);
  const [indexPagina, setIndexPagina] = React.useState(0);
  const [indexItem, setIndexItem] = React.useState(0);
  const [points, setPoints] = React.useState({ x: 0, y: 0 });
  const [promocaoSelecionada, setPromocaoSelecionada] = React.useState<
    any | null
  >(null);
  const [popoverPosition, setPopoverPosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  // --- TOTAL com promoção (aplica mínimo/máximo da promo e depois o "desconto à vista" %)
  // Total da linha considerando promoção (mín, máx, disponível) + desconto à vista (%)
  function calcularTotalComPromocao(args: {
    item: any;
    precoUnit: number; // já venha de (val.precoItemEditado ?? val.preço)
    quantidade: number; // quantidade da linha
    descontoPerc: number; // "Desconto à vista" (%)
  }): number {
    const { item, precoUnit, quantidade, descontoPerc } = args;

    const p = item?.promocoes?.[0];
    const ehBalcao = isTipoBalcao(item?.tipoPreço);

    const qtd = toNum(quantidade);
    const unit = toNum(precoUnit);

    // Base: tudo a preço normal
    let totalBase = unit * qtd;

    // Sem promo, inativa ou cliente BALCÃO → só aplica desconto à vista no fim
    if (!p || !p.ativa || ehBalcao) {
      const d = toNum(descontoPerc);
      const total = totalBase - (totalBase * d) / 100;
      return Number(total.toFixed(2));
    }

    // Regras da promoção
    const min = toNum(p.qtde_minima_item ?? 1);
    let max = toNum(p.qtde_maxima_item ?? 0); // 0/null => sem limite por cliente

    // Disponível da promoção = total - vendido
    const promoTotal = toNum(p.qtd_total_item ?? 0);
    const promoUsado = toNum(p.qtdvendido ?? 0);
    const promoDisp = Math.max(0, promoTotal - promoUsado);

    if (qtd >= min && promoDisp > 0) {
      if (!(max > 0)) max = qtd; // sem máximo explícito → usa a própria qtd

      // Quantas unidades entram com preço promocional (limitadas pelo disponível)
      const unidadesComDesconto = Math.min(qtd, max, promoDisp);
      const unidadesSemDesconto = Math.max(0, qtd - unidadesComDesconto);

      // Preço promocional unitário
      const tipo = String(
        p.tipo_desconto_item ?? p.tipo_desconto_promocao_geral ?? '',
      ).toUpperCase();
      const valor = toNum(
        p.valor_desconto_item ?? p.valor_desconto_promocao_geral ?? 0,
      );

      let precoPromoUnit = unit;
      if (tipo === 'PERC') {
        if (valor > 0) precoPromoUnit = unit * (1 - valor / 100);
      } else {
        // qualquer outro tipo: valor é o PREÇO UNITÁRIO absoluto da promoção
        if (valor > 0) precoPromoUnit = valor;
      }

      if (!Number.isFinite(precoPromoUnit) || precoPromoUnit < 0) {
        precoPromoUnit = unit;
      }

      totalBase =
        precoPromoUnit * unidadesComDesconto + unit * unidadesSemDesconto;
    }
    // else: não atingiu mínimo ou não há disponível → totalBase já é tudo a preço normal

    // Aplica "desconto à vista" (%) no final
    const d = toNum(descontoPerc);
    const total = totalBase - (totalBase * d) / 100;

    return Number(total.toFixed(2));
  }
  // Disponível da promoção (qtd_total_item - qtdvendido)
  function getDisponivelPromo(p: any): number {
    const total = toNum(p?.qtd_total_item ?? 0);
    const usado = toNum(p?.qtdvendido ?? 0);
    return Math.max(0, total - usado);
  }

  React.useEffect(() => {
    const isMine = ctxGlobal.area === 'tableProd';
    setOpenContextMenu(ctxGlobal.open && isMine);
    if (ctxGlobal.open && isMine) {
      if (ctxGlobal.index != null) setIndexItem(ctxGlobal.index);
      if (ctxGlobal.points) setPoints(ctxGlobal.points);
    }
  }, [ctxGlobal.open, ctxGlobal.area, ctxGlobal.index, ctxGlobal.points]);

  // Divide a quantidade entre "com promoção" e "normal",
  // respeitando mínimo, máximo por cliente e disponível da promoção.
  // Retorna os números para pintar no input.
  function getSplitPromoQuantidade(item: any, qtd: number) {
    const p = item?.promocoes?.[0];
    const ehBalcao = isTipoBalcao(item?.tipoPreço);
    const quantidade = toNum(qtd);

    if (!p || !p.ativa || ehBalcao) return { promo: 0, normal: quantidade };

    const min = toNum(p.qtde_minima_item ?? 1);
    let max = toNum(p.qtde_maxima_item ?? 0); // 0/null => sem limite por cliente
    const disp = getDisponivelPromo(p);

    if (quantidade < min || disp <= 0) return { promo: 0, normal: quantidade };
    if (!(max > 0)) max = quantidade;

    const promo = Math.min(quantidade, max, disp);
    const normal = Math.max(0, quantidade - promo);
    return { promo, normal };
  }

  // --- Conversão robusta para número (aceita "2,51", "1.234,56", etc.)
  // --- Conversão robusta para número (aceita "3.0000", "2.56", "1.234,56", "2,51" etc.)
  function toNum(v: any): number {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v === null || v === undefined) return 0;

    let s = String(v).trim();
    if (!s) return 0;

    // mantém apenas dígitos, vírgula, ponto e sinal
    s = s.replace(/[^\d,.\-]/g, '');

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      // Escolhe o separador decimal pelo último símbolo encontrado
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // vírgula é decimal → remove pontos de milhar e troca vírgula por ponto
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // ponto é decimal → remove vírgulas de milhar
        s = s.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // apenas vírgula → decimal é vírgula
      s = s.replace(',', '.');
    } // apenas ponto → já está correto

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  // --- Preço promocional (usa tipo/valor do item; fallback para campos gerais)
  function getPrecoPromocional(item: any): number | null {
    const precoBase = toNum(item?.preço);
    const p = item?.promocoes?.[0];
    if (!p) return null;

    // 1) Preferência: campos por item
    const tipoItem = String(p.tipo_desconto_item ?? '').toUpperCase(); // "PERC" ou (valor)
    const descItem = toNum(p.valor_desconto_item);

    // 2) Fallback: campos gerais da promoção
    const tipoGeral = String(
      p.tipo_desconto_promocao_geral ?? '',
    ).toUpperCase();
    const descGeral = toNum(p.valor_desconto_promocao_geral);

    const tipo = tipoItem || tipoGeral;
    const desc = descItem || descGeral;

    let precoPromo = precoBase;

    if (tipo === 'PERC' || tipo === 'P') {
      // percentual: 3.0000 => 3%
      precoPromo = precoBase * (1 - desc / 100);
    } else if (desc > 0) {
      // valor absoluto em reais
      precoPromo = precoBase - desc;
    } else {
      // Se nada válido, não há promo calculável
      return null;
    }

    // trava inferior e normaliza
    if (!Number.isFinite(precoPromo)) return null;
    if (precoPromo < 0) precoPromo = 0;

    return precoPromo;
  }

  // --- DETECTA BALCÃO (com/sem acento)
  function isTipoBalcao(tipo: string | undefined): boolean {
    const t = String(tipo ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
    return t === 'BALCAO';
  }

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

  const handleAtualizarDescF = (indexDesc: number, novoDesc: string) => {
    if (indexDesc === undefined || indexDesc === null) return;

    // Clona a base visível
    const novoArr = data2?.map((v) => ({ ...v })) ?? [];

    data2?.forEach((val, ind) => {
      const index = ind;

      // mantém sua validação original
      if (
        val?.codigo &&
        (val?.descrição || val.descrição === '') &&
        (val?.estoque || val.estoque === '') &&
        (val?.preço || val.preço === '')
      ) {
        if (index === indexDesc) {
          const qtd = toNum(val.quantidade);
          const precoUnit = toNum(val.precoItemEditado ?? val.preço);

          const novoTotal = calcularTotalComPromocao({
            item: val,
            precoUnit,
            quantidade: qtd,
            descontoPerc: toNum(novoDesc), // << desconto à vista (%)
          });

          // atualiza o item alterado
          novoArr[index].codigo = val?.codigo;
          novoArr[index].descrição = val?.descrição;
          novoArr[index].estoque = val?.estoque;
          novoArr[index].preço = val?.preço;
          novoArr[index].ref = val?.ref;
          novoArr[index].quantidade = val.quantidade; // mantém a quantidade atual
          novoArr[index].totalItem = novoTotal.toFixed(2); // <<< subtotal correto
          novoArr[index].precoItemEditado = val?.precoItemEditado;
          novoArr[index].descriçãoEditada = val.descriçãoEditada
            ? val.descriçãoEditada
            : val.descrição;
          novoArr[index].desconto = toNum(novoDesc); // <<< persiste o % de desconto à vista
        } else {
          // mantém os demais itens como estavam
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
          novoArr[index].desconto = val?.desconto;
        }
      }
    });

    // força re-render com o item atualizado
    setData(novoArr);

    // manda o item ATUALIZADO pro carrinho (se aplicável no seu fluxo)
    if (cliente) handleCarrinho(novoArr[indexDesc]);
  };

  const mudouPagina = async (dados: { pagina: string; linhas: string }) => {
    const qytLinhas = Number(dados.linhas);
    const pagina = Number(dados.pagina);
    const indPagina = qytLinhas * pagina;
    setIndexPagina(indPagina);
  };

  const handleAtualizarQuant = (indexQuant: number, novoQuant: string) => {
    if (!novoQuant) return;

    const novoArr = data2?.map((val) => val);
    data2?.map((val, ind) => {
      const index = ind;
      if (
        val?.codigo &&
        (val?.descrição || val.descrição === '') &&
        (val?.estoque || val.estoque === '') &&
        (val?.preço || val.preço === '')
      ) {
        if (index === indexQuant) {
          const qtd = toNum(novoQuant);
          const precoUnit = toNum(val.precoItemEditado ?? val.preço);
          const descPerc = toNum(novoArr[index]?.desconto ?? 0);

          const novoTotal = calcularTotalComPromocao({
            item: val,
            precoUnit,
            quantidade: qtd,
            descontoPerc: descPerc,
          });

          novoArr[index].codigo = val?.codigo;
          novoArr[index].descrição = val?.descrição;
          novoArr[index].estoque = val?.estoque;
          novoArr[index].preço = val?.preço;
          novoArr[index].ref = val?.ref;
          novoArr[index].quantidade = novoQuant;
          novoArr[index].totalItem = novoTotal.toFixed(2);
          novoArr[index].precoItemEditado = val.precoItemEditado;
          novoArr[index].descriçãoEditada = val.descriçãoEditada
            ? val.descriçãoEditada
            : val.descrição;
        } else {
          if (novoArr[index]) {
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

    setData(novoArr);
    if (cliente) handleCarrinho(novoArr[indexQuant]);
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
      const quantT = novoArr.map((v) => v.quantidade);
      setQuant(quantT);

      const descT = data2.map((val) => val.desconto);
      setDesc(descT);
      handleCarrinho(data2[indexItem]);
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

  return (
    <div
      onClick={() => {
        setOpenContextMenu(false);
        onCtxChange?.({ ...ctxGlobal, open: false });
      }}
      className="w-[100%] select-none h-full text-[10px] lg:text-[12px]  "
    >
      <div className=" h-[100%] border-b border-t border-gray-300 w-[100%] flex justify-center items-center ">
        <div className=" w-[100%]  h-[98%]">
          <div className="flex flex-col w-full h-[100%]  dark:border-gray-800">
            <div className="flex-grow w-full h-[100%]   overflow-auto">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <div key={Number(index + indexPagina)}>
                    {/*box 1 - 2 box um a direita e outro a esquerda  */}
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setIndexItem(index);
                        setPoints({
                          x: e.pageX,
                          y: e.pageY,
                        });
                        setOpenContextMenu(true); // ⬅️ ADICIONE
                        onCtxChange?.({
                          // ⬅️ ADICIONE
                          open: true,
                          area: 'tableProd',
                          index,
                          points: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      className="grid grid-cols-1 w-full lg:grid-cols-2 gap-1 border-b  border-gray-300 "
                    >
                      {openContextMenu && indexItem === index + indexPagina
                        ? (() => {
                            // dimensões do menu (compatíveis com suas classes)
                            const MENU_W = 200;
                            const MENU_H = 350;
                            const GAP = 10;

                            // viewport + scroll (coordenadas de página, compatíveis com e.pageX/e.pageY)
                            const vpW =
                              typeof window !== 'undefined'
                                ? window.innerWidth
                                : 0;
                            const vpH =
                              typeof window !== 'undefined'
                                ? window.innerHeight
                                : 0;
                            const scrollX =
                              typeof window !== 'undefined'
                                ? window.pageXOffset
                                : 0;
                            const scrollY =
                              typeof window !== 'undefined'
                                ? window.pageYOffset
                                : 0;

                            // posição base (abaixo e à direita do clique)
                            let left = (points?.x ?? 0) + GAP;
                            let top = (points?.y ?? 0) + GAP;

                            // se estourar à direita, recua para caber
                            const rightEdge = scrollX + vpW;
                            if (left + MENU_W > rightEdge - GAP) {
                              left = Math.max(
                                rightEdge - MENU_W - GAP,
                                scrollX + GAP,
                              );
                            }

                            // se estourar embaixo, abre pra cima
                            const bottomEdge = scrollY + vpH;
                            if (top + MENU_H > bottomEdge - GAP) {
                              top = (points?.y ?? 0) - MENU_H - GAP;
                              if (top < scrollY + GAP) top = scrollY + GAP; // garante que não cole no topo
                            }

                            return (
                              <div
                                className={`absolute z-40 ${
                                  openContextMenu ? 'flex' : 'hidden'
                                }`}
                                style={{ left, top }}
                                onClick={(e) => e.stopPropagation()} // ⬅️ ADICIONE
                                onContextMenu={(e) => e.stopPropagation()} // (opcional)
                              >
                                <div className="w-[200px] text-[12px] h-[350px] rounded-md bg-[#fefefe] border shadow-lg border-gray-300 overflow-auto">
                                  <div className="w-full">
                                    <div className="px-2 dark:hover:text-blue-600 hover:text-blue-600 text-gray-400 dark:text-gray-300 hover:bg-gray-50 w-full h-10 flex justify-center items-center min-w-32">
                                      <div className="h-full w-[100%] flex justify-center">
                                        <div className="w-full flex items-center">
                                          <div
                                            className="w-full"
                                            id="decreaseButton"
                                            onClick={() => {
                                              produtoSelecionado(
                                                String(indexItem),
                                              );
                                              setOpenConfirma(true);
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
                                            }}
                                          >
                                            <div className="w-full flex justify-start">
                                              <div className="w-full space-x-1 flex justify-start items-center">
                                                <LuShoppingBasket
                                                  size={20}
                                                  className="flex"
                                                />
                                                <div className="flex w-full">
                                                  Pedidos realizados
                                                </div>
                                                <div className="text-[11px] flex w-14 justify-end">
                                                  Ctrl + R
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="px-2 border-t hover:text-violet-600 text-gray-400 dark:text-gray-300 hover:bg-gray-50 w-full h-10 flex justify-center items-center min-w-32">
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
                                            }}
                                          >
                                            <div className="w-full flex justify-start">
                                              <div className="w-full space-x-1 flex justify-start items-center">
                                                <BsShop
                                                  size={20}
                                                  className="flex"
                                                />
                                                <div className="flex w-full">
                                                  Pedidos na fábrica
                                                </div>
                                                <div className="text-[11px] flex w-14 justify-end">
                                                  Ctrl + B
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="px-2 border-t hover:text-orange-600 text-gray-400 dark:text-gray-300 hover:bg-gray-50 w-full h-10 flex justify-center items-center min-w-32">
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
                                            }}
                                          >
                                            <div className="w-full flex justify-start">
                                              <div className="w-full space-x-1 flex justify-start items-center">
                                                <FaDoorOpen
                                                  size={20}
                                                  className="flex"
                                                />
                                                <div className="flex w-full">
                                                  Entrada do Pedido
                                                </div>
                                                <div className="text-[11px] flex w-14 justify-end">
                                                  Ctrl + N
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
                            );
                          })()
                        : null}

                      {/* Coluna 1 da linha */}
                      {/* LINHA: descrição | ícone promo (mobile) | estoque (mobile) */}
                      <div className="grid grid-cols-4 lg:grid-cols-10 w-full gap-1">
                        {/* COLUNA 1 — DESCRIÇÃO (mobile = 2 frações; desktop = 9 colunas) */}
                        <div className="h-full col-span-2 lg:col-span-9 w-full flex items-center">
                          <div className="w-full ">
                            <div className="px-4 flex w-full">
                              <div className="flex w-full font-bold">
                                <div className="flex w-[100%] items-center space-x-2 font-bold">
                                  {/* Bandeira */}
                                  <img
                                    src={
                                      data2[index + indexPagina]?.origem === 'N'
                                        ? '/images/brasil.png'
                                        : '/images/importado.png'
                                    }
                                    alt="origem"
                                    className="w-5 h-[14px] object-contain"
                                  />
                                  {/* Referência e descrição */}
                                  <span>
                                    {data2[index + indexPagina]?.ref} -{' '}
                                    {data2[index + indexPagina]?.descrição}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* bloco de marca + preços (mantido) */}
                            <div className="px-4 h-full mt-1">
                              <div className="flex w-full space-x-6">
                                <div className="flex space-x-1 text-gray-700 dark:text-gray-400 justify-start">
                                  <div className="flex h-full text-gray-400">
                                    marca:
                                  </div>
                                  <div className="flex h-full">
                                    {data2?.[
                                      index + indexPagina
                                    ]?.marca.substring(0, 30)}
                                  </div>
                                </div>

                                {/* PREÇO base + PREÇO PROMO (mantido) */}
                                <div className="flex w-auto items-center space-x-1 text-slate-800">
                                  {(() => {
                                    const item = data2[
                                      index + indexPagina
                                    ] as any;
                                    const promocao = item?.promocoes?.[0];

                                    const ehBalcao = isTipoBalcao(
                                      item?.tipoPreço,
                                    );
                                    const ativa = Boolean(promocao?.ativa);
                                    const qtdeMinima = toNum(
                                      promocao?.qtde_minima_item ?? 1,
                                    );
                                    const quantidade = toNum(
                                      item?.quantidade ?? 0,
                                    );
                                    const atingiuMinimo =
                                      quantidade >= qtdeMinima;

                                    const podeMostrarPromo =
                                      ativa && atingiuMinimo && !ehBalcao;
                                    const precoBase = toNum(item?.preço);
                                    const precoPromo = podeMostrarPromo
                                      ? getPrecoPromocional(item)
                                      : null;

                                    return (
                                      <>
                                        <div className="flex h-full text-gray-400">
                                          preço{' '}
                                          {String(
                                            item?.tipoPreço || '',
                                          ).toLowerCase()}
                                          :
                                        </div>

                                        {/* Preço base (risca quando a promoção é aplicável) */}
                                        <div
                                          className={
                                            'flex items-center ' +
                                            (podeMostrarPromo
                                              ? 'line-through text-gray-400'
                                              : 'text-gray-500 dark:text-gray-400')
                                          }
                                        >
                                          {MascaraReal(precoBase)}
                                        </div>

                                        {/* Preço promocional */}
                                        {podeMostrarPromo &&
                                          precoPromo !== null && (
                                            <>
                                              <div className="ml-2 flex h-full text-green-600 dark:text-green-400">
                                                preço promo:
                                              </div>
                                              <div className="flex items-center font-semibold text-green-600 dark:text-green-400">
                                                {MascaraReal(precoPromo)}
                                              </div>
                                            </>
                                          )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* COLUNA 2 — ÍCONE PROMO (MOBILE-ONLY) */}
                        {/* COLUNA 2 — ÍCONE PROMO ou KICKBACK (MOBILE-ONLY) */}
                        <div className="col-span-1 lg:hidden flex items-center justify-center">
                          {(() => {
                            const item = data2[index + indexPagina] as any;

                            // pega a primeira promoção, se houver
                            const p =
                              (item?.promocoes &&
                                Array.isArray(item.promocoes) &&
                                item.promocoes[0]) ||
                              item?.promocao ||
                              null;

                            const ehBalcao = isTipoBalcao(item?.tipoPreço);
                            const temPromoAtiva =
                              Boolean(p?.ativa) && !ehBalcao;

                            // 1) Se houver PROMO ativa (regra normal de mobile), mostra ícone de promoção
                            if (temPromoAtiva) {
                              const quantidade = toNum(
                                quant[index + indexPagina] ??
                                  item?.quantidade ??
                                  0,
                              );
                              const qtdeMinima = toNum(
                                p?.qtde_minima_item ?? 1,
                              );

                              // disponível da promoção: total - vendido
                              const promoDisp = Math.max(
                                0,
                                toNum(p?.qtd_total_item ?? 0) -
                                  toNum(p?.qtdvendido ?? 0),
                              );

                              // ícone fica amarelo só se atingiu a mínima e ainda há disponível
                              const ativaVisual =
                                quantidade >= qtdeMinima && promoDisp > 0;

                              return (
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
                                      setPopoverPosition(null);
                                      setPromocaoSelecionada(null);
                                    }
                                  }}
                                  className="inline-flex items-center justify-center"
                                  aria-label="Informações da promoção"
                                  title="Informações da promoção"
                                >
                                  <BadgePercent
                                    className={`${
                                      ativaVisual
                                        ? 'text-yellow-500 dark:text-yellow-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                    } w-5 h-5`}
                                  />
                                </button>
                              );
                            }

                            // 2) Caso NÃO mostre promo, mas o cliente tenha KICKBACK => mostra ícone KICKBACK com toggle
                            if (kickback) {
                              const cod = String(
                                item?.CODPROD ??
                                  item?.codprod ??
                                  item?.codproduto ??
                                  index + indexPagina,
                              );
                              const ativo = !!kickbackMarcadoPorProduto[cod];

                              return (
                                <div className="relative group z-50">
                                  <FaGift
                                    size={20}
                                    title="KICKBACK"
                                    className={`cursor-pointer transition-colors ${
                                      ativo ? 'text-green-500' : 'text-zinc-400'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setKickbackMarcadoPorProduto((prev) => ({
                                        ...prev,
                                        [cod]: !prev[cod],
                                      }));
                                    }}
                                  />
                                  {/* tooltip simples (no mobile pode não aparecer, mas não atrapalha) */}
                                </div>
                              );
                            }

                            // 3) Nenhuma condição satisfeita: não mostra nada
                            return null;
                          })()}
                        </div>

                        {/* COLUNA 3 — ESTOQUE (MOBILE-ONLY) */}
                        <div
                          className="col-span-1 lg:hidden flex items-end mr-5 flex-col cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const i = index + indexPagina;
                            setIndexItem(i);
                            setPoints({ x: e.pageX - 200, y: e.pageY }); // você já desloca -200 no X
                            setOpenContextMenu(true); // <-- ABRE local
                            onCtxChange?.({
                              open: true,
                              area: 'tableProd', // se for o bloco do componente de cima; use 'tableProdRef' no de baixo
                              index: i,
                              points: { x: e.clientX, y: e.clientY },
                            });
                          }}
                        >
                          <div className="flex flex-col">
                            <div className="h-full flex items-center">
                              <div className="flex w-full font-bold text-sm">
                                <div className="h-4 flex w-[100%] justify-center font-bold text-[10px]">
                                  Estoque
                                </div>
                              </div>
                            </div>
                            <div className="text-blue-400 font-bold h-auto flex justify-center">
                              <div className="w-[100%] h-8 flex justify-center items-center rounded-md">
                                <div className="h-full w-[100%] flex justify-center">
                                  <div className="flex items-center">
                                    {data2[index + indexPagina].estoque}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Coluna 2 da linha */}
                      <div className="flex w-full   items-center  ">
                        {/* COLUNA — ÍCONE PROMO ou KICKBACK (DESKTOP, MESMA POSIÇÃO) */}
                        <div className="w-[12%] hidden lg:flex flex-col overflow-visible">
                          <div className="h-full flex items-center">
                            <div className="flex w-full font-bold text-sm">
                              <div className="h-4 flex w-[100%] justify-center font-bold text-[10px]"></div>
                            </div>
                          </div>

                          <div className="text-blue-400 font-bold h-auto flex justify-center">
                            <div className="w-[100%] h-8 flex justify-center items-center rounded-md min-w-32">
                              <div className="h-full w-[100%] flex justify-center">
                                <div className="flex items-center relative">
                                  {(() => {
                                    const item = data2[
                                      index + indexPagina
                                    ] as any;

                                    // primeira promoção, se houver
                                    const p =
                                      (item?.promocoes &&
                                        Array.isArray(item.promocoes) &&
                                        item.promocoes[0]) ||
                                      item?.promocao ||
                                      null;

                                    const ehBalcao = isTipoBalcao(
                                      item?.tipoPreço,
                                    );
                                    const temPromoAtiva =
                                      Boolean(p?.ativa) && !ehBalcao;

                                    // 1) Se houver PROMO ativa, mostra ícone de promoção
                                    if (temPromoAtiva) {
                                      const quantidade = toNum(
                                        quant[index + indexPagina] ??
                                          item?.quantidade ??
                                          0,
                                      );
                                      const qtdeMinima = toNum(
                                        p?.qtde_minima_item ?? 1,
                                      );

                                      // disponível da promoção: total - vendido
                                      const promoDisp = Math.max(
                                        0,
                                        toNum(p?.qtd_total_item ?? 0) -
                                          toNum(p?.qtdvendido ?? 0),
                                      );

                                      // cor amarela só se atingiu a mínima e há disponível
                                      const ativaVisual =
                                        quantidade >= qtdeMinima &&
                                        promoDisp > 0;

                                      return (
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
                                              setPopoverPosition(null);
                                              setPromocaoSelecionada(null);
                                            }
                                          }}
                                          className="inline-flex items-center justify-center"
                                          aria-label="Informações da promoção"
                                          title="Informações da promoção"
                                        >
                                          <BadgePercent
                                            className={`${
                                              ativaVisual
                                                ? 'text-yellow-500 dark:text-yellow-400'
                                                : 'text-gray-400 dark:text-gray-500'
                                            } w-5 h-5`}
                                          />
                                        </button>
                                      );
                                    }

                                    // 2) Sem promo visível, mas com KICKBACK => ícone KICKBACK com toggle + tooltip
                                    if (kickback) {
                                      const cod = String(
                                        item?.CODPROD ??
                                          item?.codprod ??
                                          item?.codproduto ??
                                          index + indexPagina,
                                      );
                                      const ativo =
                                        !!kickbackMarcadoPorProduto[cod];

                                      return (
                                        <div className="relative group z-10">
                                          <FaGift
                                            size={20}
                                            title="KICKBACK"
                                            className={`cursor-pointer transition-colors ${
                                              ativo
                                                ? 'text-green-500'
                                                : 'text-zinc-400'
                                            }`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setKickbackMarcadoPorProduto(
                                                (prev) => ({
                                                  ...prev,
                                                  [cod]: !prev[cod],
                                                }),
                                              );
                                            }}
                                          />
                                          {/* tooltip acima e centralizado; sobrepõe o que estiver acima */}
                                          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-10 shadow-lg">
                                            KICKBACK
                                          </span>
                                        </div>
                                      );
                                    }

                                    // 3) Nada a mostrar
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="w-[12%] hidden lg:flex flex-col  ">
                          <div className=" h-full flex items-center  ">
                            <div className="flex w-full   font-bold text-sm ">
                              <div className="h-4 flex w-[100%] justify-center font-bold  text-[10px] ">
                                Estoque
                              </div>
                            </div>
                          </div>
                          <div className=" text-blue-400 font-bold h-auto flex justify-center ">
                            <div className=" w-[100%] h-8 flex justify-center items-center  rounded-md  min-w-32  ">
                              <div className=" h-full w-[100%] flex justify-center">
                                <div
                                  className="flex items-center cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const i = index + indexPagina;
                                    setIndexItem(i);
                                    setPoints({ x: e.pageX, y: e.pageY }); // mantém sua métrica
                                    setOpenContextMenu(true); // <-- ABRE local
                                    onCtxChange?.({
                                      // <-- avisa o pai (opcional)
                                      open: true,
                                      area: 'tableProd',
                                      index: i,
                                      points: { x: e.clientX, y: e.clientY }, // se quiser também guardar no global
                                    });
                                  }}
                                >
                                  {data2[index + indexPagina].estoque}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="h-full   flex  w-[25%]   ">
                          <div className={` w-full mb-2 flex justify-center  `}>
                            <div
                              className={`flex flex-col  w-[90%]  justify-center `}
                            >
                              <div className="flex w-full h-full  font-bold text-sm ">
                                <div
                                  className="flex w-[100%] h-full justify-center font-bold  text-[10px]
                                            dark:text-gray-300"
                                >
                                  Desconto à vista
                                </div>
                              </div>
                              <div className=" w-[100%] h-[90%]   ">
                                <div className=" items-center w-[100%] flex">
                                  <div
                                    className={`mr-1 h-6 w-8 flex justify-center items-center  rounded ${
                                      !descontoTodos &&
                                      quant[index + indexPagina] !== '0'
                                        ? 'bg-violet-600  dark:bg-violet-400 dark:hover:bg-violet-600 hover:bg-violet-400 active:bg-violet-700'
                                        : 'bg-gray-300  dark:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300 '
                                    }
                                              border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none 
                                              active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none`}
                                    onClick={() => {
                                      if (
                                        !descontoTodos &&
                                        quant[index + indexPagina] !== '0'
                                      ) {
                                        let qytF = Number(
                                          desc[index + indexPagina],
                                        );

                                        if (Number(qytF) - 1 >= 0) {
                                          qytF -= 1;
                                          setDesc((oldArray) => {
                                            const newArray = [...oldArray];
                                            newArray[index + indexPagina] =
                                              qytF;
                                            return newArray;
                                          });

                                          handleAtualizarDescF(
                                            index + indexPagina,
                                            String(qytF),
                                          );
                                        } else {
                                          setDesc((oldArray) => {
                                            const newArray = [...oldArray];
                                            newArray[index + indexPagina] = 0;
                                            return newArray;
                                          });
                                          handleAtualizarDescF(
                                            index + indexPagina,
                                            '0',
                                          );
                                        }
                                      }
                                    }}
                                  >
                                    <FaMinus className="w-full h-[12px]" />
                                  </div>
                                  <input
                                    id="amountInput"
                                    type="number"
                                    value={data2[index + indexPagina].desconto}
                                    className="text-sm  
                                          leading-6  h-6 w-full bg-transparent
                                          placeholder:text-slate-400 border border-slate-200 
                                          rounded-md uppercase text-center 
                                          [&::-webkit-outer-spin-button]:appearance-none 
                                          [&::-webkit-inner-spin-button]:appearance-none
                                          focus:outline-none"
                                    onChange={(e) => {
                                      setDesc((oldArray) => {
                                        const newArray = [...oldArray];
                                        newArray[index + indexPagina] = Number(
                                          e.target.value,
                                        );
                                        return newArray;
                                      });
                                      handleAtualizarDescF(
                                        index + indexPagina,
                                        e.target.value,
                                      );

                                      //                                handleQty(Number(e.target.value));
                                    }}
                                  />
                                  <div
                                    className={`ml-1 h-6 w-8 flex justify-center items-center  rounded ${
                                      !descontoTodos &&
                                      quant[index + indexPagina] !== '0'
                                        ? 'bg-violet-600  dark:bg-violet-400 dark:hover:bg-violet-600 hover:bg-violet-400 active:bg-violet-700'
                                        : 'bg-gray-300  dark:bg-gray-600 dark:hover:bg-gray-600 hover:bg-gray-300 '
                                    }
                                              border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none 
                                                active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none`}
                                    onClick={() => {
                                      if (
                                        !descontoTodos &&
                                        quant[index + indexPagina] !== '0'
                                      ) {
                                        let qytF = Number(
                                          desc[index + indexPagina],
                                        );

                                        if (qytF) {
                                          qytF += 1;
                                          setDesc((oldArray) => {
                                            const newArray = [...oldArray];
                                            newArray[index + indexPagina] =
                                              qytF;
                                            return newArray;
                                          });
                                          handleAtualizarDescF(
                                            index + indexPagina,
                                            String(qytF),
                                          );
                                        } else {
                                          setDesc((oldArray) => {
                                            const newArray = [...oldArray];
                                            newArray[index + indexPagina] = 1;
                                            return newArray;
                                          });
                                          handleAtualizarDescF(
                                            index + indexPagina,
                                            String('1'),
                                          );
                                        }
                                      }
                                    }}
                                  >
                                    <FaPlus className="w-full h-[12px]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="  flex  items-center w-[25%]   ">
                          <div className={` w-full mb-2 flex justify-center`}>
                            <div
                              className={`h-full  flex flex-col  w-[90%]  justify-center    sm:mb-0 sm:justify-center sm:ml-0  
                                              text-sm `}
                            >
                              <div className="flex w-full   font-bold text-sm ">
                                <div
                                  className="flex w-[100%] h-full justify-center font-bold  text-[10px]
                                            dark:text-gray-300"
                                >
                                  Quantidade
                                </div>
                              </div>
                              <div className=" w-[100%] h-[90%]   ">
                                <div className=" items-center w-[100%] flex">
                                  <div
                                    className="mr-1 h-6 w-8 flex justify-center items-center  rounded bg-gray-600  dark:bg-gray-400 dark:hover:bg-gray-600 hover:bg-gray-400 
                                   border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none 
                                   active:bg-gray-700  active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                                    onClick={() => {
                                      let qytF = Number(
                                        quant[index + indexPagina],
                                      );

                                      if (Number(qytF) - 1 >= 0) {
                                        qytF -= 1;
                                        setQuant((oldArray) => {
                                          const newArray = [...oldArray];
                                          newArray[index + indexPagina] =
                                            String(qytF);
                                          return newArray;
                                        });

                                        handleAtualizarQuant(
                                          index + indexPagina,
                                          String(qytF),
                                        );
                                      } else {
                                        setQuant((oldArray) => {
                                          const newArray = [...oldArray];
                                          newArray[index + indexPagina] = '0';
                                          return newArray;
                                        });
                                        handleAtualizarQuant(
                                          index + indexPagina,
                                          '0',
                                        );
                                      }
                                    }}
                                  >
                                    <FaMinus className="w-full h-[12px]" />
                                  </div>
                                  <div className="relative w-full">
                                    <input
                                      id="amountInput"
                                      type="number"
                                      value={
                                        data2[index + indexPagina].quantidade
                                      }
                                      className="text-sm leading-6 h-6 w-full bg-transparent
               placeholder:text-slate-400 border border-slate-200 
               rounded-md uppercase text-center
               [&::-webkit-outer-spin-button]:appearance-none 
               [&::-webkit-inner-spin-button]:appearance-none
               focus:outline-none
               text-transparent caret-slate-800"
                                      onChange={(e) => {
                                        const qytF =
                                          Number(e.target.value) || 0;
                                        if (e.target.value) {
                                          if (
                                            Number(
                                              data2[index + indexPagina]
                                                .estoque,
                                            ) > qytF
                                          ) {
                                            setQuant((oldArray) => {
                                              const newArray = [...oldArray];
                                              newArray[index + indexPagina] =
                                                e.target.value;
                                              return newArray;
                                            });
                                            handleAtualizarQuant(
                                              index + indexPagina,
                                              e.target.value,
                                            );
                                          } else {
                                            setQuant((oldArray) => {
                                              const newArray = [...oldArray];
                                              newArray[index + indexPagina] =
                                                data2[
                                                  index + indexPagina
                                                ].estoque;
                                              return newArray;
                                            });
                                            handleAtualizarQuant(
                                              index + indexPagina,
                                              data2[index + indexPagina]
                                                .estoque,
                                            );
                                          }
                                        } else {
                                          handleAtualizarQuant(
                                            index + indexPagina,
                                            '-',
                                          );
                                        }
                                      }}
                                    />

                                    {/* overlay colorido */}
                                    {/* overlay colorido dentro do wrapper do input */}
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
                                      {(() => {
                                        const item = data2[
                                          index + indexPagina
                                        ] as any;
                                        const quantidade = toNum(
                                          quant[index + indexPagina] ??
                                            item?.quantidade ??
                                            0,
                                        );
                                        const { promo, normal } =
                                          getSplitPromoQuantidade(
                                            item,
                                            quantidade,
                                          );

                                        if (promo > 0 && normal > 0) {
                                          return (
                                            <>
                                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                                {promo}
                                              </span>
                                              <span className="mx-1 text-slate-500">
                                                +
                                              </span>
                                              <span className="text-slate-700 dark:text-slate-300">
                                                {normal}
                                              </span>
                                            </>
                                          );
                                        }
                                        if (promo > 0) {
                                          return (
                                            <span className="text-green-600 dark:text-green-400 font-semibold">
                                              {promo}
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="text-slate-700 dark:text-slate-300">
                                            {quantidade}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  <div
                                    className=" ml-1 h-6 w-8 flex justify-center items-center  rounded bg-gray-600 dark:bg-gray-400 dark:hover:bg-gray-600 
                                  hover:bg-gray-400  border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none active:bg-gray-700  active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                                    onClick={() => {
                                      let qytF = Number(
                                        quant[index + indexPagina],
                                      );

                                      if (qytF) {
                                        if (
                                          Number(
                                            data2[index + indexPagina].estoque,
                                          ) > qytF
                                        )
                                          qytF += 1;

                                        setQuant((oldArray) => {
                                          const newArray = [...oldArray];
                                          newArray[index + indexPagina] =
                                            String(qytF);
                                          return newArray;
                                        });
                                        handleAtualizarQuant(
                                          index + indexPagina,
                                          String(qytF),
                                        );
                                      } else {
                                        if (
                                          Number(
                                            data2[index + indexPagina].estoque,
                                          ) > 0
                                        ) {
                                          setQuant((oldArray) => {
                                            const newArray = [...oldArray];
                                            newArray[index + indexPagina] = '1';
                                            return newArray;
                                          });
                                          handleAtualizarQuant(
                                            index + indexPagina,
                                            String('1'),
                                          );
                                        } else {
                                          setQuant((oldArray) => {
                                            const newArray = [...oldArray];
                                            newArray[index + indexPagina] = '0';
                                            return newArray;
                                          });
                                          handleAtualizarQuant(
                                            index + indexPagina,
                                            String('0'),
                                          );
                                        }
                                      }
                                    }}
                                  >
                                    <FaPlus className="w-full h-[12px]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className=" h-full flex  items-center justify-end w-[48%] lg:w-[24%] lg:justify-center  ">
                          <div>
                            <div
                              className={`mb-2 ${
                                cliente ? 'flex flex-col' : 'hidden'
                              }  w-[100%]  justify-start    sm:mb-0 sm:justify-center sm:ml-0  
                              text-sm `}
                            >
                              <div className="flex w-full   font-bold text-sm ">
                                <div
                                  className="flex w-[100%] h-full justify-center font-bold  text-[10px]
                                            dark:text-gray-300"
                                >
                                  Subtotal
                                </div>
                              </div>
                              <div className=" w-[100%] h-[90%]   ">
                                <div className=" items-center w-[100%] flex">
                                  <div className=" h-full w-[100%] flex justify-center">
                                    <div className=" flex items-center font-bold text-sm   text-green-600 dark:text-gray-200">
                                      {MascaraReal(
                                        Number(
                                          data[index + indexPagina].totalItem,
                                        ),
                                      )}
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
      <div className=" bg-blue-50 dark:bg-slate-700    flex h-10 border-b items-center  space-x-5 justify-center">
        <DataTablePagination table={table} mudouPagina={mudouPagina} />
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
      {popoverPosition && promocaoSelecionada && (
        <PopoverInfoPromo
          promocao={promocaoSelecionada}
          position={popoverPosition}
          onClose={() => {
            setPopoverPosition(null);
            setPromocaoSelecionada(null);
          }}
        />
      )}
    </div>
  );
};
export default DataTablecolumns;
