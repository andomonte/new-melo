import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Truck, DollarSign, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface NotaAssociada {
  codtransp: string;
  nrocon: string;
  serie: string;
  cfop: string;
  totaltransp: string;
  pago: string;
  dtemissao: string | null;
  chave: string | null;
  icms: number | null;
  baseicms: number | null;
  nome_transportadora: string;
  numero_nota_fiscal: string | null;
  serie_nota_fiscal: string | null;
  chave_nota_fiscal: string | null;
}

interface TituloInfo {
  cod_pgto: string;
  tipo: string;
  cod_transp: string;
  valor_pgto: string;
  titulo_importado: boolean;
  dt_emissao: string;
  dt_venc: string;
  paga: string;
  cancel: string;
  obs: string;
}

interface ResumoInfo {
  quantidade_notas: number;
  valor_total_notas: string;
  valor_titulo: string;
  valores_conferem: boolean;
  diferenca: string;
}

interface ModalNotasAssociadasProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: TituloInfo | null;
  notas: NotaAssociada[];
  resumo: ResumoInfo | null;
  carregando: boolean;
}

export default function ModalNotasAssociadas({
  aberto,
  onFechar,
  titulo,
  notas,
  resumo,
  carregando
}: ModalNotasAssociadasProps) {
  const [dados, setDados] = useState<{
    titulo: TituloInfo | null;
    notas: NotaAssociada[];
    resumo: ResumoInfo | null;
  }>({ titulo: null, notas: [], resumo: null });

  useEffect(() => {
    if (titulo && notas && resumo) {
      setDados({ titulo, notas, resumo });
    }
  }, [titulo, notas, resumo]);

  const formatarValor = (valor: string | number) => {
    const num = typeof valor === 'string' ? parseFloat(valor) : valor;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'N': { label: 'Não Pago', variant: 'destructive' as const },
      'S': { label: 'Pago', variant: 'default' as const },
    };
    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
        <DialogHeader className="border-b border-gray-200 dark:border-zinc-700 pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="size-5 text-blue-600" />
            Notas Associadas ao Título
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            Detalhes das notas de conhecimento vinculadas a este título
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-700 dark:text-gray-300">Carregando notas...</span>
          </div>
        ) : dados.titulo ? (
          <div className="space-y-6">
            {/* Informações do Título */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="size-4 text-green-600" />
                  Informações do Título
                  {dados.titulo.titulo_importado && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Importado
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Código:</span>
                  <p className="font-mono">{dados.titulo.cod_pgto}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Tipo:</span>
                  <p>{dados.titulo.tipo === 'T' ? 'Transportadora' : 'Fornecedor'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Valor:</span>
                  <p className="font-semibold text-green-600">{formatarValor(dados.titulo.valor_pgto)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Vencimento:</span>
                  <p>{formatarData(dados.titulo.dt_venc)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Status:</span>
                  <p>{dados.titulo.paga === 'S' ? 'Pago' : dados.titulo.cancel === 'S' ? 'Cancelado' : 'Pendente'}</p>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Observações:</span>
                  <p className="text-xs mt-1">{dados.titulo.obs || 'Nenhuma observação'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Resumo */}
            {dados.resumo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className={`size-4 ${dados.resumo.valores_conferem ? 'text-green-600' : 'text-red-600'}`} />
                    Resumo das Notas
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Quantidade:</span>
                    <p>{dados.resumo.quantidade_notas} nota(s)</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Valor Total Notas:</span>
                    <p className="font-semibold">{formatarValor(dados.resumo.valor_total_notas)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Valor do Título:</span>
                    <p className="font-semibold">{formatarValor(dados.resumo.valor_titulo)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Conferência:</span>
                    <p className={`font-semibold ${dados.resumo.valores_conferem ? 'text-green-600' : 'text-red-600'}`}>
                      {dados.resumo.valores_conferem ? '✅ Valores conferem' : `❌ Diferença: ${formatarValor(dados.resumo.diferenca)}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de Notas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="size-4 text-blue-600" />
                Notas de Conhecimento ({dados.notas.length})
              </h3>

              {dados.notas.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma nota associada encontrada
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {dados.notas.map((nota, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">CT-e:</span>
                            <p className="font-mono font-semibold">{nota.nrocon}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Transportadora:</span>
                            <p className="truncate" title={nota.nome_transportadora}>
                              {nota.nome_transportadora}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Valor:</span>
                            <p className="font-semibold text-green-600">{formatarValor(nota.totaltransp)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Status:</span>
                            <div className="mt-1">{getStatusBadge(nota.pago)}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Emissão:</span>
                            <p>{formatarData(nota.dtemissao)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Série CT-e:</span>
                            <p>{nota.serie || '-'}</p>
                          </div>
                          {nota.numero_nota_fiscal && (
                            <div>
                              <span className="font-medium text-gray-600 dark:text-gray-400">Nº Nota Fiscal:</span>
                              <p className="font-mono">{nota.numero_nota_fiscal}</p>
                            </div>
                          )}
                          {nota.serie_nota_fiscal && (
                            <div>
                              <span className="font-medium text-gray-600 dark:text-gray-400">Série Nota Fiscal:</span>
                              <p>{nota.serie_nota_fiscal}</p>
                            </div>
                          )}
                          {nota.chave_nota_fiscal && (
                            <div className="md:col-span-2 lg:col-span-3">
                              <span className="font-medium text-gray-600 dark:text-gray-400">Chave Nota Fiscal:</span>
                              <p className="font-mono text-xs break-all">{nota.chave_nota_fiscal}</p>
                            </div>
                          )}
                          {nota.chave && (
                            <div className="md:col-span-2 lg:col-span-3">
                              <span className="font-medium text-gray-600 dark:text-gray-400">Chave CT-e:</span>
                              <p className="font-mono text-xs break-all">{nota.chave}</p>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">CFOP:</span>
                            <p>{nota.cfop || '-'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            Não foi possível carregar as informações do título
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}