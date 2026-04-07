import Link from 'next/link';
import React from 'react';
import { TiShoppingCart } from 'react-icons/ti';
import { LayoutDashboardIcon, Plus } from 'lucide-react';
import Image from 'next/image';
import logo from '../../../../public/images/logo1Branco.webp';
import logo2 from '../../../../public/images/logo2Branco.webp';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { Label } from '@radix-ui/react-dropdown-menu';

interface LayoutPaginaProps {
  ampliar?: boolean;
  value?: string;
}

const LayoutPagina: React.FC<LayoutPaginaProps> = ({ ampliar, value }) => {
  return (
    <nav className="flex flex-col bg-gray-100 dark:bg-slate-900 items-center gap-0 ">
      <TooltipProvider>
        <div
          className={` flex flex-col 
                            justify-start pl-0 items-center bg-background
                            ${ampliar ? 'w-56' : 'w-12'} duration-300 h-full`}
        >
          <div
            className={`border-b border-gray-300 bg-[#347AB6]  dark:bg-[#1f517c] flex 
                            justify-center pl-0 items-center 
                           w-full  h-20`}
          >
            <Link
              href="#"
              className="flex h-full w-full justify-center items-center 
                    text-lg  text-primary-foreground md:text-base "
              prefetch={false}
            >
              <div className="flex w-[60%] h-full transition duration-1000 justify-center items-center ">
                <Image
                  priority
                  src={ampliar ? logo : logo2}
                  alt=""
                  style={{
                    height: 'auto',
                    width: ampliar ? '120' : '30',
                  }}
                />
                <span className="sr-only">Logo do projeto</span>
              </div>
            </Link>
          </div>
          <div className={`delay-75  w-full  h-20 `}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full h-12  flex items-center justify-center  border-b border-dashed border-gray-400  ">
                  <Link
                    href="dashboard"
                    className={` flex h-10 w-[90%]   shrink-0 items-center ${
                      ampliar ? 'justify-start' : 'justify-center'
                    }  
                      rounded-lg  transition-colors
                       `}
                    prefetch={false}
                  >
                    <div
                      className={`flex items-center ${
                        ampliar
                          ? `w-full  ${
                              value === 'dashboard'
                                ? 'px-8  text-[#347AB6] dark:text-cyan-300  '
                                : 'px-8 text-black  dark:text-gray-50 hover:text-[#347AB6]  hover:dark:text-cyan-300 '
                            }h-full rounded-lg`
                          : 'px-0 justify-center   hover:text-[#347AB6] hover:dark:text-cyan-300'
                      }   w-64 h-full rounded-lg'} `}
                    >
                      {ampliar ? (
                        <LayoutDashboardIcon
                          className={`mx-2 h-10 w-8 transition-all `}
                        />
                      ) : (
                        <LayoutDashboardIcon
                          className={`mx-2 h-10 w-5 transition-all ${
                            value === 'dashboard'
                              ? 'text-[#347AB6] dark:text-cyan-300'
                              : 'text-black  dark:text-gray-50 hover:text-[#347AB6] dark:hover:text-cyan-300'
                          }`}
                        />
                      )}

                      {ampliar ? (
                        <div className="w-full ml-1 text-xs flex justify-start ">
                          DashBoard
                        </div>
                      ) : (
                        ''
                      )}
                    </div>
                  </Link>
                </div>
              </TooltipTrigger>

              <TooltipContent
                side="right"
                className={`${ampliar && 'hidden'}  text-white bg-[#347AB6]`}
              >
                <p>DashBoard</p>
              </TooltipContent>
            </Tooltip>
            <div
              className={`flex w-full h-10 items-center   dark:text-slate-50  justify-start font-bold text-xs`}
            >
              <Label
                className={`flex w-full ${
                  ampliar
                    ? 'text-[14px] ml-10 justify-start'
                    : 'text-[8px] ml-0 justify-center'
                }  dark:text-slate-50     h-5 font-bold `}
              >
                VENDAS
              </Label>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`${ampliar ? 'w-56' : 'w-12'}     h-auto   flex 
                            items-center justify-center
                            border-dashed `}
                >
                  <Link
                    href="novavenda"
                    className={` flex h-10 w-[90%]   shrink-0 items-center ${
                      ampliar ? 'justify-start' : 'justify-center'
                    }  
                      rounded-lg text-black  dark:text-slate-50  transition-colors
                       `}
                    prefetch={false}
                  >
                    <div
                      className={`flex items-center ${
                        ampliar
                          ? `w-full  ${
                              value === 'novavenda'
                                ? 'px-8 text-[#347AB6] dark:text-cyan-300  '
                                : 'px-8 text-black  dark:text-gray-50 hover:text-[#347AB6]  hover:dark:text-cyan-300 '
                            }h-full rounded-lg`
                          : 'px-0 justify-center   hover:text-[#347AB6] hover:dark:text-cyan-300'
                      }   w-64 h-full rounded-lg'} `}
                    >
                      {ampliar ? (
                        <Plus className={`mx-2 h-10 w-8 transition-all `} />
                      ) : (
                        <Plus
                          className={`mx-2 h-10 w-5 transition-all ${
                            value === 'novavenda'
                              ? 'text-[#347AB6] dark:text-cyan-300'
                              : 'text-black  dark:text-gray-50 hover:text-[#347AB6] dark:hover:text-cyan-300'
                          }`}
                        />
                      )}

                      {ampliar ? (
                        <div className="w-full ml-1 text-xs  flex justify-start ">
                          Nova Venda
                        </div>
                      ) : (
                        ''
                      )}
                    </div>
                  </Link>
                </div>
              </TooltipTrigger>

              <TooltipContent
                side="right"
                className={`${ampliar && 'hidden'}  text-white bg-[#347AB6]`}
              >
                <p>Nova Venda</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`${
                    ampliar ? 'w-56' : 'w-12'
                  } h-auto  flex items-center justify-center  border-b border-dashed border-gray-400`}
                >
                  <Link
                    href="centralvendas"
                    className={` flex h-10 w-[90%]   shrink-0 items-center ${
                      ampliar ? 'justify-start' : 'justify-center'
                    }  
                      rounded-lg text-black  dark:text-slate-50  transition-colors
                       `}
                    prefetch={false}
                  >
                    <div
                      className={`flex items-center ${
                        ampliar
                          ? `w-full  ${
                              value === 'centralvendas'
                                ? 'px-8 text-[#347AB6] dark:text-cyan-300  '
                                : 'px-8 text-black  dark:text-gray-50 hover:text-[#347AB6]  hover:dark:text-cyan-300 '
                            }h-full rounded-lg `
                          : 'px-0 justify-center  hover:text-[#347AB6] hover:dark:text-cyan-300'
                      }   w-64 h-full rounded-lg'} `}
                    >
                      {ampliar ? (
                        <TiShoppingCart
                          className={`mx-2 h-10 w-8 transition-all `}
                        />
                      ) : (
                        <TiShoppingCart
                          className={`mx-2 h-10 w-5 transition-all ${
                            value === 'centralvendas'
                              ? 'text-[#347AB6] dark:text-cyan-300'
                              : 'text-black  dark:text-gray-50 hover:text-[#347AB6] dark:hover:text-cyan-300'
                          }`}
                        />
                      )}

                      {ampliar ? (
                        <div className="w-full ml-1 text-xs  flex justify-start ">
                          Central de Vendas
                        </div>
                      ) : (
                        ''
                      )}
                    </div>
                  </Link>
                </div>
              </TooltipTrigger>

              <TooltipContent
                side="right"
                className={`${ampliar && 'hidden'}  text-white bg-[#347AB6]`}
              >
                <p>Central de Vendas</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </nav>
  );
};
export default LayoutPagina;
