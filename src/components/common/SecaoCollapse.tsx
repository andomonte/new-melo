// src/components/common/SecaoCollapse.tsx
import React, { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SecaoCollapseProps {
  titulo: string;
  children: ReactNode;
  icone?: ReactNode;
  padraoAberto?: boolean;
}

export default function SecaoCollapse({
  titulo,
  children,
  icone,
  padraoAberto = true,
}: SecaoCollapseProps) {
  const [aberto, setAberto] = useState(padraoAberto);

  return (
    <div className="bg-white dark:bg-zinc-900 border rounded-lg mb-6">
      <div
        onClick={() => setAberto(!aberto)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
      >
        <div className="flex items-center gap-2">
          {icone && <div className="text-zinc-500 dark:text-zinc-300">{icone}</div>}
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">
            {titulo}
          </h3>
        </div>
        <div className="flex-1 h-px bg-zinc-400 mx-4 group-hover:bg-zinc-300" />
        <ChevronDown
          className={`text-zinc-500 transition-transform duration-300 ${
            aberto ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </div>
      <div
        className={`transition-all duration-300 overflow-hidden ${
          aberto ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
          {children}
        </div>
      </div>
    </div>
  );
}