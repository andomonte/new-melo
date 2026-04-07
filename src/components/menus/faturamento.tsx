import React from 'react';
import Padrao from '@/components/template/layout/padrao';
import { LiaFileInvoiceSolid } from 'react-icons/lia';
import { Barcode, Calculator, Plus } from 'lucide-react';
import HistoricoNF from '@/components/corpo/faturamento/historicoNF';
import NovoFaturamento from '@/components/corpo/faturamento/novoFaturamento';
import TelaCalculoProdutos from '../corpo/faturamento/calculofaturamento/index';
import TelaDadosFatura from '../corpo/faturamento/dadosfatura';
import TelaCobrancaFatura from '../corpo/faturamento/CobrancaFatura';
import ConsultaFaturasPage from '../corpo/faturamento/ConsultaFatura/ConsultaFatura';
const menus = [
  {
    titulo: 'Faturamento',
    items: [
      {
        name: 'Novo Faturamento',
        href: '/faturamento/novoFaturamento',
        icon: Plus,
        subItems: [],
      },
      {
        name: 'Histórico de NF',
        href: '/faturamento/historicoNF',
        icon: LiaFileInvoiceSolid,
        subItems: [],
      },
      {
        name: 'Cálculo de Produtos',
        href: '/faturamento/calculofaturamento',
        icon: Calculator,
        subItems: [],
      },
      {
        name: 'Dados da Fatura',
        href: '/faturamento/dadosfatura',
        icon: Calculator,
        subItems: [],
      },
      {
        name:'Cobrança Fatura',
        href: '/faturamento/CobrancaFatura',
        icon: Barcode,
        subItems: [],
      },{
        name:'Consulta Fatura',
        href: '/faturamento/ConsultaFatura',
        icon: Barcode,
        subItems: [],
      }
      
    ],
  },
];
interface PageSidebarProps {
  tela: string; // ou o tipo que você espera para 'tela'
}
const PageSidebar: React.FC<PageSidebarProps> = ({ tela }) => {
  return (
    <div className="flex w-full    flex-col bg-muted/40">
      {/* inicio da tela desktop */}
      <aside
        className="fixed insert-y-0  bg-gray-400  left-0 z-10  h-full w-full 
                   flex "
      >
        {tela === 'historicoNF' ? (
          <Padrao menus={menus} tela={tela} Corpo={HistoricoNF} />
        ) : null}
        {tela === 'novoFaturamento' ? (
          <Padrao menus={menus} tela={tela} Corpo={NovoFaturamento} />
        ) : null}
        {tela === 'calculofaturamento' ? (
          <Padrao menus={menus} tela={tela} Corpo={TelaCalculoProdutos} />
        ) : null}
        {tela === 'dadosfatura' ? (
          <Padrao menus={menus} tela={tela} Corpo={TelaDadosFatura} />
        ) : null}
        {tela === 'CobrancaFatura' ? (
          <Padrao menus={menus} tela={tela} Corpo={TelaCobrancaFatura} />
        ) : null}
        {tela === 'consultaFatura' ? (
          <Padrao menus={menus} tela={tela} Corpo={ConsultaFaturasPage} />
        ) : null}
      </aside>
    </div>
  );
};
export default PageSidebar;
