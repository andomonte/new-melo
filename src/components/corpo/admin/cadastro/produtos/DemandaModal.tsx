import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Loader2, FileDown } from 'lucide-react';
import { Produto } from '@/data/produtos/produtos';

interface DemandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
}

interface DemandaItem {
  periodo: string;
  demanda: number;
  pendencia: number;
  mao_gar: number;
  pph_transf: number;
  rec_transf: number;
  fl2_transf: number;
  dp5_transf: number;
  total: number;
}

export const DemandaModal: React.FC<DemandaModalProps> = ({
  isOpen,
  onClose,
  produto,
}) => {
  const [loading, setLoading] = useState(false);
  const [demandaData, setDemandaData] = useState<DemandaItem[]>([]);
  const [filiais, setFiliais] = useState({
    portoVelho: false,
    fortaleza: false,
    recife: false,
    joaoPessoa: false,
  });
  const { toast } = useToast();

  // Estatísticas
  const [stats, setStats] = useState({
    demanda12Meses: 0,
    mao12Meses: 0,
    ultimos3Meses: 0,
  });

  useEffect(() => {
    if (isOpen && produto) {
      fetchDemanda();
    }
  }, [isOpen, produto, filiais]);

  const fetchDemanda = async () => {
    if (!produto) return;

    setLoading(true);
    try {
      const response = await fetch('/api/produtos/demanda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codprod: produto.codprod,
          filiais: {
            portoVelho: filiais.portoVelho,
            fortaleza: filiais.fortaleza,
            recife: filiais.recife,
            joaoPessoa: filiais.joaoPessoa,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar demanda');
      }

      const data = await response.json();
      setDemandaData(data.demanda || []);
      setStats(data.stats || { demanda12Meses: 0, mao12Meses: 0, ultimos3Meses: 0 });
    } catch (error: any) {
      console.error('Erro ao buscar demanda:', error);
      toast({
        title: 'Erro ao carregar demanda',
        description: error.message,
        variant: 'destructive',
      });
      setDemandaData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    toast({
      title: 'Exportar para Excel',
      description: 'Funcionalidade em desenvolvimento.',
    });
  };

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Demanda do Produto
          </DialogTitle>
          <DialogDescription>
            {produto.codprod} - {produto.descr}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manaus" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manaus">MANAUS</TabsTrigger>
            <TabsTrigger value="totais">TOTAIS</TabsTrigger>
          </TabsList>

          <TabsContent value="manaus" className="space-y-4">
            {/* Filtros de Filiais */}
            <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="portoVelho"
                  checked={filiais.portoVelho}
                  onCheckedChange={(checked) =>
                    setFiliais({ ...filiais, portoVelho: checked as boolean })
                  }
                />
                <Label htmlFor="portoVelho">PORTO VELHO</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fortaleza"
                  checked={filiais.fortaleza}
                  onCheckedChange={(checked) =>
                    setFiliais({ ...filiais, fortaleza: checked as boolean })
                  }
                />
                <Label htmlFor="fortaleza">FORTALEZA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recife"
                  checked={filiais.recife}
                  onCheckedChange={(checked) =>
                    setFiliais({ ...filiais, recife: checked as boolean })
                  }
                />
                <Label htmlFor="recife">RECIFE</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="joaoPessoa"
                  checked={filiais.joaoPessoa}
                  onCheckedChange={(checked) =>
                    setFiliais({ ...filiais, joaoPessoa: checked as boolean })
                  }
                />
                <Label htmlFor="joaoPessoa">JOÃO PESSOA</Label>
              </div>
            </div>

            {/* Tabela de Demanda */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="p-2 text-left">PERIODO</th>
                      <th className="p-2 text-right">DEMANDA</th>
                      <th className="p-2 text-right">PENDENCIA</th>
                      <th className="p-2 text-right">MAO GAR</th>
                      <th className="p-2 text-right">PPH TRANSF</th>
                      <th className="p-2 text-right">REC TRANSF</th>
                      <th className="p-2 text-right">FL2 TRANSF</th>
                      <th className="p-2 text-right">DP5 TRANSF</th>
                      <th className="p-2 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandaData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-muted-foreground">
                          Nenhum dado de demanda encontrado
                        </td>
                      </tr>
                    ) : (
                      demandaData.map((item, index) => (
                        <tr
                          key={index}
                          className="border-b hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <td className="p-2">{item.periodo}</td>
                          <td className="p-2 text-right">{item.demanda}</td>
                          <td className="p-2 text-right">{item.pendencia}</td>
                          <td className="p-2 text-right">{item.mao_gar}</td>
                          <td className="p-2 text-right">{item.pph_transf}</td>
                          <td className="p-2 text-right">{item.rec_transf}</td>
                          <td className="p-2 text-right">{item.fl2_transf}</td>
                          <td className="p-2 text-right">{item.dp5_transf}</td>
                          <td className="p-2 text-right font-semibold">{item.total}</td>
                        </tr>
                      ))
                    )}
                    {demandaData.length > 0 && (
                      <tr className="bg-yellow-100 dark:bg-yellow-900 font-semibold">
                        <td className="p-2">TOTAL</td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.demanda, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.pendencia, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.mao_gar, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.pph_transf, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.rec_transf, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.fl2_transf, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.dp5_transf, 0)}
                        </td>
                        <td className="p-2 text-right">
                          {demandaData.reduce((sum, item) => sum + item.total, 0)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Estatísticas */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">DEMANDA</p>
                <p className="text-xs text-muted-foreground">12 MESES:</p>
                <p className="text-lg font-semibold">{stats.demanda12Meses.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MAO</p>
                <p className="text-xs text-muted-foreground">12 MESES:</p>
                <p className="text-lg font-semibold">{stats.mao12Meses.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">3 ÚLT. MESES:</p>
                <p className="text-lg font-semibold">{stats.ultimos3Meses.toFixed(2)}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="totais">
            <div className="p-8 text-center text-muted-foreground">
              Visualização de totais em desenvolvimento
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleExportExcel}>
            <FileDown className="mr-2 h-4 w-4" />
            EXCEL
          </Button>
          <Button onClick={onClose}>FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
