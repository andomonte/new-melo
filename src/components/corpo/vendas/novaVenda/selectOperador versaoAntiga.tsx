import * as React from 'react';
import { FaEllipsisH } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
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

function createDadosVendedorSel(label: string, value: string) {
  return {
    value,
    label,
  };
}

interface ChildProps {
  dadosVendedores: {
    CODCV: string;
    CODVEND: string;
    COMNORMAL: string;
    COMOBJ: string;
    COMTELE: string;
    CREDITO: string;
    DEBITO: string;
    LIMITE: string;
    NOME: string;
    RA_MAT: string;
    STATUS: string;
    VALOBJ: string;
    VALOBJF: string;
    VALOBJM: string;
    VALOBJSF: string;
  }[];
  readonly handleOperadorSel: (arg0: {
    CODCV: string;
    CODVEND: string;
    COMNORMAL: string;
    COMOBJ: string;
    COMTELE: string;
    CREDITO: string;
    DEBITO: string;
    LIMITE: string;
    NOME: string;
    RA_MAT: string;
    STATUS: string;
    VALOBJ: string;
    VALOBJF: string;
    VALOBJM: string;
    VALOBJSF: string;
  }) => void;
}
const SelectVendedor: React.FC<ChildProps> = ({
  dadosVendedores,
  handleOperadorSel,
}) => {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const arrayListaVendedor: {
    label: string;
    value: string;
  }[] = [];
  dadosVendedores.map((val) => {
    const newListaVend = createDadosVendedorSel(val.NOME, val.CODVEND);
    arrayListaVendedor.push(newListaVend);
    return 0;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-6 justify-center"
        >
          <FaEllipsisH className="opacity-50" />
        </Button>
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
                  value={framework.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? '' : currentValue);
                    setOpen(false);
                    const vendedorSelect = dadosVendedores.filter(
                      (val) => val.CODVEND === framework.value,
                    );

                    if (vendedorSelect.length)
                      handleOperadorSel(vendedorSelect[0]);
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

export default SelectVendedor;
