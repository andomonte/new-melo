import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Link2, Package, Warehouse } from 'lucide-react';

interface ProdutoDetalheExpandidoProps {
  produto: any;
}

interface ItemLista {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  qtd: number;
  prVenda: number;
}

interface ArmazemEstoque {
  armId: number;
  armDescricao: string;
  qtest: number;
  qtestReservada: number;
  qtestDisponivel: number;
  bloqueado: boolean;
}

const moeda = (v: any) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(v) || 0,
  );

/**
 * Painel que abre abaixo da linha do produto (padrão do zoom do Delphi):
 * Equivalentes, Relacionados e Estoque por Armazém/Locação. Cada aba busca
 * sob demanda na primeira vez que é aberta.
 */
export const ProdutoDetalheExpandido: React.FC<ProdutoDetalheExpandidoProps> = ({
  produto,
}) => {
  const codprod: string = produto?.codprod;
  const [aba, setAba] = useState('equivalentes');

  const [equivalentes, setEquivalentes] = useState<ItemLista[] | null>(null);
  const [relacionados, setRelacionados] = useState<ItemLista[] | null>(null);
  const [armazens, setArmazens] = useState<ArmazemEstoque[] | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);

  useEffect(() => {
    if (!codprod) return;
    let ativo = true;

    const buscar = async () => {
      if (aba === 'equivalentes' && equivalentes === null) {
        setCarregando('equivalentes');
        try {
          const r = await fetch('/api/produtos/equivalentes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codprod }),
          });
          const d = r.ok ? await r.json() : {};
          if (ativo) setEquivalentes(d.equivalentes || []);
        } catch {
          if (ativo) setEquivalentes([]);
        } finally {
          if (ativo) setCarregando(null);
        }
      } else if (aba === 'relacionados' && relacionados === null) {
        setCarregando('relacionados');
        try {
          const r = await fetch('/api/produtos/relacionados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codprod }),
          });
          const d = r.ok ? await r.json() : {};
          if (ativo) setRelacionados(d.relacionados || []);
        } catch {
          if (ativo) setRelacionados([]);
        } finally {
          if (ativo) setCarregando(null);
        }
      } else if (aba === 'estoque' && armazens === null) {
        setCarregando('estoque');
        try {
          const r = await fetch('/api/armazem/estoque-produto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codprods: [codprod] }),
          });
          const d = r.ok ? await r.json() : {};
          if (ativo) setArmazens(d.data?.[0]?.armazens || []);
        } catch {
          if (ativo) setArmazens([]);
        } finally {
          if (ativo) setCarregando(null);
        }
      }
    };

    buscar();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, codprod]);

  const Vazio = ({ texto }: { texto: string }) => (
    <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
      {texto}
    </div>
  );

  const Carregando = () => (
    <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
    </div>
  );

  const TabelaProdutos = ({ itens }: { itens: ItemLista[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-blue-600 text-white">
          <tr>
            <th className="p-2 text-left">REFERÊNCIA</th>
            <th className="p-2 text-left">MARCA</th>
            <th className="p-2 text-left">DESCRIÇÃO</th>
            <th className="p-2 text-right">QTDE</th>
            <th className="p-2 text-right">PR. VENDA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
          {itens.map((it, i) => (
            <tr
              key={`${it.codprod}-${i}`}
              className="hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              <td className="p-2 font-mono text-gray-900 dark:text-gray-100">
                {it.referencia}
              </td>
              <td className="p-2 text-gray-700 dark:text-gray-300">{it.marca}</td>
              <td className="p-2 text-gray-700 dark:text-gray-300">
                {it.descricao}
              </td>
              <td
                className={`p-2 text-right font-semibold ${
                  Number(it.qtd) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400'
                }`}
              >
                {it.qtd}
              </td>
              <td className="p-2 text-right text-gray-900 dark:text-gray-100">
                {moeda(it.prVenda)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!codprod) return null;

  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-900">
      <Tabs value={aba} onValueChange={setAba} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="equivalentes" className="text-xs gap-1">
            <Link2 className="h-3.5 w-3.5" /> Equivalentes
          </TabsTrigger>
          <TabsTrigger value="relacionados" className="text-xs gap-1">
            <Package className="h-3.5 w-3.5" /> Relacionados
          </TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs gap-1">
            <Warehouse className="h-3.5 w-3.5" /> Estoque por Armazém
          </TabsTrigger>
        </TabsList>

        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
          <TabsContent value="equivalentes" className="m-0">
            {carregando === 'equivalentes' ? (
              <Carregando />
            ) : !equivalentes || equivalentes.length === 0 ? (
              <Vazio texto="Nenhum produto equivalente." />
            ) : (
              <TabelaProdutos itens={equivalentes} />
            )}
          </TabsContent>

          <TabsContent value="relacionados" className="m-0">
            {carregando === 'relacionados' ? (
              <Carregando />
            ) : !relacionados || relacionados.length === 0 ? (
              <Vazio texto="Nenhum produto relacionado." />
            ) : (
              <TabelaProdutos itens={relacionados} />
            )}
          </TabsContent>

          <TabsContent value="estoque" className="m-0">
            {carregando === 'estoque' ? (
              <Carregando />
            ) : !armazens || armazens.length === 0 ? (
              <Vazio texto="Sem estoque em armazéns." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="p-2 text-left">ARMAZÉM</th>
                      <th className="p-2 text-center">STATUS</th>
                      <th className="p-2 text-right">QTDE</th>
                      <th className="p-2 text-right">RESERVADA</th>
                      <th className="p-2 text-right">DISPONÍVEL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                    {armazens.map((a) => (
                      <tr
                        key={a.armId}
                        className="hover:bg-gray-100 dark:hover:bg-zinc-800"
                      >
                        <td className="p-2 text-gray-900 dark:text-gray-100">
                          {a.armDescricao}
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              a.bloqueado
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            }`}
                          >
                            {a.bloqueado ? 'BLOQUEADO' : 'ATIVO'}
                          </span>
                        </td>
                        <td className="p-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {a.qtest}
                        </td>
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                          {a.qtestReservada}
                        </td>
                        <td
                          className={`p-2 text-right font-semibold ${
                            a.qtestDisponivel > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {a.qtestDisponivel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
