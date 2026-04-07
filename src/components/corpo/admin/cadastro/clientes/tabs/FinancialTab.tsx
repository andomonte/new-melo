import React, { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DollarSign,
  Loader2,
  ShoppingCart,
  FileText,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

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

interface Banco {
  banco: string;
  nome: string;
}

export function FinancialTab() {
  const {
    register,
    control,
    watch,
    getValues,
    formState: { errors },
  } = useFormContext();

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
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBancos, setLoadingBancos] = useState(true);

  useEffect(() => {
    async function fetchBancos() {
      try {
        const response = await fetch('/api/bancos/get?perPage=9999');
        if (response.ok) {
          const data = await response.json();
          setBancos(data.data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar bancos:', error);
      } finally {
        setLoadingBancos(false);
      }
    }

    fetchBancos();
  }, []);

  useEffect(() => {
    async function fetchFinancialData() {
      const codcli = getValues('codcli');

      if (!codcli) {
        return;
      }

      setLoading(true);
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
        setLoading(false);
      }
    }

    fetchFinancialData();
  }, [getValues]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b pb-2">
        Configurações de Crédito
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Limite de Crédito */}
        <div>
          <Label>Limite de Crédito (R$)</Label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              {...register('limiteCredito')}
              className={`pl-9 ${
                errors.limiteCredito
                  ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20 focus-visible:ring-red-500'
                  : ''
              }`}
              placeholder="0,00"
            />
          </div>
          {errors.limiteCredito && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {errors.limiteCredito.message as string}
            </p>
          )}
        </div>

        {/* Crédito */}
        <div>
          <Label>Crédito</Label>
          <Controller
            control={control}
            name="credito"
            render={({ field }) => (
              <>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || 'S'}
                >
                  <SelectTrigger
                    className={
                      errors.credito
                        ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">S - Sim</SelectItem>
                    <SelectItem value="N">N - Não</SelectItem>
                  </SelectContent>
                </Select>
                {errors.credito && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.credito.message as string}
                  </p>
                )}
              </>
            )}
          />
        </div>

        {/* Classe de Pagamento */}
        <div>
          <Label>Classe de Pagamento</Label>
          <Controller
            control={control}
            name="classePagamento"
            render={({ field }) => (
              <>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || 'A'}
                >
                  <SelectTrigger
                    className={
                      errors.classePagamento
                        ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A - À Vista</SelectItem>
                    <SelectItem value="B">B - A Prazo</SelectItem>
                    <SelectItem value="C">C - Misto</SelectItem>
                    <SelectItem value="X">X - Especial</SelectItem>
                  </SelectContent>
                </Select>
                {errors.classePagamento && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.classePagamento.message as string}
                  </p>
                )}
              </>
            )}
          />
        </div>

        {/* Aceita Atraso */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label>Aceita Atraso</Label>
            <div className="flex items-center gap-2 mt-2">
              <Controller
                control={control}
                name="aceitaAtraso"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="chk-atraso"
                  />
                )}
              />
              <Label htmlFor="chk-atraso" className="font-normal">
                Permitir atraso
              </Label>
            </div>
          </div>
          {watch('aceitaAtraso') && (
            <div className="flex-1">
              <Label>Dias de Atraso</Label>
              <Input
                {...register('diasAtraso')}
                className={
                  errors.diasAtraso
                    ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                    : ''
                }
                type="number"
                placeholder="0"
              />
              {errors.diasAtraso && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.diasAtraso.message as string}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ICMS, Faixa Financeira, Banco, Forma de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label>ICMS</Label>
          <Controller
            control={control}
            name="icms"
            render={({ field }) => (
              <>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || 'N'}
                >
                  <SelectTrigger
                    className={
                      errors.icms
                        ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N">N - Não</SelectItem>
                    <SelectItem value="S">S - Sim</SelectItem>
                  </SelectContent>
                </Select>
                {errors.icms && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.icms.message as string}
                  </p>
                )}
              </>
            )}
          />
        </div>

        <div>
          <Label>Faixa Financeira</Label>
          <Input
            {...register('faixaFinanceira')}
            className={
              errors.faixaFinanceira
                ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                : ''
            }
            placeholder="01"
          />
          {errors.faixaFinanceira && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {errors.faixaFinanceira.message as string}
            </p>
          )}
        </div>

        <div>
          <Label>
            Banco
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Controller
            control={control}
            name="banco"
            render={({ field }) => (
              <>
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(val) =>
                    field.onChange(val ? Number(val) : undefined)
                  }
                  disabled={loadingBancos}
                >
                  <SelectTrigger
                    className={
                      errors.banco
                        ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>

                  <SelectContent>
                    {bancos.map((b) => (
                      <SelectItem key={b.banco} value={String(b.banco)}>
                        {b.banco} - {b.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {errors.banco && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.banco.message as string}
                  </p>
                )}
              </>
            )}
          />
        </div>

        <div>
          <Label>Forma de Pagamento</Label>
          <Controller
            control={control}
            name="formaPagamento"
            render={({ field }) => (
              <>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger
                    className={
                      errors.formaPagamento
                        ? 'border-red-500 border-2 bg-red-50 dark:bg-red-950/20'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.formaPagamento && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errors.formaPagamento.message as string}
                  </p>
                )}
              </>
            )}
          />
        </div>
      </div>

      {/* Resto do código permanece igual... */}
      {/* Histórico Financeiro */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b pb-2">
          Histórico Financeiro
        </h3>

        <Tabs defaultValue="meses" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="meses">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Compras por Mês
            </TabsTrigger>
            <TabsTrigger value="vencer">
              <FileText className="h-4 w-4 mr-2" />
              Títulos a Vencer
            </TabsTrigger>
            <TabsTrigger value="vencidos">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Títulos Vencidos
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="meses"
            className="border rounded-md p-4 min-h-[200px]"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MÊS/ANO</TableHead>
                  <TableHead className="text-right">TOTAL (R$)</TableHead>
                  <TableHead className="text-right">PRAZO MÉDIO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
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
                          Nenhuma compra registrada
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
                        {compra.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {compra.prazoMedio}
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
                {loading ? (
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
                        {titulo.valor ? titulo.valor.toFixed(2) : '0.00'}
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
                {loading ? (
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
                        {titulo.valor ? titulo.valor.toFixed(2) : '0.00'}
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
      </div>

      {/* Estatísticas */}
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
  );
}
