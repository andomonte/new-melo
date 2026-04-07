import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { Armazem } from '@/data/armazem/armazens';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModalArmazensProps {
  isOpen: boolean;
  onClose: () => void;
  armazensSelecionadosAtuais: Armazem[];
  onConfirmar: (selecionados: Armazem[]) => void;
  armazensDisponiveisFilial: Armazem[];
}

export default function ModalArmazens({
  isOpen,
  onClose,
  armazensSelecionadosAtuais,
  onConfirmar,
  armazensDisponiveisFilial,
}: ModalArmazensProps) {
  const { toast } = useToast();
  const [armazensDisponiveis, setArmazensDisponiveis] = useState<Armazem[]>([]);
  const [armazensSelecionadosLocal, setArmazensSelecionadosLocal] = useState<
    Armazem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroFilial, setFiltroFilial] = useState<string>('todos');

  useEffect(() => {
    if (isOpen) {
      setArmazensDisponiveis(armazensDisponiveisFilial);
      setArmazensSelecionadosLocal(armazensSelecionadosAtuais ?? []);
      setError(null);
      setIsLoading(false);
      setFiltroFilial('todos');
    }
  }, [isOpen, armazensDisponiveisFilial, armazensSelecionadosAtuais]);

  const toggleArmazem = (armazem: Armazem) => {
    const jaSelecionado = armazensSelecionadosLocal.some(
      (a) => a.id_armazem === armazem.id_armazem,
    );

    if (jaSelecionado) {
      setArmazensSelecionadosLocal(
        armazensSelecionadosLocal.filter(
          (a) => a.id_armazem !== armazem.id_armazem,
        ),
      );
    } else {
      setArmazensSelecionadosLocal([...armazensSelecionadosLocal, armazem]);
    }
  };

  const selecionarTodosArmazens = () => {
    setArmazensSelecionadosLocal((prev) => {
      const novasSelecionadas = [...prev];
      armazensFiltrados.forEach((armazem) => {
        if (
          !novasSelecionadas.some((a) => a.id_armazem === armazem.id_armazem)
        ) {
          novasSelecionadas.push(armazem);
        }
      });
      return novasSelecionadas;
    });
  };

  const desmarcarTodosArmazens = () => {
    setArmazensSelecionadosLocal((prev) =>
      prev.filter(
        (a) =>
          !armazensFiltrados.some(
            (filtrado) => a.id_armazem === filtrado.id_armazem,
          ),
      ),
    );
  };

  const handleConfirm = () => {
    if (armazensSelecionadosLocal.length === 0) {
      toast({
        title: 'Seleção Obrigatória',
        description: 'Você deve selecionar pelo menos um armazém.',
        variant: 'destructive',
      });
      return;
    }
    onConfirmar(armazensSelecionadosLocal);
    onClose();
  };

  const valoresFilial = [
    'todos',
    ...Array.from(
      new Set(armazensDisponiveis.map((a) => String(a.filial) || '-')),
    ).sort(),
  ];

  const armazensFiltrados = armazensDisponiveis.filter((armazem) => {
    const matchesFilial =
      filtroFilial === 'todos' ||
      String(armazem.filial) === filtroFilial ||
      (filtroFilial === '-' &&
        (armazem.filial === null || armazem.filial === undefined));
    return matchesFilial;
  });

  const todasSelecionadasFiltradas = armazensFiltrados.every(
    (armazemFiltrado) =>
      armazensSelecionadosLocal.some(
        (selecionado) => selecionado.id_armazem === armazemFiltrado.id_armazem,
      ),
  );

  if (!isOpen) return null;

  return (
    <div className="h-full w-full fixed inset-0 bg-black/50 flex justify-center items-center px-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-[100%] h-[90%] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300">
            Selecionar Armazéns
          </h2>
          <button className="text-red-500 hover:text-red-600" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Filtro e Botão Confirmar */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 flex gap-2 justify-between items-center">
          {/* Esquerda: Apenas o Select, agora com largura máxima */}
          <div className="flex gap-2 w-full">
            {' '}
            {/* Removi max-w-xs para que ocupe a largura total disponível */}
            <Select
              value={filtroFilial}
              onValueChange={(value) => setFiltroFilial(value)}
            >
              <SelectTrigger className="w-full">
                {' '}
                {/* Agora usa a largura total da div pai */}
                <SelectValue placeholder="Filtrar por filial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Filiais</SelectItem>
                {valoresFilial.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {valor === '-' ? 'N/A' : valor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direita: Botão Confirmar */}
          <div className="flex items-center gap-2">
            {error && <span className="text-red-500 text-sm">{error}</span>}
            <Button
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirmar Seleção ({armazensSelecionadosLocal.length})
            </Button>
          </div>
        </div>

        {/* Grid com Scroll */}
        <div className="w-full h-[90%] overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p>Carregando armazéns...</p>
            </div>
          ) : armazensDisponiveis?.length === 0 && !error ? (
            <div className="flex justify-center items-center h-full">
              <p>Nenhum armazém disponível.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-400 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 w-1/2">
                    <div className="flex items-center">
                      <Checkbox
                        checked={todasSelecionadasFiltradas}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selecionarTodosArmazens();
                          } else {
                            desmarcarTodosArmazens();
                          }
                        }}
                      />
                      <span className="ml-2 font-semibold">
                        Nome do Armazém
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-2 w-1/4">Filial</th>
                  <th className="px-4 py-2 w-1/4">Ativo</th>
                </tr>
              </thead>

              <tbody>
                {armazensFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-4 text-center text-gray-500"
                    >
                      Nenhum armazém encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  armazensFiltrados.map((armazem) => {
                    const isChecked = armazensSelecionadosLocal.some(
                      (a) => a.id_armazem === armazem.id_armazem,
                    );

                    return (
                      <tr
                        key={armazem.id_armazem}
                        className="hover:bg-zinc-200 dark:hover:bg-zinc-600 cursor-pointer"
                        onClick={() => toggleArmazem(armazem)}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleArmazem(armazem)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="ml-2">{armazem.nome ?? '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">{armazem.filial ?? '-'}</td>
                        <td className="px-4 py-2">
                          {armazem.ativo ? 'Sim' : 'Não'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
