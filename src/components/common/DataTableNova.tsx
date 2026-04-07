import React, {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SelectInput from './SelectInput2';
import SearchInput from './SearchInput';
import Carregamento from '@/utils/carregamento';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronsLeft, // << novo
  ChevronsRight, // >> novo
} from 'lucide-react';
import { Meta } from '../../data/common/meta';

type SortDir = 'asc' | 'desc';

/** Novo formato:
 * - número ou string numérica (com/sem %) = percentual fixo (ex.: 20, '33.3', '40%')
 * - '*'    = flex (peso 1)
 * - '2*'   = flex com peso 2
 * - '0.5*' = flex com peso 0.5
 */
type SizeSpec = number | string | null | undefined;

interface DataTableProps {
  headers: string[]; // rótulos em ordem
  columnKeys: string[]; // chaves do row na MESMA ordem dos headers
  rows: Record<string, any>[];

  sizes?: SizeSpec[]; // novo formato explicado acima

  meta: Meta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;

  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSearchBlur?: () => void;
  searchInputPlaceholder?: string;
  // filtro de coluna para a busca
  searchField?: string; // ex.: 'todos' | 'codvenda' | 'codcli' | ...
  searchFieldOptions?: { value: string; label: string }[]; // opcional
  onSearchFieldChange?: (value: string) => void;

  // ordenação (opcional)
  sortKeys?: (string | null)[];
  sortBy?: string | null;
  sortDir?: SortDir;
  onChangeSort?: (sortBy: string, sortDir: SortDir) => void;

  // render custom por coluna (opcional)
  cellRenderers?: Record<
    string,
    (row: Record<string, any>, rowIndex: number) => React.ReactNode
  >;

  loading: boolean;
}

/* ========== Helpers de largura ========== */

