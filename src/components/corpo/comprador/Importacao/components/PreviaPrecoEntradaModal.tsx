/**
 * Modal SOMENTE INFORMATIVO: itens de uma entrada de importação e o "antes → depois"
 * do Confirmar Preço (custo de compra em US$, taxa do dólar, custo em R$ e preço de
 * venda). Os valores "depois" vêm de uma simulação do próprio Confirmar Preço no
 * servidor, desfeita em seguida (GET /api/entradas/:codent/previa-preco).
 */
import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';

interface Valores {
  prcompra: number;
  txdolar: number | null;
  custoReais: number;
  prvenda: number | null;
}
interface Linha {
  codprod: string;
  ref: string | null;
  descr: string | null;
  ordem: string;
  quant: number;
  custoUnit: number;
  total: number;
  dolar: boolean;
  antes: Valores;
  depois: Valores;
}
interface Previa {
  entrada: {
    codent: string;
    codCredor: string | null;
    credorNome: string | null;
    nrodi: string | null;
    cotacao: number | null;
    confirmada: boolean;
  };
  simulado: boolean;
  itens: Linha[];
}

const num = (v: number | null | undefined, casas = 2) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "antes → depois", destacando quando muda. */
const AntesDepois: React.FC<{ antes: number | null; depois: number | null; casas?: number; prefixo?: string }> = ({
  antes, depois, casas = 2, prefixo = '',
}) => {
  const mudou = antes != null && depois != null && Math.abs(antes - depois) >= 10 ** -casas / 2;
  if (!mudou) return <span>{prefixo}{num(depois ?? antes, casas)}</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="text-gray-400 line-through mr-1">{num(antes, casas)}</span>
      <span className={(depois ?? 0) > (antes ?? 0) ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
        {prefixo}{num(depois, casas)}
      </span>
    </span>
  );
};

export const PreviaPrecoEntradaModal: React.FC<{ codent: string | null; onClose: () => void }> = ({ codent, onClose }) => {
  const [dados, setDados] = useState<Previa | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!codent) return;
    setDados(null);
    setErro(null);
    setLoading(true);
    api
      .get(`/api/entradas/${codent}/previa-preco`)
      .then((r) => setDados(r.data))
      .catch((e) => setErro(e.response?.data?.message || e.message || 'Erro ao carregar os itens'))
      .finally(() => setLoading(false));
  }, [codent]);

  if (!codent) return null;

  const totalUsd = (dados?.itens || []).reduce((s, i) => s + i.total, 0);
  const totalQtd = (dados?.itens || []).reduce((s, i) => s + i.quant, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Entrada {codent}
              {dados?.entrada.codCredor && (
                <span className="font-normal"> — {dados.entrada.codCredor} {dados.entrada.credorNome}</span>
              )}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {dados?.entrada.nrodi ? `DI ${dados.entrada.nrodi} · ` : ''}
              {dados ? `${dados.itens.length} item(ns)` : ''}
              {dados?.entrada.cotacao ? ` · cotação da DI ${num(dados.entrada.cotacao, 4)}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Calculando a prévia do preço...
            </div>
          )}
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {erro}
            </div>
          )}
          {dados && (
            <>
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  {dados.simulado ? (
                    <>
                      <b>Somente informativo.</b> Mostra o que o Confirmar Preço vai gravar (valor riscado = atual,
                      verde/vermelho = novo). Nada é alterado ao abrir esta tela.
                    </>
                  ) : (
                    <><b>Preço já confirmado.</b> Valores atuais do produto.</>
                  )}{' '}
                  Custo do item em <b>US$</b> (produto importado); custo em R$ = custo de compra × taxa do dólar.
                </span>
              </div>

              <div className="border border-gray-200 dark:border-zinc-700 rounded-md overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-zinc-900/50 text-gray-500 dark:text-gray-400 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Produto</th>
                      <th className="px-2 py-2 text-left font-medium">OC</th>
                      <th className="px-2 py-2 text-right font-medium">Qtd</th>
                      <th className="px-2 py-2 text-right font-medium">Custo unit. (US$)</th>
                      <th className="px-2 py-2 text-right font-medium">Total (US$)</th>
                      <th className="px-2 py-2 text-right font-medium">Custo compra (US$)</th>
                      <th className="px-2 py-2 text-right font-medium">Taxa dólar</th>
                      <th className="px-2 py-2 text-right font-medium">Custo (R$)</th>
                      <th className="px-2 py-2 text-right font-medium">Preço venda (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((i) => (
                      <tr key={`${i.codprod}|${i.ordem}`} className="border-t border-gray-100 dark:border-zinc-700">
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-gray-800 dark:text-gray-200">
                            {i.codprod} {i.ref ? `· ${i.ref}` : ''}
                          </div>
                          <div className="text-gray-500 truncate max-w-[280px]" title={i.descr || ''}>{i.descr}</div>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">{i.ordem}</td>
                        <td className="px-2 py-1.5 text-right">{num(i.quant, 0)}</td>
                        <td className="px-2 py-1.5 text-right">{num(i.custoUnit)}</td>
                        <td className="px-2 py-1.5 text-right">{num(i.total)}</td>
                        <td className="px-2 py-1.5 text-right"><AntesDepois antes={i.antes.prcompra} depois={i.depois.prcompra} /></td>
                        <td className="px-2 py-1.5 text-right">
                          {i.dolar ? <AntesDepois antes={i.antes.txdolar} depois={i.depois.txdolar} casas={4} /> : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right"><AntesDepois antes={i.antes.custoReais} depois={i.depois.custoReais} /></td>
                        <td className="px-2 py-1.5 text-right"><AntesDepois antes={i.antes.prvenda} depois={i.depois.prvenda} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-zinc-900/50 font-medium">
                    <tr className="border-t border-gray-200 dark:border-zinc-700">
                      <td className="px-2 py-2" colSpan={2}>Total</td>
                      <td className="px-2 py-2 text-right">{num(totalQtd, 0)}</td>
                      <td />
                      <td className="px-2 py-2 text-right">US$ {num(totalUsd)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
};
