// Detalhe da garantia + alteração de situação e cancelamento.
// Porte das abas "Alteração" e "Operações" do TFrmGarantiaProd do Delphi.

import React, { useContext, useEffect, useState } from 'react';
import { X, Loader2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthContext } from '@/contexts/authContexts';
import FormSelect from '@/components/common/FormSelect';
import {
  Garantia,
  ItemGarantia,
  STATUS_GARANTIA,
  alterarSituacaoGarantia,
  cancelarGarantia,
  obterGarantia,
} from '@/data/vendas/garantias';

interface Props {
  codgar: string | null;
  onClose: () => void;
  onAlterado: () => void;
}

const moeda = (v: unknown) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const GarantiaDetalheModal: React.FC<Props> = ({
  codgar,
  onClose,
  onAlterado,
}) => {
  const { user } = useContext(AuthContext);
  const [dados, setDados] = useState<(Garantia & { itens: ItemGarantia[] }) | null>(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);

  useEffect(() => {
    if (!codgar) return;
    setCarregando(true);
    setErro('');
    setConfirmarCancelamento(false);
    obterGarantia(codgar)
      .then((d) => {
        setDados(d);
        setStatus(d.status);
      })
      .catch((e) =>
        setErro(e?.response?.data?.error || 'Não foi possível carregar a garantia.'),
      )
      .finally(() => setCarregando(false));
  }, [codgar]);

  const salvarSituacao = async () => {
    if (!codgar) return;
    setSalvando(true);
    setErro('');
    try {
      await alterarSituacaoGarantia(codgar, status, user?.codusr);
      onAlterado();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.error || 'Não foi possível alterar a situação.');
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async () => {
    if (!codgar) return;
    setSalvando(true);
    setErro('');
    try {
      await cancelarGarantia(codgar, user?.codusr);
      onAlterado();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.error || 'Não foi possível cancelar a garantia.');
    } finally {
      setSalvando(false);
    }
  };

  if (!codgar) return null;

  const cancelada = dados?.cancel === 'S';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-zinc-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Garantia nº {codgar}
            </h3>
            {dados && (
              <p className="text-sm text-gray-500">
                {dados.codcli} — {dados.cliente} · Doc. {dados.nrodoc}
              </p>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-blue-500" />
            </div>
          ) : dados ? (
            <>
              {cancelada && (
                <div className="bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 p-3 rounded text-sm flex items-center gap-2">
                  <Ban size={16} /> Esta garantia está cancelada.
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Data</span>
                  {dados.dt_gar ? new Date(dados.dt_gar).toLocaleDateString('pt-BR') : '-'}
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Situação atual</span>
                  {STATUS_GARANTIA[dados.status] || dados.status}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block text-xs">Observação</span>
                  {dados.obs || '-'}
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-700 text-left">
                    <th className="p-2">Referência</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2">Marca</th>
                    <th className="p-2">Armazém</th>
                    <th className="p-2 text-right">Quant.</th>
                    <th className="p-2 text-right">Pç. Unit.</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.itens.map((i) => (
                    <tr key={i.codprod} className="border-b dark:border-zinc-700">
                      <td className="p-2 font-mono">{i.ref || i.codprod}</td>
                      <td className="p-2">{i.descr}</td>
                      <td className="p-2">{i.marca || '-'}</td>
                      <td className="p-2">{i.armazem || '-'}</td>
                      <td className="p-2 text-right">{Number(i.qtde)}</td>
                      <td className="p-2 text-right">{moeda(i.prunit)}</td>
                      <td className="p-2 text-right">{moeda(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!cancelada && (
                <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
                  <div className="max-w-xs">
                    <FormSelect
                      name="situacao"
                      label="Alterar situação"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      options={Object.entries(STATUS_GARANTIA).map(([v, l]) => ({
                        value: v,
                        label: l,
                      }))}
                    />
                  </div>
                </div>
              )}
            </>
          ) : null}

          {erro && (
            <div className="bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 p-3 rounded text-sm">
              {erro}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-zinc-700">
          {!cancelada && dados ? (
            confirmarCancelamento ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">
                  Cancelar esta garantia? O estoque dos itens será devolvido.
                </span>
                <Button size="sm" variant="outline" onClick={() => setConfirmarCancelamento(false)}>
                  Não
                </Button>
                <Button
                  size="sm"
                  onClick={cancelar}
                  disabled={salvando}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sim, cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmarCancelamento(true)}
                className="text-red-600 hover:text-red-700"
              >
                <Ban size={16} className="mr-2" /> Cancelar garantia
              </Button>
            )
          ) : (
            <span />
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {!cancelada && dados && (
              <Button
                onClick={salvarSituacao}
                disabled={salvando || status === dados.status}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {salvando ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                Salvar situação
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GarantiaDetalheModal;
