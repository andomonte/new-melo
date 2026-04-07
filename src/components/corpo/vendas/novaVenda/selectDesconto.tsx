import * as React from 'react';
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
import { BiSolidDiscount } from 'react-icons/bi';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function createDadosVendedorSel(label: string, value: number) {
  return {
    value,
    label,
  };
}
interface ChildProps {
  index: number;
  descT: number[];
  descontos: boolean;
  readonly handleAtualizarDesc: (arg0: {
    indexDesc: number;
    novoDesc: string;
  }) => void;
}
const SelectDesconto: React.FC<ChildProps> = ({
  index,
  descT,
  descontos,
  handleAtualizarDesc,
}) => {
  const desconto: { value: number; label: string }[] = [];

  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [desc1, setDesc1] = React.useState(descT);
  for (let i = 1; i <= 100; i += 1) {
    desconto[i - 1] = createDadosVendedorSel(String(i), i);
  }

  React.useEffect(() => {
    setDesc1(descT);
  }, [descT]);

  return (
    <Popover
      open={desc1[index] && !descontos ? open : false}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <div className="  flex space-x-1 text-base">
          <div
            className={`flex
                                       cursor-pointer  text-sm  items-center `}
            onClick={() => {
              if (!descontos) {
                const descF = Number(desc1[index]);

                if (Number(descF) > 0) {
                  setDesc1((oldArray) => {
                    const newArray = [...oldArray];
                    newArray[index] = 0;
                    return newArray;
                  });

                  handleAtualizarDesc({
                    indexDesc: index,
                    novoDesc: '0',
                  });

                  //                                    handleAtualizarDesc(index, '0');
                } else {
                  setDesc1((oldArray) => {
                    const newArray = [...oldArray];
                    newArray[index] = 2;
                    return newArray;
                  });

                  //                                      handleAtualizarDesc(index, '2');
                }
              }
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <BiSolidDiscount
                    size={20}
                    className={` ${
                      desc1[index]
                        ? ' text-violet-700   hover:text-violet-900 '
                        : ' text-gray-300 hover:text-gray-400 '
                    } `}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {!desc1[index]
                    ? 'aplicar % de desconto à vista'
                    : 'retirar o desconto'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandList>
            <CommandEmpty>sem Desconto</CommandEmpty>
            <CommandGroup>
              {desconto.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={String(framework.value)}
                  onSelect={(currentValue) => {
                    if (!descontos) {
                      setValue(currentValue === value ? '' : currentValue);
                      setOpen(false);
                      handleAtualizarDesc({
                        indexDesc: index,
                        novoDesc: currentValue,
                      });
                    }
                  }}
                >
                  {framework.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SelectDesconto;
