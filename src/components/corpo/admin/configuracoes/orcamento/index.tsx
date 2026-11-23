/**
 * Configurações → Orçamento
 * Prazo máximo de validade do orçamento (dias), por filial. É o limite do modal
 * "Salvar Orçamento" da Nova Venda e aparece no PDF ("válido até ...").
 * Parâmetro: tb_parametros.prazo_validade_orcamento — API /api/parametros/orcamento.
 */
import React, { useContext, useEffect, useState } from 'react';
import { FileText, Loader2, Save } from 'lucide-react';
import { AuthContext } from '@/contexts/authContexts';
import { mostrarAlerta } from '@/components/common/AlertaCentralGlobal';
import { toast } from 'sonner';

type LinhaFilial = { filial: string; prazo: number | null };

const NOME_FILIAL: Record<string, string> = {
  MANAUS: 'Manaus',
  RORAIMA: 'Boa Vista / Roraima',
  RONDONIA: 'Porto Velho / Rondônia',
};

export default function ConfigOrcamento() {
  const { user } = useContext(AuthContext);
  const filialLogada = String(user?.filial || 'MANAUS').toUpperCase();

  const [filiais, setFiliais] = useState<LinhaFilial[]>([]);
  const [limites, setLimites] = useState({ minimo: 1, maximo: 60 });
  const [prazo, setPrazo] = useState('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await fetch('/api/parametros/orcamento', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao carregar.');
      setFiliais(d.filiais || []);
      setLimites({ minimo: d.minimo || 1, maximo: d.maximo || 60 });
      const atual = (d.filiais || []).find((f: LinhaFilial) => f.filial === filialLogada);
      setPrazo(String(atual?.prazo ?? 7));
      setSelecionadas((s) => (s.length ? s : [filialLogada]));
    } catch (e: any) {
      mostrarAlerta({ tipo: 'danger', titulo: 'Erro', mensagem: e.message || 'Falha ao carregar.' });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = (f: string) =>
    setSelecionadas((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));

  const salvar = async () => {
    const n = Math.floor(Number(prazo));
    if (!Number.isFinite(n) || n < limites.minimo || n > limites.maximo) {
      mostrarAlerta({ tipo: 'warning', titulo: 'Prazo inválido', mensagem: `Informe de ${limites.minimo} a ${limites.maximo} dias.` });
      return;
    }
    if (selecionadas.length === 0) {
      mostrarAlerta({ tipo: 'warning', titulo: 'Atenção', mensagem: 'Escolha ao menos uma filial.' });
      return;
    }
    setSalvando(true);
    try {
      const r = await fetch('/api/parametros/orcamento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prazo: n, filiais: selecionadas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao salvar.');
      toast.success(`Prazo do orçamento: ${n} dia(s) em ${selecionadas.map((f) => NOME_FILIAL[f] || f).join(', ')}.`);
      await carregar();
    } catch (e: any) {
      mostrarAlerta({ tipo: 'danger', titulo: 'Erro ao salvar', mensagem: e.message || 'Falha ao salvar.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-muted/40 p-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Configurações do Orçamento</h1>
        </div>

        {carregando ? (
          <div className="p-8 flex justify-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* prazo */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Prazo máximo de validade do orçamento
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Limite de dias que o vendedor pode escolher ao salvar um orçamento na Nova Venda. O PDF mostra a data
                de validade. Orçamentos já salvos não mudam.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={limites.minimo}
                  max={limites.maximo}
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvar();
                  }}
                  className="w-24 text-center text-lg font-semibold rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">dias</span>
              </div>
            </div>

            {/* filiais */}
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Aplicar nas filiais</div>
              <div className="border border-gray-200 dark:border-zinc-700 rounded-md divide-y divide-gray-100 dark:divide-zinc-800">
                {filiais.map((f) => (
                  <label key={f.filial} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(f.filial)}
                      onChange={() => alternar(f.filial)}
                      className="w-4 h-4"
                    />
                    <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">
                      {NOME_FILIAL[f.filial] || f.filial}
                      {f.filial === filialLogada && <span className="ml-2 text-xs text-blue-600">(filial atual)</span>}
                    </span>
                    <span className="text-xs text-gray-500">
                      atual: {f.prazo != null ? `${f.prazo} dia(s)` : 'não definido (usa 7)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={salvar}
                disabled={salvando}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
