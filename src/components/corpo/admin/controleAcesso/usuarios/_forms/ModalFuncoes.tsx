import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

export interface Funcao {
  id_functions: number;
  descricao: string;
  usadoEm?: string | null;
  sigla?: string | null;
}

interface ModalFuncoesProps {
  isOpen: boolean;
  onClose: () => void;
  funcoes: Funcao[];
  selecionadas?: Funcao[]; // Pode ser undefined
  onConfirmar: (selecionadas: Funcao[]) => void;
  funcoesFiltradas: Funcao[];
}

export default function ModalFuncoes({
  isOpen,
  onClose,
  selecionadas = [],
  onConfirmar,
  funcoesFiltradas,
}: ModalFuncoesProps) {
  const [selecionadasLocal, setSelecionadasLocal] = useState<Funcao[]>([]);
  const [filtroUsadoEm, setFiltroUsadoEm] = useState<string>('todos');

  const toggleFuncao = (funcao: Funcao) => {
    const jaSelecionada = selecionadasLocal.some(
      (f) => f.id_functions === funcao.id_functions,
    );

    if (jaSelecionada) {
      setSelecionadasLocal(
        selecionadasLocal.filter((f) => f.id_functions !== funcao.id_functions),
      );
    } else {
      setSelecionadasLocal([...selecionadasLocal, funcao]);
    }
  };
  useEffect(() => {
    if (isOpen) {
      setSelecionadasLocal(selecionadas ?? []); // zera para o perfil atual
    }
  }, [isOpen, selecionadas]);
  const selecionarTodasFiltradas = () => {
    setSelecionadasLocal((prev) => {
      const novasSelecionadas = [...prev];

      funcoesFiltradas.forEach((funcao) => {
        if (
          !novasSelecionadas.some((f) => f.id_functions === funcao.id_functions)
        ) {
          novasSelecionadas.push(funcao);
        }
      });

      return novasSelecionadas;
    });
  };

  const desmarcarTodasFiltradas = () => {
    setSelecionadasLocal((prev) =>
      prev.filter(
        (f) =>
          !funcoesFiltradas.some(
            (filtrada) => f.id_functions === filtrada.id_functions,
          ),
      ),
    );
  };

  const todasSelecionadasFiltradas = funcoesFiltradas.every((funcaoFiltrada) =>
    selecionadasLocal.some(
      (selecionada) => selecionada.id_functions === funcaoFiltrada.id_functions,
    ),
  );

  const valoresUsadoEm = [
    'todos',
    ...Array.from(
      new Set(funcoesFiltradas.map((f) => String(f.usadoEm) || '-')),
    ).sort(),
  ];

  return (
    <div
      className={`h-full w-full fixed inset-0 bg-black/50 flex justify-center items-center px-4 ${
        !isOpen ? 'hidden' : ''
      }`}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[100%] h-[90%] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300">
            Funções
          </h2>
          <button className="text-red-500 hover:text-red-600" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {/* Filtro e Botão Confirmar */}

        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 flex gap-2 justify-between items-center">
          <Select
            value={filtroUsadoEm}
            onValueChange={(value) => setFiltroUsadoEm(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por 'Usado Em'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {valoresUsadoEm.map((valor) => (
                <SelectItem key={valor} value={valor}>
                  {valor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => onConfirmar(selecionadasLocal)}>
            {/* Alterado aqui para incluir a contagem */}
            Confirmar Seleção ({selecionadasLocal.length})
          </Button>
        </div>

        {/* Grid com Scroll */}
        <div className="w-full h-[90%] overflow-y-auto p-4">
          <table className="w-full text-sm text-left">
            <thead className=" bg-zinc-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-400 sticky top-0 z-10">
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
                <th className="px-4 py-2 w-1/4">Sigla</th>
                <th className="px-4 py-2 w-1/4">Usado Em</th>
              </tr>
            </thead>

            <tbody>
              {funcoesFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    Nenhuma função encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                funcoesFiltradas.map((funcao) => {
                  const isChecked = selecionadasLocal.some(
                    (f) => f.id_functions === funcao.id_functions,
                  );

                  return (
                    <tr
                      key={funcao.id_functions}
                      className="hover:bg-zinc-200 dark:hover:bg-zinc-600 cursor-pointer"
                      onClick={() => toggleFuncao(funcao)}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleFuncao(funcao)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="ml-2">{funcao.descricao}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">{funcao.sigla ?? '-'}</td>
                      <td className="px-4 py-2">{funcao.usadoEm ?? '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
