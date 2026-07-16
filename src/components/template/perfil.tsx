import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { TbSunHigh } from 'react-icons/tb';
import { MdOutlineChangeCircle, MdOutlineDarkMode } from 'react-icons/md';
import { RiLockPasswordLine } from 'react-icons/ri';
import { FaUser } from 'react-icons/fa';
import { LogOut, ZoomIn } from 'lucide-react';
import { useEscalaUI } from '@/hooks/useEscalaUI';

interface DadosPerfil {
  usuario?: string;
  perfil?: string;
  obs?: string;
  filial?: string;
}

interface LayoutPaginaProps {
  perfilUser?: DadosPerfil;
}

const PerfilPagina: React.FC<LayoutPaginaProps> = ({ perfilUser }) => {
  const { theme, setTheme } = useTheme();
  const { escala, setEscala, escalas } = useEscalaUI();

  return (
    <div className="flex items-center justify-start">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div className="h-full w-full  flex justify-center items-center">
            <Avatar>
              <div className="h-full w-full flex justify-center items-center">
                <FaUser className="  h-[70%] w-[70%] text-gray-200 " />
              </div>
            </Avatar>
            <div className="mx-2 overflow-hidden">
              <div className="flex justify-start font-bold truncate text-[clamp(0.75rem,2.5vw,1rem)]">
                {perfilUser?.usuario}
              </div>
              <div className="flex justify-start truncate text-[clamp(0.65rem,2vw,0.875rem)]">
                {perfilUser?.perfil}
              </div>
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <div className="  w-52 ">
            <DropdownMenuItem>
              <RiLockPasswordLine className="mx-2 h-10 w-5 transition-all" />
              <Link href={`/mudarsenha`}>Mudar Senha</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MdOutlineChangeCircle className="mx-2 h-10 w-5 transition-all" />
              <Link href={`/filial?perfilName=${perfilUser?.usuario}`}>
                Trocar Filial
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                if (theme === 'dark') {
                  setTheme('light');
                } else {
                  setTheme('dark');
                }
              }}
            >
              {theme === 'light' ? (
                <MdOutlineDarkMode className="mx-2 h-10 w-5 text-primary transition-all" />
              ) : (
                <TbSunHigh className="mx-2 h-10 w-5 text-primary transition-all" />
              )}
              {theme === 'dark' ? 'Tela Clara' : 'Tela Escura'}
            </DropdownMenuItem>

            {/* Escala da interface — multiplica a preferência do Windows/navegador */}
            <div className="px-2 py-1.5 border-t border-gray-200 dark:border-zinc-700">
              <div className="flex items-center mb-1.5">
                <ZoomIn className="mx-2 h-5 w-5 text-primary transition-all" />
                <span className="text-xs">Escala da tela</span>
              </div>
              <div className="flex gap-1 px-2">
                {escalas.map((e) => (
                  <button
                    key={e.valor}
                    type="button"
                    onClick={() => setEscala(e.valor)}
                    title={`${e.label} (${e.valor}%)`}
                    className={`flex-1 rounded border px-1 py-1 text-[0.625rem] transition-colors ${
                      escala === e.valor
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            <DropdownMenuItem>
              {' '}
              <LogOut className="mx-2 h-10 w-5 transition-all" />
              <Link href="/logout">LogOut</Link>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
export default PerfilPagina;
