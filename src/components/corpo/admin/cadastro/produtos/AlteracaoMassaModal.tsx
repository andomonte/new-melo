import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Edit, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlteracaoMassaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Set<string>;
  onSuccess: () => void;
}

interface SelectOption {
  value: string;
  label: string;
}

// Campos alteráveis em massa — mesmo conjunto do Delphi ("Escolha do campo
// para alteração"): Marca, Grupo de Produto, Grupo de Função, custos/preços
// de transferência e mercadoria, Preço de Venda e IPI.
const CAMPOS_DISPONIVEIS = {
  'Dados Cadastrais': [
    { value: 'codmarca', label: 'Marca', tipo: 'select-async', apiEndpoint: '/api/marcas/get' },
    { value: 'codgpp', label: 'Grupo de Produto', tipo: 'select-async', apiEndpoint: '/api/gruposProduto/get' },
    { value: 'codgpf', label: 'Grupo de Função', tipo: 'select-async', apiEndpoint: '/api/gruposFuncao/get' },
  ],
  'Custos e Preços': [
    { value: 'prcompra', label: 'Custo Compra', tipo: 'number' },
    { value: 'prcomprasemst', label: 'Preço de Transferência Líquido', tipo: 'number' },
    { value: 'pratualdesp', label: 'Preço de Transferência Bruto', tipo: 'number' },
    { value: 'prcustoatual', label: 'Custo da Mercadoria', tipo: 'number' },
    { value: 'prvenda', label: 'Preço de Venda', tipo: 'number' },
  ],
  'Dados Fiscais': [
    { value: 'ipi', label: 'IPI', tipo: 'number' },
  ],
};

