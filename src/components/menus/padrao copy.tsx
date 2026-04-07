import React from 'react';
import Padrao from '@/components/template/layout/padrao';
import Carregamento from '@/utils/carregamento';
import {
  ShoppingBag,
  LayoutDashboardIcon,
  DiamondPlusIcon,
  BadgeDollarSignIcon,
  BoxesIcon,
  Building2Icon,
  ChartLineIcon,
  CircleDollarSignIcon,
  CogIcon,
  GroupIcon,
  HandCoinsIcon,
  HandshakeIcon,
  HexagonIcon,
  LandmarkIcon,
  ListCheckIcon,
  LockIcon,
  ShieldIcon,
  ShoppingBasketIcon,
  SquareUserRoundIcon,
  Monitor,
  UserCheckIcon,
  WalletIcon,
  WarehouseIcon,
  Plus,
  Warehouse,
  Briefcase,
  LayoutDashboard,
  LockOpenIcon,
  MapPin,
  BookText,
} from 'lucide-react';
import {
  LiaFileInvoiceSolid,
  LiaFileInvoiceDollarSolid,
} from 'react-icons/lia';
//import { GiShoppingCart } from 'react-icons/gi'; //´para compras
import { TbCashRegister } from 'react-icons/tb';
import DashBoard from '@/components/corpo/admin/dashBoard';
import Clientes from '@/components/corpo/admin/cadastro/clientes';
import Fornecedores from '@/components/corpo/admin/cadastro/fornecedores';
import Produtos from '@/components/corpo/admin/cadastro/produtos';
import Vendedores from '@/components/corpo/admin/cadastro/vendedores';
import Marcas from '@/components/corpo/admin/cadastro/marcas';
import GrupoDeProdutos from '@/components/corpo/admin/cadastro/grupoDeProdutos';
import Armazens from '@/components/corpo/admin/cadastro/armazens';
import BancosContas from '@/components/corpo/admin/cadastro/bancosContas';
import DadosEmpresa from '@/components/corpo/admin/cadastro/dadosEmpresa';
import ContasAPagar from '@/components/corpo/admin/financeiro/contasAPagar';
import ContasAReceber from '@/components/corpo/admin/financeiro/contasAReceber';
import Faturar from '@/components/corpo/admin/financeiro/faturar';
import Transferencia from '@/components/corpo/admin/financeiro/transferencia';

import Vendas from '@/components/corpo/admin/vendas';
import NovasVendas from '@/components/corpo/vendas/novaVenda';
import CentralVendas from '@/components/corpo/vendas/centralVendas';
import Promocoes from '@/components/corpo/vendas/promocoes';
import Estoque from '@/components/corpo/admin/estoque';
import Relatorios from '@/components/corpo/admin/relatorios';
import Parametros from '@/components/corpo/admin/configuracoes/parametros';
import Funcoes from '@/components/corpo/admin/controleAcesso/funcoes';
import Filiais from '@/components/corpo/admin/controleAcesso/filiais';
import Grupos from '@/components/corpo/admin/controleAcesso/perfis';
import Telas from '@/components/corpo/admin/controleAcesso/telas';
import Usuarios from '@/components/corpo/admin/controleAcesso/usuarios';
import HistoricoNF from '@/components/corpo/faturamento/historicoNF';
import NovoFaturamento from '@/components/corpo/faturamento/novoFaturamento';
import VendasDashboard from '../corpo/vendas/dashboard';
import VendasBloqueadasPage from '../corpo/vendas/bloqueadas';
import LocaisPecasPage from '../corpo/vendas/locaisPecas';
import TransportadorasPage from '../corpo/admin/cadastro/transportadoras';
import FormacaoPrecoVendaPage from '../corpo/admin/cadastro/formacao-preco';
import LegislacaoIcmsstPage from '../corpo/admin/legislacao/legislacao-icmsst';
import LegislacaoSignatarioPage from '../corpo/admin/legislacao/legislacao-signatario';
import LegislacaoNcmPage from '../corpo/admin/legislacao/legislacao-icmsst_ncm';
import CfopPage from '../corpo/admin/cadastro/cfop';
import LocaisPage from '../corpo/admin/cadastro/locais';
import RemessaEquifax from '../corpo/remessa/remessa';



