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

function createDadosDocumentoSel(label: string, value: string) {
  return {
    value,
    label,
  };
}

interface ChildProps {
  dadosDocumento: {
    COD_OPERACAO: string;
    DESCR: string;
  }[];
  readonly handleDocumento: (arg0: {
    COD_OPERACAO: string;
    DESCR: string;
  }) => void;
}
const SelectVendedor: React.FC<ChildProps> = ({
  dadosDocumento,
  handleDocumento,
}) => {
  const [open, setOpen] = React.useState(false);

  const [documento, setDocumento] = React.useState('VENDA');
  const arrayListaVendedor: {
    label: string;
    value: string;
  }[] = [];

  dadosDocumento.map((val) => {
    const newListaVend = createDadosDocumentoSel(val.DESCR, val.COD_OPERACAO);
    arrayListaVendedor.push(newListaVend);
    return 0;
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start text-sm ">
          <div className="w-full text-primary flex items-center">
            <div className="relative  h-full w-full min-w-[200px]">
              <input
                className="peer h-full w-full
                     
                                    rounded-[7px] border  
                                  border-gray-300 dark:border-gray-50
                                  
                                    dark:focus:border-t-transparent
                                    
                                    bg-transparent 
                                    
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
                                    "
                value={documento || ''}
                onChange={() => {
                  return 0;
                }}
                placeholder={''}
              />
              <label
                className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:text-sm
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                peer-focus:text-gray-600
                                dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
              >
                Documento
              </label>
            </div>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 ml-48">
        <Command>
          <CommandInput placeholder="" />
          <CommandList>
            <CommandEmpty>Nenhum Vendedor encontrado.</CommandEmpty>
            <CommandGroup>
              {arrayListaVendedor.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.label}
                  onSelect={(currentValue) => {
                    setDocumento(
                      currentValue === documento ? '' : currentValue,
                    );
                    setOpen(false);
                    const transSelect = dadosDocumento.filter(
                      (val) => val.COD_OPERACAO === framework.value,
                    );

                    if (transSelect.length) handleDocumento(transSelect[0]);
                  }}
                >
                  {framework.label}
                  <Check
                    className={cn(
                      'ml-auto',
                      documento === framework.value
                        ? 'opacity-100'
                        : 'opacity-0',
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
