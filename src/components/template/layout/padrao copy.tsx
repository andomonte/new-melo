import React, { useState } from 'react';
import { ComponentType } from 'react';
import NavBar from '@/components/template/layout/navBar';
import NavBarMobile from '@/components/template/layout/navBarMobile';
import Cabecalho from '@/components/template/layout/cabecalho';
import CabecalhoMobile from '@/components/template/layout/cabecalhoMobile';
import Drawer from './drawer';

interface SubMenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface MenuItem {
  name: string;
  href?: string;
  icon?: React.ElementType;
  subItems?: SubMenuItem[];
}

interface MenuSection {
  titulo: string;
  items: MenuItem[];
}

interface LayoutPaginaProps {
  menus: MenuSection[];
  Corpo?: ComponentType<any>;
  setTelaMudou?: (arg0: string) => void;
  tela: string;
}

const LayoutPadrao: React.FC<LayoutPaginaProps> = ({
  Corpo,
  menus,
  setTelaMudou,
  tela,
}) => {
  const [ampliar, setAmpliar] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(ampliar);

  const handleAmpliar = (statusAmpliar: boolean) => {
    setAmpliar(statusAmpliar);

    setOpen(statusAmpliar);
  };

  React.useEffect(() => {
    if (tela.length) {
      sessionStorage.setItem('telaAtualMelo', JSON.stringify(tela));
    }
  }, [tela]);

  return (
    <div className="select-none flex w-full flex-col bg-muted/40">
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden h-full w-full sm:flex bg-gray-400">
        <NavBar
          menus={menus}
          ampliar={ampliar}
          tela={tela}
          setTelaMudou={setTelaMudou}
          exibirLogo={true}
          handleAmpliar={handleAmpliar}
        />

        <Cabecalho
          ampliar={ampliar}
          handleAmpliar={handleAmpliar}
          Corpo={Corpo}
        />
      </aside>

      {/* Mobile */}
      <aside className="fixed inset-y-0 left-0 z-10 flex h-full w-full sm:hidden bg-gray-400">
        <Drawer
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            setAmpliar(isOpen);
          }}
        >
          <NavBarMobile
            ampliar={ampliar}
            menus={menus}
            tela={tela}
            setTelaMudou={(tela) => {
              setTelaMudou?.(tela);
            }}
            handleAmpliar={handleAmpliar}
          />
        </Drawer>

        <CabecalhoMobile
          ampliar={ampliar}
          handleAmpliar={handleAmpliar}
          Corpo={Corpo}
        />
      </aside>
    </div>
  );
};

export default LayoutPadrao;
