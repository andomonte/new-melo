'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileText, FileSpreadsheet, Eraser, Plus, UserPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Lançar um título novo do DDA como conta a pagar (pré-preenche o form Nova Conta). */
  onLancarConta?: (titulo: Titulo) => void;
  /** Abrir o modal de cadastro de fornecedor pré-preenchido com o cedente do DDA. */
  onPedirCadastro?: (cedente: { nome: string; cnpj: string; cnpjFmt: string; tipo: 'F' | 'J' }) => void;
  /** Sinal para re-processar o arquivo (ex.: após cadastrar um fornecedor). */
  reprocessarSignal?: number;
}

interface Cedente {
  cnpj: string; cnpjFmt: string; nome: string; tipo: 'F' | 'J';
  cadastrado: boolean; cod_credor: string | null; nome_credor: string | null;
  qtdTitulos: number; valorTotal: number;
}
interface Titulo {
  banco: string; registro: string; codbar: string; tipoInscricao: 'F' | 'J';
  cnpj: string; cnpjFmt: string; nome: string;
  dtVenc: string | null; valor: number; documento: string; agencia: string;
  especie: string; dtEmissao: string | null; cadastrado: boolean; cod_credor: string | null;
  ja_lancado: boolean; cod_pgto_existente: string | null; pago_existente: boolean;
}
interface Resultado {
  banco: string;
  cedentes: Cedente[];
  titulos: Titulo[];
  resumo: { totalTitulos: number; valorTotal: number; cedentesCadastrados: number; cedentesNaoCadastrados: number; titulosJaLancados: number; titulosNovos: number; linhasInvalidas: number };
}

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: string | null) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
};
const baixarBlob = (blob: Blob, nome: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ModalImportarDDA({ isOpen, onClose, onLancarConta, onPedirCadastro, reprocessarSignal }: Props) {
  const [processando, setProcessando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [aba, setAba] = useState<'cedentes' | 'titulos'>('cedentes');
  const [ultimoBase64, setUltimoBase64] = useState<string | null>(null); // p/ re-processar após cadastro
  const fileRef = useRef<HTMLInputElement>(null);

  const importarBase64 = async (base64: string, nome?: string, manterAba = false) => {
    setProcessando(true);
    if (!manterAba) setRes(null);
    try {
      const r = await fetch('/api/contas-pagar/dda/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivoBase64: base64, nome }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Falha ao processar o arquivo DDA');
      setRes(data);
      if (!manterAba) setAba('cedentes');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar DDA');
    } finally {
      setProcessando(false);
    }
  };

  const processar = async (file: File) => {
    const buf = await file.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    setUltimoBase64(base64);
    await importarBase64(base64, file.name);
  };

  // Re-processa quando o pai sinaliza (ex.: após cadastrar um fornecedor) para atualizar
  // o "Cadastrado?" e liberar o "Lançar", mantendo a aba atual.
  useEffect(() => {
    if (reprocessarSignal && ultimoBase64) importarBase64(ultimoBase64, nomeArquivo, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprocessarSignal]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNomeArquivo(f.name);
    processar(f);
  };

  const limpar = () => { setRes(null); setNomeArquivo(''); setUltimoBase64(null); if (fileRef.current) fileRef.current.value = ''; };

  const exportarNaoCadastrados = async () => {
    if (!res) return;
    const naoCad = res.cedentes.filter((c) => !c.cadastrado);
    if (naoCad.length === 0) { toast.info('Todos os cedentes já estão cadastrados.'); return; }
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Cedentes não cadastrados');
      ws.addRow(['CEDENTE', 'CNPJ/CPF', 'TIPO', 'QTD. TÍTULOS', 'VALOR TOTAL']);
      ws.getRow(1).font = { bold: true };
      naoCad.forEach((c) => ws.addRow([c.nome, c.cnpjFmt, c.tipo === 'F' ? 'PF' : 'PJ', c.qtdTitulos, c.valorTotal]));
      ws.getColumn(5).numFmt = '#,##0.00';
      ws.columns.forEach((col, i) => { col.width = i === 0 ? 40 : i === 1 ? 22 : 14; });
      const buf = await wb.xlsx.writeBuffer();
      baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `dda-nao-cadastrados-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e instanceof Error ? e.message : ''));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar Arquivo DDA" width="w-[97%] max-w-7xl">
      <div className="space-y-3 p-1">
        {/* Opções */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <input ref={fileRef} type="file" accept=".ret,.txt,.dda,.cnab,.rem,*" onChange={onFile} className="hidden" id="dda-file" />
          <label htmlFor="dda-file"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md cursor-pointer text-sm font-medium">
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Processar arquivo
          </label>
          {nomeArquivo && <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{nomeArquivo}</span>}
          {res && <Button variant="outline" size="sm" onClick={limpar}><Eraser className="w-3.5 h-3.5 mr-1" />Limpar</Button>}
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={exportarNaoCadastrados} disabled={!res}>
              <FileSpreadsheet className="w-4 h-4 mr-1" />Exportar Não Cadastrados
            </Button>
          </div>
          <p className="text-xs text-muted-foreground w-full">
            Arquivo DDA que o banco envia (CNAB240 / Itaú). Lê os títulos registrados e mostra os cedentes, indicando quais já estão no cadastro de fornecedores.
          </p>
        </div>

        {res && (
          <>
            {/* Abas */}
            <div className="flex items-center gap-1 text-sm">
              <button onClick={() => setAba('cedentes')} className={`px-4 py-1.5 rounded-t-md border-b-2 ${aba === 'cedentes' ? 'border-blue-600 font-semibold text-blue-700 dark:text-blue-300' : 'border-transparent text-muted-foreground'}`}>
                Cedentes ({res.cedentes.length})
              </button>
              <button onClick={() => setAba('titulos')} className={`px-4 py-1.5 rounded-t-md border-b-2 ${aba === 'titulos' ? 'border-blue-600 font-semibold text-blue-700 dark:text-blue-300' : 'border-transparent text-muted-foreground'}`}>
                Títulos ({res.titulos.length})
              </button>
            </div>

            {/* Grid */}
            <div className="border rounded-md overflow-auto max-h-[52vh]">
              {aba === 'cedentes' ? (
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800">
                    <tr>
                      <th className="px-2 py-1 border-b text-left">Cedente</th>
                      <th className="px-2 py-1 border-b text-left">CNPJ / CPF</th>
                      <th className="px-2 py-1 border-b text-center">Tipo</th>
                      <th className="px-2 py-1 border-b text-center">Cadastrado?</th>
                      <th className="px-2 py-1 border-b text-right">Qtd. Títulos</th>
                      <th className="px-2 py-1 border-b text-right">Valor Total</th>
                      <th className="px-2 py-1 border-b text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.cedentes.map((c) => (
                      <tr key={c.cnpj} className="border-b hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-2 py-1">{c.nome}{c.nome_credor && c.nome_credor !== c.nome ? <span className="text-muted-foreground"> · {c.nome_credor}</span> : ''}</td>
                        <td className="px-2 py-1 font-mono">{c.cnpjFmt}</td>
                        <td className="px-2 py-1 text-center">{c.tipo === 'F' ? 'PF' : 'PJ'}</td>
                        <td className="px-2 py-1 text-center">
                          {c.cadastrado
                            ? <span className="text-green-700 dark:text-green-400 font-medium">SIM{c.cod_credor ? ` (${c.cod_credor})` : ''}</span>
                            : <span className="text-red-600 font-medium">NÃO</span>}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{c.qtdTitulos}</td>
                        <td className="px-2 py-1 text-right tabular-nums">R$ {brl(c.valorTotal)}</td>
                        <td className="px-2 py-1 text-center">
                          {!c.cadastrado && onPedirCadastro && (
                            <button
                              type="button"
                              onClick={() => onPedirCadastro({ nome: c.nome, cnpj: c.cnpj, cnpjFmt: c.cnpjFmt, tipo: c.tipo })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                            >
                              <UserPlus className="w-3 h-3" /> Cadastrar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800">
                    <tr>
                      <th className="px-2 py-1 border-b text-left">Cedente</th>
                      <th className="px-2 py-1 border-b text-left">CNPJ / CPF</th>
                      <th className="px-2 py-1 border-b text-left">Documento</th>
                      <th className="px-2 py-1 border-b text-left">Espécie</th>
                      <th className="px-2 py-1 border-b text-center">Emissão</th>
                      <th className="px-2 py-1 border-b text-center">Vencimento</th>
                      <th className="px-2 py-1 border-b text-right">Valor</th>
                      <th className="px-2 py-1 border-b text-center">Cadastrado?</th>
                      <th className="px-2 py-1 border-b text-center">Título no CAP?</th>
                      <th className="px-2 py-1 border-b text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.titulos.map((t, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                        <td className="px-2 py-1">{t.nome}</td>
                        <td className="px-2 py-1 font-mono">{t.cnpjFmt}</td>
                        <td className="px-2 py-1 font-mono">{t.documento || '—'}</td>
                        <td className="px-2 py-1">{t.especie}</td>
                        <td className="px-2 py-1 text-center">{fmtData(t.dtEmissao)}</td>
                        <td className="px-2 py-1 text-center">{fmtData(t.dtVenc)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">R$ {brl(t.valor)}</td>
                        <td className="px-2 py-1 text-center">{t.cadastrado ? <span className="text-green-700 dark:text-green-400">SIM</span> : <span className="text-red-600">NÃO</span>}</td>
                        <td className="px-2 py-1 text-center">
                          {t.ja_lancado
                            ? <span className="text-blue-700 dark:text-blue-300 font-medium">{t.pago_existente ? 'Pago' : 'Lançado'} ({t.cod_pgto_existente})</span>
                            : <span className="text-amber-600 font-medium">Novo</span>}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {!t.ja_lancado && t.cadastrado && onLancarConta ? (
                            <button
                              type="button"
                              onClick={() => onLancarConta(t)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded"
                            >
                              <Plus className="w-3 h-3" /> Lançar
                            </button>
                          ) : !t.ja_lancado && !t.cadastrado && onPedirCadastro ? (
                            <button
                              type="button"
                              onClick={() => onPedirCadastro({ nome: t.nome, cnpj: t.cnpj, cnpjFmt: t.cnpjFmt, tipo: t.tipoInscricao })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                            >
                              <UserPlus className="w-3 h-3" /> Cadastrar
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rodapé */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm border-t pt-2">
              <span>Banco: <strong>{res.banco}</strong></span>
              <span>Títulos: <strong>{res.resumo.totalTitulos}</strong> · R$ {brl(res.resumo.valorTotal)}</span>
              <span className="text-green-700 dark:text-green-400">Cedentes cadastrados: <strong>{res.resumo.cedentesCadastrados}</strong></span>
              <span className="text-red-600">Cedentes não cadastrados: <strong>{res.resumo.cedentesNaoCadastrados}</strong></span>
              <span className="text-blue-700 dark:text-blue-300">Já lançados no CAP: <strong>{res.resumo.titulosJaLancados}</strong></span>
              <span className="text-amber-600">Novos (a lançar): <strong>{res.resumo.titulosNovos}</strong></span>
              {res.resumo.linhasInvalidas > 0 && <span className="text-amber-600">Linhas ignoradas (tam. ≠ 240): {res.resumo.linhasInvalidas}</span>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
