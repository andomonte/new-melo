import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  Calculator,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// Tipagem para os resultados retornados pela API
interface KickbackResult {
  sku: string;
  descricao: string;
  precoOriginal: number;
  precoCalculado: number;
}

// Tipagem para o estado de carregamento
type LoadingState = 'idle' | 'uploading' | 'success' | 'error';

export default function KickbackPage() {
  // Estados do componente
  const [vendorPercent, setVendorPercent] = useState<number>(0); // Porcentagem do vendor
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Arquivo selecionado
  const [results, setResults] = useState<KickbackResult[]>([]); // Resultados da API
  const [loadingState, setLoadingState] = useState<LoadingState>('idle'); // Estado de carregamento

  /**
   * Manipula a seleção de arquivo
   * Verifica se o arquivo é do tipo Excel (.xlsx ou .xls)
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      // Verifica se o arquivo é Excel
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];

      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
        toast.success(`Arquivo "${file.name}" selecionado com sucesso!`);
      } else {
        toast.error(
          'Por favor, selecione apenas arquivos Excel (.xlsx ou .xls)',
        );
        event.target.value = ''; // Limpa o input
      }
    }
  };

  /**
   * Manipula o envio do formulário para processamento
   * Envia o arquivo e a porcentagem para a API
   */
  const handleExport = async () => {
    // Validações antes do envio
    if (!selectedFile) {
      toast.error('Por favor, selecione um arquivo Excel primeiro');
      return;
    }

    if (vendorPercent <= 0) {
      toast.error('Por favor, insira uma porcentagem válida maior que 0');
      return;
    }

    // Inicia o estado de carregamento
    setLoadingState('uploading');

    try {
      // Cria FormData para envio multipart/form-data
      const formData = new FormData();
      formData.append('arquivo', selectedFile);
      formData.append('vendorPercent', vendorPercent.toString());

      // Faz a requisição para a API
      const response = await fetch('/api/kickback/process', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Sucesso: exibe os resultados na tabela
        setResults(data.results || []);
        setLoadingState('success');
        toast.success(
          `Processamento concluído! ${
            data.results?.length || 0
          } itens processados.`,
        );
      } else {
        // Erro da API
        setLoadingState('error');
        toast.error(data.error || 'Erro ao processar arquivo');
      }
    } catch (error) {
      // Erro de rede ou outro erro inesperado
      setLoadingState('error');
      toast.error('Erro de conexão. Tente novamente.');
      console.error('Erro no processamento:', error);
    }
  };

  /**
   * Formata valores monetários para exibição
   */
  const formatMoney = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Cabeçalho da página */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-8 w-8 text-blue-600" />
          Sistema Kickback - Calculadora de Preços
        </h1>
        <p className="text-gray-600 mt-2">
          Faça upload de uma planilha Excel e aplique porcentagem para calcular
          preços kickback
        </p>
      </div>

      {/* Card principal com o formulário */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload e Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campo de porcentagem */}
          <div className="space-y-2">
            <Label htmlFor="vendor-percent" className="text-sm font-medium">
              Vendor % *
            </Label>
            <Input
              id="vendor-percent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="Ex: 4.5"
              value={vendorPercent || ''}
              onChange={(e) =>
                setVendorPercent(parseFloat(e.target.value) || 0)
              }
              className="max-w-xs"
            />
            <p className="text-xs text-gray-500">
              Porcentagem a ser aplicada sobre o preço sem taxa
            </p>
          </div>

          {/* Seletor de arquivo */}
          <div className="space-y-2">
            <Label htmlFor="file-upload" className="text-sm font-medium">
              Arquivo Excel *
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="max-w-md"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-green-600">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="text-sm">{selectedFile.name}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Selecione apenas arquivos Excel (.xlsx ou .xls)
            </p>
          </div>

          {/* Botão de exportar */}
          <Button
            onClick={handleExport}
            disabled={
              loadingState === 'uploading' ||
              !selectedFile ||
              vendorPercent <= 0
            }
            className="w-full sm:w-auto"
          >
            {loadingState === 'uploading' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Feedback visual do estado atual */}
      {loadingState !== 'idle' && (
        <Card
          className={`mb-8 ${
            loadingState === 'success'
              ? 'border-green-200 bg-green-50'
              : loadingState === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {loadingState === 'uploading' && (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                  <span className="text-blue-700">Processando arquivo...</span>
                </>
              )}
              {loadingState === 'success' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">
                    Processamento concluído com sucesso!
                  </span>
                </>
              )}
              {loadingState === 'error' && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">
                    Erro no processamento. Verifique o arquivo e tente
                    novamente.
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de resultados */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Resultados do Processamento ({results.length} itens)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">SKU</TableHead>
                    <TableHead className="min-w-64">Descrição</TableHead>
                    <TableHead className="text-right w-32">
                      Preço Original
                    </TableHead>
                    <TableHead className="text-right w-32">
                      Preço Kickback
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((item, index) => (
                    <TableRow key={`${item.sku}-${index}`}>
                      <TableCell className="font-mono text-sm">
                        {item.sku}
                      </TableCell>
                      <TableCell>
                        {item.descricao || 'Descrição não disponível'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(item.precoOriginal)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatMoney(item.precoCalculado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Resumo dos cálculos */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Resumo dos Cálculos:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  • Vendor %: <strong>{vendorPercent}%</strong>
                </p>
                <p>
                  • Itens processados: <strong>{results.length}</strong>
                </p>
                <p>
                  • Fórmula aplicada:{' '}
                  <strong>
                    Preço Kickback = Preço Original × (1 + {vendorPercent}/100)
                  </strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
