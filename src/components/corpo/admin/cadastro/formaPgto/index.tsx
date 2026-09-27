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
import useConfirmarSalvar from '@/hooks/useConfirmarSalvar';

interface Forma {
  fpg_letra: string;
  fpg_descricao: string;
  fpg_ativo: string; // 'S' | 'N'
}

const EMPTY = { fpg_letra: '', fpg_descricao: '' };

export default function FormaPgtoCadastro() {
  const [formas, setFormas] = useState<Forma[]>([]);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'ativo' | 'inativo' | 'todos'>('ativo');
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Forma | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [salvando, setSalvando] = useState(false);
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/forma-pgto?status=${statusFiltro}`);
      const d = await r.json();
      setFormas(Array.isArray(d?.data) ? d.data : []);
    } catch {
      toast.error('Erro ao carregar formas de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return formas;
    return formas.filter(
      (f) =>
        f.fpg_letra.toLowerCase().includes(t) ||
        (f.fpg_descricao || '').toLowerCase().includes(t),
    );
  }, [formas, busca]);

  const abrirNova = () => {
    setEditando(null);
    setForm({ ...EMPTY });
    setModalAberto(true);
  };
  const abrirEditar = (f: Forma) => {
    setEditando(f);
    setForm({ fpg_letra: f.fpg_letra, fpg_descricao: f.fpg_descricao || '' });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.fpg_descricao.trim()) {
      toast.error('Informe a descrição.');
      return;
    }
    if (!editando && !form.fpg_letra.trim()) {
      toast.error('Informe a letra.');
      return;
    }
    setSalvando(true);
    try {
      const url = editando
        ? `/api/forma-pgto/${editando.fpg_letra}`
        : '/api/forma-pgto';
      const method = editando ? 'PUT' : 'POST';
      const body = editando
        ? { fpg_descricao: form.fpg_descricao }
        : { fpg_letra: form.fpg_letra, fpg_descricao: form.fpg_descricao, fpg_ativo: 'S' };
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar.');
      toast.success(editando ? 'Forma atualizada.' : 'Forma cadastrada.');
      setModalAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const aplicarStatus = async (f: Forma, novo: 'S' | 'N') => {
    try {
      const r = await fetch(`/api/forma-pgto/${f.fpg_letra}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fpg_ativo: novo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao alterar situação.');
      toast.success(novo === 'S' ? 'Forma ativada.' : 'Forma inativada.');
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleStatus = (f: Forma) => {
    if (f.fpg_ativo === 'S') {
      // Inativar → pede confirmação no modal central (padrão)
      pedirConfirmacao(() => aplicarStatus(f, 'N'), {
        title: 'Inativar forma de pagamento',
        message: `Inativar "${f.fpg_letra} - ${f.fpg_descricao}"? Ela deixa de aparecer na seleção do pagamento.`,
        type: 'warning',
        confirmText: 'Inativar',
        cancelText: 'Cancelar',
      });
    } else {
      aplicarStatus(f, 'S');
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-slate-900 p-6 gap-4">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
          Cadastro de Forma de Pagamento
        </h1>
        <Button onClick={abrirNova}>
          <Plus size={16} className="mr-1" /> Nova Forma
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por letra ou descrição..."
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
              <th className="px-3 py-2 text-left w-24">Letra</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-center w-24">Situação</th>
              <th className="px-3 py-2 text-center w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin inline" /> Carregando...
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  Nenhuma forma de pagamento encontrada.
                </td>
              </tr>
            ) : (
              filtradas.map((f) => (
                <tr
                  key={f.fpg_letra}
                  className="border-t border-gray-100 dark:border-slate-800"
                >
                  <td className="px-3 py-2 font-mono">{f.fpg_letra}</td>
                  <td className="px-3 py-2">{f.fpg_descricao}</td>
                  <td className="px-3 py-2 text-center">
                    {f.fpg_ativo === 'S' ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">Ativa</Badge>
                    ) : (
                      <Badge className="bg-gray-400 hover:bg-gray-500 text-[10px]">Inativa</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => abrirEditar(f)}
                        className="p-1.5 text-gray-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggleStatus(f)}
                        className={`p-1.5 ${f.fpg_ativo === 'S' ? 'text-gray-500 hover:text-red-600' : 'text-gray-500 hover:text-green-600'}`}
                        title={f.fpg_ativo === 'S' ? 'Inativar' : 'Ativar'}
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
        title={editando ? `Editar Forma ${editando.fpg_letra}` : 'Nova Forma de Pagamento'}
        width="w-[95%] max-w-md"
      >
        <div className="space-y-4">
          <div>
            <Label>Letra *</Label>
            <Input
              value={form.fpg_letra}
              onChange={(e) =>
                setForm({ ...form, fpg_letra: e.target.value.toUpperCase().slice(0, 2) })
              }
              placeholder="Ex: D"
              disabled={!!editando}
              className="font-mono w-24"
            />
            {editando && (
              <p className="text-[11px] text-gray-500 mt-1">A letra não pode ser alterada.</p>
            )}
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input
              value={form.fpg_descricao}
              onChange={(e) =>
                setForm({ ...form, fpg_descricao: e.target.value.toUpperCase().slice(0, 30) })
              }
              placeholder="Ex: DINHEIRO"
            />
          </div>

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

      {ConfirmacaoSalvarModal}
    </div>
  );
}
