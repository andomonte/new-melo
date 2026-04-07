import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Produto } from '@/data/produtos/produtos';
import { Loader2 } from 'lucide-react';

interface ProdutoZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
}

export const ProdutoZoomModal: React.FC<ProdutoZoomModalProps> = ({
  isOpen,
  onClose,
  produto,
}) => {
  const [loading, setLoading] = useState(false);

  if (!produto) return null;

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined || value === '') return 'R$ 0,00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num || 0);
  };

  const formatPercent = (value: any) => {
    if (value === null || value === undefined || value === '') return '0%';
    return `${value}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Inspeção Detalhada do Produto</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DialogTitle>
          <DialogDescription>
            Visualize todas as informações cadastrais, fiscais, custos e estoque do produto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cabeçalho com informações principais */}
          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Código</p>
                <p className="font-semibold text-lg">{produto.codprod}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Referência</p>
                <p className="font-semibold text-lg">{produto.ref || '-'}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Descrição</p>
              <p className="font-semibold">{produto.descr || '-'}</p>
            </div>
          </div>

          <Tabs defaultValue="cadastrais" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="cadastrais">Cadastrais</TabsTrigger>
              <TabsTrigger value="fiscais">Fiscais</TabsTrigger>
              <TabsTrigger value="custos">Custos/Preços</TabsTrigger>
              <TabsTrigger value="estoque">Estoque</TabsTrigger>
            </TabsList>

            {/* Tab Dados Cadastrais */}
            <TabsContent value="cadastrais" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Referência Original" value={produto.reforiginal} />
                <InfoField label="Código de Barras" value={produto.codbar} />
                <InfoField label="Marca" value={produto.codmarca} />
                <InfoField label="Grupo Função" value={produto.codgpf} />
                <InfoField label="Grupo Produto" value={produto.codgpp} />
                <InfoField label="Unidade Medida" value={produto.unimed} />
                <InfoField label="Curva ABC" value={produto.curva} />
                <InfoField label="Info" value={produto.inf} />
                <InfoField label="Múltiplo" value={produto.multiplo} />
                <InfoField label="Múltiplo Compra" value={produto.multiplocompra} />
                <InfoField label="Peso Líquido" value={produto.pesoliq} />
                <InfoField label="Qtd Embalagem" value={produto.qtembal} />
                <InfoField label="Tipo" value={produto.tipo} />
                <InfoField
                  label="Tabelado"
                  value={produto.tabelado === 1 || produto.tabelado === '1' ? 'Sim' : 'Não'}
                />
                <InfoField
                  label="Compra Direta"
                  value={produto.compradireta === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField
                  label="Moeda Compra"
                  value={produto.dolar === 'S' ? 'Dólar (US$)' : 'Real (R$)'}
                />
              </div>
              <div>
                <InfoField label="Observações" value={produto.obs} fullWidth />
                <InfoField label="Aplicação Estendida" value={produto.aplic_extendida} fullWidth />
                <InfoField label="Descrição Importação" value={produto.descr_importacao} fullWidth />
              </div>
            </TabsContent>

            {/* Tab Dados Fiscais */}
            <TabsContent value="fiscais" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="NCM/Classificação Fiscal" value={produto.clasfiscal} />
                <InfoField label="CEST" value={produto.cest} />
                <InfoField label="Situação Tributária" value={produto.strib} />
                <InfoField
                  label="Tributado"
                  value={produto.trib === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField label="Nº DI" value={produto.nrodi} />
                <InfoField label="Data DI" value={produto.dtdi} />
                <InfoField label="% Substituição" value={formatPercent(produto.percsubst)} />
                <InfoField label="ICMS (%)" value={formatPercent(produto.icms)} />
                <InfoField label="IPI (%)" value={formatPercent(produto.ipi)} />
                <InfoField
                  label="Isento IPI"
                  value={produto.isentoipi === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField label="PIS (%)" value={formatPercent(produto.pis)} />
                <InfoField label="COFINS (%)" value={formatPercent(produto.cofins)} />
                <InfoField
                  label="Isento PIS/COFINS"
                  value={produto.isentopiscofins === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField
                  label="Desconto PIS/COFINS"
                  value={produto.descontopiscofins === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField label="II (%)" value={formatPercent(produto.ii)} />
              </div>
            </TabsContent>

            {/* Tab Custos e Preços */}
            <TabsContent value="custos" className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Preços de Compra</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Preço Compra" value={formatCurrency(produto.prcompra)} />
                  <InfoField label="Preço Fábrica" value={formatCurrency(produto.prfabr)} />
                  <InfoField label="Preço s/ ST" value={formatCurrency(produto.prcomprasemst)} />
                  <InfoField label="Preço Atual Desp" value={formatCurrency(produto.pratualdesp)} />
                  <InfoField label="Preço Custo Atual" value={formatCurrency(produto.prcustoatual)} />
                  <InfoField label="Preço Médio" value={formatCurrency(produto.prmedio)} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Preços de Venda</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Preço Venda" value={formatCurrency(produto.prvenda)} />
                  <InfoField label="Preço Importação" value={formatCurrency(produto.primp)} />
                  <InfoField label="Preço NF" value={formatCurrency(produto.preconf)} />
                  <InfoField label="Preço s/ NF" value={formatCurrency(produto.precosnf)} />
                  <InfoField label="Concorrência" value={formatCurrency(produto.concor)} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Importação</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Importação Fatura" value={formatCurrency(produto.impfat)} />
                  <InfoField label="Importação Fábrica" value={formatCurrency(produto.impfab)} />
                  <InfoField label="Taxa Dólar Compra" value={formatCurrency(produto.txdolarcompra)} />
                  <InfoField label="Taxa Dólar Venda" value={formatCurrency(produto.txdolarvenda)} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Margens</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Margem Nacional" value={formatPercent(produto.margem)} />
                  <InfoField label="Margem Promo" value={formatPercent(produto.margempromo)} />
                  <InfoField label="Margem Fora Estado" value={formatPercent(produto.margemfe)} />
                  <InfoField label="Margem Promo FE" value={formatPercent(produto.margempromofe)} />
                  <InfoField label="Margem Zona Franca" value={formatPercent(produto.margemzf)} />
                  <InfoField label="Margem Promo ZF" value={formatPercent(produto.margempromozf)} />
                </div>
              </div>
            </TabsContent>

            {/* Tab Estoque */}
            <TabsContent value="estoque" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Estoque Atual" value={produto.qtest} />
                <InfoField label="Estoque Reservado" value={produto.qtdreservada} />
                <InfoField label="Estoque Filial" value={produto.qtest_filial} />
                <InfoField label="Estoque Mínimo" value={produto.qtestmin} />
                <InfoField label="Estoque Máximo" value={produto.qtestmax} />
                <InfoField label="Estoque Máx Sugerido" value={produto.qtestmax_sugerido} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Componente auxiliar para exibir campos
const InfoField: React.FC<{
  label: string;
  value: any;
  fullWidth?: boolean;
}> = ({ label, value, fullWidth = false }) => {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">
        {value !== null && value !== undefined && value !== '' ? value : '-'}
      </p>
    </div>
  );
};
