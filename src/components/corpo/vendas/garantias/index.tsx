// Garantias de Produtos — porte do TFrmGarantiaProd do Delphi
// (menu Operação de venda > Garantias de Produtos).
//
// As abas do Delphi viram: a lista (aba Garantia + Filtrar), o modal de
// inclusão (aba Cadastro + Produtos) e o modal de detalhe (aba Alteração).

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { PlusIcon, Eye, Filter } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import DataTablePadrao from '@/components/common/DataTablePadrao';
import { DefaultButton } from '@/components/common/Buttons';
import SelectPadrao from '@/components/common/SelectPadrao';
import { AuthContext } from '@/contexts/authContexts';
import { useToast } from '@/hooks/use-toast';
import {
  Garantia,
  STATUS_GARANTIA,
  listarGarantias,
} from '@/data/vendas/garantias';
import NovaGarantiaModal from './NovaGarantiaModal';
import GarantiaDetalheModal from './GarantiaDetalheModal';

const ROTULOS: Record<string, string> = {
  codgar: 'GARANTIA',
  dt_gar: 'DATA',
  status: 'SITUAÇÃO',
  cliente: 'CLIENTE',
  codcli: 'CÓD. CLIENTE',
  nrodoc: 'Nº DOCUMENTO',
  obs: 'OBSERVAÇÃO',
  itens: 'ITENS',
  total_garantia: 'TOTAL',
};

// Colunas na ordem do grid DbgGar do Delphi (CodGar, Dt_Gar, Status, Cliente),
// seguidas do que a listagem dele traz no filtro (NroDoc, Obs).
const COLUNAS = [
  'acoes',
  'codgar',
  'dt_gar',
  'status',
  'cliente',
  'codcli',
  'nrodoc',
  'itens',
  'total_garantia',
  'obs',
];

const moeda = (v: unknown) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function GarantiasPage() {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();

  const [dados, setDados] = useState<Garantia[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [carregando, setCarregando] = useState(false);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  // "Após a data": o campo abre em hoje (como o Delphi), mas só entra na
  // busca quando o usuário aplica — lá o filtro também não roda na abertura.
  const [dataApos, setDataApos] = useState(() => new Date().toISOString().slice(0, 10));
  const [de, setDe] = useState('');
  const [limiteColunas, setLimiteColunas] = useState(8);

  const [novaAberta, setNovaAberta] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await listarGarantias({ page, perPage, search, status, de });
      setDados(r.data || []);
      setMeta(r.meta || {});
    } catch (erro) {
      console.error('Erro ao listar garantias:', erro);
      setDados([]);
    } finally {
      setCarregando(false);
    }
  }, [page, perPage, search, status, de]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const buscaComDebounce = useDebouncedCallback((v: string) => {
    setPage(1);
    setSearch(v);
  }, 400);

  const linhas = dados.map((g) => ({
    ...g,
    acoes: (
      <button
        onClick={() => setDetalhe(g.codgar)}
        className="p-1 text-gray-500 hover:text-blue-600"
        title="Ver itens, alterar situação ou cancelar"
      >
        <Eye size={16} />
      </button>
    ),
    dt_gar: g.dt_gar ? new Date(g.dt_gar).toLocaleDateString('pt-BR') : '',
    status: (
      <span
        className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
          g.status === 'A'
            ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50'
            : g.status === 'N'
            ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50'
            : g.status === 'C'
            ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50'
            : 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50'
        }`}
      >
        {STATUS_GARANTIA[g.status] || g.status}
      </span>
    ),
    total_garantia: moeda(g.total_garantia),
    obs: g.obs || '',
  }));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <main className="p-4 w-full">
        <header className="flex justify-between items-center mb-4 mr-6 ml-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
            Garantias de Produtos
          </h1>
          <DefaultButton
            onClick={() => setNovaAberta(true)}
            variant="primary"
            text="Nova Garantia"
            icon={<PlusIcon size={16} />}
          />
        </header>

        <DataTablePadrao
          screenKey="vendas-garantias"
          userName={user?.usuario}
          carregando={carregando}
          headers={COLUNAS}
          rows={linhas}
          meta={meta}
          semColunaDeAcaoPadrao={true}
          columnLabels={ROTULOS}
          limiteColunas={limiteColunas}
          onLimiteColunasChange={setLimiteColunas}
          onPageChange={setPage}
          onPerPageChange={(v) => {
            setPerPage(v);
            setPage(1);
          }}
          onSearch={(e) => buscaComDebounce(e.target.value)}
          searchInputPlaceholder="Buscar por garantia, documento ou cliente..."
          searchRightSlot={
            <div className="flex items-center gap-2 shrink-0">
              {/* "Após a data" do Delphi (BtDataClick, filtro dt_gar >= data).
                  Lá o campo abre com hoje mas NÃO filtra até você acionar —
                  por isso o valor fica no campo e só entra na busca ao aplicar. */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 whitespace-nowrap">Após a data:</span>
                <input
                  type="date"
                  value={dataApos}
                  onChange={(e) => setDataApos(e.target.value)}
                  className="h-8 px-2 text-xs rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDe(dataApos);
                    setPage(1);
                  }}
                  className="h-8 px-2 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-600 dark:text-gray-200 hover:border-gray-400"
                  title="Filtrar garantias a partir desta data"
                >
                  <Filter size={14} />
                </button>
                {de && (
                  <button
                    type="button"
                    onClick={() => {
                      setDe('');
                      setPage(1);
                    }}
                    className="h-8 px-2 rounded-md text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Remover o filtro de data"
                  >
                    limpar
                  </button>
                )}
              </div>

              <div className="w-52 shrink-0">
                <SelectPadrao
                  placeholder="Todas as situações"
                  value={status || 'todas'}
                  onValueChange={(v) => {
                    setStatus(v === 'todas' ? '' : v);
                    setPage(1);
                  }}
                  options={[
                    { value: 'todas', label: 'Todas as situações' },
                    ...Object.entries(STATUS_GARANTIA).map(([v, l]) => ({
                      value: v,
                      label: l,
                    })),
                  ]}
                />
              </div>
            </div>
          }
        />
      </main>

      <NovaGarantiaModal
        isOpen={novaAberta}
        onClose={() => setNovaAberta(false)}
        codusr={user?.codusr}
        onSalvo={(codgar) => {
          setNovaAberta(false);
          buscar();
          // O Delphi mostra "O NÚMERO DA GARANTIA É: xxx" ao confirmar.
          toast({
            title: 'Garantia incluída',
            description: `O número da garantia é: ${codgar}`,
          });
        }}
      />

      <GarantiaDetalheModal
        codgar={detalhe}
        onClose={() => setDetalhe(null)}
        onAlterado={buscar}
      />
    </div>
  );
}
