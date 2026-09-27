'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import SelectPadrao from '@/components/common/SelectPadrao';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search, Loader2, MapPin, Check } from 'lucide-react';
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';

interface Armazem {
  arm_id: number;
  arm_descricao: string;
}
interface Produto {
  codprod: string;
  descr: string;
  marca_nome: string;
  multiplo: number | null;
  unimed: string;
  qtde_disponivel: number | string;
  locacoes: string;
  loc_id: number | null;
  loc_desc: string;
  loc_count: number | string;
}
interface Locacao {
  apl_id: number;
  apl_descricao: string;
}

const MAX_DESC = 15;

export default function LocacoesProdutoCadastro() {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [armId, setArmId] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [exigeBusca, setExigeBusca] = useState(true);

  // Inline: rascunho do texto e estado de salvando por produto
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingInline, setSavingInline] = useState<Record<string, boolean>>({});

  // Multi-seleção + aplicação em massa
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bulkDesc, setBulkDesc] = useState('');
  const [aplicandoBulk, setAplicandoBulk] = useState(false);

  // Modal de gestão completa (várias locações)
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoAtual, setProdutoAtual] = useState<Produto | null>(null);
  const [locacoes, setLocacoes] = useState<Locacao[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [descInput, setDescInput] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/locacoes/armazens');
        const d = await r.json();
        const list: Armazem[] = d?.armazens || [];
        setArmazens(list);
        if (list.length > 0) setArmId(String(list[0].arm_id));
      } catch {
        toast.error('Erro ao carregar armazéns.');
      }
    })();
  }, []);

  const buscarProdutos = useCallback(async () => {
    if (!armId) return;
    if (busca.trim().length < 2) {
      setProdutos([]);
      setExigeBusca(true);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/locacoes/produtos?arm_id=${armId}&busca=${encodeURIComponent(busca.trim())}&perPage=50`,
      );
      const d = await r.json();
      const lista: Produto[] = d?.produtos || [];
      setProdutos(lista);
      setExigeBusca(!!d?.exigeBusca);
      // reinicia rascunhos e seleção
      const dr: Record<string, string> = {};
      lista.forEach((p) => (dr[p.codprod] = p.loc_desc || ''));
      setDrafts(dr);
      setSelecionados(new Set());
    } catch {
      toast.error('Erro ao buscar produtos.');
    } finally {
      setLoading(false);
    }
  }, [armId, busca]);

  const armazemLabel = useMemo(
    () => armazens.find((a) => String(a.arm_id) === armId)?.arm_descricao || '',
    [armazens, armId],
  );

  // ---- Inline: salvar a locação primária do produto ----
  const salvarInline = async (p: Produto) => {
    const desc = (drafts[p.codprod] ?? '').trim().toUpperCase();
    if (desc === (p.loc_desc || '')) return; // sem alteração
    if (!desc) return; // vazio inline não remove (use o botão Locações)
    if (desc.length > MAX_DESC) {
      toast.error(`Máximo de ${MAX_DESC} caracteres.`);
      return;
    }
    setSavingInline((s) => ({ ...s, [p.codprod]: true }));
    try {
      const isEdit = p.loc_id != null;
      const r = await fetch('/api/locacoes/locacoes', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arm_id: armId,
          codprod: p.codprod,
          descricao: desc,
          ...(isEdit ? { apl_id: p.loc_id } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar.');
      const novoId = d?.locacao?.apl_id ?? p.loc_id;
      setProdutos((prev) =>
        prev.map((x) =>
          x.codprod === p.codprod
            ? {
                ...x,
                loc_id: novoId,
                loc_desc: desc,
                loc_count: isEdit ? x.loc_count : Number(x.loc_count || 0) + 1,
              }
            : x,
        ),
      );
      toast.success('Locação salva.');
    } catch (e: any) {
      toast.error(e.message);
      // reverte o rascunho para o valor salvo
      setDrafts((dr) => ({ ...dr, [p.codprod]: p.loc_desc || '' }));
    } finally {
      setSavingInline((s) => ({ ...s, [p.codprod]: false }));
    }
  };

  // ---- Multi-seleção ----
  const toggleSel = (codprod: string) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(codprod)) n.delete(codprod);
      else n.add(codprod);
      return n;
    });
  };
  const todosSelecionados = produtos.length > 0 && selecionados.size === produtos.length;
  const toggleTodos = () => {
    setSelecionados(todosSelecionados ? new Set() : new Set(produtos.map((p) => p.codprod)));
  };

  const aplicarBulk = async () => {
    const desc = bulkDesc.trim().toUpperCase();
    if (selecionados.size === 0) {
      toast.error('Selecione ao menos um produto.');
      return;
    }
    if (!desc) {
      toast.error('Informe a locação a aplicar.');
      return;
    }
    setAplicandoBulk(true);
    try {
      const r = await fetch('/api/locacoes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arm_id: armId, codprods: Array.from(selecionados), descricao: desc }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao aplicar.');
      toast.success(`Locação aplicada a ${d.aplicados} produto(s)${d.ignorados ? ` (${d.ignorados} já tinham)` : ''}.`);
      setBulkDesc('');
      setSelecionados(new Set());
      buscarProdutos();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAplicandoBulk(false);
    }
  };

  // ---- Modal de gestão completa ----
  const abrirLocacoes = async (p: Produto) => {
    setProdutoAtual(p);
    setModalAberto(true);
    setEditId(null);
    setDescInput('');
    await carregarLocacoes(p.codprod);
  };
  const carregarLocacoes = async (codprod: string) => {
    setLoadingLoc(true);
    try {
      const r = await fetch(`/api/locacoes/locacoes?arm_id=${armId}&codprod=${codprod}`);
      const d = await r.json();
      setLocacoes(d?.locacoes || []);
    } catch {
      toast.error('Erro ao carregar locações.');
    } finally {
      setLoadingLoc(false);
    }
  };
  const iniciarAdicionar = () => {
    setEditId(null);
    setDescInput('');
  };
  const iniciarEditar = (l: Locacao) => {
    setEditId(l.apl_id);
    setDescInput(l.apl_descricao || '');
  };
  const salvarLocacaoModal = async () => {
    if (!produtoAtual) return;
    const desc = descInput.trim().toUpperCase();
    if (!desc) return toast.error('Informe a descrição da locação.');
    if (desc.length > MAX_DESC) return toast.error(`Máximo de ${MAX_DESC} caracteres.`);
    setSalvando(true);
    try {
      const isEdit = editId != null;
      const r = await fetch('/api/locacoes/locacoes', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arm_id: armId,
          codprod: produtoAtual.codprod,
          descricao: desc,
          ...(isEdit ? { apl_id: editId } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar.');
      toast.success(isEdit ? 'Locação atualizada.' : 'Locação adicionada.');
      setEditId(null);
      setDescInput('');
      await carregarLocacoes(produtoAtual.codprod);
      buscarProdutos();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };
  const removerLocacao = (l: Locacao) => {
    if (!produtoAtual) return;
    pedirConfirmacao(
      async () => {
        try {
          const r = await fetch('/api/locacoes/locacoes', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arm_id: armId, codprod: produtoAtual.codprod, apl_id: l.apl_id }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Erro ao remover.');
          toast.success('Locação removida.');
          await carregarLocacoes(produtoAtual.codprod);
          buscarProdutos();
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      {
        title: 'Remover locação',
        message: `Remover a locação "${l.apl_descricao}"?`,
        type: 'warning',
        confirmText: 'Remover',
        cancelText: 'Cancelar',
      },
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-slate-900 p-6 gap-4">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Locações do Produto</h1>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Label className="text-xs">Armazém</Label>
          <SelectPadrao
            value={armId}
            onValueChange={(v) => {
              setArmId(v);
              setProdutos([]);
              setSelecionados(new Set());
            }}
            options={armazens.map((a) => ({ value: String(a.arm_id), label: `${a.arm_id} - ${a.arm_descricao}` }))}
          />
        </div>
        <div className="relative flex-1 min-w-[260px]">
          <Label className="text-xs">Localizar (código, descrição ou marca)</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite ao menos 2 caracteres e Enter..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') buscarProdutos();
              }}
              className="pl-8"
            />
          </div>
        </div>
        <Button onClick={buscarProdutos} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search size={16} className="mr-1" />}
          Pesquisar
        </Button>
      </div>

      {/* Barra de aplicação em massa (aparece com seleção) */}
      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mr-2 self-center">
            {selecionados.size} selecionado(s)
          </div>
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Aplicar esta locação aos selecionados (máx. {MAX_DESC})</Label>
            <Input
              value={bulkDesc}
              onChange={(e) => setBulkDesc(e.target.value.toUpperCase().slice(0, MAX_DESC))}
              placeholder="Ex: P1/35 D 1"
              className="font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') aplicarBulk();
              }}
            />
          </div>
          <Button onClick={aplicarBulk} disabled={aplicandoBulk}>
            {aplicandoBulk ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check size={16} className="mr-1" />}
            Aplicar
          </Button>
          <Button variant="outline" onClick={() => setSelecionados(new Set())} disabled={aplicandoBulk}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-slate-800 shadow-sm">
            <tr>
              <th className="px-3 py-2 text-center w-10 bg-gray-100 dark:bg-slate-800">
                <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} title="Selecionar todos" />
              </th>
              <th className="px-3 py-2 text-left w-24">Código</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left w-36">Marca</th>
              <th className="px-3 py-2 text-center w-16">Múlt.</th>
              <th className="px-3 py-2 text-right w-20">Qtde</th>
              <th className="px-3 py-2 text-left w-52">Locação</th>
              <th className="px-3 py-2 text-center w-24">Mais</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin inline" /> Carregando...
                </td>
              </tr>
            ) : produtos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  {exigeBusca
                    ? 'Digite ao menos 2 caracteres e pesquise por código, descrição ou marca.'
                    : 'Nenhum produto encontrado.'}
                </td>
              </tr>
            ) : (
              produtos.map((p) => {
                const sel = selecionados.has(p.codprod);
                const outras = Number(p.loc_count || 0) - (p.loc_id != null ? 1 : 0);
                const alterado = (drafts[p.codprod] ?? '').trim().toUpperCase() !== (p.loc_desc || '');
                return (
                  <tr
                    key={p.codprod}
                    className={`border-t border-gray-100 dark:border-slate-800 ${sel ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={sel} onChange={() => toggleSel(p.codprod)} />
                    </td>
                    <td className="px-3 py-2 font-mono">{p.codprod}</td>
                    <td className="px-3 py-2">{p.descr}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{p.marca_nome || '-'}</td>
                    <td className="px-3 py-2 text-center">{p.multiplo ?? 1}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(p.qtde_disponivel) || 0}</td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <Input
                          value={drafts[p.codprod] ?? ''}
                          onChange={(e) =>
                            setDrafts((dr) => ({
                              ...dr,
                              [p.codprod]: e.target.value.toUpperCase().slice(0, MAX_DESC),
                            }))
                          }
                          onBlur={() => salvarInline(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="—"
                          className={`h-8 font-mono pr-7 ${alterado ? 'border-amber-400' : ''}`}
                        />
                        {savingInline[p.codprod] && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => abrirLocacoes(p)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        title="Gerenciar todas as locações"
                      >
                        <MapPin size={13} />
                        {outras > 0 ? `+${outras}` : 'Ver'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de gestão completa (várias locações) */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={produtoAtual ? `Locações — ${produtoAtual.codprod} (${armazemLabel})` : 'Locações'}
        width="w-[95%] max-w-lg"
      >
        {produtoAtual && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{produtoAtual.descr}</p>

            <div className="rounded-lg border border-gray-200 dark:border-slate-700 max-h-56 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Locação</th>
                    <th className="px-3 py-2 text-center w-24">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLoc ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin inline" /> Carregando...
                      </td>
                    </tr>
                  ) : locacoes.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-gray-400">
                        Nenhuma locação cadastrada.
                      </td>
                    </tr>
                  ) : (
                    locacoes.map((l) => (
                      <tr key={l.apl_id} className="border-t border-gray-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono">{l.apl_descricao}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => iniciarEditar(l)} className="p-1.5 text-gray-500 hover:text-blue-600" title="Editar">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => removerLocacao(l)} className="p-1.5 text-gray-500 hover:text-red-600" title="Remover">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-end gap-2 pt-2 border-t">
              <div className="flex-1">
                <Label className="text-xs">
                  {editId != null ? 'Editar locação' : 'Nova locação'} (máx. {MAX_DESC})
                </Label>
                <Input
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value.toUpperCase().slice(0, MAX_DESC))}
                  placeholder="Ex: P1/35 D 1"
                  className="font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarLocacaoModal();
                  }}
                />
              </div>
              {editId != null && (
                <Button variant="outline" onClick={iniciarAdicionar} disabled={salvando}>
                  Cancelar
                </Button>
              )}
              <Button onClick={salvarLocacaoModal} disabled={salvando}>
                {salvando ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : editId != null ? (
                  <Pencil size={15} className="mr-1" />
                ) : (
                  <Plus size={15} className="mr-1" />
                )}
                {editId != null ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setModalAberto(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {ConfirmacaoSalvarModal}
    </div>
  );
}
