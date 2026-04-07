import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// 👇 gera: label = "CODTPTRANSP - DESCR", value = CODTPTRANSP
function createDadosVendedorSel(cod: string, descr: string) {
  return {
    label: `${cod} - ${descr}`,
    value: cod,
  };
}

interface ChildProps {
  dadosTransporte: {
    CODTPTRANSP: string;
    DESCR: string;
  }[];
  transporteSel: {
    CODTPTRANSP: string;
    DESCR: string;
  };
  obrigTransporte: boolean;
  readonly handleTransporteSel: (arg0: {
    CODTPTRANSP: string;
    DESCR: string;
  }) => void;
}

const SelectVendedor: React.FC<ChildProps> = ({
  dadosTransporte,
  transporteSel,
  obrigTransporte,
  handleTransporteSel,
}) => {
  const [open, setOpen] = React.useState(false);

  // mostra no input o texto "CODTPTRANSP - DESCR" já selecionado, se houver
  const [transporte, setTransporte] = React.useState(
    transporteSel?.CODTPTRANSP
      ? `${transporteSel.CODTPTRANSP} - ${transporteSel.DESCR}`
      : '',
  );

  const arrayListaVendedor: { label: string; value: string }[] =
    dadosTransporte?.map((val) =>
      createDadosVendedorSel(val.CODTPTRANSP, val.DESCR),
    ) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex w-[100%] space-x-1 text-gray-700 dark:text-gray-300 justify-start text-sm ">
          <div className="w-full text-primary flex items-center">
            <div className="relative h-full w-full min-w-[200px]">
              <input
                className={` peer h-full w-full
                  border-gray-300 dark:border-gray-50
                  rounded-[7px] border
                  ${obrigTransporte ? 'bg-red-100' : 'bg-transparent'}
                  dark:focus:border-t-transparent
                  px-3 py-2.5 !pr-9 font-sans
                  text-sm font-normal
                  focus:text-gray-600
                  focus:border-1
                  dark:focus:text-gray-200
                  dark:focus:border-2
                  dark:focus:border-gray-200
                  outline outline-0 transition-all
                  focus:border-gray-600
                  focus:border-t-transparent
                  dark:border-t-transparent
                  placeholder-shown:border-t
                  placeholder-shown:border-gray-300
                  placeholder-shown:placeholder-gray-400
                  dark:placeholder-shown:placeholder-gray-500
                  dark:placeholder-shown:border-gray-400
                  border-t-transparent focus:outline-0
                  disabled:border-0 disabled:bg-gray-50
                `}
                value={transporte || ''}
                onChange={() => {}}
                readOnly
                placeholder=""
              />
              <label
                className="before:content[' '] after:content[' '] pointer-events-none
                  absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px]
                  font-normal leading-tight text-gray-400 transition-all
                  before:pointer-events-none before:mt-[6.5px] before:mr-1
                  before:box-border before:block before:h-1.5 before:w-2.5
                  before:rounded-tl-md before:border-t before:border-l before:border-gray-300
                  before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1
                  after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow
                  after:rounded-tr-md after:border-t after:border-r after:border-gray-300
                  after:transition-all peer-placeholder-shown:text-sm
                  peer-placeholder-shown:leading-[3.75]
                  dark:peer-placeholder-shown:text-gray-500
                  dark:peer-placeholder:text-gray-500
                  peer-placeholder-shown:before:border-transparent
                  peer-placeholder-shown:after:border-transparent
                  peer-focus:text-[11px] peer-focus:leading-tight
                  peer-focus:text-gray-600 dark:peer-focus:text-gray-200
                  peer-focus:before:border-t-1 peer-focus:before:border-l-1
                  peer-focus:before:border-gray-600 dark:peer-focus:before:border-l-1
                  dark:peer-focus:before:border-gray-200 peer-focus:after:border-t-1
                  peer-focus:after:border-r-1 peer-focus:after:border-gray-600
                  dark:peer-focus:after:border-gray-200 peer-disabled:text-transparent
                  peer-disabled:before:border-transparent peer-disabled:after:border-transparent"
              >
                Transporte {`${obrigTransporte ? ' é obrigatório' : ''}`}
              </label>
            </div>
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0 ml-48">
        <Command>
          <CommandInput placeholder="" />
          <CommandList>
            <CommandEmpty>Nenhum transporte encontrado.</CommandEmpty>
            <CommandGroup>
              {arrayListaVendedor.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.label} // 🔹 onSelect receberá este label
                  onSelect={(currentValue) => {
                    // currentValue === label ("COD - DESCR")
                    setTransporte(
                      currentValue === transporte ? '' : currentValue,
                    );
                    setOpen(false);

                    // acha o objeto original pelo value (CODTPTRANSP)
                    const transSelect = dadosTransporte.find(
                      (val) => val.CODTPTRANSP === framework.value,
                    );
                    if (transSelect) handleTransporteSel(transSelect);
                  }}
                >
                  {/* Mostra "COD - DESCR" */}
                  <span>{framework.label}</span>
                  <Check
                    className={cn(
                      'ml-auto',
                      transporte === framework.label
                        ? 'opacity-100'
                        : 'opacity-0', // 🔹 compara com label
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SelectVendedor;
