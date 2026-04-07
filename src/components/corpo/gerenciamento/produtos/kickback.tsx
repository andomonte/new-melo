import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Upload, FileSpreadsheet, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

// Componentes UI
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Tipagem para dados do Excel
interface ExcelRowData {
  item_sku: string;
  preco_sem_taxa: number;
  preco_com_taxa?: number;
  preco_final?: number;
  descricao: string;
}

// Tipagem para mapeamento de colunas
interface ColumnMapping {
  skuCol: number;
  precoCol: number;
  descricaoCol: number;
  startRow: number;
}

// Schema de validação
const formSchema = z.object({
  arquivo: z.instanceof(File).refine(
    (file) => {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];
      return validTypes.includes(file?.type);
    },
    {
      message: 'Apenas arquivos Excel (.xlsx ou .xls) são permitidos',
    },
  ),
  percentual: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'Percentual deve ser um número válido',
    }),
});

export default function KickbackBoschComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [displayedItems, setDisplayedItems] = useState(50); // Virtualization para performance
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      percentual: '',
    },
  });

  // Memoização dos dados visíveis para performance
  const visibleData = useMemo(() => {
    return previewData.slice(0, displayedItems);
  }, [previewData, displayedItems]);

  // Função otimizada para carregar mais itens
  const loadMoreItems = useCallback(() => {
    if (isLoadingMore || displayedItems >= previewData.length) return;

    setIsLoadingMore(true);
    // Simula carregamento assíncrono para não travar a UI
    setTimeout(() => {
      setDisplayedItems((prev) => Math.min(prev + 50, previewData.length));
      setIsLoadingMore(false);
    }, 10);
  }, [displayedItems, previewData.length, isLoadingMore]);

  // Função para processar e mostrar preview do Excel
  const handleFilePreview = async (file: File) => {
    if (!file) {
      console.log('❌ Arquivo não fornecido para preview');
      return;
    }

    console.log('🚀 Iniciando preview do arquivo:', file.name);
    setIsLoadingPreview(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Tentar ler com diferentes opções para preservar texto
      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: false, // Não converter para Date
        cellNF: false, // Não aplicar formatos de número
        cellText: true, // Preservar como texto quando possível
        raw: true, // Manter valores brutos
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Ler dados célula por célula para evitar conversão automática
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const jsonData: any[][] = [];

      // Percorrer cada linha da planilha
      for (let row = range.s.r; row <= range.e.r; row++) {
        const rowData: any[] = [];

        // Percorrer cada coluna da linha
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];

          if (cell && cell.v !== undefined) {
            let cellValue = '';

            // Estratégia universal para todas as células
            // Verificar se é uma data convertida automaticamente
            if (cell.t === 'd' || cell.v instanceof Date) {
              // Se for data, tentar recuperar texto original
              if (cell.w && !cell.w.includes('/') && !cell.w.includes(':')) {
                // Valor formatado que não parece data
                cellValue = String(cell.w).trim();
              } else {
                // Pular esta célula pois é provavelmente data real
                cellValue = '';
              }
            } else {
              // 1. Tentar valor formatado primeiro (preserva formatação original)
              if (cell.w) {
                cellValue = String(cell.w).trim();
              }
              // 2. Se não tem valor formatado, tentar valor bruto
              else if (cell.v !== undefined) {
                cellValue = String(cell.v).trim();
              }
              // 3. Se tem fórmula, tentar usar ela
              else if (cell.f) {
                cellValue = String(cell.f).trim();
              }
            }

            rowData[col] = cellValue;

            // Debug para células importantes nas primeiras linhas
            if (row <= 7 && cellValue && cellValue !== '') {
              console.log(`🔍 Frontend Linha ${row}, Coluna ${col}:`, {
                cellAddress,
                raw_v: cell.v,
                formatted_w: cell.w,
                type_t: cell.t,
                final_value: cellValue,
              });
            }
          } else {
            rowData[col] = '';
          }
        }

        jsonData.push(rowData);
      }

      // Detectar estrutura da planilha automaticamente
      const structure = detectSheetStructure(jsonData);

      // Processar dados usando a estrutura detectada
      const processedData: ExcelRowData[] = [];
      console.log('📋 Total de linhas na planilha:', jsonData.length);
      console.log('🔍 Primeiras 3 linhas raw:', jsonData.slice(0, 3));
      console.log('🎯 Usando estrutura:', structure);

      // Processamento otimizado de alta performance - leitura ilimitada
      const totalRows = jsonData.length;
      const totalItems = totalRows - structure.startRow;
      console.log(`🚀 Processamento de alta performance: ${totalItems} linhas`);

      // Pre-compilar regex para performance
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}/;

      // Processamento otimizado com minimal logging
      let validItems = 0;
      let skippedItems = 0;

      for (let i = structure.startRow; i < totalRows; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length < 2) {
          skippedItems++;
          continue;
        }

        // Otimizado: usar destructuring quando possível
        const item_sku = String(row[structure.skuCol] || '').trim();
        if (!item_sku || item_sku === 'undefined' || dateRegex.test(item_sku)) {
          skippedItems++;
          continue;
        }

        // Processamento otimizado de preço
        const precoCelula = row[structure.precoCol];
        let preco_sem_taxa = 0;

        if (
          precoCelula !== undefined &&
          precoCelula !== null &&
          precoCelula !== ''
        ) {
          if (typeof precoCelula === 'number') {
            preco_sem_taxa = precoCelula;
          } else {
            // Otimizado: replace chain mais eficiente
            const precoStr = String(precoCelula).replace(',', '.').trim();
            preco_sem_taxa = parseFloat(precoStr) || 0;
          }
        }

        if (item_sku && preco_sem_taxa > 0) {
          const descricao =
            structure.descricaoCol !== -1
              ? String(row[structure.descricaoCol] || '').trim()
              : '';

          processedData.push({
            item_sku,
            preco_sem_taxa,
            descricao: descricao || 'Sem descrição',
          });

          validItems++;

          // Log otimizado: apenas primeiros 3 e marcos importantes
          if (validItems <= 3) {
            console.log(
              `✅ Item ${validItems}: ${item_sku} - R$ ${preco_sem_taxa}`,
            );
          } else if (validItems % 1000 === 0) {
            console.log(`📊 Processados: ${validItems} itens válidos...`);
          }
        } else {
          skippedItems++;
        }
      }

      console.log(
        `✅ Processamento concluído: ${validItems} válidos, ${skippedItems} ignorados`,
      );

      // Otimização: resetar virtualização para novo arquivo
      setDisplayedItems(50);
      setPreviewData(processedData);

      console.log('📊 Preview processado:', processedData.length, 'itens');
      console.log('🔍 Primeiros 3 itens:', processedData.slice(0, 3));

      // Toast otimizado com informações de performance
      const performanceInfo =
        processedData.length > 1000
          ? ` (otimizado para ${processedData.length.toLocaleString()} itens)`
          : '';

      toast.success(
        `Preview carregado: ${processedData.length.toLocaleString()} itens válidos encontrados${performanceInfo}`,
      );
    } catch (error) {
      console.error('🚨 Erro ao processar arquivo para preview:', error);
      toast.error(
        `Erro ao ler arquivo Excel: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`,
      );
      setPreviewData([]);
    } finally {
      console.log(
        '✅ Preview finalizado, carregando estado definido como false',
      );
      setIsLoadingPreview(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('arquivo', values.arquivo);
      formData.append('vendorPercent', values.percentual);

      const response = await fetch('/api/kickback/process', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Arquivo processado com sucesso!');

        // Mostrar erros se houver
        if (data.erros && data.erros.length > 0) {
          data.erros.forEach((erro: string) => {
            toast.warning(erro);
          });
        }

        // Limpar formulário
        form.reset();
        setSelectedFile(null);
      } else {
        toast.error(data.error || 'Erro ao processar arquivo');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para formatar preço
  const formatMoney = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função inteligente para detectar estrutura da planilha
  const detectSheetStructure = (jsonData: any[][]): ColumnMapping => {
    console.log('🔍 Frontend: Analisando estrutura da planilha...');

    let skuCol = -1;
    let precoCol = -1;
    let descricaoCol = -1;
    let startRow = -1;
    let precoComTaxaCol = -1;

    // Procurar por cabeçalhos nas primeiras 15 linhas
    for (let row = 0; row < Math.min(15, jsonData.length); row++) {
      const rowData = jsonData[row];
      if (!rowData || rowData.length === 0) continue;

      console.log(
        `📋 Frontend: Analisando linha ${row} (${rowData.length} colunas):`,
        rowData,
      );

      // Mostrar todas as colunas para debug nas primeiras linhas
      if (row <= 7) {
        rowData.forEach((cell, idx) => {
          const cellStr = String(cell || '').trim();
          if (cellStr) {
            console.log(`  Frontend Coluna ${idx}: "${cellStr}"`);
          }
        });
      }

      // Procurar por padrões de cabeçalho específicos da planilha Bosch
      for (let col = 0; col < rowData.length; col++) {
        const cellValue = String(rowData[col] || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-zA-Z0-9_]/g, ''); // Remove caracteres especiais para comparação

        // Detectar coluna SKU/Item (exato para planilha Bosch)
        if (
          skuCol === -1 &&
          (cellValue === 'item' ||
            cellValue === 'codigo' ||
            cellValue === 'sku' ||
            cellValue === 'codigodoitem' ||
            cellValue === 'ref' ||
            cellValue === 'referencia')
        ) {
          skuCol = col;
          console.log(
            `✅ Frontend: Coluna SKU/Item detectada: ${col} ("${String(
              rowData[col],
            ).trim()}")`,
          );
        }

        // Detectar coluna Preco_Sem_Taxa (prioritária)
        if (
          precoCol === -1 &&
          (cellValue === 'precosemtaxa' ||
            cellValue === 'precosemtaxa' ||
            cellValue === 'preco_sem_taxa' ||
            cellValue === 'precosemtaxa')
        ) {
          precoCol = col;
          console.log(
            `✅ Frontend: Coluna Preço SEM Taxa detectada: ${col} ("${String(
              rowData[col],
            ).trim()}")`,
          );
        }

        // Detectar coluna Preco_Com_Taxa (alternativa)
        if (
          precoComTaxaCol === -1 &&
          (cellValue === 'precocomtaxa' ||
            cellValue === 'precocomtaxa' ||
            cellValue === 'preco_com_taxa' ||
            cellValue === 'precocomtaxa')
        ) {
          precoComTaxaCol = col;
          console.log(
            `✅ Frontend: Coluna Preço COM Taxa detectada: ${col} ("${String(
              rowData[col],
            ).trim()}")`,
          );
        }

        // Detectar coluna descrição
        if (
          descricaoCol === -1 &&
          (cellValue === 'descricao' ||
            cellValue === 'descricao' ||
            cellValue === 'nome' ||
            cellValue === 'produto' ||
            cellValue === 'description')
        ) {
          descricaoCol = col;
          console.log(
            `✅ Frontend: Coluna Descrição detectada: ${col} ("${String(
              rowData[col],
            ).trim()}")`,
          );
        }
      }

      // Se encontrou pelo menos SKU e algum tipo de preço, definir linha de início
      if (
        skuCol !== -1 &&
        (precoCol !== -1 || precoComTaxaCol !== -1) &&
        startRow === -1
      ) {
        startRow = row + 1; // Dados começam na próxima linha

        // Se não encontrou Preco_Sem_Taxa, usar Preco_Com_Taxa
        if (precoCol === -1 && precoComTaxaCol !== -1) {
          precoCol = precoComTaxaCol;
          console.log(
            `✅ Frontend: Usando Preço COM Taxa como coluna principal: ${precoCol}`,
          );
        }

        console.log(`✅ Frontend: Linha de início dos dados: ${startRow}`);
        break;
      }
    }

    // Fallback: se não encontrou cabeçalhos, assumir estrutura padrão
    if (skuCol === -1 || precoCol === -1) {
      console.log(
        '⚠️ Frontend: Cabeçalhos não encontrados, usando estrutura padrão',
      );

      // Procurar primeira linha com dados válidos
      for (let row = 0; row < Math.min(10, jsonData.length); row++) {
        const rowData = jsonData[row];
        if (!rowData || rowData.length < 2) continue;

        const firstCol = String(rowData[0] || '').trim();
        const secondCol = rowData[1];

        // Verificar se primeira coluna parece SKU e segunda parece preço
        if (
          firstCol &&
          !firstCol.includes('/') && // Não é data
          firstCol.length > 2 &&
          !isNaN(parseFloat(String(secondCol)))
        ) {
          skuCol = 0;
          precoCol = 1;
          descricaoCol = rowData.length > 2 ? 2 : -1;
          startRow = row;
          console.log(
            `✅ Frontend: Estrutura detectada automaticamente na linha ${row}`,
          );
          break;
        }
      }
    }

    const result: ColumnMapping = {
      skuCol: skuCol !== -1 ? skuCol : 0,
      precoCol: precoCol !== -1 ? precoCol : 1,
      descricaoCol: descricaoCol !== -1 ? descricaoCol : 2,
      startRow: startRow !== -1 ? startRow : 1,
    };

    console.log('📊 Frontend: Estrutura final detectada:', result);

    // Validação final - mostrar quais colunas foram mapeadas
    if (jsonData.length > 0 && jsonData[result.startRow - 1]) {
      const headerRow = jsonData[result.startRow - 1];
      console.log('🎯 Frontend: Mapeamento final das colunas:');
      console.log(
        `  SKU/Item: Coluna ${result.skuCol} = "${
          headerRow[result.skuCol] || 'N/A'
        }"`,
      );
      console.log(
        `  Preço: Coluna ${result.precoCol} = "${
          headerRow[result.precoCol] || 'N/A'
        }"`,
      );
      console.log(
        `  Descrição: Coluna ${result.descricaoCol} = "${
          result.descricaoCol !== -1
            ? headerRow[result.descricaoCol] || 'N/A'
            : 'Não detectada'
        }"`,
      );
      console.log(`  Início dos dados: Linha ${result.startRow}`);
    }

    return result;
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Kickback Bosch</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Card do Formulário */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Importação de Preços Kickback</CardTitle>
            <CardDescription>
              Faça upload da planilha Excel com os produtos Bosch e defina o
              percentual de acréscimo
            </CardDescription>
          </CardHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                {/* Campo de Upload */}
                <FormField
                  control={form.control}
                  name="arquivo"
                  render={({ field: { onChange, name, onBlur } }) => (
                    <FormItem>
                      <FormLabel>Planilha Excel</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-4">
                          <Input
                            type="file"
                            accept=".xlsx,.xls"
                            name={name}
                            onBlur={onBlur}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Otimização: reset completo do estado para novo arquivo
                                setPreviewData([]);
                                setDisplayedItems(50);
                                setIsLoadingPreview(true);
                                setIsLoadingMore(false);

                                onChange(file);
                                setSelectedFile(file);
                                handleFilePreview(file);
                              } else {
                                // Limpar tudo se nenhum arquivo selecionado
                                setSelectedFile(null);
                                setPreviewData([]);
                                setDisplayedItems(50);
                                setIsLoadingPreview(false);
                                setIsLoadingMore(false);
                              }
                            }}
                            className="cursor-pointer"
                          />
                          {selectedFile && (
                            <span className="text-sm text-muted-foreground">
                              {selectedFile.name}
                            </span>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Selecione a planilha Excel (.xlsx ou .xls) com as
                        colunas: item_sku, preco_sem_taxa, descricao
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campo de Percentual */}
                <FormField
                  control={form.control}
                  name="percentual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentual de Desconto (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 4.5"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Digite o percentual de desconto que será aplicado sobre
                        o preço base
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>

              <CardFooter>
                <Button
                  type="submit"
                  disabled={isLoading || !selectedFile}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Processar Arquivo
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        {/* Card de Preview */}
        <Card className="h-fit overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Preview dos Dados
            </CardTitle>
            <CardDescription>
              Visualização dos dados que serão processados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mb-2 text-xs text-muted-foreground">
              Debug: isLoading={String(isLoadingPreview)}, items=
              {previewData.length}
            </div>

            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Carregando preview...</span>
              </div>
            ) : selectedFile ? (
              previewData.length > 0 ? (
                <>
                  <div className="mb-4">
                    <Badge variant="secondary">
                      {previewData.length} itens encontrados
                    </Badge>
                  </div>
                  <div
                    className="max-h-96 overflow-y-auto"
                    onScroll={(e) => {
                      const target = e.target as HTMLDivElement;
                      const { scrollTop, scrollHeight, clientHeight } = target;

                      // Scroll infinito otimizado - carrega mais quando próximo ao final
                      if (scrollHeight - scrollTop <= clientHeight * 1.5) {
                        loadMoreItems();
                      }
                    }}
                  >
                    <div className="overflow-x-auto">
                      <Table className="min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[100px] sticky left-0 bg-background z-10">
                              SKU
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({previewData.length} total)
                              </span>
                            </TableHead>
                            <TableHead className="text-right min-w-[120px]">
                              Preço Original
                            </TableHead>
                            <TableHead className="min-w-[200px]">
                              Descrição
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleData.map((item, index) => (
                            <TableRow key={`${item.item_sku}-${index}`}>
                              <TableCell className="font-mono text-sm sticky left-0 bg-background z-10 border-r">
                                <div
                                  className="max-w-[100px] truncate"
                                  title={item.item_sku}
                                >
                                  {item.item_sku}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">
                                {formatMoney(item.preco_sem_taxa)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <div
                                  className="max-w-[300px] truncate"
                                  title={item.descricao}
                                >
                                  {item.descricao}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Indicator de loading para mais itens */}
                          {isLoadingMore && (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="text-center py-4"
                              >
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                <span className="text-xs text-muted-foreground ml-2">
                                  Carregando mais itens...
                                </span>
                              </TableCell>
                            </TableRow>
                          )}
                          {/* Indicator de mais itens disponíveis */}
                          {!isLoadingMore &&
                            displayedItems < previewData.length && (
                              <TableRow>
                                <TableCell
                                  colSpan={3}
                                  className="text-center py-4"
                                >
                                  <button
                                    onClick={loadMoreItems}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Carregar mais itens (
                                    {previewData.length - displayedItems}{' '}
                                    restantes)
                                  </button>
                                </TableCell>
                              </TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-orange-500">
                  <FileSpreadsheet className="h-8 w-8 mb-2" />
                  <p className="text-sm font-medium">
                    Arquivo selecionado: {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Processando dados...
                  </p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Eye className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhum arquivo selecionado</p>
                <p className="text-xs">
                  Selecione uma planilha Excel para ver o preview
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
