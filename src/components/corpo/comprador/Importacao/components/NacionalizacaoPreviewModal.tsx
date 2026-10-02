/**
 * Modal de PREVIEW da(s) NF-e de nacionalização.
 * Mostra as notas montadas (sem transmitir) com chave, totais e download do XML.
 */
import React from 'react';
import { X, FileDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NotaPreview {
  modo: string;
  cod_exportador?: string;
  seq_nota: number;
  chave: string;
  totais: { vProd: number; vII: number; vIPI: number; vICMS: number; vNF: number };
  xml: string;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onTrocarModo?: (modo: 'POR_DI' | 'POR_EXPORTADOR') => void;
  carregando?: boolean;
  resultado: {
    modo: string;
    di: { nro_di: string };
    qtd_itens: number;
    qtd_adicoes: number;
    notas: NotaPreview[];
  } | null;
}

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function baixarXml(nota: NotaPreview, nroDi: string) {
  const blob = new Blob([nota.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sufixo = nota.cod_exportador ? `_${nota.cod_exportador.replace(/\W+/g, '').slice(0, 12)}` : '';
  a.download = `nacionalizacao_DI${nroDi}${sufixo}_seq${nota.seq_nota}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

export const NacionalizacaoPreviewModal: React.FC<Props> = ({
  aberto,
  onFechar,
  onTrocarModo,
  carregando,
  resultado,
}) => {
  if (!aberto || !resultado) return null;

  const btnModo = (modo: 'POR_DI' | 'POR_EXPORTADOR', label: string) => (
    <button
      disabled={carregando || resultado.modo === modo}
      onClick={() => onTrocarModo?.(modo)}
      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
        resultado.modo === modo
          ? 'bg-[#347AB6] text-white border-[#347AB6]'
          : 'bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-zinc-600 hover:bg-gray-50'
      } disabled:opacity-60`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h4 className="text-lg font-bold text-[#347AB6] flex items-center gap-2">
            <FileText size={18} /> Preview — Nota(s) de Nacionalização
          </h4>
          <button onClick={onFechar} className="text-gray-500 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-3 flex-1 overflow-auto">
          <div className="mb-3 text-sm text-gray-600 dark:text-gray-300 flex flex-wrap gap-x-6 gap-y-1">
            <span>DI: <b>{resultado.di.nro_di}</b></span>
            <span>Modo: <b>{resultado.modo}</b></span>
            <span>Itens: <b>{resultado.qtd_itens}</b></span>
            <span>Adições: <b>{resultado.qtd_adicoes}</b></span>
            <span>Notas geradas: <b>{resultado.notas.length}</b></span>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Modo:</span>
            {btnModo('POR_DI', 'Por DI (1 nota)')}
            {btnModo('POR_EXPORTADOR', 'Por exportador (N notas)')}
            {carregando && <span className="text-xs text-gray-400">gerando…</span>}
          </div>

          <div className="mb-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            Preview em homologação — <b>não transmite ao SEFAZ</b>. Valores fiscais finais (vOutro,
            PIS/COFINS, IBS/CBS) dependem do alinhamento com a contabilidade.
          </div>

          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div className="bg-gray-100 dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 flex gap-2">
              <div className="w-10 text-center">#</div>
              <div className="flex-1">Chave / Exportador</div>
              <div className="w-28 text-right">vProd</div>
              <div className="w-28 text-right">vNF</div>
              <div className="w-20 text-center">XML</div>
            </div>
            {resultado.notas.map((n, i) => (
              <div
                key={i}
                className="flex gap-2 items-center px-3 py-2 text-xs border-t border-gray-100 dark:border-zinc-700"
              >
                <div className="w-10 text-center text-gray-500">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-gray-800 dark:text-gray-100 truncate">{n.chave}</div>
                  {n.cod_exportador && (
                    <div className="text-[10px] text-gray-500 truncate">{n.cod_exportador}</div>
                  )}
                </div>
                <div className="w-28 text-right text-gray-700 dark:text-gray-300">{fmtBRL(n.totais.vProd)}</div>
                <div className="w-28 text-right font-semibold text-gray-900 dark:text-gray-100">{fmtBRL(n.totais.vNF)}</div>
                <div className="w-20 text-center">
                  <button
                    onClick={() => baixarXml(n, resultado.di.nro_di)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-50 dark:bg-blue-900/20 text-[#347AB6] dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800"
                  >
                    <FileDown size={11} /> Baixar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button variant="outline" size="sm" onClick={onFechar}>Fechar</Button>
        </div>
      </div>
    </div>
  );
};
