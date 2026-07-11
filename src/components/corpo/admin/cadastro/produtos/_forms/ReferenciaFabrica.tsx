import React, { useState, useEffect } from 'react';
import { Produto } from '@/data/produtos/produtos';
import { Label } from '@/components/ui/label';
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
import { Trash2, Plus, ChevronsUpDown, Loader2 } from 'lucide-react';

export interface ReferenciaItem {
  id?: string;
  cod_id?: number;
  referencia: string;
  codmarca?: string;
  codcredor?: string;
  marca_nome?: string;
}

interface ReferenciaFabricaProps {
  produto: Produto;
  handleProdutoChange: (produto: Produto) => void;
  error?: { [p: string]: string };
}

const ReferenciaFabrica: React.FC<ReferenciaFabricaProps> = ({
  produto,
  handleProdutoChange,
  error,
}) => {
  const [referencias, setReferencias] = useState<ReferenciaItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Busca de referências (igual ao popup do Delphi)
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const [resultados, setResultados] = useState<ReferenciaItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [refSelecionada, setRefSelecionada] = useState<ReferenciaItem | null>(
    null,
  );

  // ---- NOVA referência (botão "NOVO", equivalente ao Delphi) ----
  const [novoAberto, setNovoAberto] = useState(false);
  const [novaReferencia, setNovaReferencia] = useState('');
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState('');
  // busca de marca para a nova referência
  const [marcaSel, setMarcaSel] = useState<{ codmarca: string; descr: string } | null>(null);
  const [marcaOpen, setMarcaOpen] = useState(false);
  const [marcaQuery, setMarcaQuery] = useState('');
  const [debouncedMarca] = useDebounce(marcaQuery, 300);
  const [marcaResultados, setMarcaResultados] = useState<{ codmarca: string; descr: string }[]>([]);
  // busca de fornecedor (credor) — obrigatório, como no Delphi
  const [fornecedorSel, setFornecedorSel] = useState<{ cod_credor: string; nome: string; cpf_cgc?: string } | null>(null);
  const [fornOpen, setFornOpen] = useState(false);
  const [fornQuery, setFornQuery] = useState('');
  const [debouncedForn] = useDebounce(fornQuery, 300);
  const [fornResultados, setFornResultados] = useState<{ cod_credor: string; nome: string; nome_fant?: string; cpf_cgc?: string }[]>([]);

  useEffect(() => {
    if (!marcaOpen) return;
    let ativo = true;
    fetch(`/api/marcas/get?perPage=30&search=${encodeURIComponent(debouncedMarca)}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => {
        if (ativo) setMarcaResultados(data.data || data.rows || []);
      })
      .catch(() => ativo && setMarcaResultados([]));
    return () => {
      ativo = false;
    };
  }, [debouncedMarca, marcaOpen]);

  useEffect(() => {
    if (!fornOpen) return;
    let ativo = true;
    fetch(`/api/fornecedores/get?perPage=30&search=${encodeURIComponent(debouncedForn)}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => {
        if (ativo) setFornResultados(data.data || data.rows || []);
      })
      .catch(() => ativo && setFornResultados([]));
    return () => {
      ativo = false;
    };
  }, [debouncedForn, fornOpen]);

  // Abre o formulário "Novo" já com a marca do produto pré-preenchida
  // (como o Delphi, que traz a marca selecionada nos dados do produto).
  const abrirNovo = () => {
    setErroNovo('');
    setNovoAberto((v) => !v);
    if (produto.codmarca && !marcaSel) {
      const cod = String(produto.codmarca).trim();
      setMarcaSel({ codmarca: cod, descr: '' });
      // busca a descrição da marca para exibir "cod - NOME"
      fetch(`/api/marcas/get?perPage=5&search=${encodeURIComponent(cod)}`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((data) => {
          const lista = data.data || data.rows || [];
          const achou = lista.find((m: any) => String(m.codmarca).trim() === cod);
          if (achou) setMarcaSel({ codmarca: cod, descr: achou.descr || '' });
        })
        .catch(() => {});
    }
  };

  const criarNovaReferencia = async () => {
    setErroNovo('');
    const ref = novaReferencia.trim();
    if (!ref) {
      setErroNovo('Informe a referência.');
      return;
    }
    if (!marcaSel) {
      setErroNovo('Selecione a marca.');
      return;
    }
    if (!fornecedorSel) {
      setErroNovo('Selecione o fornecedor.');
      return;
    }
    setCriandoNovo(true);
    try {
      const resp = await fetch('/api/produtos/ref-fabrica-novo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: ref,
          codmarca: marcaSel.codmarca,
          codcredor: fornecedorSel.cod_credor,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErroNovo(data.error || 'Falha ao criar referência.');
        return;
      }
      const nova: ReferenciaItem = {
        cod_id: data.referencia.cod_id,
        referencia: data.referencia.referencia,
        codmarca: data.referencia.codmarca || '',
        codcredor: data.referencia.codcredor || '',
        marca_nome: data.referencia.marca_nome || marcaSel.descr || '',
      };
      // não duplica se já estiver na lista
      if (!referencias.some((r) => r.cod_id === nova.cod_id)) {
        const novasRefs = [...referencias, nova];
        setReferencias(novasRefs);
        handleProdutoChange({ ...produto, referenciasFabrica: novasRefs });
      }
      // limpa o formulário do NOVO
      setNovaReferencia('');
      setMarcaSel(null);
      setMarcaQuery('');
      setFornecedorSel(null);
      setFornQuery('');
      setNovoAberto(false);
    } catch (e: any) {
      setErroNovo('Erro ao criar referência.');
    } finally {
      setCriandoNovo(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    setBuscando(true);
    fetch(`/api/produtos/ref-fabrica-search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => (r.ok ? r.json() : { referencias: [] }))
      .then((data) => {
        if (ativo) setResultados(data.referencias || []);
      })
      .catch(() => ativo && setResultados([]))
      .finally(() => ativo && setBuscando(false));
    return () => {
      ativo = false;
    };
  }, [debouncedQuery, open]);

  // Carregar referências do banco ao editar produto existente
  useEffect(() => {
    if (produto.codprod && produto.codprod !== '') {
      setCarregando(true);
      fetch(`/api/produtos/ref-fabrica?codprod=${produto.codprod}`)
        .then((r) => r.ok ? r.json() : { referencias: [] })
        .then((data) => {
          const refs = (data.referencias || []).map((r: any) => ({
            cod_id: r.cod_id,
            referencia: r.referencia || '',
            codmarca: r.codmarca || '',
            codcredor: r.codcredor || '',
            marca_nome: r.marca_nome || r.codmarca || '',
          }));
          setReferencias(refs);
          // Sincroniza com o produto pai
          handleProdutoChange({ ...produto, referenciasFabrica: refs });
        })
        .catch(() => setReferencias([]))
        .finally(() => setCarregando(false));
    } else {
      // Novo produto — usa as referências que já estão no produto (se houver)
      setReferencias(produto.referenciasFabrica || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto.codprod]);

  const adicionarReferencia = () => {
    if (!refSelecionada) return;
    // não duplica a mesma referência
    if (referencias.some((r) => r.cod_id === refSelecionada.cod_id)) {
      setRefSelecionada(null);
      return;
    }
    const novaRef: ReferenciaItem = {
      id: Date.now().toString(),
      cod_id: refSelecionada.cod_id,
      referencia: refSelecionada.referencia,
      codmarca: refSelecionada.codmarca || '',
      codcredor: refSelecionada.codcredor || '',
      marca_nome: refSelecionada.marca_nome || '',
    };
    const novasRefs = [...referencias, novaRef];
    setReferencias(novasRefs);
    handleProdutoChange({ ...produto, referenciasFabrica: novasRefs });
    setRefSelecionada(null);
    setQuery('');
  };

  const removerReferencia = (index: number) => {
    const novasRefs = referencias.filter((_, i) => i !== index);
    setReferencias(novasRefs);
    handleProdutoChange({ ...produto, referenciasFabrica: novasRefs });
  };

  return (
    <div className="form-compact space-y-4">
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2 border-b pb-2">
        Referências de Fábrica
      </h3>

      {/* Campos para adicionar nova referência */}
      <div className="grid grid-cols-4 gap-3 items-end">
        <div className="col-span-3">
          <Label>Referência</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {refSelecionada
                  ? `${refSelecionada.referencia}${
                      refSelecionada.codmarca
                        ? ' — ' +
                          refSelecionada.codmarca +
                          (refSelecionada.marca_nome
                            ? ' ' + refSelecionada.marca_nome
                            : '')
                        : ''
                    }`
                  : 'Buscar referência...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Digite a referência..."
                  value={query}
                  onValueChange={setQuery}
                />
                <CommandList>
                  {buscando && (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Buscando...
                    </div>
                  )}
                  {!buscando && resultados.length === 0 && (
                    <CommandEmpty>Nenhuma referência encontrada.</CommandEmpty>
                  )}
                  {!buscando && (
                    <CommandGroup>
                      {resultados.map((r) => (
                        <CommandItem
                          key={r.cod_id}
                          value={String(r.cod_id)}
                          onSelect={() => {
                            setRefSelecionada(r);
                            setOpen(false);
                          }}
                        >
                          <span className="font-medium">{r.referencia}</span>
                          {r.codmarca && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {r.codmarca}
                              {r.marca_nome ? ` - ${r.marca_nome}` : ''}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={adicionarReferencia}
            disabled={!refSelecionada}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-xs rounded transition-colors h-[38px]"
          >
            <Plus size={14} />
            Adicionar
          </button>
          <button
            type="button"
            onClick={abrirNovo}
            title="Cadastrar uma referência que não existe (como o NOVO do Delphi)"
            className="flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors h-[38px]"
          >
            <Plus size={14} />
            Novo
          </button>
        </div>
      </div>

      {/* Formulário do NOVO: cria uma referência inexistente */}
      {novoAberto && (
        <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 space-y-3">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Nova referência de fábrica
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Referência *</Label>
              <input
                type="text"
                value={novaReferencia}
                onChange={(e) => setNovaReferencia(e.target.value)}
                placeholder="Ex.: F000BL07TAB15"
                className="w-full h-[38px] px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <Label>Marca *</Label>
              <Popover open={marcaOpen} onOpenChange={setMarcaOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={marcaOpen}
                    className="w-full justify-between font-normal h-[38px]"
                  >
                    {marcaSel
                      ? `${marcaSel.codmarca} - ${marcaSel.descr}`
                      : 'Buscar marca...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite a marca..."
                      value={marcaQuery}
                      onValueChange={setMarcaQuery}
                    />
                    <CommandList>
                      {marcaResultados.length === 0 && (
                        <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                      )}
                      <CommandGroup>
                        {marcaResultados.map((m) => (
                          <CommandItem
                            key={m.codmarca}
                            value={m.codmarca}
                            onSelect={() => {
                              setMarcaSel({ codmarca: m.codmarca, descr: m.descr });
                              setMarcaOpen(false);
                            }}
                          >
                            <span className="font-medium">{m.codmarca}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {m.descr}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2">
              <Label>Fornecedor *</Label>
              <Popover open={fornOpen} onOpenChange={setFornOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={fornOpen}
                    className="w-full justify-between font-normal h-[38px]"
                  >
                    {fornecedorSel
                      ? `${fornecedorSel.cod_credor} - ${fornecedorSel.nome}${
                          fornecedorSel.cpf_cgc ? ` (${fornecedorSel.cpf_cgc})` : ''
                        }`
                      : 'Buscar fornecedor...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite o fornecedor (código, nome ou CNPJ)..."
                      value={fornQuery}
                      onValueChange={setFornQuery}
                    />
                    <CommandList>
                      {fornResultados.length === 0 && (
                        <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                      )}
                      <CommandGroup>
                        {fornResultados.map((f) => (
                          <CommandItem
                            key={f.cod_credor}
                            value={f.cod_credor}
                            onSelect={() => {
                              setFornecedorSel({
                                cod_credor: String(f.cod_credor).trim(),
                                nome: f.nome || f.nome_fant || '',
                                cpf_cgc: f.cpf_cgc || '',
                              });
                              setFornOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <div>
                                <span className="font-medium">{f.cod_credor}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {f.nome || f.nome_fant || ''}
                                </span>
                              </div>
                              {f.cpf_cgc && (
                                <span className="text-[11px] text-muted-foreground">
                                  CNPJ/CPF: {f.cpf_cgc}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {erroNovo && <span className="text-red-500 text-xs">{erroNovo}</span>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNovoAberto(false);
                setErroNovo('');
              }}
              className="px-3 py-2 text-xs rounded border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={criarNovaReferencia}
              disabled={criandoNovo}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs rounded"
            >
              {criandoNovo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Criar e adicionar
            </button>
          </div>
        </div>
      )}

      {error?.referencia && (
        <span className="text-red-500 text-xs">{error.referencia}</span>
      )}

      {/* Tabela de referências */}
      <div className="border border-gray-200 dark:border-zinc-700 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                Código
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                Referência
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">
                Marca
              </th>
              <th className="px-3 py-2 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase w-20">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
            {carregando ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  Carregando referências...
                </td>
              </tr>
            ) : referencias.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  Nenhuma referência cadastrada
                </td>
              </tr>
            ) : (
              referencias.map((ref, index) => (
                <tr key={ref.cod_id || ref.id || index} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                  <td className="px-3 py-2">{ref.cod_id ?? '-'}</td>
                  <td className="px-3 py-2">{ref.referencia}</td>
                  <td className="px-3 py-2">
                    {ref.codmarca
                      ? `${ref.codmarca}${ref.marca_nome ? ' - ' + ref.marca_nome : ''}`
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removerReferencia(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="Remover referência"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        {referencias.length} referência{referencias.length !== 1 ? 's' : ''} cadastrada{referencias.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default ReferenciaFabrica;
