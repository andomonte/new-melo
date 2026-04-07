// src/components/menus/comprador.tsx
import React from 'react';
import Padrao from '@/components/template/layout/padrao';
import Carregamento from '@/utils/carregamento';
import RequisicoesCompra from '@/components/corpo/comprador/RequisicoesCompra/';
import HistoricoCompra from '@/components/corpo/comprador/historicoCompra';
import {
  Plus,
  HomeIcon,
  Info,
  Settings,
  LayoutDashboardIcon,
} from 'lucide-react';
import { LiaFileInvoiceSolid } from 'react-icons/lia';

export type SubMenuItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

export type MenuItem = {
  name: string;
  href?: string;
  icon?: React.ElementType;
  corpo?: React.ComponentType<any>;
  subItems?: SubMenuItem[];
};

export type MenuSection = {
  titulo: string;
  items: MenuItem[];
};

export const menus: MenuSection[] = [
  {
    titulo: 'DashBoard',
    items: [
      {
        name: 'DashBoard',
        href: '/compras/dashBoard',
        icon: LayoutDashboardIcon,
        subItems: [],
      },
    ],
  },
  {
    titulo: 'Compras',
    items: [
      {
        name: 'Nova Requisição',
        href: '/compras/novaCompra',
        icon: Plus,
        subItems: [],
      },
      {
        name: 'Requisições de Compra',
        href: '/compras/requisicoes-compra',
        icon: LayoutDashboardIcon,
        corpo: RequisicoesCompra,
        subItems: [],
      },
      {
        name: 'Histórico de Compra',
        href: '/compras/historicoCompra',
        corpo: HistoricoCompra,
        icon: LiaFileInvoiceSolid,
        subItems: [],
      },
    ],
  },
  {
    titulo: 'Configurações',
    items: [
      {
        name: 'Opções',
        href: '',
        icon: Settings,
        subItems: [
          {
            name: 'Perfil',
            href: '/compras/configuracoes/profile',
            icon: Info,
          },
          {
            name: 'Segurança',
            href: '/compras/configuracoes/security',
            icon: HomeIcon,
          },
        ],
      },
    ],
  },
];

// Função para encontrar o componente baseado na tela
function encontrarCorpoPorTela(tela: string, menusArray: any[]) {
  for (const menu of menusArray) {
    if (menu.items) {
      for (const item of menu.items) {
        if (item.href === tela) {
          return item.corpo;
        }
        if (item.subItems) {
          for (const subItem of item.subItems) {
            if (subItem.href === tela) {
              return subItem.corpo;
            }
          }
        }
      }
    }
  }
  return Carregamento;
}

interface PageSidebarProps {
  tela: string;
}

const PageSidebar: React.FC<PageSidebarProps> = ({ tela }) => {
  const [telaMudou, setTelaMudou] = React.useState(tela);

  const handleTelaMudou = (newTela: string) => {
    setTelaMudou(newTela);
  };

  const corpoAtual = encontrarCorpoPorTela(tela, menus);

  return (
    <div className="flex w-full flex-col bg-muted/40">
      <Padrao
        setTelaMudou={handleTelaMudou}
        menus={menus}
        tela={tela}
        Corpo={telaMudou === tela ? corpoAtual : Carregamento}
      />
    </div>
  );
};

export default PageSidebar;
