import React from 'react';
import NotasConhecimento from '@/components/corpo/notas-conhecimento/NotasConhecimento';


export default function PageSidebar() {
  return (
    <div className="h-full flex w-full flex-col bg-muted/40 text-black dark:text-gray-50">
      {/* inicio da tela desktop */}
      <div className="border-b border-l border-r border-gray-300 h-full w-[100%]">
        <div className="w-[100%] h-full border-t border-gray-300 dark:bg-slate-900 bg-white overflow-auto">
          <NotasConhecimento />
        </div>
      </div>
    </div>
  );
}
