import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

interface PermissoesPorTela {
  cadastrar: boolean;
  editar: boolean;
  remover: boolean;
  exportar: boolean;
}

interface TelaPermissao {
  tela: {
    label: string;
    value: number;
  };
  permissoes: PermissoesPorTela;
  ativa: boolean;
}

interface Props {
  telas: { label: string; value: number }[];
  selecionadas: TelaPermissao[];
  onConfirmar: (selecionadas: TelaPermissao[]) => void;
}

export default function ModalSelecionarTelas({
  telas,
  selecionadas,
  onConfirmar,
}: Props) {
  const [selecionadasLocal, setSelecionadasLocal] = useState<TelaPermissao[]>(
    [],
  );
  const [filtroNomeInicial, setFiltroNomeInicial] = useState<string>('Todas');
  const [opcoesFiltro, setOpcoesFiltro] = useState<string[]>(['Todas']);
  const [telasFiltradas, setTelasFiltradas] = useState<TelaPermissao[]>([]);

  useEffect(() => {
    const inicial: TelaPermissao[] = telas.map((tela) => {
      const encontrada = selecionadas.find((s) => s.tela.value === tela.value);
      return {
        tela: tela,
        permissoes: encontrada?.permissoes || {
          cadastrar: false,
          editar: false,
          remover: false,
          exportar: false,
        },
        ativa: !!encontrada,
      };
    });
    setSelecionadasLocal(inicial);
  }, [telas, selecionadas]);

  useEffect(() => {
    const primeirosNomes = Array.from(
      new Set(selecionadasLocal.map((item) => item.tela.label.split(' ')[0])),
    ).sort();
    setOpcoesFiltro(['Todas', ...primeirosNomes]);
  }, [selecionadasLocal]);

  useEffect(() => {
    if (filtroNomeInicial === 'Todas') {
      setTelasFiltradas(selecionadasLocal);
    } else {
      setTelasFiltradas(
        selecionadasLocal.filter((item) =>
          item.tela.label.startsWith(filtroNomeInicial),
        ),
      );
    }
  }, [filtroNomeInicial, selecionadasLocal]);

  const toggleTelaAtiva = (index: number) => {
    setSelecionadasLocal((prev) => {
      const nova = [...prev];
      const ativa = !nova[index].ativa;
      nova[index] = {
        ...nova[index],
        ativa,
        permissoes: ativa
          ? { cadastrar: true, editar: true, remover: true, exportar: true }
          : {
              cadastrar: false,
              editar: false,
              remover: false,
              exportar: false,
            },
      };
      return nova;
    });
  };

  const togglePermissao = (index: number, tipo: keyof PermissoesPorTela) => {
    const novaLista = [...selecionadasLocal];
    novaLista[index].permissoes[tipo] = !novaLista[index].permissoes[tipo];
    setSelecionadasLocal(novaLista);
  };

  const toggleTodosPorPermissao = (tipo: keyof PermissoesPorTela) => {
    const marcar = !telasFiltradas.every((item) => item.permissoes[tipo]);
    setSelecionadasLocal((prev) =>
      prev.map((item) =>
        telasFiltradas.includes(item)
          ? {
              ...item,
              permissoes: {
                ...item.permissoes,
                [tipo]: item.ativa ? marcar : false,
              },
            }
          : item,
      ),
    );
  };

  const toggleTodasTelas = () => {
    const todasAtivas = telasFiltradas.every((item) => item.ativa);
    setSelecionadasLocal((prev) =>
      prev.map((item) =>
        telasFiltradas.includes(item)
          ? {
              ...item,
              ativa: !todasAtivas,
              permissoes: {
                cadastrar: !todasAtivas,
                editar: !todasAtivas,
                remover: !todasAtivas,
                exportar: !todasAtivas,
              },
            }
          : item,
      ),
    );
  };

  const todasSelecionadasFiltradas = telasFiltradas.every((item) => item.ativa);
  const todosMarcadosFiltrados = (tipo: keyof PermissoesPorTela) =>
    telasFiltradas.every((item) => item.permissoes[tipo]);

  const alturaFixaGrid = '300px'; // Defina a altura desejada

  return (
    <div className=" flex flex-col h-full pt-2">
      <div className="sticky top-0 z-10  bg-white dark:bg-zinc-900 pb-2">
        <div className="flex rounded-md shadow-sm overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-2">
          <div className="relative flex-grow">
            <Select
              value={filtroNomeInicial}
              onValueChange={setFiltroNomeInicial}
            >
              <SelectTrigger className="w-full rounded-none first:rounded-l-md last:rounded-r-md">
                {opcoesFiltro.find((valor) => valor === filtroNomeInicial) ||
                  'Todas'}
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="Todas" value="Todas">
                  Todas
                </SelectItem>
                {Array.from(
                  new Set(
                    selecionadasLocal.map(
                      (item) => item.tela.label.split(' ')[0],
                    ),
                  ),
                )
                  .sort()
                  .map((primeiroNome) => (
                    <SelectItem key={primeiroNome} value={primeiroNome}>
                      {primeiroNome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() =>
              onConfirmar(selecionadasLocal.filter((item) => item.ativa))
            }
            className="rounded-none first:rounded-l-md last:rounded-r-md"
          >
            Confirmar
          </Button>
        </div>
      </div>

      <div
        className="rounded-md border  border-zinc-200 dark:border-zinc-700 mt-2 overflow-y-auto"
        style={{ height: alturaFixaGrid, maxHeight: alturaFixaGrid }} // Define altura fixa e máxima
      >
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={todasSelecionadasFiltradas}
                    onChange={toggleTodasTelas}
                  />
                  <span className="font-medium">Telas</span>
                </div>
              </th>
              {['cadastrar', 'editar', 'remover', 'exportar'].map((tipo) => (
                <th key={tipo} className="text-center px-2">
                  <div className="flex justify-center items-center gap-1">
                    <input
                      type="checkbox"
                      checked={todosMarcadosFiltrados(
                        tipo as keyof PermissoesPorTela,
                      )}
                      onChange={() =>
                        toggleTodosPorPermissao(tipo as keyof PermissoesPorTela)
                      }
                    />
                    <span className="capitalize">{tipo}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {telasFiltradas.map((item, index) => (
              <tr key={item.tela.value} className="border-b">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.ativa}
                      onChange={() => toggleTelaAtiva(index)}
                    />
                    <span>{item.tela.label}</span>
                  </div>
                </td>
                {(['cadastrar', 'editar', 'remover', 'exportar'] as const).map(
                  (tipo) => (
                    <td key={tipo} className="text-center px-2">
                      <input
                        type="checkbox"
                        checked={item.permissoes[tipo]}
                        onChange={() => togglePermissao(index, tipo)}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
