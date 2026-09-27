import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

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

const TIPOS: (keyof PermissoesPorTela)[] = [
  'cadastrar',
  'editar',
  'remover',
  'exportar',
];

export default function ModalSelecionarTelas({
  telas,
  selecionadas,
  onConfirmar,
}: Props) {
  const [selecionadasLocal, setSelecionadasLocal] = useState<TelaPermissao[]>(
    [],
  );
  const [busca, setBusca] = useState('');
  // Inicializa a lista local UMA vez (quando as telas chegam). Não reinicializa a
  // cada re-render do pai — o `telas`/`selecionadas` vêm de um `.map` inline (nova
  // referência a cada render), e reinicializar apagaria as marcações não confirmadas.
  const inicializado = useRef(false);

  useEffect(() => {
    if (inicializado.current || telas.length === 0) return;
    const inicial: TelaPermissao[] = telas.map((tela) => {
      const encontrada = selecionadas.find((s) => s.tela.value === tela.value);
      return {
        tela,
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
    inicializado.current = true;
  }, [telas, selecionadas]);

  // Filtro por texto livre: casa com QUALQUER parte do nome da tela (case-insensitive).
  const telasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return selecionadasLocal;
    return selecionadasLocal.filter((item) =>
      item.tela.label.toLowerCase().includes(termo),
    );
  }, [busca, selecionadasLocal]);

  // Toggles SEMPRE por `value` (nunca por índice da lista filtrada) — evita que, com um
  // filtro ativo, o clique numa linha marque/desmarque outra tela.
  const toggleTelaAtiva = (value: number) => {
    setSelecionadasLocal((prev) =>
      prev.map((item) => {
        if (item.tela.value !== value) return item;
        const ativa = !item.ativa;
        return {
          ...item,
          ativa,
          permissoes: {
            cadastrar: ativa,
            editar: ativa,
            remover: ativa,
            exportar: ativa,
          },
        };
      }),
    );
  };

  const togglePermissao = (value: number, tipo: keyof PermissoesPorTela) => {
    setSelecionadasLocal((prev) =>
      prev.map((item) =>
        item.tela.value === value
          ? {
              ...item,
              permissoes: {
                ...item.permissoes,
                [tipo]: !item.permissoes[tipo],
              },
            }
          : item,
      ),
    );
  };

  // "Selecionar tudo" opera só sobre as telas VISÍVEIS no filtro atual.
  const valuesFiltrados = useMemo(
    () => new Set(telasFiltradas.map((t) => t.tela.value)),
    [telasFiltradas],
  );

  const toggleTodasTelas = () => {
    const todasAtivas =
      telasFiltradas.length > 0 && telasFiltradas.every((item) => item.ativa);
    const novoAtiva = !todasAtivas;
    setSelecionadasLocal((prev) =>
      prev.map((item) =>
        valuesFiltrados.has(item.tela.value)
          ? {
              ...item,
              ativa: novoAtiva,
              permissoes: {
                cadastrar: novoAtiva,
                editar: novoAtiva,
                remover: novoAtiva,
                exportar: novoAtiva,
              },
            }
          : item,
      ),
    );
  };

  const toggleTodosPorPermissao = (tipo: keyof PermissoesPorTela) => {
    const marcar = !telasFiltradas.every((item) => item.permissoes[tipo]);
    setSelecionadasLocal((prev) =>
      prev.map((item) =>
        valuesFiltrados.has(item.tela.value)
          ? {
              ...item,
              permissoes: {
                ...item.permissoes,
                // só faz sentido marcar a permissão de uma tela ativa
                [tipo]: item.ativa ? marcar : false,
              },
            }
          : item,
      ),
    );
  };

  const totalMarcadas = selecionadasLocal.filter((i) => i.ativa).length;
  const todasSelecionadasFiltradas =
    telasFiltradas.length > 0 && telasFiltradas.every((item) => item.ativa);
  const todosMarcadosFiltrados = (tipo: keyof PermissoesPorTela) =>
    telasFiltradas.length > 0 &&
    telasFiltradas.every((item) => item.permissoes[tipo]);

  const alturaFixaGrid = '360px';

  return (
    <div className="flex flex-col h-full pt-2">
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 pb-2">
        <div className="flex gap-2 items-center">
          <div className="relative flex-grow">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar telas (ex.: conta, caixa, cliente, compra, venda)…"
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-8 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                title="Limpar filtro"
              >
                ✕
              </button>
            )}
          </div>
          <Button onClick={() => onConfirmar(selecionadasLocal.filter((i) => i.ativa))}>
            Confirmar
          </Button>
        </div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {telasFiltradas.length} de {selecionadasLocal.length} tela(s)
          {busca ? ' no filtro' : ''} · {totalMarcadas} marcada(s)
        </div>
      </div>

      <div
        className="rounded-md border border-zinc-200 dark:border-zinc-700 mt-2 overflow-y-auto"
        style={{ height: alturaFixaGrid, maxHeight: alturaFixaGrid }}
      >
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 z-10">
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
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
              {TIPOS.map((tipo) => (
                <th key={tipo} className="text-center px-2">
                  <div className="flex justify-center items-center gap-1">
                    <input
                      type="checkbox"
                      checked={todosMarcadosFiltrados(tipo)}
                      onChange={() => toggleTodosPorPermissao(tipo)}
                    />
                    <span className="capitalize">{tipo}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {telasFiltradas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-2 py-6 text-center text-zinc-400"
                >
                  Nenhuma tela encontrada para “{busca}”.
                </td>
              </tr>
            ) : (
              telasFiltradas.map((item) => (
                <tr
                  key={item.tela.value}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.ativa}
                        onChange={() => toggleTelaAtiva(item.tela.value)}
                      />
                      <span>{item.tela.label}</span>
                    </div>
                  </td>
                  {TIPOS.map((tipo) => (
                    <td key={tipo} className="text-center px-2">
                      <input
                        type="checkbox"
                        checked={item.permissoes[tipo]}
                        disabled={!item.ativa}
                        onChange={() => togglePermissao(item.tela.value, tipo)}
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
