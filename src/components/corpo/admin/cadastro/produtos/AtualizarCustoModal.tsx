import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import api from '@/components/services/api';
import { Loader2, Upload, Calculator, Save, FileSpreadsheet } from 'lucide-react';

interface AtualizarCustoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface MarcaOpt {
  codmarca: string;
  descr: string;
}

interface GridRow {
  codprod: string;
  ref: string;
  descricao: string;
  ncm: string;
  ipi: number; // -1 = manter
  pis: number;
  cofins: number;
  barras: string;
  aplicacao: string;
  prBruto: number;
  prNF: number;
  prSNF: number;
  custo: number;
  custoFE: number;
  custoZF: number;
}

// Tabela de split PIS/COFINS (CutPISCOFINS do Delphi): total% -> {pis, cofins}
const TABELA_PISCOFINS: Record<string, { pis: number; cofins: number }> = {
  '3.65': { pis: 0.65, cofins: 3.0 },
  '4.00': { pis: 0.8, cofins: 3.2 },
  '9.25': { pis: 1.65, cofins: 7.6 },
  '11.50': { pis: 2.0, cofins: 9.5 },
  '12.00': { pis: 2.1, cofins: 9.9 },
  '12.50': { pis: 2.2, cofins: 10.3 },
  '13.10': { pis: 2.3, cofins: 10.8 },
  '14.40': { pis: 2.5, cofins: 11.9 },
  '23.63': { pis: 4.21, cofins: 19.42 },
  '28.52': { pis: 5.08, cofins: 23.44 },
  '57.60': { pis: 10.2, cofins: 47.4 },
};

function n(v: any): number {
  const f = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(f) ? 0 : f;
}

// campos mapeáveis: chave -> rótulo e se é obrigatório
const CAMPOS_MAP: Array<{ key: string; label: string; obrig?: boolean }> = [
  { key: 'ref', label: 'Referência', obrig: true },
  { key: 'prBruto', label: 'Preço Bruto (Pr. Fábrica)', obrig: true },
  { key: 'prNF', label: 'Preço NF (com nota)', obrig: true },
  { key: 'prSNF', label: 'Preço SNF (sem nota)', obrig: true },
  { key: 'ncm', label: 'Class. Fiscal (NCM)' },
  { key: 'ipi', label: 'IPI' },
  { key: 'pisCofins', label: 'PIS/COFINS' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'barras', label: 'Código de Barras' },
  { key: 'aplicacao', label: 'Aplicação Extendida' },
];

