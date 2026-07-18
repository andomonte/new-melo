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
  // Detalhe completo do produto (SELECT * dbprod) — traz datas de movimento
  // (dtcompra/dtvenda/dtinventario/dtprcustoatual) que a linha da lista pode
  // não ter. Estava faltando no web em relação ao zoom do Delphi.
  const [detalhes, setDetalhes] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !produto?.codprod) return;
    let ativo = true;
    setLoading(true);
    setDetalhes(null);
    fetch(`/api/produtos/get/${p.codprod}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => {
        if (ativo && row && !row.error) setDetalhes(row);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [isOpen, produto?.codprod]);

  if (!produto) return null;

  // Dados exibidos: detalhe do banco quando disponível, senão a linha recebida.
  const p: any = detalhes ?? produto;

  const formatDate = (value: any) => {
    if (!value) return '-';
    // Pega só YYYY-MM-DD para não deslocar o dia por fuso horário.
    const s = String(value).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d && m && y ? `${d}/${m}/${y}` : '-';
  };

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
                <p className="font-semibold text-lg">{p.codprod}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Referência</p>
                <p className="font-semibold text-lg">{p.ref || '-'}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Descrição</p>
              <p className="font-semibold">{p.descr || '-'}</p>
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
                <InfoField label="Referência Original" value={p.reforiginal} />
                <InfoField label="Código de Barras" value={p.codbar} />
                <InfoField label="Marca" value={p.codmarca} />
                <InfoField label="Grupo Função" value={p.codgpf} />
                <InfoField label="Grupo Produto" value={p.codgpp} />
                <InfoField label="Unidade Medida" value={p.unimed} />
                <InfoField label="Curva ABC" value={p.curva} />
                <InfoField label="Info" value={p.inf} />
                <InfoField label="Múltiplo" value={p.multiplo} />
                <InfoField label="Múltiplo Compra" value={p.multiplocompra} />
                <InfoField label="Peso Líquido" value={p.pesoliq} />
                <InfoField label="Qtd Embalagem" value={p.qtembal} />
                <InfoField label="Tipo" value={p.tipo} />
                <InfoField
                  label="Tabelado"
                  value={p.tabelado === 1 || p.tabelado === '1' ? 'Sim' : 'Não'}
                />
                <InfoField
                  label="Compra Direta"
                  value={p.compradireta === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField
                  label="Moeda Compra"
                  value={p.dolar === 'S' ? 'Dólar (US$)' : 'Real (R$)'}
                />
              </div>
              <div>
                <InfoField label="Observações" value={p.obs} fullWidth />
                <InfoField label="Aplicação Estendida" value={p.aplic_extendida} fullWidth />
                <InfoField label="Descrição Importação" value={p.descr_importacao} fullWidth />
              </div>
            </TabsContent>

            {/* Tab Dados Fiscais */}
            <TabsContent value="fiscais" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="NCM/Classificação Fiscal" value={p.clasfiscal} />
                <InfoField label="CEST" value={p.cest} />
                <InfoField label="Situação Tributária" value={p.strib} />
                <InfoField
                  label="Tributado"
                  value={p.trib === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField label="Nº DI" value={p.nrodi} />
                <InfoField label="Data DI" value={p.dtdi} />
                <InfoField label="% Substituição" value={formatPercent(p.percsubst)} />
                <InfoField label="ICMS (%)" value={formatPercent(p.icms)} />
                <InfoField label="IPI (%)" value={formatPercent(p.ipi)} />
                <InfoField
                  label="Isento IPI"
                  value={p.isentoipi === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField label="PIS (%)" value={formatPercent(p.pis)} />
                <InfoField label="COFINS (%)" value={formatPercent(p.cofins)} />
                <InfoField
                  label="Isento PIS/COFINS"
                  value={p.isentopiscofins === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField
                  label="Desconto PIS/COFINS"
                  value={p.descontopiscofins === 'S' ? 'Sim' : 'Não'}
                />
                <InfoField label="II (%)" value={formatPercent(p.ii)} />
              </div>
            </TabsContent>

            {/* Tab Custos e Preços */}
            <TabsContent value="custos" className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Preços de Compra</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Preço Compra" value={formatCurrency(p.prcompra)} />
                  <InfoField label="Preço Fábrica" value={formatCurrency(p.prfabr)} />
                  <InfoField label="Preço s/ ST" value={formatCurrency(p.prcomprasemst)} />
                  <InfoField label="Preço Atual Desp" value={formatCurrency(p.pratualdesp)} />
                  <InfoField label="Preço Custo Atual" value={formatCurrency(p.prcustoatual)} />
                  <InfoField label="Preço Médio" value={formatCurrency(p.prmedio)} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Preços de Venda</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Preço Venda" value={formatCurrency(p.prvenda)} />
                  <InfoField label="Preço Importação" value={formatCurrency(p.primp)} />
                  <InfoField label="Preço NF" value={formatCurrency(p.preconf)} />
                  <InfoField label="Preço s/ NF" value={formatCurrency(p.precosnf)} />
                  <InfoField label="Concorrência" value={formatCurrency(p.concor)} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Importação</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Importação Fatura" value={formatCurrency(p.impfat)} />
                  <InfoField label="Importação Fábrica" value={formatCurrency(p.impfab)} />
                  <InfoField label="Taxa Dólar Compra" value={formatCurrency(p.txdolarcompra)} />
                  <InfoField label="Taxa Dólar Venda" value={formatCurrency(p.txdolarvenda)} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Margens</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Margem Nacional" value={formatPercent(p.margem)} />
                  <InfoField label="Margem Promo" value={formatPercent(p.margempromo)} />
                  <InfoField label="Margem Fora Estado" value={formatPercent(p.margemfe)} />
                  <InfoField label="Margem Promo FE" value={formatPercent(p.margempromofe)} />
                  <InfoField label="Margem Zona Franca" value={formatPercent(p.margemzf)} />
                  <InfoField label="Margem Promo ZF" value={formatPercent(p.margempromozf)} />
                </div>
              </div>
            </TabsContent>

            {/* Tab Estoque */}
            <TabsContent value="estoque" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Estoque Atual" value={p.qtest} />
                <InfoField label="Estoque Reservado" value={p.qtdreservada} />
                <InfoField label="Estoque Filial" value={p.qtest_filial} />
                <InfoField label="Estoque Mínimo" value={p.qtestmin} />
                <InfoField label="Estoque Máximo" value={p.qtestmax} />
                <InfoField label="Estoque Máx Sugerido" value={p.qtestmax_sugerido} />
              </div>

              <Separator />

              {/* Datas de movimento e disponibilidade — mesmos campos em
                  vermelho no zoom do Delphi, que faltavam no web. */}
              <div>
                <h4 className="font-semibold mb-2">Movimentação e Disponibilidade</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Dt. Última Entrada" value={formatDate(p.dtcompra)} />
                  <InfoField label="Dt. Última Venda" value={formatDate(p.dtvenda)} />
                  <InfoField label="Última Alteração (custo)" value={formatDate(p.dtprcustoatual)} />
                  <InfoField label="Data Último Inventário" value={formatDate(p.dtinventario)} />
                  <InfoField label="Qtd. Ent. Aberta" value={p.qtdreservada ?? 0} />
                  <InfoField label="Qtd. Transferência" value={p.qtest_filial ?? 0} />
                  <InfoField label="Est. Disponível" value={p.qtest ?? 0} />
                </div>
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
