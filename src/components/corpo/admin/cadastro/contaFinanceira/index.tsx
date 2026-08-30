'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/common/Modal';
import SelectPadrao from '@/components/common/SelectPadrao';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Power, Search, Loader2 } from 'lucide-react';

interface Conta {
  cof_id: number;
  cof_descricao: string;
  cof_cec_id: number | null;
  cof_operacional: string;
  status: string;
  centro_custo: string | null;
}
interface Centro {
  cec_id: number;
  cec_descricao: string;
}

const EMPTY = { cof_descricao: '', cof_cec_id: '', cof_operacional: 'S' };

export default function ContaFinanceiraCadastro() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'ativo' | 'inativo' | 'todos'>('ativo');
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cadastros/conta-financeira?status=${statusFiltro}`);
      const d = await r.json();
      setContas(Array.isArray(d?.contas) ? d.contas : []);
    } catch {
      toast.error('Erro ao carregar contas financeiras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro]);

  useEffect(() => {
    fetch('/api/cadastros/conta-financeira?centros=1')
      .then((r) => (r.ok ? r.json() : { centros: [] }))
      .then((d) => setCentros(Array.isArray(d?.centros) ? d.centros : []))
      .catch(() => {});
  }, []);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return contas;
    return contas.filter(
      (c) => String(c.cof_id).includes(t) || (c.cof_descricao || '').toLowerCase().includes(t),
    );
  }, [contas, busca]);

  const abrirNova = () => {
    setEditando(null);
    setForm({ ...EMPTY });
    setModalAberto(true);
  };
  const abrirEditar = (c: Conta) => {
    setEditando(c);
    setForm({
      cof_descricao: c.cof_descricao || '',
      cof_cec_id: c.cof_cec_id ? String(c.cof_cec_id) : '',
      cof_operacional: c.cof_operacional === 'N' ? 'N' : 'S',
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.cof_descricao.trim()) {
      toast.error('Informe a descrição.');
      return;
    }
    setSalvando(true);
    try {
      const url = editando
        ? `/api/cadastros/conta-financeira/${editando.cof_id}`
        : '/api/cadastros/conta-financeira';
      const method = editando ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar.');
      toast.success(editando ? 'Conta atualizada.' : 'Conta cadastrada.');
      setModalAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const toggleStatus = async (c: Conta) => {
    const novo = c.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      const r = await fetch(`/api/cadastros/conta-financeira/${c.cof_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao alterar status.');
      toast.success(novo === 'ativo' ? 'Conta ativada.' : 'Conta inativada.');
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-slate-900 p-6 gap-4">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Cadastro de Conta Financeira</h1>
        <Button onClick={abrirNova}>
          <Plus size={16} className="mr-1" /> Nova Conta
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="w-48">
          <SelectPadrao
            value={statusFiltro}
            onValueChange={(v) => setStatusFiltro(v as any)}
            options={[
              { value: 'ativo', label: 'Somente ativas' },
              { value: 'inativo', label: 'Somente inativas' },
              { value: 'todos', label: 'Todas' },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-left w-20">Código</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Centro de Custo</th>
              <th className="px-3 py-2 text-center w-24">Status</th>
              <th className="px-3 py-2 text-center w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin inline" /> Carregando...
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Nenhuma conta financeira encontrada.
                </td>
              </tr>
            ) : (
              filtradas.map((c) => (
                <tr key={c.cof_id} className="border-t border-gray-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-mono">{c.cof_id}</td>
                  <td className="px-3 py-2">{c.cof_descricao}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.centro_custo || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    {c.status === 'ativo' ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">Ativo</Badge>
                    ) : (
                      <Badge className="bg-gray-400 hover:bg-gray-500 text-[10px]">Inativo</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="p-1.5 text-gray-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`p-1.5 ${c.status === 'ativo' ? 'text-gray-500 hover:text-red-600' : 'text-gray-500 hover:text-green-600'}`}
                        title={c.status === 'ativo' ? 'Inativar' : 'Ativar'}
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? `Editar Conta ${editando.cof_id}` : 'Nova Conta Financeira'}
        width="w-[95%] max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input
              value={form.cof_descricao}
              onChange={(e) => setForm({ ...form, cof_descricao: e.target.value })}
              placeholder="Ex: PIS A PAGAR (IMPOSTOS FEDERAIS)"
            />
          </div>
          <div>
            <Label>Centro de Custo</Label>
            <SelectPadrao
              searchable
              value={form.cof_cec_id}
              onValueChange={(v) => setForm({ ...form, cof_cec_id: v })}
              placeholder="Selecione o centro de custo..."
              options={centros.map((cc) => ({ value: String(cc.cec_id), label: `${cc.cec_id} — ${cc.cec_descricao}` }))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.cof_operacional === 'S'}
              onChange={(e) => setForm({ ...form, cof_operacional: e.target.checked ? 'S' : 'N' })}
              className="h-4 w-4"
            />
            <span className="text-sm">Conta operacional</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
