import React, { useCallback, useEffect, useState } from 'react';
import { PlusIcon, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import DataTablePadrao from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';

export interface CampoOpcao {
  value: string;
  label: string;
}

export interface CampoCfg {
  key: string;
  label: string;
  tipo?: 'text' | 'number';
  required?: boolean;
  /** No editar, o campo não pode ser alterado (ex.: chave) */
  bloqueadoNaEdicao?: boolean;
  /** força maiúsculas no texto */
  upper?: boolean;
  /** casas decimais (tipo number com máscara ÷100 estilo Delphi) */
  decimais?: number;
  /** largura no grid do formulário (col-span) */
  span?: 1 | 2 | 3;
}

export interface CrudConfig {
  titulo: string;
  screenKey: string;
  /** campo chave (pk) usado para editar/excluir */
  chave: string;
  /** true = código gerado automaticamente (esconde a chave no cadastro) */
  chaveAuto?: boolean;
  endpoints: {
    list: string; // GET ?page=&perPage=&search=
    add: string; // POST
    update: string; // PUT
    del: string; // DELETE (?<chave>= ou body)
  };
  colunas: { key: string; label: string }[];
  campos: CampoCfg[];
  searchPlaceholder?: string;
}

const CrudSimplesPage: React.FC<{ config: CrudConfig }> = ({ config }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState<any>({ data: [], meta: {} });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [excluir, setExcluir] = useState<any | null>(null);
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar({
    title: config.titulo,
    message: 'Deseja realmente salvar?',
  });

  const colLabels = config.colunas.reduce<Record<string, string>>((a, c) => {
    a[c.key] = c.label;
    return a;
  }, {});

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${config.endpoints.list}?page=${page}&perPage=${perPage}&search=${encodeURIComponent(search)}`;
      const r = await fetch(url);
      const j = r.ok ? await r.json() : { data: [], meta: {} };
      setDados({ data: j.data || j.rows || [], meta: j.meta || {} });
    } catch {
      toast({ description: 'Erro ao carregar dados.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, config.endpoints.list]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({});
    setErroForm('');
    setModalAberto(true);
  };
  const abrirEditar = (item: any) => {
    setEditando(item);
    setForm({ ...item });
    setErroForm('');
    setModalAberto(true);
  };

  const mascaraDecimal = (v: string, casas: number) => {
    const d = (v || '').replace(/\D/g, '');
    return d ? parseInt(d, 10) / Math.pow(10, casas) : 0;
  };

  const salvar = async () => {
    setErroForm('');
    // valida obrigatórios
    for (const c of config.campos) {
      if (c.required) {
        const v = form[c.key];
        if (v === undefined || v === null || String(v).trim() === '') {
          setErroForm(`${c.label} é obrigatório.`);
          return;
        }
      }
    }
    setSalvando(true);
    try {
      const url = editando ? config.endpoints.update : config.endpoints.add;
      const method = editando ? 'PUT' : 'POST';
      const body: Record<string, any> = { ...form };
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErroForm(j?.error || j?.message || 'Falha ao salvar.');
        return;
      }
      toast({ description: 'Registro salvo com sucesso!' });
      setModalAberto(false);
      carregar();
    } catch {
      setErroForm('Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      const chaveVal = excluir[config.chave];
      const r = await fetch(
        `${config.endpoints.del}?${config.chave}=${encodeURIComponent(chaveVal)}`,
        { method: 'DELETE' },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || 'Falha ao excluir.');
      }
      toast({ description: 'Registro excluído.' });
      setExcluir(null);
      carregar();
    } catch (e: any) {
      toast({ description: e.message || 'Falha ao excluir.', variant: 'destructive' });
      setExcluir(null);
    }
  };

  const headers = ['ações', ...config.colunas.map((c) => c.key)];

  const rows = (dados.data || []).map((item: any) => {
    const linha: Record<string, any> = {
      ações: (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => abrirEditar(item)}
            className="text-gray-500 hover:text-blue-600"
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => setExcluir(item)}
            className="text-red-500 hover:text-red-700"
            title="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    };
    config.colunas.forEach((c) => {
      const v = item[c.key];
      linha[c.key] = v ?? '';
    });
    return linha;
  });

  return (
    <div className="h-full w-full flex flex-col flex-grow bg-white dark:bg-slate-900">
      <main className="flex-1 flex flex-col p-4 w-full overflow-hidden">
        <header className="mb-2">
          <div className="flex justify-between mb-4 mr-6 ml-6">
            <div className="text-lg font-bold text-[#347AB6] dark:text-gray-200">
              {config.titulo}
            </div>
            <DefaultButton
              onClick={abrirNovo}
              className="px-3 py-1 text-sm h-8 flex items-center gap-1"
              text="Novo"
              icon={<PlusIcon size={18} />}
            />
          </div>
        </header>

        <div className="flex-1 min-h-20 flex flex-col">
          <DataTablePadrao
            screenKey={config.screenKey}
            headers={headers}
            columnLabels={colLabels}
            rows={rows}
            semColunaDeAcaoPadrao
            nonsortableColumns={['ações']}
            meta={dados.meta}
            carregando={loading}
            onPageChange={(p) => setPage(p)}
            onPerPageChange={(pp) => {
              setPerPage(pp);
              setPage(1);
            }}
            onSearch={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            onSearchBlur={() => {}}
            searchInputPlaceholder={
              config.searchPlaceholder || 'Pesquisar...'
            }
          />
        </div>
      </main>

      {/* Modal cadastro/edição */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-blue-600 dark:text-blue-300">
                {editando ? `Editar ${config.titulo}` : `Novo ${config.titulo}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-gray-500 hover:text-red-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {config.campos.map((c) => {
                // esconde a chave auto no cadastro (mostra readonly na edição)
                if (c.key === config.chave && config.chaveAuto && !editando)
                  return null;
                const bloqueado =
                  (c.bloqueadoNaEdicao && !!editando) ||
                  (c.key === config.chave && config.chaveAuto);
                const isDecimal = c.tipo === 'number' && c.decimais;
                const valor = form[c.key];
                return (
                  <div
                    key={c.key}
                    className={
                      c.span === 2
                        ? 'col-span-2'
                        : c.span === 1
                          ? 'col-span-1'
                          : 'col-span-2 md:col-span-1'
                    }
                  >
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      {c.label}
                      {c.required && <span className="text-red-500"> *</span>}
                    </label>
                    <input
                      type="text"
                      disabled={bloqueado}
                      value={
                        isDecimal
                          ? Number(valor ?? 0).toFixed(c.decimais)
                          : valor ?? ''
                      }
                      onChange={(e) => {
                        let v: any = e.target.value;
                        if (isDecimal) v = mascaraDecimal(v, c.decimais!);
                        else if (c.upper) v = v.toUpperCase();
                        setForm((f) => ({ ...f, [c.key]: v }));
                      }}
                      className={`w-full h-10 px-3 text-sm border rounded bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-800 dark:text-gray-100 ${
                        bloqueado ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {erroForm && <p className="text-red-500 text-xs mt-2">{erroForm}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  pedirConfirmacao(salvar, {
                    title: editando ? 'Confirmar alteração' : 'Confirmar cadastro',
                    message: 'Deseja realmente salvar os dados?',
                  })
                }
                disabled={salvando}
                className="flex items-center gap-1 px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmacaoSalvarModal}

      <ConfirmationModal
        isOpen={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirm={confirmarExclusao}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir este registro?`}
        type="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};

export default CrudSimplesPage;
