import React from 'react';
import Image from 'next/image';
import { MenuSection } from './navBar';
import NavBar from './navBar';
import logo from '../../../../public/images/logo1Branco.webp';

interface NavBarMobileProps {
  menus: MenuSection[];
  setTelaMudou?: (arg0: string) => void;
  ampliar?: boolean;
  tela: string;
  readonly handleAmpliar: (arg0: boolean) => void;
}

const NavBarMobile = ({
  menus,
  handleAmpliar,
  setTelaMudou,
  ampliar,
  tela,
}: NavBarMobileProps) => {
  return (
    <div className="h-screen flex flex-col w-56 bg-background dark:bg-slate-900">
      {/* Logo fixa no topo */}
      <div className="h-20 bg-[#347AB6] dark:bg-[#1f517c] flex justify-center items-center shrink-0 border-b border-gray-300">
        <div
          style={{ position: 'relative', width: 120, height: 50 }}
          className="mx-auto"
        >
          <Image
            priority
            src={logo}
            alt="Logo"
            fill
            sizes="120px"
            style={{ objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Menu que só scrolla se necessário */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <NavBar
          menus={menus}
          ampliar={ampliar}
          setTelaMudou={(tela) => {
            setTelaMudou?.(tela);
            // ❌ Não fecha o drawer automaticamente no mobile
          }}
          exibirLogo={false}
          tela={tela}
          handleAmpliar={handleAmpliar}
        />
      </div>
    </div>
  );
};

export default NavBarMobile;