function parseFixedPercent(tok: string): number | null {
  // "40", "40%", "33.3", "33.3%"
  const s = tok.trim().replace('%', '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseFlexWeight(tok: string): number | null {
  // "*", "2*", "0.5*"
  const m = tok.trim().match(/^(\d*\.?\d+)?\s*\*$/);
  if (!m) return null;
  const raw = m[1];
  if (!raw) return 1; // "*" => peso 1
  const w = Number(raw);
  return Number.isFinite(w) && w > 0 ? w : 1;
}

/** Gera larguras (%), somando fixos e dividindo restante por pesos flex */
function computeColWidths(len: number, sizes?: SizeSpec[]): string[] {
  const norm: SizeSpec[] = Array.from(
    { length: len },
    (_, i) => sizes?.[i] ?? '*',
  );

  let sumFixedPct = 0;
  let sumFlexWeight = 0;
  const parsed: Array<{ kind: 'fixed' | 'flex'; val: number }> = [];

  for (const s of norm) {
    if (typeof s === 'number') {
      sumFixedPct += s;
      parsed.push({ kind: 'fixed', val: s });
      continue;
    }
    if (typeof s === 'string') {
      const pct = parseFixedPercent(s);
      if (pct !== null) {
        sumFixedPct += pct;
        parsed.push({ kind: 'fixed', val: pct });
        continue;
      }
      const w = parseFlexWeight(s);
      if (w !== null) {
        sumFlexWeight += w;
        parsed.push({ kind: 'flex', val: w });
        continue;
      }
    }
    // fallback: flex peso 1
    sumFlexWeight += 1;
    parsed.push({ kind: 'flex', val: 1 });
  }

  // se só tem fixos e >100%, normalize proporcionalmente
  if (sumFixedPct > 100 && sumFlexWeight === 0) {
    return parsed.map((p) =>
      p.kind === 'fixed' ? `${(p.val / sumFixedPct) * 100}%` : '0%',
    );
  }

  const remaining = Math.max(0, 100 - sumFixedPct);

  return parsed.map((p) => {
    if (p.kind === 'fixed') return `${p.val}%`;
    if (sumFlexWeight === 0) return '0%';
    return `calc(${remaining}% * ${p.val} / ${sumFlexWeight})`;
  });
}

function ColGroup({ widths }: { widths: string[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/* ========== Ícone de ordenação ========== */
function SortIcon({ active, dir }: { active: boolean; dir?: SortDir }) {
  if (!active) return <ArrowUpDown size={14} className="opacity-60" />;
  return dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
}

/* ========== Componente principal (duas tabelas) ========== */
export default function DataTable({
  headers,
  columnKeys,
  rows,
  sizes,

  meta,
  onPageChange,
  onPerPageChange,

  onSearch,
  onSearchKeyDown,
  onSearchBlur,
  searchInputPlaceholder,

  searchField,
  searchFieldOptions,
  onSearchFieldChange,
  sortKeys,
  sortBy,
  sortDir = 'desc',
  onChangeSort,

  cellRenderers,
  loading = false,
}: DataTableProps) {
  const colCount = headers.length;
  const widths = useMemo(
    () => computeColWidths(colCount, sizes),
    [colCount, sizes],
  );

  // compensação da barra de rolagem do corpo no header (padding-right)
  const bodyWrapRef = useRef<HTMLDivElement | null>(null);
  const [headerPadRight, setHeaderPadRight] = useState(0);

  // ⬇️ adicione:
  const [bodyHeight, setBodyHeight] = useState(0);

  useEffect(() => {
    const el = bodyWrapRef.current;
    if (!el) return;

    const calc = () => {
      const scrollbar = el.offsetWidth - el.clientWidth;
      setHeaderPadRight(scrollbar > 0 ? scrollbar : 0);

      // ⬇️ NOVO: guarda a altura disponível do body para centralizar o loader
      setBodyHeight(el.clientHeight);
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener('resize', calc);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calc);
    };
  }, []);

  // abaixo de handlePrev / handleNext:
  const handleFirst = () => meta.currentPage > 1 && onPageChange(1);
  const handleLast = () =>
    meta.currentPage < meta.lastPage && onPageChange(meta.lastPage);

  useEffect(() => {
    const el = bodyWrapRef.current;
    if (!el) return;

    const calc = () => {
      const scrollbar = el.offsetWidth - el.clientWidth;
      setHeaderPadRight(scrollbar > 0 ? scrollbar : 0);
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener('resize', calc);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', calc);
    };
  }, []);

  const handleHeaderClick = (i: number) => {
    if (!onChangeSort || !sortKeys?.length) return;
    const key = sortKeys[i];
    if (!key) return; // coluna não ordenável
    const same = sortBy === key;
    const next: SortDir = same ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    onChangeSort(key, next);
  };

  const handlePrev = () =>
    meta.currentPage > 1 && onPageChange(meta.currentPage - 1);
  const handleNext = () =>
    meta.currentPage < meta.lastPage && onPageChange(meta.currentPage + 1);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-300 rounded-lg overflow-hidden max-w-full flex flex-col h-[calc(100vh-10rem)]">
      {/* Busca */}
      {/* Busca */}
      <div className="p-2">
        <div className="flex items-center gap-2">
          {/* Select de coluna da busca */}
          <div className="w-44">
            <SelectInput
              name="searchField"
              label=""
              value={String(searchField ?? 'TODAS')}
              options={
                searchFieldOptions && searchFieldOptions.length > 0
                  ? searchFieldOptions
                  : // fallback: monta opções a partir de sortKeys + headers
                    [
                      { value: 'todas', label: 'TODAS' },
                      ...(Array.isArray(sortKeys)
                        ? (sortKeys
                            .map((k, i) =>
                              k
                                ? {
                                    value: String(k),
                                    label: headers[i] ?? String(k),
                                  }
                                : null,
                            )
                            .filter(Boolean) as {
                            value: string;
                            label: string;
                          }[])
                        : []),
                    ]
              }
              onValueChange={(v) => onSearchFieldChange?.(v)}
            />
          </div>
          {/* Input de texto para a busca */}
          <SearchInput
            placeholder={searchInputPlaceholder ?? 'Pesquisar...'}
            onChange={onSearch}
            onKeyDown={onSearchKeyDown}
            onBlur={onSearchBlur}
          />
        </div>
      </div>

      {/* ===== HEADER TABLE (fixa) ===== */}
      <div className="border-b border-gray-300 dark:border-zinc-700">
        <Table
          className="min-w-full table-fixed text-sm text-center text-gray-700 dark:text-gray-200"
          style={{ paddingRight: headerPadRight }}
        >
          <ColGroup widths={widths} />
          <TableHeader>
            <TableRow className="bg-gray-100 dark:bg-zinc-800">
              {headers.map((label, i) => {
                const skey = sortKeys?.[i];
                const active = !!skey && sortBy === skey;

                // 💡 1. Verifica se é a última coluna
                const isLastColumn = i === headers.length - 1;

                return (
                  <TableHead
                    key={i}
                    className={`py-2 font-bold uppercase ${
                      // Mantemos o px-0 ou ajustamos conforme o alinhamento de texto (esquerda/centro)
                      isLastColumn ? 'px-0  text-center' : 'px-0 text-center'
                    } ${
                      skey ? 'cursor-pointer select-none hover:opacity-90' : ''
                    }`}
                    onClick={() => handleHeaderClick(i)}
                    title={skey ? 'Clique para ordenar' : undefined}
                    // 💡 2. Aplica o padding-right como estilo inline APENAS na última coluna
                    style={
                      isLastColumn
                        ? { paddingRight: headerPadRight }
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <span>{label}</span>
                      {/* renderiza SEMPRE o ícone nas colunas ordenáveis (neutro/asc/desc) */}
                      {skey ? <SortIcon active={active} dir={sortDir} /> : null}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* ===== BODY WRAPPER + BODY TABLE (rolável) ===== */}
      <div ref={bodyWrapRef} className="flex-grow overflow-y-auto">
        <Table className="min-w-full table-fixed text-sm text-center text-gray-700 dark:text-gray-200">
          <ColGroup widths={widths} />
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-10">
                  <div
                    className="flex items-center justify-center"
                    style={{ height: bodyHeight }}
                  >
                    <Carregamento texto="Carregando dados..." />
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-10">
                  Sem dados até o momento.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rIdx) => (
                <TableRow
                  key={rIdx}
                  className="bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all duration-200"
                >
                  {columnKeys.map((key, cIdx) => (
                    <TableCell
                      key={cIdx}
                      className={`px-0 py-2 text-center ${
                        cIdx === columnKeys.length - 1
                          ? 'whitespace-nowrap'
                          : ''
                      }`}
                    >
                      {cellRenderers?.[key]?.(row, rIdx) ?? row?.[key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="border-t border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
        <Table className="min-w-full table-fixed text-sm text-center text-gray-700 dark:text-gray-200">
          <TableFooter>
            <TableRow>
              <TableCell colSpan={colCount} className="border-none">
                <div className="flex justify-between items-center px-2 py-1">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-sm">Qtd. Itens:</span>
                    <SelectInput
                      name="itemsPagina"
                      label=""
                      value={meta?.perPage?.toString() ?? ''}
                      options={[
                        { value: '10', label: '10' },
                        { value: '25', label: '25' },
                        { value: '50', label: '50' },
                        { value: '100', label: '100' },
                      ]}
                      onValueChange={(v) => onPerPageChange?.(Number(v))}
                    />
                  </div>
                  <div className="flex gap-2 items-center text-sm">
                    {/* << primeira */}
                    <button
                      onClick={handleFirst}
                      disabled={meta?.currentPage === 1}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                      title="Primeira página"
                    >
                      <ChevronsLeft size={18} />
                    </button>

                    {/* < anterior */}
                    <button
                      onClick={handlePrev}
                      disabled={meta?.currentPage === 1}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                      title="Página anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <span className="whitespace-nowrap">
                      Página {meta?.currentPage} de {meta?.lastPage}
                    </span>

                    {/* > próxima */}
                    <button
                      onClick={handleNext}
                      disabled={meta?.currentPage === meta?.lastPage}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                      title="Próxima página"
                    >
                      <ChevronRight size={18} />
                    </button>

                    {/* >> última */}
                    <button
                      onClick={handleLast}
                      disabled={meta?.currentPage === meta?.lastPage}
                      className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 disabled:opacity-40"
                      title="Última página"
                    >
                      <ChevronsRight size={18} />
                    </button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
