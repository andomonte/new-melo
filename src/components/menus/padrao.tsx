import React, { lazy, Suspense } from 'react';
import Padrao from '@/components/template/layout/padrao';
import Carregamento from '@/utils/carregamento';
import {
  ShoppingBag,
  LayoutDashboardIcon,
  CheckCircle,
  FileCheck,
  Tv,
  Printer,
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
  Package,
  FileText,
  Search,
  PackageCheck,
  MapPin,
  BookText,
  Upload,
  ListCheck,
  CreditCardIcon,
  UploadIcon,
  FileTextIcon,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import {
  LiaFileInvoiceSolid,
  LiaFileInvoiceDollarSolid,
} from 'react-icons/lia';
import { TbCashRegister } from 'react-icons/tb';

// Admin / Cadastros / etc.
import DashBoard from '@/components/corpo/admin/dashBoard';
import Clientes from '@/components/corpo/admin/cadastro/clientes';
import Fornecedores from '@/components/corpo/admin/cadastro/fornecedores';
import Produtos from '@/components/corpo/admin/cadastro/produtos';
import Vendedores from '@/components/corpo/admin/cadastro/vendedores';
import Marcas from '@/components/corpo/admin/cadastro/marcas';
import GrupoDeProdutos from '@/components/corpo/admin/cadastro/grupoDeProdutos';
import Armazens from '@/components/corpo/admin/cadastro/armazens';
import BancosContas from '@/components/corpo/admin/cadastro/bancosContas';
import KickbackBosch from '@/components/corpo/gerenciamento/produtos/kickback';
import DadosEmpresa from '@/components/corpo/admin/cadastro/dadosEmpresa';
import TransportadorasPage from '../corpo/admin/cadastro/transportadoras';
import CfopPage from '../corpo/admin/cadastro/cfop';
import FormacaoPrecoVendaPage from '../corpo/admin/cadastro/formacao-preco';
import LocaisPage from '../corpo/admin/cadastro/locais';
//import CalculadoraTributariaManual from '@/components/corpo/admin/calculadora/CalculadoraTributariaManual';

// Financeiro / Faturamento
import ContasAPagar from '@/components/corpo/admin/financeiro/contasAPagar';
import ContasAReceber from '@/components/corpo/admin/financeiro/contasAReceber';
import Faturar from '@/components/corpo/admin/financeiro/faturar';
import Transferencia from '@/components/corpo/admin/financeiro/transferencia';
import DashboardFinanceiro from '@/components/common/DashboardFinanceiro';
import HistoricoNF from '@/components/corpo/faturamento/historicoNF';
import NovoFaturamento from '@/components/corpo/faturamento/novoFaturamento';
import ConsultaFaturasPage from '../corpo/faturamento/ConsultaFatura/ConsultaFatura';

// Vendas / Operacional - Lazy loading para componentes pesados
const Vendas = lazy(() => import('@/components/corpo/admin/vendas'));
const NovasVendas = lazy(() => import('@/components/corpo/vendas/novaVenda'));
const CentralVendas = lazy(() => import('@/components/corpo/vendas/centralVendas'));
const Promocoes = lazy(() => import('@/components/corpo/vendas/promocoes'));
const VendasDashboard = lazy(() => import('../corpo/vendas/dashboard'));
const VendasBloqueadasPage = lazy(() => import('../corpo/vendas/bloqueadas'));
const LocaisPecasPage = lazy(() => import('../corpo/vendas/locaisPecas'));
const SeparacaoPage = lazy(() => import('../corpo/separacao'));
const ConferenciaPage = lazy(() => import('../corpo/conferencia'));
const TelaFinalizarPage = lazy(() => import('../corpo/conferencia/TelaFinalizar'));
const TelaTVPage = lazy(() => import('../corpo/operacional/tv'));
const TelaRecebimentoPage = lazy(() => import('../corpo/operacional/recebimento'));

// Compras - Lazy loading para componentes pesados
const RequisicoesCompra = lazy(() => import('@/components/corpo/comprador/RequisicoesCompra/'));
const ComprasTabManagerOrdens = lazy(() =>
  import('@/components/corpo/comprador/RequisicoesCompra/components/ComprasTabManagerOrdens').then(
    module => ({ default: module.ComprasTabManagerOrdens })
  )
);
const HistoricoCompra = lazy(() => import('@/components/corpo/comprador/historicoCompra'));
const NovaCompra = lazy(() => import('@/components/corpo/comprador/novaCompra'));
const DashBoardCompras = lazy(() => import('@/components/corpo/comprador/DashBoard'));
const EntradasMain = lazy(() => import('@/components/corpo/comprador/Entradas'));
const EntradaXmlMain = lazy(() => import('@/components/corpo/comprador/EntradaXml'));
const RecebimentoEntradaPage = lazy(() => import('@/components/corpo/recebimento-entrada'));
const AlocacaoPage = lazy(() => import('@/components/corpo/alocacao'));
const ImportacaoMain = lazy(() => import('@/components/corpo/comprador/Importacao'));
const DevolucaoMain = lazy(() => import('@/components/corpo/comprador/Devolucao'));

// Relatórios / Config / Acessos / Estoque
import Estoque from '@/components/corpo/admin/estoque';
import Relatorios from '@/components/corpo/admin/relatorios';
import Parametros from '@/components/corpo/admin/configuracoes/parametros';
import Funcoes from '@/components/corpo/admin/controleAcesso/funcoes';
import Filiais from '@/components/corpo/admin/controleAcesso/filiais';
import Grupos from '@/components/corpo/admin/controleAcesso/perfis';
import Telas from '@/components/corpo/admin/controleAcesso/telas';
import Usuarios from '@/components/corpo/admin/controleAcesso/usuarios';

import SMTPList from '@/components/corpo/admin/smtp/SMTPList';
import LegislacaoNcmPage from '../corpo/admin/legislacao/legislacao-icmsst_ncm';
import LegislacaoIcmsstPage from '../corpo/admin/legislacao/legislacao-icmsst';
import LegislacaoSignatarioPage from '../corpo/admin/legislacao/legislacao-signatario';
import RemessaEquifax from '../corpo/remessa/remessa';
import { FaNoteSticky } from 'react-icons/fa6';
import RelatorioConciliacaoCartao from '../corpo/contas-receber/RelatorioConciliacaoCartao';
import CalculadoraTributariaManual from '../corpo/admin/calculadora/CalculadoraTributariaManual';


export const menus = [
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

      // ======= LEGISLAÇÃO (do primeiro arquivo) =======
      {
        name: 'Legislação',
        href: '',
        icon: BookText,
        corpo: '',
        subItems: [
          {
            name: 'IMC',
            href: '/admin/legislacao/legislacaoIcmsst',
            icon: ListCheckIcon,
            corpo: LegislacaoIcmsstPage,
          },
          {
            name: 'IMC - NCM',
            href: '/admin/legislacao/legislacaoNcm',
            icon: ListCheckIcon,
            corpo: LegislacaoNcmPage,
          },
          {
            name: 'Signatário',
            href: '/admin/legislacao/legislacaoSignatario',
            icon: ListCheckIcon,
            corpo: LegislacaoSignatarioPage,
          },
        ],
      },

      // ======= CADASTRO (mescla dos dois) =======
      {
        name: 'Cadastro',
        href: '',
        icon: DiamondPlusIcon,
        corpo: '',
        subItems: [
          {
            name: 'Dados Empresa',
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
            name: 'Grupo de produtos',
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
            href: '/admin/cadastros/bancos',
            icon: LandmarkIcon,
            corpo: BancosContas,
          },

          {
            name: 'Configuração SMTP',
            href: '/admin/cadastros/smtp',
            icon: CogIcon,
            corpo: SMTPList,
          },
        ],
      },

      // ======= FINANCEIRO =======
      {
        name: 'Financeiro',
        href: '',
        icon: BadgeDollarSignIcon,
        corpo: '',
        subItems: [
          {
            name: 'Dashboard',
            href: '/admin/financeiro/dashboard',
            icon: ChartLineIcon,
            corpo: DashboardFinanceiro,
          },
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
            name: 'Relatório Cartao',
            href: '/admin/financeiro/relatorio-cartao',
            icon: FileTextIcon,
            corpo: RelatorioConciliacaoCartao,
          },
          {
            name: 'Nota de Conhecimento',
            href: '/admin/financeiro/faturar',
            icon: ListCheck,
            corpo: Faturar,
          },
          {
            name: 'Transferência',
            href: '/admin/financeiro/transferencia',
            icon: WalletIcon,
            corpo: Transferencia,
          },
          {
            name: 'Remessa',
            href: '/admin/financeiro/remessa',
            icon: BadgeDollarSignIcon,
            corpo: RemessaEquifax,
          },
         
        ],
      },

      // ======= VENDAS (mescla; inclui itens extras do primeiro) =======
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
          {
            name: 'Separação',
            href: '/vendas/separacao',
            icon: PackageCheck,
            corpo: SeparacaoPage,
          },
          {
            name: 'Conferência',
            href: '/vendas/conferencia',
            icon: CheckCircle,
            corpo: ConferenciaPage,
          },
          {
            name: 'Pedidos Conferidos',
            href: '/vendas/conferidos',
            icon: FileCheck,
            corpo: TelaFinalizarPage,
          },
          {
            name: 'Tela TV',
            href: '/vendas/operacional/tv',
            icon: Tv,
            corpo: TelaTVPage,
          },
          {
            name: 'Recebimento',
            href: '/vendas/operacional/recebimento',
            icon: Printer,
            corpo: TelaRecebimentoPage,
          },
        ],
      },

      // ======= COMPRAS (do segundo arquivo) =======
      {
        name: 'Compras',
        icon: ShoppingBag,
        href: '',
        corpo: '',
        subItems: [
          {
            name: 'Dashboard',
            href: '/compras/dashBoard',
            icon: LayoutDashboard,
            corpo: DashBoardCompras,
          },
          {
            name: 'Nova Requisição',
            href: '/compras/novaCompra',
            icon: Plus,
            corpo: NovaCompra,
          },
          {
            name: 'Requisições de Compra',
            href: '/compras/requisicoes-compra',
            icon: ListCheckIcon,
            corpo: RequisicoesCompra,
          },
          {
            name: 'Histórico de Compras',
            href: '/comprador/historicoCompra',
            icon: LiaFileInvoiceSolid,
            corpo: HistoricoCompra,
          },
          {
            name: 'Entradas',
            href: '/compras/entradas',
            icon: Package,
            corpo: EntradasMain,
          },
          {
            name: 'Entrada por XML',
            icon: FileText,
            hasSubmenu: true,
            subMenuItems: [
              {
                name: 'Gerar Entrada de NFe',
                href: '/compras/entrada-xml/gerar-nfe',
              },
              {
                name: 'Entrada por XML de NFe',
                href: '/compras/entrada-xml/importar-nfe',
              },
              {
                name: 'Entrada por XML de Embarque',
                href: '/compras/entrada-xml/embarque',
              },
            ],
          },
          {
            name: 'Importação',
            icon: CircleDollarSignIcon,
            href: '/compras/importacao',
            corpo: ImportacaoMain,
          },
          {
            name: 'Devolução',
            icon: RotateCcw,
            href: '/compras/devolucao',
            corpo: DevolucaoMain,
          },
          {
            name: 'Recebimento',
            href: '/entrada/recebimento',
            icon: PackageCheck,
            corpo: RecebimentoEntradaPage,
            openInNewTab: true,
          },
          {
            name: 'Alocação',
            href: '/alocacao',
            icon: MapPin,
            corpo: AlocacaoPage,
            openInNewTab: true,
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

      // ======= CONFIGURAÇÕES =======
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

      // ======= ACESSOS =======
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

      // ======= FATURAMENTO (mescla) =======
      {
        name: 'Faturamento',
        icon: LiaFileInvoiceDollarSolid,
        href: '',
        subItems: [
          {
            name: 'Consultar Faturas',
            href: '/faturamento/consultaFatura',
            icon: Search,
            corpo: ConsultaFaturasPage,
          },
          {
            name: 'Novo Faturamento',
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

      // ======= GERENCIAMENTO =======
      {
        name: 'Gerenciamento',
        icon: CogIcon,
        href: '',
        corpo: '',
        subItems: [
          {
            name: 'Kickback Bosch',
            href: '/gerenciamento/produtos/kickback',
            icon: Upload,
            corpo: KickbackBosch,
          },
        ],
      },
    ],
  },
];

interface PageSidebarProps {
  tela: string;
  permissoes: string[] | undefined;
}
interface SubMenuItemThirdLevel {
  name: string;
  href: string;
}
interface SubMenuItemThirdLevel {
  name: string;
  href: string;
}

interface SubMenuItem {
  name: string;
  href?: string;
  icon?: React.ComponentType<any>;
  corpo?: React.ComponentType<any> | string;
  hasSubmenu?: boolean;
  subMenuItems?: SubMenuItemThirdLevel[];
  openInNewTab?: boolean;
}

interface MenuItem {
  name: string;
  href: string;
  icon?: React.ComponentType<any>;
  corpo?: React.ComponentType<any> | string;
  subItems?: SubMenuItem[];
  hasSubmenu?: boolean;
  subMenuItems?: SubMenuItemThirdLevel[];
}
function encontrarCorpoPorTela(
  tela: string,
  menus: any[],
): React.ComponentType | typeof Carregamento {
  // Casos especiais (do segundo arquivo)
  if (tela === '/compras/importacao') return ImportacaoMain;
  if (tela === '/compras/devolucao') return DevolucaoMain;
  if (tela === '/compras/ordens-compra') return ComprasTabManagerOrdens;
  if (
    tela === '/compras/entrada-xml/gerar-nfe' ||
    tela === '/compras/entrada-xml/importar-nfe' ||
    tela === '/compras/entrada-xml/embarque'
  ) {
    return EntradaXmlMain;
  }

  for (const menu of menus) {
    for (const item of menu.items) {
      if (item.href && item.href === tela) return item.corpo;
      if (item.subItems?.length > 0) {
        for (const subItem of item.subItems) {
          if (subItem.href && subItem.href === tela) return subItem.corpo;
        }
      }
    }
  }
  return Carregamento;
}

const PageSidebar: React.FC<PageSidebarProps> = ({ tela, permissoes }) => {
  const [telaMudou, setTelaMudou] = React.useState(tela);
  const handleTelaMudou = (newTela: string) => setTelaMudou(newTela);

  const [valorF, setValorF] = React.useState<any[]>([]);
  const corpoAtual = encontrarCorpoPorTela(tela, valorF);

  React.useEffect(() => {
    const novoValorF = menus.map((menu) => {
      // 1) Filtra itens conforme permissões (suportando 3º nível)
      const itensFiltrados = menu.items
        .map((item) => {
          const novoItem: MenuItem = { ...item };

          // Se item tem subMenuItems (3º nível) diretamente
          if (novoItem.hasSubmenu && novoItem.subMenuItems) {
            const temPermissaoFilho = novoItem.subMenuItems.some((sub) =>
              (permissoes ?? []).includes(sub.href),
            );
            if (temPermissaoFilho) return novoItem;
          }

          // Se item principal é permitido
          if (novoItem.href && (permissoes ?? []).includes(novoItem.href)) {
            if (novoItem.subItems?.length) {
              novoItem.subItems = novoItem.subItems.filter((sub) => {
                if (sub.hasSubmenu && sub.subMenuItems) {
                  return sub.subMenuItems.some((third) =>
                    (permissoes ?? []).includes(third.href),
                  );
                }
                return sub.href && (permissoes ?? []).includes(sub.href);
              });
            }
            return novoItem;
          }

          // Se não é permitido no principal, verificar subItems
          if (novoItem.subItems?.length) {
            const novosSubItems = novoItem.subItems.filter((sub) => {
              // Se o subItem tem subMenuItems (3º nível), verificar se algum filho é permitido
              if (sub.hasSubmenu && sub.subMenuItems) {
                return sub.subMenuItems.some((third) =>
                  (permissoes ?? []).includes(third.href),
                );
              }
              // Caso contrário, verificar se o subItem é permitido diretamente
              return sub.href && (permissoes ?? []).includes(sub.href);
            });

            if (novosSubItems.length > 0)
              return { ...novoItem, subItems: novosSubItems };
          }

          return null;
        })
        .filter(Boolean) as MenuItem[];

      // 2) Ordenar subitems A-Z
      itensFiltrados.forEach((it) => {
        if (it.subItems?.length) {
          it.subItems.sort((a, b) =>
            (a.name || '').localeCompare(b.name || ''),
          );
        }
      });

      // 3) Garantir DashBoard no topo e ordenar o resto A-Z
      const dash = itensFiltrados.find((i) => i.name === 'DashBoard');
      const outros = itensFiltrados.filter((i) => i.name !== 'DashBoard');
      outros.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      return { ...menu, items: dash ? [dash, ...outros] : outros };
    });

    setValorF(novoValorF);
  }, [permissoes, tela]);

  return (
    <div className="flex w-full flex-col bg-muted/40">
      <Suspense fallback={<Carregamento texto="Carregando módulo..." />}>
        <Padrao
          setTelaMudou={handleTelaMudou}
          menus={valorF}
          tela={tela}
          Corpo={telaMudou === tela ? corpoAtual : Carregamento}
        />
      </Suspense>
    </div>
  );
};

export default PageSidebar;
