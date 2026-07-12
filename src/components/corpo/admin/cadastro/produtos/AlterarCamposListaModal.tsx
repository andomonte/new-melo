import React, { useState, useEffect, useCallback } from 'react';
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
import InputMoeda from '@/components/common/InputMoeda';
import { useToast } from '@/hooks/use-toast';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import { Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlterarCamposListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Set<string>;
  onSuccess: () => void;
}

type Modo = 'linha' | 'fiscal' | 'strib' | 'opcao' | 'simnao';

interface CampoDef {
  value: string;
  label: string;
  disabled?: boolean;
  modo?: Modo;
  tipo?: 'text' | 'number' | 'integer';
  aplicarTodos?: boolean; // campo por-linha que também aceita "aplicar a todos"
}

// Lista de campos na MESMA ordem do Delphi (frmAlteraCampoProduto). Os campos
// cinza (disabled) aparecem para manter a paridade, mas não são selecionáveis.
const CAMPOS: CampoDef[] = [
  { value: 'descr', label: 'Descrição', modo: 'linha', tipo: 'text' },
  { value: 'codmarca', label: 'Marca', disabled: true },
  { value: 'codgpp', label: 'Grupo de Produto', disabled: true },
  { value: 'codgpf', label: 'Grupo de Função', disabled: true },
  { value: 'prcompra', label: 'Preço de Compra', modo: 'linha', tipo: 'number' },
  { value: 'prvenda', label: 'Preço de Venda', disabled: true },
  { value: 'prfabr', label: 'Preço de Fábrica', modo: 'linha', tipo: 'number' },
  { value: 'prfabrlinear', label: 'Preço de Fábrica - Linear', disabled: true },
  { value: 'prcustoatual', label: 'Custo Atual', modo: 'linha', tipo: 'number' },
  { value: 'qtestmin', label: 'Estoque Mínimo', modo: 'linha', tipo: 'integer' },
  { value: 'dtprfabr', label: 'Data Pç. Fábrica', disabled: true },
  { value: 'prbalcaogm', label: 'Preço Balcão GM', disabled: true },
  { value: 'clasfiscal', label: 'Classificação Fiscal', modo: 'fiscal' },
  { value: 'strib', label: 'Situação Tributária', modo: 'strib' },
  { value: 'qtembal', label: 'Quant. Embalagem', modo: 'linha', tipo: 'integer' },
  { value: 'ipi', label: 'IPI', disabled: true },
  { value: 'isentoipi', label: 'Situação IPI', modo: 'opcao' },
  { value: 'naotemst', label: 'Não tem ST', modo: 'simnao' },
  { value: 'hanan', label: 'Lei Hanan', modo: 'simnao' },
  { value: 'margem', label: 'Margem', modo: 'linha', tipo: 'number', aplicarTodos: true },
  { value: 'margempromo', label: 'Margem Promoção', modo: 'linha', tipo: 'number', aplicarTodos: true },
  { value: 'comissao', label: 'Comissão', disabled: true },
];

// Situação IPI — texto exibido -> caractere gravado (Copy(...,1,1) no Delphi)
const OPCOES_IPI = [
  { label: 'SUSPENSO', db: 'S' },
  { label: 'COBRAR', db: 'C' },
  { label: 'PAGO', db: 'P' },
  { label: 'ZERADO', db: 'Z' },
  { label: 'IMPORTAÇÃO', db: 'I' },
  { label: 'T - IMPORT. ST', db: 'T' },
];

// Situação Tributária: origem (1 díg.) + CST (2 díg.), como no Delphi.
const STRIB_ORIGEM = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
const STRIB_CST = ['00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90'];

interface RowData {
  codprod: string;
  ref: string;
  descr: string;
  prcompra: any;
  prfabr: any;
  prcustoatual: any;
  qtestmin: any;
  qtembal: any;
  margem: any;
  margempromo: any;
  clasfiscal: string;
  pis: any;
  cofins: any;
  percsubst: any;
  cest: string;
  strib: string;
  isentoipi: string;
  naotemst: string;
  hanan: string;
}

