import React, { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

export interface ItemSugestao {
  codprod: string;
  codunico: string;
  ref: string;
  descr: string;
  marca: string;
  grupo: string;
  curvaABC: string;
  qtdSugerida: number;
  estoque: number;
  transito: number;
  pendencia: number;
  disponivel: number;
  demanda30d: number;
  demandaTrimestre: number;
  demandaAno: number;
  preco: number;
  multiplo: number;
  multiploCompra: number;
  baseIndicacao: string;
  selecionado?: boolean;
}

interface SugestaoAutomaticaProps {
  reqId?: number;
  reqVersao?: number;
  onItensImportados?: (qtd: number) => void;
  /** Quando fornecido, os itens marcados são entregues via callback (para o
   *  carrinho de Adicionar Produtos) em vez de importados direto na requisição. */
  onAdicionarSelecionados?: (itens: ItemSugestao[]) => void;
}

type TipoSugestao = 'DEMANDA_30D' | 'DEMANDA_60D' | 'ESTOQUE_MIN' | 'ESTOQUE_MAX';
type TipoFiltro = 'marca' | 'grupo';

export default function SugestaoAutomatica({
  reqId,
  reqVersao,
  onItensImportados,
  onAdicionarSelecionados,
}: SugestaoAutomaticaProps) {
  // Estados
  const [tipoSugestao, setTipoSugestao] = useState<TipoSugestao>('DEMANDA_30D');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('marca');
  const [codigoFiltro, setCodigoFiltro] = useState('');
  // Combobox de marca (pesquisável por código OU nome; limpável e re-pesquisável)
  const [marcaSel, setMarcaSel] = useState<{ codmarca: string; descr: string } | null>(null);
  const [marcaBusca, setMarcaBusca] = useState('');
  const [marcaResultados, setMarcaResultados] = useState<{ codmarca: string; descr: string }[]>([]);
  const [marcaAberto, setMarcaAberto] = useState(false);
  const buscarMarcas = useDebouncedCallback(async (termo: string) => {
    if (!termo || termo.trim().length < 1) {
      setMarcaResultados([]);
      return;
    }
    try {
      const r = await fetch(
        `/api/marcas/get?perPage=30&search=${encodeURIComponent(termo.trim())}`,
      );
      const d = r.ok ? await r.json() : { data: [] };
      setMarcaResultados(d.data || []);
    } catch {
      setMarcaResultados([]);
    }
  }, 300);
  const limparMarca = () => {
    setMarcaSel(null);
    setCodigoFiltro('');
    setMarcaBusca('');
    setMarcaResultados([]);
    setMarcaAberto(false);
  };
  const [sugestoes, setSugestoes] = useState<ItemSugestao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Gerar sugestões
  const handleGerarSugestao = async () => {
    if (!codigoFiltro) {
      setErro('Por favor, informe o código da marca ou grupo de produto');
      return;
    }

    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      const response = await fetch('/api/compras/sugestoes/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoSugestao,
          filtro: {
            tipo: tipoFiltro,
            codigo: codigoFiltro
          }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar sugestões');
      }

      const sugestoesComSelecao = (data.sugestoes || []).map((s: ItemSugestao) => ({
        ...s,
        selecionado: false
      }));

      setSugestoes(sugestoesComSelecao);

      if (sugestoesComSelecao.length === 0) {
        setErro('Nenhum produto encontrado com sugestão de compra');
      } else {
        setSucesso(`${sugestoesComSelecao.length} produtos encontrados com sugestão de compra`);
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao gerar sugestões');
      setSugestoes([]);
    } finally {
      setLoading(false);
    }
  };

  // Selecionar/desselecionar item
  const handleToggleItem = (codprod: string) => {
    setSugestoes(prev =>
      prev.map(s =>
        s.codprod === codprod ? { ...s, selecionado: !s.selecionado } : s
      )
    );
  };

  // Selecionar todos
  const handleSelecionarTodos = () => {
    setSugestoes(prev => prev.map(s => ({ ...s, selecionado: true })));
  };

  // Desselecionar todos
  const handleDesselecionarTodos = () => {
    setSugestoes(prev => prev.map(s => ({ ...s, selecionado: false })));
  };

  // Importar itens selecionados
  const handleImportar = async () => {
    const itensSelecionados = sugestoes.filter(s => s.selecionado);

    if (itensSelecionados.length === 0) {
      setErro('Selecione pelo menos um item para importar');
      return;
    }

    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      const response = await fetch('/api/compras/sugestoes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reqId,
          reqVersao,
          itens: itensSelecionados.map(item => ({
            codprod: item.codprod,
            quantidade: item.qtdSugerida,
            precoUnitario: item.preco,
            baseIndicacao: 'SUGESTAO'
          }))
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao importar itens');
      }

      setSucesso(`${data.itensImportados} itens importados com sucesso!`);

      // Limpar seleção
      setSugestoes(prev => prev.filter(s => !s.selecionado));

      // Callback
      if (onItensImportados) {
        onItensImportados(data.itensImportados);
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao importar itens');
    } finally {
      setLoading(false);
    }
  };

  // Entrega os itens marcados ao carrinho (Adicionar Produtos) em vez de
  // importar direto na requisição.
  const handleAdicionarAoCarrinho = () => {
    const itensSelecionados = sugestoes.filter((s) => s.selecionado);
    if (itensSelecionados.length === 0) {
      setErro('Selecione pelo menos um item para adicionar');
      return;
    }
    onAdicionarSelecionados?.(itensSelecionados);
    setSucesso(`${itensSelecionados.length} item(ns) enviado(s) para o carrinho.`);
    setSugestoes((prev) => prev.filter((s) => !s.selecionado));
  };

  // Edição de quantidade/preço direto nos resultados
  const atualizarItem = (
    codprod: string,
    campo: 'qtdSugerida' | 'preco',
    valor: number,
  ) => {
    setSugestoes((prev) =>
      prev.map((s) =>
        s.codprod === codprod ? { ...s, [campo]: isNaN(valor) ? 0 : valor } : s,
      ),
    );
  };

  // Busca dentro dos resultados (por referência ou descrição)
  const [filtroTexto, setFiltroTexto] = useState('');
  const sugestoesFiltradas = filtroTexto.trim()
    ? sugestoes.filter((s) =>
        `${s.ref} ${s.descr}`
          .toLowerCase()
          .includes(filtroTexto.trim().toLowerCase()),
      )
    : sugestoes;

  const qtdSelecionados = sugestoes.filter(s => s.selecionado).length;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Sugestão Automática de Compras
          </CardTitle>
          <CardDescription>
            Gere sugestões baseadas em demanda histórica ou estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tipo de Sugestão */}
            <div className="space-y-2">
              <Label>Tipo de Sugestão</Label>
              <Select value={tipoSugestao} onValueChange={(v) => setTipoSugestao(v as TipoSugestao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEMANDA_30D">Demanda para 30 Dias</SelectItem>
                  <SelectItem value="DEMANDA_60D">Demanda para 60 Dias</SelectItem>
                  <SelectItem value="ESTOQUE_MIN">Estoque Mínimo</SelectItem>
                  <SelectItem value="ESTOQUE_MAX">Estoque Máximo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtrar por */}
            <div className="space-y-2">
              <Label>Filtrar por</Label>
              <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as TipoFiltro)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marca">Marca</SelectItem>
                  <SelectItem value="grupo">Grupo de Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Código / Marca (combobox pesquisável para marca) */}
            <div className="space-y-2">
              <Label>{tipoFiltro === 'marca' ? 'Marca' : 'Código do Grupo'}</Label>
              {tipoFiltro === 'marca' ? (
                <div className="relative">
                  <div className="flex items-center rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-sm">
                    <input
                      className="flex-1 bg-transparent px-3 py-[6px] text-sm text-gray-900 dark:text-white outline-none"
                      placeholder="Digite código ou nome da marca..."
                      value={marcaSel ? `${marcaSel.codmarca} - ${marcaSel.descr}` : marcaBusca}
                      onChange={(e) => {
                        if (marcaSel) {
                          setMarcaSel(null);
                          setCodigoFiltro('');
                        }
                        setMarcaBusca(e.target.value);
                        buscarMarcas(e.target.value);
                        setMarcaAberto(true);
                      }}
                      onFocus={() => setMarcaAberto(true)}
                      onBlur={() => setTimeout(() => setMarcaAberto(false), 150)}
                    />
                    {(marcaSel || marcaBusca) && (
                      <button
                        type="button"
                        onClick={limparMarca}
                        title="Limpar marca"
                        className="px-2 text-gray-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {marcaAberto && !marcaSel && marcaResultados.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-md">
                      {marcaResultados.map((m) => (
                        <button
                          key={m.codmarca}
                          type="button"
                          onClick={() => {
                            setMarcaSel(m);
                            setCodigoFiltro(m.codmarca);
                            setMarcaBusca('');
                            setMarcaAberto(false);
                          }}
                          className="block w-full text-left px-3 py-1.5 text-sm text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-zinc-700"
                        >
                          {m.codmarca} - {m.descr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  value={codigoFiltro}
                  onChange={(e) => setCodigoFiltro(e.target.value)}
                  placeholder="Ex: 00001"
                />
              )}
            </div>

            {/* Botão Gerar */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                onClick={handleGerarSugestao}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Sugestão'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensagens */}
      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      {sucesso && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600 dark:text-green-400">{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Tabela de Resultados */}
      {sugestoes.length > 0 && (
        <Card>
          <CardHeader className="space-y-3">
            {/* Busca dentro dos resultados (referência ou descrição) */}
            <Input
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar nos resultados por referência ou descrição..."
            />
            <div className="flex justify-between items-center">
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelecionarTodos}
                  className="mr-2"
                >
                  Selecionar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDesselecionarTodos}
                >
                  Desselecionar Todos
                </Button>
              </div>

              <Button
                onClick={
                  onAdicionarSelecionados
                    ? handleAdicionarAoCarrinho
                    : handleImportar
                }
                disabled={qtdSelecionados === 0 || loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {onAdicionarSelecionados ? 'Adicionar Selecionados' : 'Importar'}{' '}
                {qtdSelecionados > 0 && `(${qtdSelecionados})`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-center">Curva</TableHead>
                      <TableHead className="text-right">Qtd Sugerida</TableHead>
                      <TableHead className="text-right">Múlt. Compra</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Trânsito</TableHead>
                      <TableHead className="text-right">Dem. 30d</TableHead>
                      <TableHead className="text-right">Dem. Tri</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugestoesFiltradas.map((item) => (
                      <TableRow
                        key={item.codprod}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleToggleItem(item.codprod)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={item.selecionado || false}
                            onCheckedChange={() => handleToggleItem(item.codprod)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.ref}</TableCell>
                        <TableCell>{item.descr}</TableCell>
                        <TableCell>{item.marca}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              item.curvaABC === 'A' ? 'destructive' :
                              item.curvaABC === 'B' ? 'default' :
                              item.curvaABC === 'C' ? 'secondary' :
                              'outline'
                            }
                          >
                            {item.curvaABC}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={item.qtdSugerida}
                            onChange={(e) =>
                              atualizarItem(
                                item.codprod,
                                'qtdSugerida',
                                parseFloat(e.target.value),
                              )
                            }
                            className="w-20 text-right rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm font-bold text-gray-900 dark:text-white"
                          />
                        </TableCell>
                        <TableCell className="text-right text-blue-600 font-medium">
                          {item.multiploCompra || 1}
                        </TableCell>
                        <TableCell className="text-right">{item.estoque}</TableCell>
                        <TableCell className="text-right">{item.transito}</TableCell>
                        <TableCell className="text-right">{item.demanda30d}</TableCell>
                        <TableCell className="text-right">{item.demandaTrimestre}</TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-gray-500">R$</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.preco}
                              onChange={(e) =>
                                atualizarItem(
                                  item.codprod,
                                  'preco',
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-24 text-right rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-gray-900 dark:text-white"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
