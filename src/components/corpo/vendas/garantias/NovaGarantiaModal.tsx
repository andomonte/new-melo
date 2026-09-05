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
import {
  ArmazemDoProduto,
  ProdutoGarantia,
  STATUS_INCLUSAO,
  buscarClientes,
  buscarProdutosGarantia,
  criarGarantia,
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

  // Item em edição — a busca é por REFERÊNCIA, como no Delphi.
  const [itens, setItens] = useState<ItemNovo[]>([]);
  const [buscaRef, setBuscaRef] = useState('');
  const [resultados, setResultados] = useState<ProdutoGarantia[]>([]);
  const [buscandoProd, setBuscandoProd] = useState(false);
  const [buscouProd, setBuscouProd] = useState(false);
  const [produto, setProduto] = useState<ProdutoGarantia | null>(null);
  const [armId, setArmId] = useState('');
  const [qtde, setQtde] = useState('');
  const [prunit, setPrunit] = useState('');

  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNrodoc(''); setCodcli(''); setClienteNome(''); setBuscaCliente('');
    setClientes([]); setDtGar(hoje()); setObs(''); setStatus('P');
    setItens([]); limparItem(); setErro('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const limparItem = () => {
    setBuscaRef(''); setResultados([]); setBuscouProd(false);
    setProduto(null); setArmId(''); setQtde(''); setPrunit('');
  };

  const procurarCliente = async () => {
    if (buscaCliente.trim().length < 2) return;
    try {
      setClientes(await buscarClientes(buscaCliente.trim()));
    } catch {
      setClientes([]);
    }
  };

  // MeRefKeyPress do Delphi: Enter na referência abre a lista de produtos.
  const procurarProduto = async () => {
    const termo = buscaRef.trim();
    if (termo.length < 2) return;
    setBuscandoProd(true);
    setErro('');
    try {
      const achados = await buscarProdutosGarantia(termo);
      setResultados(achados);
      setBuscouProd(true);
      // Um único resultado já entra direto, como quem escolhe a linha do grid.
      if (achados.length === 1) escolherProduto(achados[0]);
    } catch {
      setResultados([]);
      setBuscouProd(true);
      setErro('Não foi possível buscar o produto.');
    } finally {
      setBuscandoProd(false);
    }
  };

  const escolherProduto = (p: ProdutoGarantia) => {
    setProduto(p);
    setResultados([]);
    setBuscouProd(false);
    setBuscaRef(p.ref || '');
    // Um armazém só (o caso normal desta base): já vem escolhido.
    const liberados = p.armazens;
    setArmId(liberados.length === 1 ? String(liberados[0].armId) : '');
  };

  const armazensDoProduto: ArmazemDoProduto[] = produto?.armazens ?? [];

  const disponivelNoArmazem = (id: string) =>
    Number(
      armazensDoProduto.find((a) => String(a.armId) === String(id))?.disponivel ?? 0,
    );

  // Ordem de recusas do BtOkClick do Delphi: quantidade, preço, quantidade > 0
  // e, por último, estoque disponível no armazém.
  const adicionarItem = () => {
    setErro('');
    if (!produto) return setErro('Informe a referência e escolha o produto.');
    if (itens.some((i) => i.codprod === produto.codprod)) {
      // EXISTE_ITAUXGAR: o Delphi recusa o mesmo produto duas vezes.
      return setErro('Este produto já está na garantia.');
    }
    if (String(qtde).trim() === '') return setErro('Quantidade inválida.');
    const q = Number(qtde);
    if (!Number.isInteger(q) || q <= 0) {
      return setErro('A quantidade requisitada deve ser maior que zero.');
    }
    if (String(prunit).trim() === '') return setErro('Preço inválido.');
    const p = Number(String(prunit).replace(',', '.'));
    if (!Number.isFinite(p) || p < 0) return setErro('Preço inválido.');
    if (!armId) return setErro('Selecione o armazém.');

    const disp = disponivelNoArmazem(armId);
    if (q > disp) {
      return setErro(
        `QUANTIDADE SOLICITADA SUPERIOR À QUANTIDADE EM ESTOQUE. Disponível: ${disp}.`,
      );
    }

    setItens((atual) => [
      ...atual,
      {
        codprod: produto.codprod,
        ref: produto.ref,
        descr: produto.descr,
        qtde: q,
        prunit: p,
        arm_id: Number(armId),
        armazem:
          armazensDoProduto.find((a) => String(a.armId) === armId)?.armDescricao || '',
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
            {/* Busca por REFERÊNCIA — é o que o Delphi faz (MeRefKeyPress:
                vFILTRO = " P.REF LIKE 'texto%' "), e o combo de armazém sai do
                próprio produto (ARMAZEM.NAV_PRODUTO_ARMAZEM), com o disponível
                já calculado. */}
            <div className="flex flex-col space-y-1 mb-3">
              <Label htmlFor="ref-produto">Referência do produto</Label>
              <div className="flex gap-2">
                <Input
                  id="ref-produto"
                  value={buscaRef}
                  onChange={(e) => {
                    setBuscaRef(e.target.value.toUpperCase());
                    setProduto(null);
                    setArmId('');
                    setBuscouProd(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      procurarProduto();
                    }
                  }}
                  placeholder="Digite a referência e tecle Enter (ex.: IK500)"
                />
                <Button
                  variant="outline"
                  onClick={procurarProduto}
                  disabled={buscandoProd || buscaRef.trim().length < 2}
                  title="Procurar produto pela referência"
                >
                  {buscandoProd ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                </Button>
              </div>

              {produto && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-mono">{produto.ref}</span> · {produto.descr}
                  {produto.marca ? ` · ${produto.marca}` : ''}
                  {armazensDoProduto.length === 0 && (
                    <span className="text-red-600">
                      {' '}— sem armazém liberado para este produto.
                    </span>
                  )}
                </p>
              )}

              {buscouProd && resultados.length === 0 && (
                <p className="text-xs text-red-600">
                  Nenhum produto encontrado para essa referência.
                </p>
              )}
            </div>

            {/* Resultado da busca — o grid DbG_Produto do Delphi
                (Referência, Marca, Descrição). */}
            {resultados.length > 0 && (
              <div className="mb-3 max-h-48 overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-700 text-left">
                    <tr>
                      <th className="p-2">Referência</th>
                      <th className="p-2">Marca</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2 text-right">Disponível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r) => {
                      const disp = r.armazens.reduce((t, a) => t + a.disponivel, 0);
                      return (
                        <tr
                          key={r.codprod}
                          onClick={() => escolherProduto(r)}
                          className="border-t dark:border-zinc-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700/60"
                        >
                          <td className="p-2 font-mono">{r.ref}</td>
                          <td className="p-2">{r.marca}</td>
                          <td className="p-2">{r.descr}</td>
                          <td
                            className={`p-2 text-right ${disp > 0 ? '' : 'text-red-600'}`}
                          >
                            {disp}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              {/* Select nativo (e não o FormSelect) para o campo ficar na mesma
                  linha de base dos demais: o FormSelect traz um wrapper com
                  mb-4 e altura própria, o que desalinhava a caixa. */}
              <div className="flex flex-col space-y-1">
                <Label htmlFor="armazem">Armazém</Label>
                <select
                  id="armazem"
                  name="armazem"
                  value={armId}
                  onChange={(e) => setArmId(e.target.value)}
                  disabled={!produto}
                  className="flex h-10 w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/50 focus-visible:border-blue-400 disabled:opacity-50"
                >
                  <option value="">
                    {produto ? 'Selecione...' : 'Escolha o produto primeiro'}
                  </option>
                  {armazensDoProduto.map((a) => (
                    <option key={a.armId} value={String(a.armId)}>
                      {a.armDescricao} (disp. {a.disponivel})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={qtde}
                  onChange={(e) => setQtde(e.target.value)}
                  disabled={!produto}
                />
              </div>
              <div className="flex flex-col space-y-1">
                <Label>Preço Unit.</Label>
                <Input
                  value={prunit}
                  onChange={(e) => setPrunit(e.target.value)}
                  placeholder="0,00"
                  disabled={!produto}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={adicionarItem}
                  disabled={!produto}
                  className="bg-blue-600 hover:bg-blue-700 h-10"
                >
                  <Plus size={16} className="mr-1" /> Incluir item
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
