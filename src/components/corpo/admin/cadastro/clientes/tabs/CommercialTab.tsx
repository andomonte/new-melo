import React, { useEffect, useState } from 'react';
import { useFormContext, Controller, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Plus,
  Trash2,
  Loader2,
  ShoppingCart,
  FileText,
  AlertTriangle,
  TrendingUp,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Vendedor {
  id: string;
  nome: string;
}

interface Segmento {
  codsegmento: string;
  descricao: string;
}

interface ComprasMes {
  data: string;
  total: number;
  prazoMedio: number;
}

interface Titulo {
  nroDoc: string;
  codReceita: string;
  dtEmissao: string;
  dtPgto: string;
  dtVenc: string;
  valor?: number;
  diasAtraso?: number;
}

interface Estatisticas {
  media3Meses: number;
  totalDebito: number;
  maiorCompra: number;
  titulosVencer: number;
  titulosVencidos: number;
  atrasoMedio: number;
}

export function CommercialTab() {
  const {
    register,
    control,
    getValues,
    formState: { errors: _errors },
  } = useFormContext();
  const [sellers, setSellers] = useState<Vendedor[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSegmentos, setLoadingSegmentos] = useState(true);

  // Estados para dados financeiros
  const [comprasMeses, setComprasMeses] = useState<ComprasMes[]>([]);
  const [titulosVencer, setTitulosVencer] = useState<Titulo[]>([]);
  const [titulosVencidos, setTitulosVencidos] = useState<Titulo[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    media3Meses: 0,
    totalDebito: 0,
    maiorCompra: 0,
    titulosVencer: 0,
    titulosVencidos: 0,
    atrasoMedio: 0,
  });
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  useEffect(() => {
    async function fetchSellers() {
      try {
        const res = await fetch('/api/vendedores');
        if (!res.ok) throw new Error('Falha ao carregar vendedores');
        const data = await res.json();
        setSellers(data);
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar lista de vendedores.');
      } finally {
        setLoading(false);
      }
    }
    fetchSellers();
  }, []);

  useEffect(() => {
    async function fetchSegmentos() {
      try {
        const res = await fetch('/api/segmentos/get?perPage=999');
        if (!res.ok) throw new Error('Falha ao carregar segmentos');
        const data = await res.json();
        setSegmentos(data.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingSegmentos(false);
      }
    }
    fetchSegmentos();
  }, []);

  useEffect(() => {
    async function fetchFinancialData() {
      const codcli = getValues('codcli');

      if (!codcli) {
        return;
      }

      setLoadingFinancial(true);
      try {
        const [mesesRes, vencerRes, vencidosRes, statsRes] = await Promise.all([
          fetch(`/api/clientes/${codcli}/compras-meses`),
          fetch(`/api/clientes/${codcli}/titulos-vencer`),
          fetch(`/api/clientes/${codcli}/titulos-vencidos`),
          fetch(`/api/clientes/${codcli}/estatisticas-financeiras`),
        ]);

        if (mesesRes.ok) {
          const mesesData = await mesesRes.json();
          setComprasMeses(mesesData);
        }

        if (vencerRes.ok) {
          const vencerData = await vencerRes.json();
          setTitulosVencer(vencerData);
        }

        if (vencidosRes.ok) {
          const vencidosData = await vencidosRes.json();
          setTitulosVencidos(vencidosData);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setEstatisticas(statsData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados financeiros:', error);
      } finally {
        setLoadingFinancial(false);
      }
    }

    fetchFinancialData();
  }, [getValues]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'vendedores_list',
  });

  return (
    <div className="space-y-6">
      {/* Vendedores por Segmento */}
      <div className="flex flex-row items-center justify-between border-b pb-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Vendedores por Segmento
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ sellerId: '', segmentoId: '' })}
        >
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
            Nenhum vendedor associado. Clique em "Adicionar" para vincular vendedores a segmentos.
          </p>
        ) : (
          <div className="grid gap-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-zinc-700"
              >
                {/* Vendedor */}
                <div className="flex-1 min-w-[200px]">
                  <Controller
                    control={control}
                    name={`vendedores_list.${index}.sellerId`}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between font-normal h-8 px-2 py-1 text-xs',
                              'bg-background border border-input hover:bg-background hover:text-foreground',
                              !field.value && 'text-muted-foreground',
                            )}
                            disabled={loading}
                          >
                            {loading
                              ? 'Carregando...'
                              : field.value
                              ? sellers.find((s) => s.id === field.value)
                                ? `${field.value} - ${sellers.find((s) => s.id === field.value)?.nome}`
                                : 'Selecione vendedor'
                              : 'Selecione vendedor'}
                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 bg-popover"
                          align="start"
                        >
                          <Command className="bg-popover">
                            <CommandInput
                              placeholder="Pesquisar vendedor..."
                              className="bg-popover text-xs"
                            />
                            <CommandEmpty className="py-4 text-center text-xs">
                              Nenhum vendedor encontrado.
                            </CommandEmpty>
                            <CommandGroup className="max-h-48 overflow-auto bg-popover">
                              {sellers.map((seller) => (
                                <CommandItem
                                  key={seller.id}
                                  value={`${seller.id} ${seller.nome}`}
                                  onSelect={() => field.onChange(seller.id)}
                                  className="bg-popover hover:bg-accent text-xs"
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-3 w-3',
                                      field.value === seller.id ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                  {seller.id} - {seller.nome}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>

                {/* Segmento */}
                <div className="w-[180px]">
                  <Controller
                    control={control}
                    name={`vendedores_list.${index}.segmentoId`}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={loadingSegmentos}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={loadingSegmentos ? 'Carregando...' : 'Segmento (opcional)'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todos os segmentos</SelectItem>
                          {segmentos.map((seg) => (
                            <SelectItem key={seg.codsegmento} value={seg.codsegmento}>
                              {seg.codsegmento} - {seg.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Botão remover */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                  onClick={() => remove(index)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configurações Comerciais */}
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-6 mb-4 border-b pb-2">
        Configurações Comerciais
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Acréscimo */}
        <div>
          <Label>Acréscimo (%)</Label>
          <Input
            {...register('acrescimo')}
            type="number"
            step="0.01"
            placeholder="0.00"
          />
        </div>

        {/* Desconto */}
        <div>
          <Label>Desconto (%)</Label>
          <Input
            {...register('desconto')}
            type="number"
            step="0.01"
            placeholder="0.00"
          />
        </div>

        {/* Preço de Venda */}
        <div>
          <Label>Preço de Venda</Label>
          <Input
            {...register('precoVenda')}
            type="number"
            step="0.01"
            placeholder="0.00"
          />
        </div>

        {/* Kickback */}
        <div>
          <Label>Kickback</Label>
          <Input
            {...register('kickback')}
            type="number"
            step="0.01"
            placeholder="0.00"
          />
        </div>

        {/* Desconto Aplicado */}
        <div>
          <Label>Desconto Aplicado</Label>
          <Controller
            control={control}
            name="descontoAplicado"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 - INTERCOM</SelectItem>
                  <SelectItem value="S">Sim</SelectItem>
                  <SelectItem value="N">Não</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Bloqueio de Preço */}
        <div className="flex items-center gap-2 mt-6">
          <Controller
            control={control}
            name="benmd"
            render={({ field }) => (
              <Checkbox
                checked={field.value === 'S'}
                onCheckedChange={(checked) =>
                  field.onChange(checked ? 'S' : 'N')
                }
                id="chk-bloquear-preco"
              />
            )}
          />
          <Label
            htmlFor="chk-bloquear-preco"
            className="font-normal cursor-pointer"
          >
            Bloquear Preço de Venda
          </Label>
        </div>

        {/* Habilitar Local de Entrega */}
        <div className="flex items-center gap-2 mt-6">
          <Controller
            control={control}
            name="habilitarLocalEntrega"
            render={({ field }) => (
              <Checkbox
                checked={field.value === '1'}
                onCheckedChange={(checked) =>
                  field.onChange(checked ? '1' : '0')
                }
                id="chk-local-entrega"
              />
            )}
          />
          <Label
            htmlFor="chk-local-entrega"
            className="font-normal cursor-pointer"
          >
            Habilitar Local de Entrega (Outros)
          </Label>
        </div>

        {/* Observações Comerciais */}
        <div className="md:col-span-2">
          <Label>Observações Comerciais</Label>
          <Input
            {...register('obs')}
            placeholder="Notas internas sobre o cliente..."
          />
        </div>
      </div>

      {/* Grid de Dados Financeiros - Replicado da aba Financeira */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
            Visualização de Dados Financeiros
          </h3>
          {loadingFinancial && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Carregando dados...</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="tres-meses" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tres-meses">
              <ShoppingCart className="h-4 w-4 mr-2" />
              TRÊ(S)[3] ÚLTIMOS MESES
            </TabsTrigger>
            <TabsTrigger value="vencer">
              <FileText className="h-4 w-4 mr-2" />
              TÍTULOS A VENCER
            </TabsTrigger>
            <TabsTrigger value="vencidos">
              <AlertTriangle className="h-4 w-4 mr-2" />
              TÍTULOS VENCIDOS
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="tres-meses"
            className="border rounded-md p-4 min-h-[200px]"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DATA</TableHead>
                  <TableHead className="text-right">TOTAL</TableHead>
                  <TableHead className="text-right">PRAZO MÉDIO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingFinancial ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm">Carregando compras...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : comprasMeses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <ShoppingCart className="h-12 w-12 opacity-20" />
                        <p className="text-sm font-medium">
                          Nenhuma compra nos últimos 3 meses
                        </p>
                        <p className="text-xs">
                          As compras realizadas aparecerão aqui automaticamente
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  comprasMeses.map((compra, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{compra.data}</TableCell>
                      <TableCell className="text-right">
                        R$ {compra.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {compra.prazoMedio} dias
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent
            value="vencer"
            className="border rounded-md p-4 min-h-[200px]"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NRO. DOC</TableHead>
                  <TableHead>CÓD. RECEB</TableHead>
                  <TableHead>DT. EMISSÃO</TableHead>
                  <TableHead>DT. VENC</TableHead>
                  <TableHead className="text-right">VALOR (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingFinancial ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm">Carregando títulos...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : titulosVencer.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <FileText className="h-12 w-12 opacity-20" />
                        <p className="text-sm font-medium">
                          Nenhum título a vencer
                        </p>
                        <p className="text-xs">
                          Ótimo! Este cliente não possui pendências futuras
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  titulosVencer.map((titulo, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{titulo.nroDoc}</TableCell>
                      <TableCell>{titulo.codReceita}</TableCell>
                      <TableCell>{titulo.dtEmissao}</TableCell>
                      <TableCell>{titulo.dtVenc}</TableCell>
                      <TableCell className="text-right">
                        R$ {titulo.valor ? titulo.valor.toFixed(2) : '0.00'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent
            value="vencidos"
            className="border rounded-md p-4 min-h-[200px]"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NRO. DOC</TableHead>
                  <TableHead>CÓD. RECEB</TableHead>
                  <TableHead>DT. EMISSÃO</TableHead>
                  <TableHead>DT. VENC</TableHead>
                  <TableHead className="text-right">VALOR (R$)</TableHead>
                  <TableHead className="text-right">ATRASO (dias)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingFinancial ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm">
                          Carregando títulos vencidos...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : titulosVencidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="relative">
                          <TrendingUp className="h-12 w-12 opacity-20 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          Excelente! Nenhum título vencido
                        </p>
                        <p className="text-xs">
                          Este cliente mantém os pagamentos em dia
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  titulosVencidos.map((titulo, idx) => (
                    <TableRow
                      key={idx}
                      className="text-red-600 dark:text-red-400"
                    >
                      <TableCell>{titulo.nroDoc}</TableCell>
                      <TableCell>{titulo.codReceita}</TableCell>
                      <TableCell>{titulo.dtEmissao}</TableCell>
                      <TableCell>{titulo.dtVenc}</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {titulo.valor ? titulo.valor.toFixed(2) : '0.00'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {titulo.diasAtraso || 0}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        {/* Estatísticas Financeiras */}
        <div className="mt-6 p-4 bg-muted/50 dark:bg-muted/20 rounded-md border border-muted">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">
                MÉDIA 3 ÚLTIMOS MESES
              </span>
              <span className="text-lg font-semibold">
                R$ {estatisticas.media3Meses.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">
                TOTAL DÉBITO EM CONTA
              </span>
              <span
                className={`text-lg font-semibold ${
                  estatisticas.totalDebito > 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : ''
                }`}
              >
                R$ {estatisticas.totalDebito.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">
                MAIOR COMPRA EM 12 MESES
              </span>
              <span className="text-lg font-semibold">
                R$ {estatisticas.maiorCompra.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">
                TÍTULOS A VENCER
              </span>
              <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                R$ {estatisticas.titulosVencer.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">
                TÍTULOS VENCIDOS
              </span>
              <span
                className={`text-lg font-semibold ${
                  estatisticas.titulosVencidos > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                R$ {estatisticas.titulosVencidos.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">
                ATRASO MÉDIO
              </span>
              <span
                className={`text-lg font-semibold ${
                  estatisticas.atrasoMedio > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                {estatisticas.atrasoMedio > 0
                  ? `${estatisticas.atrasoMedio} dias`
                  : 'Em dia ✓'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
