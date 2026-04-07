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
import { LogOut } from 'lucide-react';

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
