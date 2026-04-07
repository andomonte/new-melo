import React, { useContext } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PerfilPagina from '@/components/template/perfil';
import { AuthContext } from '@/contexts/authContexts';
import { ComponentType } from 'react';

interface LayoutPaginaProps {
  ampliar?: boolean;
  readonly handleAmpliar: (arg0: boolean) => void;
  Corpo?: ComponentType<any>;
  tela?: string;
}

const LayoutPagina: React.FC<LayoutPaginaProps> = ({
  ampliar,
  handleAmpliar,
  Corpo,
}) => {
  const { user } = useContext(AuthContext);
  const perfilUser = user;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full w-full overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-[#347AB6] dark:bg-[#1f517c] text-white border-b border-gray-300 h-20 w-full flex items-center justify-between px-4 gap-4">
        <div className="mx-2">
          <PerfilPagina perfilUser={perfilUser} />
        </div>

        <div className="h-auto w-[25%] flex justify-start items-center text-[10px] sm:text-xs md:text-sm lg:text-base">
          {perfilUser.filial}
        </div>
        <div className="w-[10%] sm:w-[8%] md:w-[5%] lg:w-[4%] ml-2 h-full flex items-center justify-start">
          <Button
            className="w-8 h-8"
            size="icon"
            variant="outline"
            onClick={() => handleAmpliar(!ampliar)}
          >
            {!ampliar ? (
              <Menu className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span className="sr-only">Abrir / fechar menu</span>
          </Button>
        </div>
      </div>

      {/* Corpo centralizado */}
      <div className="flex-1 w-full flex justify-center items-center text-black dark:text-gray-50 border-t border-gray-300 dark:bg-black bg-white overflow-hidden">
        {Corpo ? <Corpo /> : <div></div>}
      </div>
    </div>
  );
};

export default LayoutPagina;
