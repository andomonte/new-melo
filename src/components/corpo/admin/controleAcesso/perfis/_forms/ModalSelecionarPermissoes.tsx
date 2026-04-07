import React, { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface PermissaoOption {
  label: string;
  value: string;
}

interface Props {
  permissoes: PermissaoOption[];
  selecionadas: PermissaoOption[];
  onConfirmar: (selecionadas: PermissaoOption[]) => void;
}

export default function ModalSelecionarPermissoes({
  permissoes,
  selecionadas,
  onConfirmar,
}: Props) {
  const [selecionadasLocal, setSelecionadasLocal] = useState<PermissaoOption[]>(
    [],
  );

  useEffect(() => {
    setSelecionadasLocal(selecionadas);
  }, [selecionadas]);

  const togglePermissao = (permissao: PermissaoOption) => {
    const jaSelecionada = selecionadasLocal.some(
      (p) => p.value === permissao.value,
    );
    if (jaSelecionada) {
      setSelecionadasLocal(
        selecionadasLocal.filter((p) => p.value !== permissao.value),
      );
    } else {
      setSelecionadasLocal([...selecionadasLocal, permissao]);
    }
  };

  const selecionarTodas = () => setSelecionadasLocal(permissoes);
  const desmarcarTodas = () => setSelecionadasLocal([]);

  return (
    <div className="flex flex-col h-full pt-2">
      {/* Cabeçalho fixo + botões de ação */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 pb-2">
        <div className="mb-2">
          <h2 className="text-lg text-gray-800 dark:text-white font-semibold">
            Escolha as Permissões
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Selecione as permissões que deseja atribuir ao grupo.
          </p>
        </div>

        <div className="flex justify-between items-center gap-4 mt-2">
          <div className="flex gap-2">
            <Button
              onClick={selecionarTodas}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Selecionar todas
            </Button>
            <Button
              onClick={desmarcarTodas}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Desmarcar todas
            </Button>
          </div>

          <Button
            onClick={() => onConfirmar(selecionadasLocal)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Confirmar
          </Button>
        </div>
      </div>

      {/* Lista de permissões */}
      <ScrollArea className="flex-grow border rounded p-4 bg-zinc-50 dark:bg-zinc-800">
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {permissoes.map((permissao) => (
            <li
              key={permissao.value}
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => togglePermissao(permissao)}
            >
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={selecionadasLocal.some(
                  (p) => p.value === permissao.value,
                )}
                onChange={() => {}}
              />
              <label className="text-base">{permissao.label}</label>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
