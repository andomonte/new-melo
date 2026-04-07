import * as React from 'react';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { BiSolidDiscount } from 'react-icons/bi';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';

function createDadosVendedorSel(label: string, value: number) {
  return {
    value,
    label,
  };
}
interface ChildProps {
  statusDesc: boolean;
  descontoTodos: number;
  readonly handleAtualizarDesc: (arg0: {
    status: boolean;
    novoDesc: string;
  }) => void;
}
const SelectDesconto: React.FC<ChildProps> = ({
  statusDesc,
  descontoTodos,
  handleAtualizarDesc,
}) => {
  const desconto: { value: number; label: string }[] = [];

  const desc1 = statusDesc;
  for (let i = 1; i <= 100; i += 1) {
    desconto[i - 1] = createDadosVendedorSel(String(i), i);
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button className="w-4 h-6 " variant="outline">
          <BiSolidDiscount
            size={20}
            className={` ${
              statusDesc
                ? ' text-violet-700   hover:text-violet-900 '
                : ' text-gray-300 hover:text-gray-400 '
            } `}
          />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-60 ml-20">
        <div className="  flex  items-center  w-full  ">
          <div
            className={`h-full  flex flex-col   w-[100%]  justify-center    sm:mb-0 sm:justify-center sm:ml-0  
                              text-sm `}
          >
            <div className="flex w-full   font-bold text-base ">
              <div
                className="flex w-[100%] h-full justify-center font-bold  text-[10px]
                                            dark:text-gray-300"
              >
                Desconto p/ todos os itens
              </div>
            </div>
            <div className=" w-[100%] h-[90%]   ">
              <div className=" items-center w-[100%] flex">
                <button
                  id="decreaseButton"
                  className="mr-1 h-6 w-8 flex justify-center items-center  rounded bg-violet-600  dark:bg-violet-400 dark:hover:bg-violet-600 hover:bg-violet-400 
                                   border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none 
                                   active:bg-violet-700  active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                  type="button"
                  onClick={() => {
                    let qytF = descontoTodos;

                    if (Number(qytF) - 1 >= 0) {
                      qytF -= 1;

                      handleAtualizarDesc({
                        status: desc1,
                        novoDesc: String(qytF),
                      });
                    } else {
                      handleAtualizarDesc({
                        status: desc1,
                        novoDesc: String(0),
                      });
                    }
                  }}
                >
                  <FaMinus className="w-full h-[12px]" />
                </button>
                <input
                  id="amountInput"
                  type="number"
                  value={descontoTodos}
                  className="text-sm  
                                  leading-6  h-6 w-full bg-transparent
                                   placeholder:text-slate-400 border border-slate-200 
                                   rounded-md uppercase text-center 
                                   [&::-webkit-outer-spin-button]:appearance-none 
                                   [&::-webkit-inner-spin-button]:appearance-none
                                   focus:outline-none"
                  onChange={(e) => {
                    handleAtualizarDesc({
                      status: desc1,
                      novoDesc: e.target.value,
                    });

                    //                                handleQty(Number(e.target.value));
                  }}
                />
                <button
                  id="increaseButton"
                  className=" bg-violet-600 ml-1 h-6 w-8 flex justify-center items-center  rounded  dark:bg-violet-400 dark:hover:bg-violet-600 
                                  hover:bg-violet-400  border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none active:bg-violet-700  active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                  type="button"
                  onClick={() => {
                    let qytF = descontoTodos;
                    if (qytF) {
                      qytF += 1;

                      handleAtualizarDesc({
                        status: desc1,
                        novoDesc: String(qytF),
                      });
                    } else {
                      handleAtualizarDesc({
                        status: desc1,
                        novoDesc: String('1'),
                      });
                    }
                  }}
                >
                  <FaPlus className="w-full h-[12px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default SelectDesconto;
