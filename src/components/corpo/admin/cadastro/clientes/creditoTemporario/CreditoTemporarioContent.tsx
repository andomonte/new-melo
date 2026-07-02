import React, { useCallback, useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreditoTemp {
  id: number;
  codcli: string;
  nome: string | null;
  data: string;
  datavencimento: string;
  limite: number | string;
  limite_usado: number | string;
  status: string;
}

interface Props {
  /** Quando aberto a partir do Zoom de um cliente, pré-seleciona o cliente no formulário */
  clientePreselecionado?: { codcli: string; nome: string } | null;
}

const brl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtData = (v: string) => {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
};

// yyyy-mm-dd de hoje (para o input date)
const hojeISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

export function CreditoTemporarioContent({ clientePreselecionado }: Props) {
  const { toast } = useToast();
  const [lista, setLista] = useState<CreditoTemp[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Formulário de adicionar
  const [codcli, setCodcli] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [limite, setLimite] = useState('');
  const [datavencimento, setDatavencimento] = useState(hojeISO());
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const fetchLista = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clientes/credito-temporario');
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao listar');
      setLista(await res.json());
    } catch (e) {
      toast({
        title: 'Erro ao carregar',
        description: e instanceof Error ? e.message : 'Falha ao listar créditos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLista();
  }, [fetchLista]);

  // Abre o formulário já com o cliente pré-selecionado (vindo do Zoom)
  useEffect(() => {
    if (clientePreselecionado?.codcli) {
      setCodcli(clientePreselecionado.codcli);
      setNomeCliente(clientePreselecionado.nome || '');
      setShowForm(true);
    }
  }, [clientePreselecionado]);

  const buscarCliente = useCallback(async () => {
    const cod = codcli.trim();
    if (!cod) return;
    setBuscandoCliente(true);
    try {
      const res = await fetch(`/api/clientes/get/${cod}`);
      if (!res.ok) {
        setNomeCliente('');
        toast({ title: 'Cliente não encontrado', variant: 'destructive' });
        return;
      }
      const data = await res.json();
      setNomeCliente(data.nome || '');
    } catch {
      setNomeCliente('');
    } finally {
      setBuscandoCliente(false);
    }
  }, [codcli, toast]);

  const resetForm = () => {
    setCodcli('');
    setNomeCliente('');
    setLimite('');
    setDatavencimento(hojeISO());
    setShowForm(false);
  };

  const handleAdicionar = async () => {
    if (!codcli.trim()) {
      toast({ title: 'Informe o cliente', variant: 'destructive' });
      return;
    }
    if (!Number(limite) || Number(limite) <= 0) {
      toast({ title: 'Adicione um limite válido', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/clientes/credito-temporario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codcli: codcli.trim(),
          limite: Number(limite),
          datavencimento,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar');
      toast({ title: 'Crédito temporário cadastrado com sucesso.' });
      resetForm();
      fetchLista();
    } catch (e) {
      toast({
        title: 'Não foi possível adicionar',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (item: CreditoTemp) => {
    if (!window.confirm(`Remover o crédito temporário do cliente ${item.codcli}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/clientes/credito-temporario/${item.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      toast({ title: 'Crédito temporário removido com sucesso.' });
      fetchLista();
    } catch (e) {
      toast({
        title: 'Não foi possível remover',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {loading ? 'Carregando...' : `${lista.length} crédito(s) ativo(s)`}
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Formulário de adicionar */}
      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Adicionar Crédito Temporário</h4>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Fechar formulário"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label>Cliente (código)</Label>
              <div className="flex gap-1">
                <Input
                  value={codcli}
                  onChange={(e) => setCodcli(e.target.value.replace(/\D/g, ''))}
                  onBlur={buscarCliente}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') buscarCliente();
                  }}
                  placeholder="Código"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={buscarCliente}
                  disabled={buscandoCliente}
                >
                  {buscandoCliente ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="md:col-span-1">
              <Label>Nome</Label>
              <Input value={nomeCliente} readOnly className="bg-gray-100 dark:bg-zinc-800" />
            </div>
            <div>
              <Label>Limite (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={datavencimento}
                min={hojeISO()}
                onChange={(e) => setDatavencimento(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={resetForm}>
              Voltar
            </Button>
            <Button size="sm" onClick={handleAdicionar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Limite</TableHead>
              <TableHead className="text-right">Limite Usado</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin inline text-blue-600" />
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum crédito temporário ativo
                </TableCell>
              </TableRow>
            ) : (
              lista.map((item) => {
                const disp = Number(item.limite || 0) - Number(item.limite_usado || 0);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.codcli}</TableCell>
                    <TableCell>{item.nome || '-'}</TableCell>
                    <TableCell>{fmtData(item.data)}</TableCell>
                    <TableCell>{fmtData(item.datavencimento)}</TableCell>
                    <TableCell className="text-right">R$ {brl(item.limite)}</TableCell>
                    <TableCell className="text-right">R$ {brl(item.limite_usado)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      R$ {brl(disp)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemover(item)}
                        title="Remover"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default CreditoTemporarioContent;