function soDigitos(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

function formataClassFiscal(v: any): string {
  const d = soDigitos(v);
  if (d.length < 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

function num(v: any): number {
  const f = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(f) ? 0 : f;
}

export const AlterarCamposListaModal: React.FC<AlterarCamposListaModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: 'Confirmar alterações',
    message: 'Confirma as alterações nos produtos selecionados?',
    confirmText: 'Sim, salvar',
    type: 'warning',
  });

  const [dados, setDados] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [campo, setCampo] = useState('');

  // valores editados da coluna atual: codprod -> valor (ou objeto p/ fiscal)
  const [valores, setValores] = useState<Record<string, any>>({});
  // referências editadas (apenas na tela de Descrição): codprod -> ref
  const [refs, setRefs] = useState<Record<string, string>>({});

  // barra "aplicar a todos"
  const [ncm, setNcm] = useState('');
  const [cest, setCest] = useState('');
  const [stribOrigem, setStribOrigem] = useState('');
  const [stribCst, setStribCst] = useState('');
  const [opcaoIpi, setOpcaoIpi] = useState('');
  const [simNao, setSimNao] = useState('');
  const [valorTodos, setValorTodos] = useState('');

  const campoDef = CAMPOS.find((c) => c.value === campo);

  // Carrega os dados dos produtos selecionados ao abrir
  useEffect(() => {
    if (!isOpen) return;
    setCampo('');
    setValores({});
    setDados([]);
    const codprods = Array.from(selectedProducts);
    if (codprods.length === 0) return;
    setLoading(true);
    fetch('/api/produtos/dados-campos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codprods }),
    })
      .then((r) => r.json())
      .then((json) => setDados(json.data || []))
      .catch(() => toast({ title: 'Erro ao carregar produtos', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [isOpen, selectedProducts, toast]);

  // Ao trocar de campo, inicializa os valores editáveis a partir do snapshot
  const escolherCampo = useCallback(
    (novo: string) => {
      setCampo(novo);
      setNcm('');
      setCest('');
      setStribOrigem('');
      setStribCst('');
      setOpcaoIpi('');
      setSimNao('');
      setValorTodos('');
      const def = CAMPOS.find((c) => c.value === novo);
      const init: Record<string, any> = {};
      // Na tela de Descrição a Referência também é editável (como no Delphi)
      const initRefs: Record<string, string> = {};
      for (const d of dados) {
        if (novo === 'descr') initRefs[d.codprod] = d.ref ?? '';
        if (def?.modo === 'fiscal') {
          init[d.codprod] = {
            clasfiscal: soDigitos(d.clasfiscal),
            pis: num(d.pis),
            cofins: num(d.cofins),
            percsubst: num(d.percsubst),
            cest: soDigitos(d.cest),
          };
        } else {
          init[d.codprod] = (d as any)[novo] ?? '';
        }
      }
      setValores(init);
      setRefs(initRefs);
    },
    [dados],
  );

  const setValorLinha = (codprod: string, valor: any) => {
    setValores((prev) => ({ ...prev, [codprod]: valor }));
  };

  // Aplica o valor da barra do topo em TODAS as linhas
  const aplicarTodos = async () => {
    if (!campoDef) return;

    if (campoDef.modo === 'fiscal') {
      const d = soDigitos(ncm);
      if (d.length < 8) {
        toast({ title: 'Informe um NCM válido (8 dígitos).', variant: 'destructive' });
        return;
      }
      const cestD = soDigitos(cest);
      if (cestD.length !== 0 && cestD.length !== 7) {
        toast({ title: 'CEST incorreto (deve ter 7 dígitos).', variant: 'destructive' });
        return;
      }
      try {
        const resp = await fetch(`/api/produtos/resolver-ncm?ncm=${d}`);
        if (!resp.ok) {
          toast({ title: 'NCM não localizado.', variant: 'destructive' });
          return;
        }
        const j = await resp.json();
        const novo: Record<string, any> = {};
        for (const row of dados) {
          novo[row.codprod] = {
            clasfiscal: d,
            pis: j.pis,
            cofins: j.cofins,
            percsubst: j.agregado,
            cest: cestD,
          };
        }
        setValores(novo);
        toast({ title: 'Classificação aplicada a todos os produtos.' });
      } catch {
        toast({ title: 'Erro ao resolver NCM.', variant: 'destructive' });
      }
      return;
    }

    if (campoDef.modo === 'strib') {
      if (!stribOrigem || !stribCst) {
        toast({ title: 'Informe origem e situação tributária.', variant: 'destructive' });
        return;
      }
      const v = stribOrigem + stribCst;
      const novo: Record<string, any> = {};
      for (const row of dados) novo[row.codprod] = v;
      setValores(novo);
      return;
    }

    if (campoDef.modo === 'opcao') {
      if (!opcaoIpi) {
        toast({ title: 'Informe a situação do IPI.', variant: 'destructive' });
        return;
      }
      const novo: Record<string, any> = {};
      for (const row of dados) novo[row.codprod] = opcaoIpi;
      setValores(novo);
      return;
    }

    if (campoDef.modo === 'simnao') {
      if (!simNao) {
        toast({ title: 'Informe Sim ou Não.', variant: 'destructive' });
        return;
      }
      const novo: Record<string, any> = {};
      for (const row of dados) novo[row.codprod] = simNao;
      setValores(novo);
      return;
    }

    // linha + aplicarTodos (margem / margem promoção)
    if (valorTodos === '') return;
    const novo: Record<string, any> = {};
    for (const row of dados) novo[row.codprod] = valorTodos;
    setValores(novo);
  };

  // Monta o payload apenas com as linhas efetivamente alteradas
  const montarRowsAlteradas = () => {
    const rows: any[] = [];
    for (const d of dados) {
      const atual = valores[d.codprod];
      if (campoDef?.modo === 'fiscal') {
        if (!atual) continue;
        const original = {
          clasfiscal: soDigitos(d.clasfiscal),
          pis: num(d.pis),
          cofins: num(d.cofins),
          percsubst: num(d.percsubst),
          cest: soDigitos(d.cest),
        };
        const mudou =
          atual.clasfiscal !== original.clasfiscal ||
          num(atual.pis) !== original.pis ||
          num(atual.cofins) !== original.cofins ||
          num(atual.percsubst) !== original.percsubst ||
          atual.cest !== original.cest;
        // no Delphi só entra quem tem NCM válido (>= 8 díg.) e mudou
        if (mudou && soDigitos(atual.clasfiscal).length >= 8) {
          rows.push({ codprod: d.codprod, ...atual });
        }
      } else if (campo === 'descr') {
        // Descrição + Referência (ambas editáveis, em MAIÚSCULAS como o Delphi)
        const descrAtual = String(atual ?? '').toUpperCase();
        const refAtual = String(refs[d.codprod] ?? '').toUpperCase();
        const descrMudou = descrAtual !== String(d.descr ?? '').toUpperCase();
        const refMudou = refAtual !== String(d.ref ?? '').toUpperCase();
        if (descrMudou || refMudou) {
          rows.push({ codprod: d.codprod, valor: descrAtual, ref: refAtual });
        }
      } else if (campoDef?.tipo === 'number' || campoDef?.tipo === 'integer') {
        const original = num((d as any)[campo]);
        if (num(atual) !== original) {
          rows.push({ codprod: d.codprod, valor: atual });
        }
      } else {
        const original = (d as any)[campo] ?? '';
        if (String(atual ?? '') !== String(original)) {
          rows.push({ codprod: d.codprod, valor: atual });
        }
      }
    }
    return rows;
  };

  const salvar = () => {
    if (!campoDef || campoDef.disabled) return;
    const rows = montarRowsAlteradas();
    if (rows.length === 0) {
      toast({ title: 'Nenhuma alteração para salvar.' });
      return;
    }
    pedirConfirmacao(async () => {
      setSalvando(true);
      try {
        const resp = await fetch('/api/produtos/update-campos-lista', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campo, rows }),
        });
        const j = await resp.json();
        if (!resp.ok) throw new Error(j.error || 'Erro ao salvar');
        toast({ title: `Produtos alterados: ${j.alterados}` });
        onSuccess();
        onClose();
      } catch (e: any) {
        toast({ title: e.message || 'Erro ao salvar', variant: 'destructive' });
      } finally {
        setSalvando(false);
      }
    });
  };

  const rotuloCelula = (d: RowData): React.ReactNode => {
    if (!campoDef) return null;
    const v = valores[d.codprod];
    if (campoDef.modo === 'opcao') {
      const op = OPCOES_IPI.find((o) => o.db === v);
      return op ? op.label : '';
    }
    if (campoDef.modo === 'simnao') {
      return v === 'S' ? 'Sim' : v === 'N' ? 'Não' : '';
    }
    if (campoDef.modo === 'strib') return v || '';
    return null;
  };

  const temBarraTopo =
    campoDef &&
    (campoDef.modo === 'fiscal' ||
      campoDef.modo === 'strib' ||
      campoDef.modo === 'opcao' ||
      campoDef.modo === 'simnao' ||
      campoDef.aplicarTodos);

  const readonlyGrid =
    campoDef &&
    (campoDef.modo === 'fiscal' ||
      campoDef.modo === 'strib' ||
      campoDef.modo === 'opcao' ||
      campoDef.modo === 'simnao');

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Alterar Campos Lista
            {campoDef ? ` : [ ${campoDef.label} ]` : ''}
          </DialogTitle>
          <DialogDescription>
            {selectedProducts.size} produto(s) selecionado(s). Escolha o campo à
            esquerda e edite os valores na lista.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4" style={{ minHeight: 420 }}>
          {/* Coluna esquerda: escolha do campo */}
          <div className="w-56 shrink-0 overflow-y-auto border rounded-md p-2 max-h-[460px]">
            <p className="text-xs font-semibold text-muted-foreground px-1 pb-1">
              Selecione o campo a ser alterado
            </p>
            {CAMPOS.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={c.disabled}
                onClick={() => !c.disabled && escolherCampo(c.value)}
                className={cn(
                  'w-full text-left text-sm px-2 py-1 rounded flex items-center gap-2',
                  c.disabled
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'hover:bg-accent cursor-pointer',
                  campo === c.value && 'bg-accent font-medium',
                )}
                title={c.disabled ? 'Campo não disponível' : undefined}
              >
                <span
                  className={cn(
                    'inline-block w-3 h-3 rounded-full border shrink-0',
                    campo === c.value ? 'bg-primary border-primary' : 'border-muted-foreground/40',
                  )}
                />
                {c.label}
              </button>
            ))}
          </div>

          {/* Coluna direita: barra do topo + grade */}
          <div className="flex-1 min-w-0 flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center flex-1 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando produtos...
              </div>
            ) : !campoDef ? (
              <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                Selecione um campo ao lado para começar.
              </div>
            ) : (
              <>
                {/* Barra "aplicar a todos" */}
                {temBarraTopo && (
                  <div className="flex flex-wrap items-end gap-2 mb-2 p-2 border rounded-md bg-muted/30">
                    {campoDef.modo === 'fiscal' && (
                      <>
                        <div>
                          <label className="text-xs block mb-0.5">NCM</label>
                          <Input
                            value={ncm}
                            onChange={(e) => setNcm(e.target.value)}
                            placeholder="00000000"
                            className="w-32 h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-0.5">CEST</label>
                          <Input
                            value={cest}
                            onChange={(e) => setCest(e.target.value)}
                            placeholder="0000000"
                            className="w-32 h-8"
                          />
                        </div>
                      </>
                    )}
                    {campoDef.modo === 'strib' && (
                      <>
                        <div>
                          <label className="text-xs block mb-0.5">Origem</label>
                          <Select value={stribOrigem} onValueChange={setStribOrigem}>
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {STRIB_ORIGEM.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs block mb-0.5">Sit. Tributária</label>
                          <Select value={stribCst} onValueChange={setStribCst}>
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {STRIB_CST.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {campoDef.modo === 'opcao' && (
                      <div>
                        <label className="text-xs block mb-0.5">Situação IPI</label>
                        <Select value={opcaoIpi} onValueChange={setOpcaoIpi}>
                          <SelectTrigger className="w-44 h-8">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {OPCOES_IPI.map((o) => (
                              <SelectItem key={o.db} value={o.db}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {campoDef.modo === 'simnao' && (
                      <div>
                        <label className="text-xs block mb-0.5">{campoDef.label}</label>
                        <Select value={simNao} onValueChange={setSimNao}>
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="S">Sim</SelectItem>
                            <SelectItem value="N">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {campoDef.modo === 'linha' && campoDef.aplicarTodos && (
                      <div>
                        <label className="text-xs block mb-0.5">{campoDef.label} (todos)</label>
                        <InputMoeda
                          value={valorTodos}
                          onChangeValue={(v) => setValorTodos(String(v))}
                          className="w-32 h-8 text-right"
                        />
                      </div>
                    )}
                    <Button type="button" size="sm" variant="secondary" onClick={aplicarTodos}>
                      Aplicar a todos
                    </Button>
                  </div>
                )}

                {/* Grade */}
                <div className="flex-1 overflow-auto border rounded-md max-h-[400px]">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left px-2 py-1.5 border-b w-44">
                          Referência
                          {campo === 'descr' && (
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              (editável)
                            </span>
                          )}
                        </th>
                        {campoDef.modo === 'fiscal' ? (
                          <>
                            <th className="text-center px-2 py-1.5 border-b">Class. Fiscal</th>
                            <th className="text-center px-2 py-1.5 border-b w-20">PIS</th>
                            <th className="text-center px-2 py-1.5 border-b w-20">COFINS</th>
                            <th className="text-center px-2 py-1.5 border-b w-24">AGREGADO</th>
                          </>
                        ) : (
                          <th className="text-left px-2 py-1.5 border-b">{campoDef.label}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.map((d) => (
                        <tr key={d.codprod} className="odd:bg-muted/20">
                          {campo === 'descr' ? (
                            <td className="px-1 py-0.5 border-b">
                              <Input
                                value={refs[d.codprod] ?? ''}
                                onChange={(e) =>
                                  setRefs((prev) => ({
                                    ...prev,
                                    [d.codprod]: e.target.value,
                                  }))
                                }
                                className="h-7"
                              />
                            </td>
                          ) : (
                            <td className="px-2 py-1 border-b whitespace-nowrap">{d.ref}</td>
                          )}
                          {campoDef.modo === 'fiscal' ? (
                            <>
                              <td className="px-2 py-1 border-b text-center">
                                {formataClassFiscal(valores[d.codprod]?.clasfiscal)}
                              </td>
                              <td className="px-2 py-1 border-b text-center">
                                {num(valores[d.codprod]?.pis).toFixed(2)}
                              </td>
                              <td className="px-2 py-1 border-b text-center">
                                {num(valores[d.codprod]?.cofins).toFixed(2)}
                              </td>
                              <td className="px-2 py-1 border-b text-center">
                                {num(valores[d.codprod]?.percsubst).toFixed(2)}
                              </td>
                            </>
                          ) : readonlyGrid ? (
                            <td className="px-2 py-1 border-b">{rotuloCelula(d)}</td>
                          ) : campoDef.tipo === 'number' ? (
                            <td className="px-1 py-0.5 border-b">
                              <InputMoeda
                                value={valores[d.codprod]}
                                onChangeValue={(v) => setValorLinha(d.codprod, v)}
                                className="h-7 text-right"
                              />
                            </td>
                          ) : (
                            <td className="px-1 py-0.5 border-b">
                              <Input
                                value={valores[d.codprod] ?? ''}
                                onChange={(e) =>
                                  setValorLinha(
                                    d.codprod,
                                    campoDef.tipo === 'integer'
                                      ? e.target.value.replace(/\D/g, '')
                                      : e.target.value,
                                  )
                                }
                                className="h-7"
                                inputMode={campoDef.tipo === 'integer' ? 'numeric' : 'text'}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!campoDef || salvando || loading}>
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Salvar
          </Button>
        </div>
      </DialogContent>
      {ConfirmacaoSalvarModal}
    </Dialog>
  );
};

export default AlterarCamposListaModal;