const menus = [
  {
    titulo: '',
    items: [
      {
        name: 'DashBoard',
        href: '/admin/dashBoard',
        icon: LayoutDashboardIcon,
        subItems: [],
        corpo: DashBoard,
      },
      {
        name: 'Legislação',
        href: '',
        icon: BookText,
        corpo: '',
        subItems: [
          {
            name: 'IMC',
            href: '/admin/cadastros/legislacaoIcmsst',
            icon: ListCheckIcon,
            corpo: LegislacaoIcmsstPage,
          },
          {
            name: 'IMC - NCM',
            href: '/admin/cadastros/legislacaoNcm',
            icon: ListCheckIcon,
            corpo: LegislacaoNcmPage,
          },
          {
            name: 'Signatário',
            href: '/admin/cadastros/legislacaoSignatario',
            icon: ListCheckIcon,
            corpo: LegislacaoSignatarioPage,
          },
        ],
      },
      {
        name: 'Cadastro',
        href: '',
        icon: DiamondPlusIcon,
        corpo: '',
        subItems: [
          {
            name: 'Empresa',
            href: '/admin/cadastros/dadosEmpresa',
            icon: Briefcase,
            corpo: DadosEmpresa,
          },
          {
            name: 'Clientes',
            href: '/admin/cadastros/clientes',
            icon: HandshakeIcon,
            corpo: Clientes,
          },
          {
            name: 'Fornecedores',
            href: '/admin/cadastros/fornecedores',
            icon: Building2Icon,
            corpo: Fornecedores,
          },
          {
            name: 'Vendedores',
            href: '/admin/cadastros/vendedores',
            icon: SquareUserRoundIcon,
            corpo: Vendedores,
          },
          {
            name: 'Transportadoras',
            href: '/admin/cadastros/transportadora',
            icon: Building2Icon,
            corpo: TransportadorasPage,
          },
          {
            name: 'CFOP',
            href: '/admin/cadastros/cfop',
            icon: ListCheckIcon,
            corpo: CfopPage,
          },
          {
            name: 'Preços',
            href: '/admin/cadastros/preco',
            icon: ListCheckIcon,
            corpo: FormacaoPrecoVendaPage,
          },

          {
            name: 'Locais',
            href: '/admin/cadastros/locais',
            icon: MapPin,
            corpo: LocaisPage,
          },
          {
            name: 'Produtos',
            href: '/admin/cadastros/produtos',
            icon: BoxesIcon,
            corpo: Produtos,
          },
          {
            name: 'Marcas',
            href: '/admin/cadastros/marcas',
            icon: HexagonIcon,
            corpo: Marcas,
          },
          {
            name: 'Grupo prod.',
            href: '/admin/cadastros/grupoDeProdutos',
            icon: GroupIcon,
            corpo: GrupoDeProdutos,
          },
          {
            name: 'Armazens',
            href: '/admin/cadastros/armazens',
            icon: Warehouse,
            corpo: Armazens,
          },
          {
            name: 'Bancos e Contas',
            href: '/admin/cadastros/bancosContas',
            icon: LandmarkIcon,
            corpo: BancosContas,
          },
        ],
      },
      {
        name: 'Financeiro',
        href: '',
        icon: BadgeDollarSignIcon,
        corpo: '',
        subItems: [
          {
            name: 'Contas a Pagar',
            href: '/admin/financeiro/contasAPagar',
            icon: LandmarkIcon,
            corpo: ContasAPagar,
          },
          {
            name: 'Contas a Receber',
            href: '/admin/financeiro/contasAReceber',
            icon: HandCoinsIcon,
            corpo: ContasAReceber,
          },
          {
            name: 'Faturar',
            href: '/admin/financeiro/faturar',
            icon: CircleDollarSignIcon,
            corpo: Faturar,
          },
          {
            name: 'Transferência',
            href: '/admin/financeiro/transferencia',
            icon: WalletIcon,
            corpo: Transferencia,
          },
          {
            name: 'Remessa Equifax',
            href: '/admin/financeiro/remessa',
            icon: BadgeDollarSignIcon,
            corpo: RemessaEquifax,
          },
        ],
      },
      {
        name: 'Vendas',
        icon: TbCashRegister,
        href: '',
        corpo: '',
        subItems: [
          {
            name: 'Dashboard',
            href: '/vendas/dashboard',
            icon: LayoutDashboard,
            corpo: VendasDashboard,
          },
          {
            name: 'Nova',
            href: '/vendas/novaVenda',
            icon: Plus,
            corpo: NovasVendas,
          },
          {
            name: 'Central',
            href: '/vendas/centralVendas',
            icon: ShoppingBag,
            corpo: CentralVendas,
          },
          {
            name: 'Promoções',
            href: '/vendas/promocoes',
            icon: ShoppingBag,
            corpo: Promocoes,
          },
          {
            name: 'Desbloqueio',
            href: '/vendas/bloqueadas',
            icon: LockOpenIcon,
            corpo: VendasBloqueadasPage,
          },
          {
            name: 'Locais',
            href: '/vendas/locaisPecas',
            icon: WarehouseIcon,
            corpo: LocaisPecasPage,
          },
        ],
      },

      {
        name: 'Estoque',
        icon: WarehouseIcon,
        href: '/admin/estoque',
        corpo: Estoque,
      },
      {
        name: 'Relatórios',
        icon: ChartLineIcon,
        href: '/admin/relatorios',
        corpo: Relatorios,
      },
      {
        name: 'Configurações',
        icon: CogIcon,
        href: '',
        corpo: '',
        subItems: [
          {
            name: 'Parâmetros',
            icon: ListCheckIcon,
            href: '/admin/configuracoes/parametros',
            corpo: Parametros,
          },
          {
            name: 'Vendas',
            icon: ShoppingBasketIcon,
            href: '/admin/configuracoes/vendas',
            corpo: Vendas,
          },
        ],
      },
      {
        name: 'Acessos',
        icon: LockIcon,
        href: '',
        corpo: '',
        subItems: [
          {
            name: 'Filiais',
            icon: Building2Icon,
            href: '/admin/controleAcesso/filiais',
            corpo: Filiais,
          },
          {
            name: 'Perfis',
            icon: BoxesIcon,
            href: '/admin/controleAcesso/perfis',
            corpo: Grupos,
          },
          {
            name: 'Telas',
            icon: Monitor,
            href: '/admin/controleAcesso/telas',
            corpo: Telas,
          },
          {
            name: 'Funções',
            icon: ShieldIcon,
            href: '/admin/controleAcesso/funcoes',
            corpo: Funcoes,
          },

          {
            name: 'Usuários',
            icon: UserCheckIcon,
            href: '/admin/controleAcesso/usuarios',
            corpo: Usuarios,
          },
        ],
      },
      {
        name: 'Faturamento',
        icon: LiaFileInvoiceDollarSolid,
        href: '',
        corpo: '',
        subItems: [
          {
            name: 'Novo',
            href: '/faturamento/novoFaturamento',
            icon: Plus,
            corpo: NovoFaturamento,
          },
          {
            name: 'Histórico de NF',
            href: '/faturamento/historicoNF',
            icon: LiaFileInvoiceSolid,
            corpo: HistoricoNF,
          },
        ],
      },
    ],
  },
];