export const AlteracaoMassaModal: React.FC<AlteracaoMassaModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  onSuccess,
}) => {
  const [campoSelecionado, setCampoSelecionado] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const { toast } = useToast();

  // Encontrar informações do campo selecionado
  const getCampoInfo = () => {
    for (const grupo of Object.values(CAMPOS_DISPONIVEIS)) {
      const campo = grupo.find((c) => c.value === campoSelecionado);
      if (campo) return campo;
    }
    return null;
  };

  const campoInfo = getCampoInfo();

  // Limpar valor quando campo muda
  useEffect(() => {
    setNovoValor('');
  }, [campoSelecionado]);

  // Carregar opções quando o campo selecionado for do tipo select-async
  useEffect(() => {
    const loadSelectOptions = async () => {
      if (!campoInfo || campoInfo.tipo !== 'select-async') {
        setSelectOptions([]);
        return;
      }

      setLoadingOptions(true);
      try {
        const apiEndpoint = (campoInfo as any).apiEndpoint;
        const response = await fetch(`${apiEndpoint}?perPage=1000&page=1`);

        if (!response.ok) {
          throw new Error('Erro ao carregar opções');
        }

        const data = await response.json();

        // Mapear dados baseado no tipo de API
        let options: SelectOption[] = [];

        if (campoInfo.value === 'codmarca') {
          // Marcas: codmarca + descr
          options = data.data.map((item: any) => ({
            value: item.codmarca,
            label: `${item.codmarca} - ${item.descr}`,
          }));
        } else if (campoInfo.value === 'codgpf') {
          // Grupos de Função: codgpf + descr
          options = data.data.map((item: any) => ({
            value: String(item.codgpf),
            label: `${item.codgpf} - ${item.descr}`,
          }));
        } else if (campoInfo.value === 'codgpp') {
          // Grupos de Produto: codgpp + descr
          options = data.data.map((item: any) => ({
            value: item.codgpp,
            label: `${item.codgpp} - ${item.descr}`,
          }));
        } else if (campoInfo.value === 'clasfiscal') {
          // Classificações Fiscais: ncm + descricao
          options = data.data.map((item: any) => ({
            value: item.ncm,
            label: `${item.ncm} - ${item.descricao}`,
          }));
        } else if (campoInfo.value === 'cest') {
          // CEST: cest + descricao
          options = data.data.map((item: any) => ({
            value: item.cest,
            label: `${item.cest} - ${item.descricao}`,
          }));
        }

        setSelectOptions(options);
      } catch (error) {
        console.error('Erro ao carregar opções do select:', error);
        toast({
          title: 'Erro ao carregar opções',
          description: 'Não foi possível carregar as opções do campo.',
          variant: 'destructive',
        });
        setSelectOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadSelectOptions();
  }, [campoSelecionado, campoInfo, toast]);

  const handleAlterar = async () => {
    if (!campoSelecionado) {
      toast({
        title: 'Campo não selecionado',
        description: 'Selecione um campo para alterar.',
        variant: 'destructive',
      });
      return;
    }

    if (novoValor === '') {
      toast({
        title: 'Valor não informado',
        description: 'Informe o novo valor para o campo.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedProducts.size === 0) {
      toast({
        title: 'Nenhum produto selecionado',
        description: 'Selecione pelo menos um produto.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Preparar valor baseado no tipo
      let valorFormatado = novoValor;
      if (campoInfo?.tipo === 'number') {
        valorFormatado = parseFloat(novoValor).toString();
      }

      const response = await fetch('/api/produtos/update-massa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campo: campoSelecionado,
          valor: valorFormatado,
          codprods: Array.from(selectedProducts),
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error || 'Erro ao alterar produtos');
      }

      toast({
        title: 'Alteração realizada com sucesso!',
        description: `${resultado.produtosAtualizados} produto(s) atualizado(s).`,
      });

      // Resetar campos
      setCampoSelecionado('');
      setNovoValor('');

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao alterar produtos:', error);
      toast({
        title: 'Erro ao alterar produtos',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCampoSelecionado('');
      setNovoValor('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Alteração em Massa
          </DialogTitle>
          <DialogDescription>
            Alterar um campo em <strong>{selectedProducts.size}</strong> produto(s) selecionado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seleção de Campo */}
          <div className="space-y-2">
            <Label htmlFor="campo">
              Escolha o campo para alteração <span className="text-red-500">*</span>
            </Label>
            <Select value={campoSelecionado} onValueChange={setCampoSelecionado} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um campo..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.entries(CAMPOS_DISPONIVEIS).map(([grupo, campos]) => (
                  <div key={grupo}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {grupo}
                    </div>
                    {campos.map((campo) => (
                      <SelectItem key={campo.value} value={campo.value}>
                        {campo.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Novo Valor */}
          {campoSelecionado && (
            <div className="space-y-2">
              <Label htmlFor="novoValor">
                Novo Valor <span className="text-red-500">*</span>
              </Label>

              {campoInfo?.tipo === 'select-async' ? (
                // Combobox com busca para dados assíncronos do banco
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                      disabled={loading || loadingOptions}
                    >
                      {novoValor
                        ? selectOptions.find((option) => option.value === novoValor)?.label
                        : loadingOptions
                        ? 'Carregando opções...'
                        : 'Selecione...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Digite para buscar..." />
                      <CommandList>
                        {loadingOptions ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                            <CommandGroup>
                              {selectOptions.map((opcao) => (
                                <CommandItem
                                  key={opcao.value}
                                  value={opcao.label}
                                  onSelect={() => {
                                    setNovoValor(opcao.value);
                                    setComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      novoValor === opcao.value ? 'opacity-100' : 'opacity-0'
                                    )}
                                  />
                                  {opcao.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : campoInfo?.tipo === 'select' && (campoInfo as any).opcoes ? (
                // Select com opções estáticas
                <Select value={novoValor} onValueChange={setNovoValor} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(campoInfo as any).opcoes.map((opcao: any) => {
                      const value = typeof opcao === 'string' ? opcao : opcao.value;
                      const label = typeof opcao === 'string' ? opcao : opcao.label;
                      return (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                // Input de texto ou número
                <Input
                  id="novoValor"
                  type={campoInfo?.tipo === 'number' ? 'number' : 'text'}
                  step={campoInfo?.tipo === 'number' ? '0.01' : undefined}
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder={`Digite o novo valor para ${campoInfo?.label}`}
                  disabled={loading}
                />
              )}
            </div>
          )}

          {/* Aviso */}
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Atenção:</strong> A alteração terá efeito sobre todos os{' '}
              <strong>{selectedProducts.size}</strong> produto(s) selecionado(s). Esta ação não pode
              ser desfeita automaticamente.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleAlterar}
            disabled={loading || !campoSelecionado || novoValor === ''}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando...
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Alterar {selectedProducts.size} Produto(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
