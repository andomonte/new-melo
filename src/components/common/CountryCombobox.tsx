import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { useDebounce } from 'use-debounce';

interface Country {
  codpais: number;
  descricao: string;
}

interface CountryComboboxProps {
  value?: string | number;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  className?: string;
}

export function CountryCombobox({ value, onChange, disabled, className }: CountryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  
  // Initial load (Brasil default or selected)
  useEffect(() => {
    if(!open && !value) return; 
    // If we have a value but no label, we might want to fetch it, 
    // but for now we'll just fetch list when open or on mount if needed.
    // Let's just fetch on open or query change.
  }, [open, value]);

  useEffect(() => {
    async function fetchCountries() {
        setLoading(true);
        try {
            const res = await fetch(`/api/global/countries?q=${debouncedQuery}`);
            if(res.ok) {
                const data = await res.json();
                setCountries(data);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    
    if (open) {
        fetchCountries();
    }
  }, [debouncedQuery, open]);

  const selectedCountry = countries.find(c => c.codpais.toString() === String(value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          {selectedCountry ? selectedCountry.descricao : (value ? `País ${value}` : "Selecione o país...")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar país..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && <div className="p-4 text-sm text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2"/> Carregando...</div>}
            {!loading && countries.length === 0 && <CommandEmpty>Nenhum país encontrado.</CommandEmpty>}
            {!loading && (
                <CommandGroup>
                {countries.map((country) => (
                    <CommandItem
                    key={country.codpais}
                    value={String(country.codpais)}
                    onSelect={(currentValue) => {
                        // CommandItem usually lowercases the value, so we use the country obj
                        onChange(country.codpais);
                        setOpen(false);
                    }}
                    >
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        String(value) === String(country.codpais) ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {country.descricao}
                    </CommandItem>
                ))}
                </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
