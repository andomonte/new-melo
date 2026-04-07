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
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
      {/* Header Bar */}
      <div className="flex-none flex h-20 items-center justify-center w-full bg-[#347AB6] dark:bg-[#1f517c] text-white border-b border-gray-300 dark:border-slate-700">
        <div className="w-[6%] sm:w-[8%] md:w-[5%] lg:w-[4%] ml-2 h-full flex items-center justify-start">
          <Button
            className="w-8 h-8"
            size="icon"
            variant="outline"
            onClick={() => {
              handleAmpliar(!ampliar);
            }}
          >
            {!ampliar ? (
              <Menu className="h-[4] w-full" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span className="sr-only">Abrir / fechar menu</span>
          </Button>
        </div>
        <div className={`w-[93%] flex items-center justify-end`}>
          <div className="h-auto w-[75%] flex justify-start">
            <div className="h-full w-auto">
              <div className="w-full flex h-[70%] text-[14px] items-start justify-start">
                {perfilUser.filial}
              </div>
            </div>
          </div>
          <div className="w-[25%] flex items-center justify-end">
            <PerfilPagina perfilUser={perfilUser} />
          </div>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full text-black dark:text-gray-50 bg-white dark:bg-black overflow-hidden">
        {Corpo ? <Corpo /> : null}
      </div>
    </div>
  );
};
export default LayoutPagina;
