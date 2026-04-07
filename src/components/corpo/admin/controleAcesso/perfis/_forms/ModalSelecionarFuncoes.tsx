import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

interface FuncaoOption {
  label: string; // Descrição
  value: number; // ID
  sigla: string;
  usadoEm?: string; // Opcional
}

interface Props {
  funcoes: FuncaoOption[];
  selecionadas: FuncaoOption[];
  onConfirmar: (selecionadas: FuncaoOption[]) => void;
}

export default function ModalSelecionarFuncoes({
  funcoes,
  selecionadas,
  onConfirmar,
}: Props) {
  const [selecionadasLocal, setSelecionadasLocal] = useState<FuncaoOption[]>(
    [],
  );
  const [filtroUsadoEm, setFiltroUsadoEm] = useState<string>('todos');
  const [funcoesFiltradas, setFuncoesFiltradas] = useState<FuncaoOption[]>([]);

  useEffect(() => {
    setSelecionadasLocal(selecionadas);
  }, [selecionadas]);

  useEffect(() => {
    if (filtroUsadoEm === 'todos') {
      setFuncoesFiltradas(funcoes);
    } else {
      setFuncoesFiltradas(funcoes.filter((f) => f.usadoEm === filtroUsadoEm));
    }
  }, [funcoes, filtroUsadoEm]);

  const toggleFuncao = (funcao: FuncaoOption) => {
    const jaSelecionada = selecionadasLocal.some(
      (f) => f.value === funcao.value,
    );
    if (jaSelecionada) {
      setSelecionadasLocal(
        selecionadasLocal.filter((f) => f.value !== funcao.value),
      );
    } else {
      setSelecionadasLocal([...selecionadasLocal, funcao]);
    }
  };

  const selecionarTodasFiltradas = () => {
    setSelecionadasLocal((prevSelecionadas) => {
      const novasSelecionadas = [...prevSelecionadas];
      funcoesFiltradas.forEach((funcao) => {
        if (!novasSelecionadas.some((f) => f.value === funcao.value)) {
          novasSelecionadas.push(funcao);
        }
      });
      return novasSelecionadas;
    });
  };

  const desmarcarTodasFiltradas = () => {
    setSelecionadasLocal((prevSelecionadas) =>
      prevSelecionadas.filter(
        (f) => !funcoesFiltradas.some((filtrada) => f.value === filtrada.value),
      ),
    );
  };

  const todasSelecionadasFiltradas = funcoesFiltradas.every((funcaoFiltrada) =>
    selecionadasLocal.some(
      (selecionada) => selecionada.value === funcaoFiltrada.value,
    ),
  );

  const valoresUsadoEm = [
    'todos',
    ...Array.from(
      new Set(funcoes.map((f) => f.usadoEm).filter(Boolean)),
    ).sort(),
  ];

  const alturaFixaGrid = '300px'; // Defina a altura desejada para o grid de funções

  return (
    <div className="flex flex-col h-full pt-2">
      <div className="sticky top-0 z-10 text-zinc-800 dark:text-zinc-100 bg-white  dark:bg-zinc-900 pb-2">
        <div className="flex rounded-md shadow-sm overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-2">
          <div className="relative flex-grow">
            <Select value={filtroUsadoEm} onValueChange={setFiltroUsadoEm}>
              <SelectTrigger className="w-full rounded-none first:rounded-l-md last:rounded-r-md">
                {valoresUsadoEm.find((valor) => valor === filtroUsadoEm) ||
                  'Todos'}
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="todos" value="todos">
                  Todos
                </SelectItem>
                {Array.from(
                  new Set(funcoes.map((f) => f.usadoEm).filter(Boolean)),
                )
                  .sort()
                  .map((valor) => (
                    <SelectItem key={valor} value={valor as string}>
                      {valor}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => onConfirmar(selecionadasLocal)}
            className="rounded-none first:rounded-l-md last:rounded-r-md"
          >
            Confirmar
          </Button>
        </div>
      </div>

      <div
        className="rounded-md border border-zinc-200 dark:border-zinc-700 mt-2 overflow-y-auto"
        style={{ height: alturaFixaGrid, maxHeight: alturaFixaGrid }}
      >
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 w-1/2">
                <div className="flex items-center">
                  <Checkbox
                    checked={todasSelecionadasFiltradas}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selecionarTodasFiltradas();
                      } else {
                        desmarcarTodasFiltradas();
                      }
                    }}
                  />
                  <span className="ml-2 font-semibold">Descrição</span>
                </div>
              </th>
              <th className="px-4 py-2 w-1/4 font-semibold">Sigla</th>
              <th className="px-4 py-2 w-1/4 font-semibold">Usado Em</th>
            </tr>
          </thead>
          <tbody>
            {funcoesFiltradas.map((funcao) => (
              <tr
                key={funcao.value}
                className="dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-600 cursor-pointer"
                onClick={() => toggleFuncao(funcao)}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center">
                    <Checkbox
                      checked={selecionadasLocal.some(
                        (f) => f.value === funcao.value,
                      )}
                      onCheckedChange={() => toggleFuncao(funcao)}
                    />
                    <span className="ml-2">{funcao.label}</span>
                  </div>
                </td>
                <td className="px-4 py-2">{funcao.sigla}</td>
                <td className="px-4 py-2">{funcao.usadoEm || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
