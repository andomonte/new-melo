// Cadastro de Garantia de Produto — porte da aba "Cadastro" do
// TFrmGarantiaProd do Delphi (UniGarantiaProd.pas).
//
// Diferença estrutural: o Delphi monta a lista de itens numa tabela auxiliar
// no banco (INC_AUXITGAR / NAV_AUXITGAR, por usuário logado) e só depois o
// INC_GARANTIA a transforma nos itens definitivos. Aqui os itens ficam no
// estado do componente e vão junto no POST, numa transação só — o resultado é
// o mesmo e dispensa a tabela temporária.
//
// Ao confirmar, o estoque dos itens é BAIXADO (dbprod.qtest e
// cad_armazem_produto.arp_qtest), como faz o GARANTIA.inc_garantia do Oracle.

import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSelect from '@/components/common/FormSelect';
import ProdutoSearchInput from '@/components/common/ProdutoSearchInput';
import {
  EstoqueArmazem,
  STATUS_INCLUSAO,
  buscarArmazens,
  buscarClientes,
  criarGarantia,
  estoqueDoProduto,
} from '@/data/vendas/garantias';

interface ItemNovo {
  codprod: string;
  ref: string;
  descr: string;
  qtde: number;
  prunit: number;
  arm_id: number;
  armazem: string;
  disponivel: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSalvo: (codgar: string) => void;
  codusr?: string;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export const NovaGarantiaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSalvo,
  codusr,
}) => {
  // Cabeçalho
  const [nrodoc, setNrodoc] = useState('');
  const [codcli, setCodcli] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientes, setClientes] = useState<{ codcli: string; nome: string }[]>([]);
  const [dtGar, setDtGar] = useState(hoje());
  const [obs, setObs] = useState('');
  const [status, setStatus] = useState('P');

  // Item em edição
  const [itens, setItens] = useState<ItemNovo[]>([]);
  const [prodCod, setProdCod] = useState('');
  const [prodRef, setProdRef] = useState('');
  const [prodDescr, setProdDescr] = useState('');
  const [estoques, setEstoques] = useState<EstoqueArmazem[]>([]);
  const [armId, setArmId] = useState('');
  const [qtde, setQtde] = useState('');
  const [prunit, setPrunit] = useState('');

  const [armazens, setArmazens] = useState<{ arm_id: number; arm_descricao: string }[]>([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNrodoc(''); setCodcli(''); setClienteNome(''); setBuscaCliente('');
    setClientes([]); setDtGar(hoje()); setObs(''); setStatus('P');
    setItens([]); limparItem(); setErro('');
    buscarArmazens().then(setArmazens).catch(() => setArmazens([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const limparItem = () => {
    setProdCod(''); setProdRef(''); setProdDescr('');
    setEstoques([]); setArmId(''); setQtde(''); setPrunit('');
  };

  const procurarCliente = async () => {
    if (buscaCliente.trim().length < 2) return;
    try {
      setClientes(await buscarClientes(buscaCliente.trim()));
    } catch {
      setClientes([]);
    }
  };

  const selecionarProduto = async (codigo: string, produto?: any) => {
    setProdCod(codigo);
    setProdRef(produto?.ref || '');
    setProdDescr(produto?.descr || '');
    setArmId('');
    if (!codigo) return setEstoques([]);
    try {
      setEstoques(await estoqueDoProduto(codigo));
    } catch {
      setEstoques([]);
    }
  };

  const disponivelNoArmazem = (id: string) =>
    Number(estoques.find((e) => String(e.armId) === String(id))?.qtestDisponivel ?? 0);

  const adicionarItem = () => {
    setErro('');
    if (!prodCod) return setErro('Selecione o produto.');
    if (itens.some((i) => i.codprod === prodCod)) {
      return setErro('Este produto já está na garantia.');
    }
    const q = Number(qtde);
    if (!Number.isFinite(q) || q <= 0) {
      return setErro('A quantidade requisitada deve ser maior que zero.');
    }
    const p = Number(String(prunit).replace(',', '.'));
    if (!Number.isFinite(p) || p < 0) return setErro('Preço inválido.');
    if (!armId) return setErro('Selecione o armazém.');

    // Mesma recusa do BtOkClick do Delphi.
    const disp = disponivelNoArmazem(armId);
    if (q > disp) {
      return setErro(
        `Quantidade solicitada superior à quantidade em estoque. Disponível: ${disp}.`,
      );
    }

    setItens((atual) => [
      ...atual,
      {
        codprod: prodCod,
        ref: prodRef,
        descr: prodDescr,
        qtde: q,
        prunit: p,
        arm_id: Number(armId),
        armazem: estoques.find((e) => String(e.armId) === armId)?.armDescricao || '',
        disponivel: disp,
      },
    ]);
    limparItem();
  };

  const salvar = async () => {
    setErro('');
    // Mesmas recusas do BtConfClick, na mesma ordem.
    if (!codcli) return setErro('Informe o cliente.');
    if (!nrodoc.trim()) return setErro('Informe o nº do documento.');
    if (!status) return setErro('Informe a situação da garantia.');
    if (itens.length === 0) return setErro('Inclua ao menos um produto na garantia.');

    setSalvando(true);
    try {
      const r = await criarGarantia({
        nrodoc: nrodoc.trim(),
        codcli,
        obs: obs.trim(),
        status,
        dt_gar: dtGar || undefined,
        codusr,
        itens: itens.map(({ codprod, qtde, prunit, arm_id }) => ({
          codprod, qtde, prunit, arm_id,
        })),
      });
      onSalvo(r.codgar);
    } catch (e: any) {
      setErro(e?.response?.data?.error || e?.message || 'Não foi possível incluir a garantia.');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  const totalGarantia = itens.reduce((s, i) => s + i.qtde * i.prunit, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nova Garantia de Produto
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Cabeçalho */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label>Cliente <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && procurarCliente()}
                  placeholder="Código ou nome do cliente"
                />
                <Button variant="outline" onClick={procurarCliente} title="Procurar cliente">
                  <Search size={16} />
                </Button>
              </div>
              {clienteNome && (
                <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-400">
                  {codcli} — {clienteNome}
                </p>
              )}
              {clientes.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 dark:border-zinc-600 rounded">
                  {clientes.map((c) => (
                    <button
                      key={c.codcli}
                      type="button"
                      onClick={() => {
                        setCodcli(c.codcli);
                        setClienteNome(c.nome);
                        setClientes([]);
                        setBuscaCliente(`${c.codcli} - ${c.nome}`);
                      }}
                      className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700"
                    >
                      {c.codcli} — {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Nº do Documento <span className="text-red-500">*</span></Label>
              <Input
                value={nrodoc}
                maxLength={15}
                onChange={(e) => setNrodoc(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <Label>Data</Label>
              <Input type="date" value={dtGar} onChange={(e) => setDtGar(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <Label>Observação</Label>
              <Input value={obs} maxLength={60} onChange={(e) => setObs(e.target.value)} />
            </div>

            <FormSelect
              name="status"
              label="Situação"
              required
              options={STATUS_INCLUSAO}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>

          {/* Inclusão de item */}
          <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">
              Itens da Garantia
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <ProdutoSearchInput
                  name="produto"
                  label="Produto"
                  value={prodCod}
                  onChange={selecionarProduto}
                />
              </div>
              <FormSelect
                name="armazem"
                label="Armazém"
                value={armId}
                onChange={(e) => setArmId(e.target.value)}
                options={[
                  { value: '', label: 'Selecione...' },
                  ...(estoques.length
                    ? estoques.map((e) => ({
                        value: String(e.armId),
                        label: `${e.armDescricao} (disp. ${e.qtestDisponivel})`,
                      }))
                    : armazens.map((a) => ({
                        value: String(a.arm_id),
                        label: a.arm_descricao,
                      }))),
                ]}
              />
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={qtde}
                  onChange={(e) => setQtde(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Preço Unit.</Label>
                  <Input value={prunit} onChange={(e) => setPrunit(e.target.value)} placeholder="0,00" />
                </div>
                <Button onClick={adicionarItem} className="bg-blue-600 hover:bg-blue-700">
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {itens.length > 0 && (
              <table className="w-full mt-4 text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-700 text-left">
                    <th className="p-2">Referência</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2">Armazém</th>
                    <th className="p-2 text-right">Qtde</th>
                    <th className="p-2 text-right">Pç. Unit.</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.codprod} className="border-b dark:border-zinc-700">
                      <td className="p-2 font-mono">{i.ref || i.codprod}</td>
                      <td className="p-2">{i.descr}</td>
                      <td className="p-2">{i.armazem}</td>
                      <td className="p-2 text-right">{i.qtde}</td>
                      <td className="p-2 text-right">{i.prunit.toFixed(2)}</td>
                      <td className="p-2 text-right">{(i.qtde * i.prunit).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setItens((a) => a.filter((x) => x.codprod !== i.codprod))}
                          className="text-red-600 hover:text-red-700"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold bg-gray-50 dark:bg-zinc-700">
                    <td className="p-2" colSpan={5}>Total</td>
                    <td className="p-2 text-right">{totalGarantia.toFixed(2)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 p-3 rounded text-sm">
              {erro}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-200 dark:border-zinc-700">
          <span className="text-xs text-gray-500">
            {itens.length} item(ns) — ao confirmar, o estoque dos itens é baixado.
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvando ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovaGarantiaModal;
