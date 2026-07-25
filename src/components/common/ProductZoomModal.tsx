"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Package,
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Boxes,
  Info,
  Hash,
  Tag,
  FileText,
  RefreshCw,
  AlertTriangle,
  ArrowDownUp,
  Warehouse,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductZoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string | number | null;
  product?: any | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(value: any): string {
  if (!value) return "\u2014";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "\u2014";
}

function formatCurrency(value: any): string {
  if (value === null || value === undefined || value === "") return "\u2014";
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(num)) return "\u2014";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

function formatPercent(value: any): string {
  if (value === null || value === undefined || value === "") return "\u2014";
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(num)) return "\u2014";
  return `${num}%`;
}

function display(value: any): string {
  if (value === null || value === undefined || value === "") return "\u2014";
  return String(value);
}

function numVal(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single labeled field inside a card grid */
function FieldBox({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 ${className ?? ""}`}
    >
      <span className="block text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <strong className="mt-0.5 block text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </strong>
    </div>
  );
}

/** Price row inside cost card */
function PriceRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-3 py-2 ${
        highlight
          ? "bg-blue-50 dark:bg-blue-950/40"
          : "bg-white dark:bg-slate-800"
      }`}
    >
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`text-sm font-medium tabular-nums ${
          highlight
            ? "text-blue-700 dark:text-blue-300"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** Section header inside cost card */
function CostSectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </span>
    </div>
  );
}

/** Card wrapper */
function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Loading skeleton */
function Skeleton() {
  return (
    <div className="animate-pulse space-y-5 p-6">
      <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 gap-5">
        <div className="h-72 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-72 rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProductZoomModal({
  open,
  onOpenChange,
  productId,
  product,
}: ProductZoomModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idToFetch = productId ?? product?.codprod;
  const needsFetch = !!idToFetch && !product?.prcustoatual; // fetch if no full data

  const fetchProduct = useCallback(async () => {
    if (!idToFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/produtos/get/${idToFetch}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const row = await res.json();
      if (row?.error) throw new Error(row.error);
      setData(row);
    } catch (err: any) {
      setError(err?.message ?? "Erro ao carregar produto");
    } finally {
      setLoading(false);
    }
  }, [idToFetch]);

  useEffect(() => {
    if (!open) return;
    if (needsFetch) {
      fetchProduct();
    } else if (product) {
      setData(product);
    }
  }, [open, needsFetch, product, fetchProduct]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
    }
  }, [open]);

  // Keyboard shortcut Ctrl+Z to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const p: any = data ?? {};

  // Stock helpers
  const estoque = numVal(p.qtest);
  const reservado = numVal(p.qtdreservada);
  const disponivel = estoque - reservado;
  const estoqueMin = numVal(p.qtestmin);

  function stockBadge(qtd: number) {
    if (qtd <= 0)
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
    if (qtd <= estoqueMin && estoqueMin > 0)
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        className="z-[100] flex max-h-[calc(100vh-32px)] w-[min(1180px,calc(100vw-48px))] max-w-[1180px] flex-col gap-0 overflow-hidden rounded-xl border-0 bg-white p-0 shadow-2xl [&>button]:hidden dark:bg-slate-900"
        style={{ backdropFilter: "blur(4px)" }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { e.preventDefault(); onOpenChange(false); }}
      >
        {/* ---- Accessible title (hidden, required by Radix) ---- */}
        <DialogTitle className="sr-only">Zoom do Produto</DialogTitle>
        <DialogDescription className="sr-only">
          Visualize todas as informações do produto
        </DialogDescription>

        {/* ================================================================
            HEADER
        ================================================================ */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Zoom dos Dados do Produto
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspeção detalhada &mdash; cadastro, custos e estoque
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 sm:inline-block dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Ctrl+Z
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>
        </div>

        {/* ================================================================
            SCROLLABLE CONTENT
        ================================================================ */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {loading ? (
            <Skeleton />
          ) : error ? (
            /* Error state */
            <div className="flex flex-col items-center justify-center gap-4 p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
                <AlertTriangle className="h-7 w-7 text-rose-500" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchProduct}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </button>
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center p-12">
              <p className="text-sm text-slate-400">Nenhum produto selecionado</p>
            </div>
          ) : (
            <>
              {/* ==============================================================
                  MAIN SUMMARY
              ============================================================== */}
              <div className="border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-slate-900">
                {/* 4 highlight blocks */}
                <div className="flex flex-wrap items-stretch divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/50">
                  {[
                    {
                      icon: Hash,
                      label: "Codigo",
                      value: display(p.codprod),
                      color: "text-blue-600 dark:text-blue-400",
                    },
                    {
                      icon: Tag,
                      label: "Referencia",
                      value: display(p.ref),
                      color: "text-violet-600 dark:text-violet-400",
                    },
                    {
                      icon: BarChart3,
                      label: "Codigo de Barras",
                      value: display(p.codbar),
                      color: "text-emerald-600 dark:text-emerald-400",
                    },
                    {
                      icon: FileText,
                      label: "Marca",
                      value: p.marca_nome ? `${p.codmarca} - ${p.marca_nome}` : display(p.codmarca),
                      color: "text-amber-600 dark:text-amber-400",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex min-w-[140px] flex-1 items-center gap-3 px-5 py-4"
                    >
                      <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                      <div className="min-w-0">
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {item.label}
                        </span>
                        <strong className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {item.value}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full description */}
                <div className="mt-4 space-y-1">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      Descricao:{" "}
                    </span>
                    {display(p.aplic_extendida || p.descr)}
                  </p>
                  {p.reforiginal ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium">Ref. Original:</span>{" "}
                      {p.reforiginal}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* ==============================================================
                  TWO COLUMN LAYOUT
              ============================================================== */}
              <div className="grid gap-5 bg-slate-50 p-5 xl:grid-cols-[1.15fr_0.85fr] dark:bg-slate-950/50">
                {/* ---- LEFT COLUMN ---- */}
                <SectionCard icon={Info} title="Informacoes do Produto">
                  <div className="grid grid-cols-3 gap-3">
                    <FieldBox label="Referencia" value={display(p.ref)} />
                    <FieldBox
                      label="Ref. Original"
                      value={display(p.reforiginal)}
                    />
                    <FieldBox
                      label="Codigo de Barras"
                      value={display(p.codbar)}
                    />
                    <FieldBox label="Marca" value={p.marca_nome ? `${p.codmarca} - ${p.marca_nome}` : display(p.codmarca)} />
                    <FieldBox label="Grupo Função" value={p.grupo_funcao_nome ? `${p.codgpf} - ${p.grupo_funcao_nome}` : display(p.codgpf)} />
                    <FieldBox label="Grupo Produto" value={p.grupo_produto_nome ? `${p.codgpp} - ${p.grupo_produto_nome}` : display(p.codgpp)} />
                    <FieldBox
                      label="Classif. Fiscal"
                      value={display(p.clasfiscal)}
                    />
                    <FieldBox label="Tipo" value={display(p.tipo)} />
                    <FieldBox label="Curva ABC" value={display(p.curva)} />
                    <FieldBox
                      label="Unid. Medida"
                      value={display(p.unimed)}
                    />
                    <FieldBox label="PIS (%)" value={formatPercent(p.pis)} />
                    <FieldBox
                      label="COFINS (%)"
                      value={formatPercent(p.cofins)}
                    />
                    <FieldBox label="IPI (%)" value={formatPercent(p.ipi)} />
                    <FieldBox
                      label="Est. Minimo"
                      value={display(p.qtestmin)}
                    />
                    <FieldBox
                      label="Qtd. Embalagem"
                      value={display(p.qtembal)}
                    />
                    <FieldBox label="Nr. DI" value={display(p.nrodi)} />
                    <FieldBox label="Data DI" value={formatDate(p.dtdi)} />
                    <FieldBox label="Multiplo" value={display(p.multiplo)} />
                    <FieldBox
                      label="Peso Liquido"
                      value={display(p.pesoliq)}
                    />
                    <FieldBox label="Info" value={display(p.inf)} />
                    <FieldBox label="CEST" value={display(p.cest)} />
                  </div>

                  {/* Full width fields */}
                  <div className="mt-3 space-y-3">
                    <FieldBox
                      label="Descricao"
                      value={display(p.descr)}
                      className="col-span-full"
                    />
                    <FieldBox
                      label="Aplicacao Estendida"
                      value={display(p.aplic_extendida)}
                      className="col-span-full"
                    />
                    <FieldBox
                      label="Observacoes"
                      value={display(p.obs)}
                      className="col-span-full"
                    />
                  </div>
                </SectionCard>

                {/* ---- RIGHT COLUMN ---- */}
                <div className="flex flex-col gap-5">
                  {/* Custos e Precos */}
                  <SectionCard icon={DollarSign} title="Custos e Precos">
                    {/* Custo Fabrica */}
                    <CostSectionTitle icon={TrendingDown} title="Custo Fabrica" />
                    <div className="mb-4 space-y-1 rounded-lg border border-slate-100 p-1 dark:border-slate-700">
                      <PriceRow
                        label="Preco Fabrica"
                        value={formatCurrency(p.prfabr)}
                      />
                      <PriceRow
                        label="Preco Liquido"
                        value={formatCurrency(p.prcomprasemst)}
                      />
                      <PriceRow
                        label="Preco NF"
                        value={formatCurrency(p.preconf)}
                      />
                      <PriceRow
                        label="Preco sem NF"
                        value={formatCurrency(p.precosnf)}
                      />
                    </div>

                    {/* Custo Compra */}
                    <CostSectionTitle icon={ArrowDownUp} title="Custo Compra" />
                    <div className="mb-4 space-y-1 rounded-lg border border-slate-100 p-1 dark:border-slate-700">
                      <PriceRow
                        label="Preco Compra"
                        value={formatCurrency(p.prcompra)}
                      />
                      <PriceRow
                        label="Custo Atual"
                        value={formatCurrency(p.prcustoatual)}
                        highlight
                      />
                      <PriceRow
                        label="Preco Medio"
                        value={formatCurrency(p.prmedio)}
                      />
                      <PriceRow
                        label="Taxa Dolar"
                        value={formatCurrency(p.txdolarcompra)}
                      />
                    </div>

                    {/* Precos de Venda */}
                    <CostSectionTitle icon={TrendingUp} title="Precos de Venda" />
                    <div className="space-y-1 rounded-lg border border-slate-100 p-1 dark:border-slate-700">
                      <PriceRow
                        label="Pr. Venda"
                        value={formatCurrency(p.prvenda)}
                        highlight
                      />
                      <PriceRow
                        label="Pr. Importacao"
                        value={formatCurrency(p.primp)}
                      />
                      <PriceRow
                        label="Concorrencia"
                        value={formatCurrency(p.concor)}
                      />
                    </div>
                  </SectionCard>

                  {/* Ultimas Movimentacoes */}
                  <SectionCard icon={Calendar} title="Ultimas Movimentacoes">
                    <div className="grid grid-cols-3 gap-3">
                      {/* Ultima Alteracao */}
                      <div className="flex flex-col items-center gap-2 rounded-xl bg-blue-50 px-3 py-4 dark:bg-blue-950/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          Ult. Alteracao
                        </span>
                        <span className="text-xs font-bold tabular-nums text-blue-900 dark:text-blue-200">
                          {formatDate(p.dtprcustoatual)}
                        </span>
                      </div>

                      {/* Ultima Entrada */}
                      <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 px-3 py-4 dark:bg-emerald-950/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                          <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Ult. Entrada
                        </span>
                        <span className="text-xs font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                          {formatDate(p.dtcompra)}
                        </span>
                      </div>

                      {/* Ultima Venda */}
                      <div className="flex flex-col items-center gap-2 rounded-xl bg-rose-50 px-3 py-4 dark:bg-rose-950/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
                          <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                          Ult. Venda
                        </span>
                        <span className="text-xs font-bold tabular-nums text-rose-900 dark:text-rose-200">
                          {formatDate(p.dtvenda)}
                        </span>
                      </div>
                    </div>
                  </SectionCard>

                  {/* Estoque */}
                  <SectionCard icon={Boxes} title="Estoque">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left - Estoque Total */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Estoque Total
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Em estoque
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${stockBadge(estoque)}`}
                            >
                              {estoque}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Reservado
                            </span>
                            <span className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                              {reservado}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Est. Minimo
                            </span>
                            <span className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                              {estoqueMin}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Filial
                            </span>
                            <span className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                              {numVal(p.qtest_filial)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right - Disponivel */}
                      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Disponivel
                        </span>
                        <span
                          className={`mt-2 text-3xl font-black tabular-nums ${
                            disponivel > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : disponivel === 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {disponivel}
                        </span>
                        <span className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                          (estoque - reservado)
                        </span>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ================================================================
            FOOTER
        ================================================================ */}
        {data ? (
          <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Ultimo inventario:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatDate(p.dtinventario)}
                </span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Cod. {display(p.codprod)}
            </span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default ProductZoomModal;
