import React from 'react';
import Padrao from '@/components/template/layout/padrao';
import { LiaFileInvoiceSolid } from 'react-icons/lia';
import { Plus } from 'lucide-react';
import HistoricoNF from '@/components/corpo/faturamento/historicoNF';
import NovoFaturamento from '@/components/corpo/faturamento/novoFaturamento';
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
          <Padrao tela={tela} menus={menus} Corpo={HistoricoNF} />
        ) : null}
        {tela === 'novoFaturamento' ? (
          <Padrao tela={tela} menus={menus} Corpo={NovoFaturamento} />
        ) : null}
      </aside>
    </div>
  );
};
export default PageSidebar;
