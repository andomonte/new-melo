import React, { useState } from 'react';
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
  reqId: number;
  reqVersao: number;
  onItensImportados?: (qtd: number) => void;
}

type TipoSugestao = 'DEMANDA_30D' | 'DEMANDA_60D' | 'ESTOQUE_MIN' | 'ESTOQUE_MAX';
type TipoFiltro = 'marca' | 'grupo';

export default function SugestaoAutomatica({
  reqId,
  reqVersao,
  onItensImportados
}: SugestaoAutomaticaProps) {
  // Estados
  const [tipoSugestao, setTipoSugestao] = useState<TipoSugestao>('DEMANDA_30D');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('marca');
  const [codigoFiltro, setCodigoFiltro] = useState('');
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

            {/* Código */}
            <div className="space-y-2">
              <Label>{tipoFiltro === 'marca' ? 'Código da Marca' : 'Código do Grupo'}</Label>
              <Input
                value={codigoFiltro}
                onChange={(e) => setCodigoFiltro(e.target.value)}
                placeholder="Ex: 00001"
              />
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
          <CardHeader>
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
                onClick={handleImportar}
                disabled={qtdSelecionados === 0 || loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Importar {qtdSelecionados > 0 && `(${qtdSelecionados})`}
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
                    {sugestoes.map((item) => (
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
                        <TableCell className="text-right font-bold">
                          {item.qtdSugerida}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 font-medium">
                          {item.multiploCompra || 1}
                        </TableCell>
                        <TableCell className="text-right">{item.estoque}</TableCell>
                        <TableCell className="text-right">{item.transito}</TableCell>
                        <TableCell className="text-right">{item.demanda30d}</TableCell>
                        <TableCell className="text-right">{item.demandaTrimestre}</TableCell>
                        <TableCell className="text-right">
                          R$ {item.preco.toFixed(2)}
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