interface PageSidebarProps {
  tela: string; // ou o tipo que você espera para 'tela'
  permissoes: string[] | undefined; // um array de strings para as permissões do usuário
}

function encontrarCorpoPorTela(
  tela: string,
  menus: any[],
): React.ComponentType | typeof Carregamento {
  for (const menu of menus) {
    for (const item of menu.items) {
      if (item.href && item.href === tela) {
        return item.corpo;
      }
      if (item.subItems?.length > 0) {
        for (const subItem of item.subItems) {
          if (subItem.href && subItem.href === tela) {
            return subItem.corpo;
          }
        }
      }
    }
  }
  return Carregamento;
}

const PageSidebar: React.FC<PageSidebarProps> = ({ tela, permissoes }) => {
  const [telaMudou, setTelaMudou] = React.useState(tela);

  const handleTelaMudou = (newTela: string) => {
    setTelaMudou(newTela);
  };
  const [valorF, setValorF] = React.useState<any[]>([]);
  const corpoAtual = encontrarCorpoPorTela(tela, valorF);

  React.useEffect(() => {
    const novoValorF = menus.map((menu) => ({
      ...menu,
      items: menu.items
        .map((item: any) => {
          const novoItem: any = { ...item };

          // Verifica se o item principal está nas permissões
          if ((permissoes ?? []).includes(novoItem.href)) {
            // Filtra subItems, se existirem
            if (novoItem.subItems && novoItem.subItems.length > 0) {
              novoItem.subItems = (novoItem.subItems as any[]).filter((subItem: any) =>
                (permissoes ?? []).includes(subItem.href),
              );
            }
            return novoItem;
          }

          // Verifica os subItems se o item principal não está nas permissões
          if (novoItem.subItems && novoItem.subItems.length > 0) {
            const novosSubItems = (novoItem.subItems as any[]).filter((subItem: any) =>
              (permissoes ?? []).includes(subItem.href),
            );

            if (novosSubItems.length > 0) {
              return { ...novoItem, subItems: novosSubItems };
            }
          }

          return null; // Remove itens não permitidos
        })
        .filter(Boolean), // Remove itens nulos
    }));

    setValorF(novoValorF);
  }, [permissoes, tela]);

  // ... restante do seu código ...

  return (
    <div className="flex w-full    flex-col bg-muted/40">
      {/* inicio da tela desktop */}
      <Padrao
        setTelaMudou={handleTelaMudou}
        menus={valorF} // Agora passamos `valorF` em vez de `menus`
        tela={tela}
        Corpo={telaMudou === tela ? corpoAtual : Carregamento}
      />
    </div>
  );
};
export default PageSidebar;