function letraColuna(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export const AtualizarCustoModal: React.FC<AtualizarCustoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  // parâmetros de cálculo
  const [desconto, setDesconto] = useState('0');
  const [acrescimo, setAcrescimo] = useState('0');
  const [custoFin, setCustoFin] = useState('0');
  const [verbaMkt, setVerbaMkt] = useState('0');
  const [frete, setFrete] = useState('0');
  const [zerarIpi, setZerarIpi] = useState(false);
  const [zerarSt, setZerarSt] = useState(false);

  // fornecedor / marca
  const [codCredor, setCodCredor] = useState('');
  const [codmarca, setCodmarca] = useState('');
  const [marcas, setMarcas] = useState<MarcaOpt[]>([]);

  // opcionais (checkboxes)
  const [opc, setOpc] = useState<Record<string, boolean>>({
    ncm: false,
    ipi: false,
    pisCofins: false,
    barras: false,
    descricao: false,
    aplicacao: false,
  });

  // planilha
  const [colunas, setColunas] = useState<string[]>([]);
  const [dados, setDados] = useState<any[][]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [nomeArquivo, setNomeArquivo] = useState('');

  // grid resultado
  const [linhas, setLinhas] = useState<GridRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // reset
    setLinhas([]);
    setColunas([]);
    setDados([]);
    setMapa({});
    setNomeArquivo('');
    api
      .get('/api/marcas/get?perPage=3000&page=1')
      .then(({ data }) => setMarcas(data.data || data.marcas || []))
      .catch(() => {});
  }, [isOpen]);

  const lerArquivo = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      if (aoa.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        return;
      }
      const header = aoa[0].map((h: any, i: number) => {
        const nome = String(h ?? '').trim();
        return `${letraColuna(i)}${nome ? ' - ' + nome : ''}`;
      });
      setColunas(header);
      setDados(aoa);
      setNomeArquivo(file.name);
      setLinhas([]);
    } catch (e: any) {
      toast({ title: 'Erro ao ler a planilha', description: e.message, variant: 'destructive' });
    }
  };

  const carregar = useCallback(async () => {
    if (!codmarca) {
      toast({ title: 'Selecione a Marca.', variant: 'destructive' });
      return;
    }
    if (dados.length < 2) {
      toast({ title: 'Carregue uma planilha com dados.', variant: 'destructive' });
      return;
    }
    for (const c of CAMPOS_MAP) {
      const ativo = c.obrig || opc[c.key];
      if (ativo && (mapa[c.key] === undefined || mapa[c.key] === '')) {
        toast({ title: `Mapeie a coluna: ${c.label}`, variant: 'destructive' });
        return;
      }
    }

    const col = (k: string) => (mapa[k] !== undefined && mapa[k] !== '' ? Number(mapa[k]) : -1);
    const iRef = col('ref');
    const linhasArq = dados.slice(1); // pula cabeçalho

    // monta itens do arquivo por referência (primeira ocorrência)
    const porRef = new Map<string, any[]>();
    const refs: string[] = [];
    for (const row of linhasArq) {
      const ref = String(row[iRef] ?? '').trim();
      if (!ref) continue;
      if (!porRef.has(ref)) {
        porRef.set(ref, row);
        refs.push(ref);
      }
    }
    if (refs.length === 0) {
      toast({ title: 'Nenhuma referência encontrada na planilha.', variant: 'destructive' });
      return;
    }

    setCarregando(true);
    try {
      const { data } = await api.post('/api/produtos/custo-carregar', { codmarca, refs });
      const resultados: Array<{ ref: string; status: string; codprod?: string; descr?: string }> =
        data.resultados || [];

      let dup = 0;
      let inex = 0;
      const novas: GridRow[] = [];
      for (const r of resultados) {
        if (r.status === 'DUPLICADO') {
          dup++;
          continue;
        }
        if (r.status === 'INEXISTENTE') {
          inex++;
          continue;
        }
        const row = porRef.get(r.ref)!;
        // IPI do arquivo entra como (valor * 100), como no Delphi
        const ipi = opc.ipi && col('ipi') >= 0 ? n(row[col('ipi')]) * 100 : -1;
        let pis = -1;
        let cofins = -1;
        if (opc.pisCofins && col('pisCofins') >= 0) {
          const total = (n(row[col('pisCofins')]) * 100).toFixed(2);
          const t = TABELA_PISCOFINS[total];
          if (t) {
            pis = t.pis;
            cofins = t.cofins;
          }
        }
        novas.push({
          codprod: r.codprod!,
          ref: r.ref,
          descricao: opc.descricao && col('descricao') >= 0 ? String(row[col('descricao')] ?? '') : (r.descr || ''),
          ncm: opc.ncm && col('ncm') >= 0 ? String(row[col('ncm')] ?? '') : '',
          ipi,
          pis,
          cofins,
          barras: opc.barras && col('barras') >= 0 ? String(row[col('barras')] ?? '') : '',
          aplicacao: opc.aplicacao && col('aplicacao') >= 0 ? String(row[col('aplicacao')] ?? '') : '',
          prBruto: n(row[col('prBruto')]),
          prNF: n(row[col('prNF')]),
          prSNF: n(row[col('prSNF')]),
          custo: 0,
          custoFE: 0,
          custoZF: 0,
        });
      }
      setLinhas(novas);
      toast({
        title: `Carregados: ${novas.length}`,
        description:
          (dup ? `${dup} duplicado(s). ` : '') + (inex ? `${inex} inexistente(s).` : '') ||
          'Todos os produtos localizados.',
      });
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e?.response?.data?.error, variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  }, [codmarca, dados, mapa, opc, toast]);

  const calcular = async () => {
    if (linhas.length === 0) {
      toast({ title: 'Carregue os produtos primeiro.', variant: 'destructive' });
      return;
    }
    setCalculando(true);
    try {
      const { data } = await api.post('/api/produtos/custo-calcular', {
        params: {
          desconto: n(desconto),
          acrescimo: n(acrescimo),
          custoFin: n(custoFin),
          verbaMkt: n(verbaMkt),
          frete: n(frete),
          zerarIpi,
          zerarSt,
          codCredor,
        },
        rows: linhas.map((l) => ({
          codprod: l.codprod,
          prNF: l.prNF,
          prSNF: l.prSNF,
          ipi: l.ipi,
          pis: l.pis,
          cofins: l.cofins,
        })),
      });
      const mapaRes = new Map<string, any>();
      (data.resultados || []).forEach((r: any) => mapaRes.set(r.codprod, r));
      setLinhas((prev) =>
        prev.map((l) => {
          const r = mapaRes.get(l.codprod);
          return r ? { ...l, custo: r.custo, custoFE: r.custoFE, custoZF: r.custoZF } : l;
        }),
      );
      toast({ title: 'Cálculo concluído.' });
    } catch (e: any) {
      toast({
        title: 'Falha no cálculo',
        description: e?.response?.data?.error || 'Ponte Oracle indisponível.',
        variant: 'destructive',
      });
    } finally {
      setCalculando(false);
    }
  };

  const salvar = () => {
    if (linhas.length === 0) {
      toast({ title: 'Nada para salvar.', variant: 'destructive' });
      return;
    }
    pedirConfirmacao(
      async () => {
        setSalvando(true);
        try {
          const { data } = await api.post('/api/produtos/custo-salvar', { rows: linhas });
          toast({ title: `Custos atualizados: ${data.atualizados}` });
          onSuccess();
          onClose();
        } catch (e: any) {
          toast({ title: 'Erro ao salvar', description: e?.response?.data?.error, variant: 'destructive' });
        } finally {
          setSalvando(false);
        }
      },
      {
        title: 'Atualizar custo',
        message: `Confirma a atualização do custo de ${linhas.length} produto(s)?`,
        type: 'warning',
        confirmText: 'Sim, salvar',
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar Custo da Mercadoria</DialogTitle>
          <DialogDescription>
            Importe a planilha, mapeie as colunas, carregue os produtos, calcule
            e salve os custos.
          </DialogDescription>
        </DialogHeader>

        {/* Cálculo do Custo */}
        <fieldset className="border rounded-md p-3">
          <legend className="text-xs font-semibold px-1">Cálculo do Custo</legend>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { l: 'Desconto (-) %', v: desconto, s: setDesconto },
              { l: 'Acréscimo (+) %', v: acrescimo, s: setAcrescimo },
              { l: 'Custo Financeiro (+) %', v: custoFin, s: setCustoFin },
              { l: 'Verba Mkt (+) %', v: verbaMkt, s: setVerbaMkt },
              { l: 'Frete (+) %', v: frete, s: setFrete },
            ].map((f) => (
              <div key={f.l}>
                <label className="text-xs block mb-0.5">{f.l}</label>
                <Input value={f.v} onChange={(e) => f.s(e.target.value)} className="h-8" inputMode="decimal" />
              </div>
            ))}
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={zerarIpi} onChange={(e) => setZerarIpi(e.target.checked)} />
                ZERAR IPI
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={zerarSt} onChange={(e) => setZerarSt(e.target.checked)} />
                ZERAR ST
              </label>
            </div>
          </div>
        </fieldset>

        {/* Fornecedor / Marca */}
        <fieldset className="border rounded-md p-3">
          <legend className="text-xs font-semibold px-1">Fornecedor / Marca</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-0.5">Fornecedor (código)</label>
              <Input value={codCredor} onChange={(e) => setCodCredor(e.target.value)} className="h-8" placeholder="Cód. do fornecedor" />
            </div>
            <div>
              <label className="text-xs block mb-0.5">Marca *</label>
              <Select value={codmarca} onValueChange={setCodmarca}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Selecione a marca..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {marcas.map((m) => (
                    <SelectItem key={m.codmarca} value={String(m.codmarca)}>
                      {m.codmarca} - {m.descr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>

        {/* Informação Opcional */}
        <fieldset className="border rounded-md p-3">
          <legend className="text-xs font-semibold px-1">Informação Opcional (importar da planilha)</legend>
          <div className="flex flex-wrap gap-4">
            {[
              { k: 'ncm', l: 'NCM' },
              { k: 'ipi', l: 'IPI (%)' },
              { k: 'pisCofins', l: 'PIS/COFINS (%)' },
              { k: 'barras', l: 'Cód. Barras' },
              { k: 'descricao', l: 'Descrição' },
              { k: 'aplicacao', l: 'Aplicação Extendida' },
            ].map((o) => (
              <label key={o.k} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={opc[o.k]}
                  onChange={(e) => setOpc((p) => ({ ...p, [o.k]: e.target.checked }))}
                />
                {o.l}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Importação + mapeamento */}
        <fieldset className="border rounded-md p-3">
          <legend className="text-xs font-semibold px-1">Planilha de importação</legend>
          <div className="flex items-center gap-2 mb-3">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer text-sm hover:bg-accent">
              <Upload className="w-4 h-4" />
              Selecionar arquivo
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])}
              />
            </label>
            {nomeArquivo && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4" /> {nomeArquivo}
              </span>
            )}
          </div>

          {colunas.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CAMPOS_MAP.filter((c) => c.obrig || opc[c.key]).map((c) => (
                <div key={c.key}>
                  <label className="text-xs block mb-0.5">
                    {c.label}
                    {c.obrig && <span className="text-red-500"> *</span>}
                  </label>
                  <Select
                    value={mapa[c.key] ?? ''}
                    onValueChange={(v) => setMapa((p) => ({ ...p, [c.key]: v }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Coluna..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {colunas.map((col, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <Button type="button" variant="secondary" onClick={carregar} disabled={carregando}>
              {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Carregar
            </Button>
            <Button type="button" variant="secondary" onClick={calcular} disabled={calculando || linhas.length === 0}>
              {calculando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calculator className="w-4 h-4 mr-1" />}
              Calcular
            </Button>
          </div>
        </fieldset>

        {/* Grid */}
        {linhas.length > 0 && (
          <div className="border rounded-md max-h-72 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left px-2 py-1.5 border-b">Referência</th>
                  <th className="text-left px-2 py-1.5 border-b">Descrição</th>
                  <th className="text-left px-2 py-1.5 border-b">NCM</th>
                  <th className="text-right px-2 py-1.5 border-b">Pr. Fábrica</th>
                  <th className="text-right px-2 py-1.5 border-b">Pr. NF</th>
                  <th className="text-right px-2 py-1.5 border-b">Pr. SNF</th>
                  <th className="text-right px-2 py-1.5 border-b">Custo</th>
                  <th className="text-right px-2 py-1.5 border-b">Custo FE</th>
                  <th className="text-right px-2 py-1.5 border-b">Custo ZF</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.codprod} className="odd:bg-muted/20">
                    <td className="px-2 py-1 border-b whitespace-nowrap">{l.ref}</td>
                    <td className="px-2 py-1 border-b whitespace-nowrap max-w-[220px] truncate">{l.descricao}</td>
                    <td className="px-2 py-1 border-b">{l.ncm}</td>
                    <td className="px-2 py-1 border-b text-right">{l.prBruto.toFixed(2)}</td>
                    <td className="px-2 py-1 border-b text-right">{l.prNF.toFixed(2)}</td>
                    <td className="px-2 py-1 border-b text-right">{l.prSNF.toFixed(2)}</td>
                    <td className="px-2 py-1 border-b text-right font-medium">{l.custo.toFixed(2)}</td>
                    <td className="px-2 py-1 border-b text-right">{l.custoFE.toFixed(2)}</td>
                    <td className="px-2 py-1 border-b text-right">{l.custoZF.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || linhas.length === 0}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
      {ConfirmacaoSalvarModal}
    </Dialog>
  );
};

export default AtualizarCustoModal;
