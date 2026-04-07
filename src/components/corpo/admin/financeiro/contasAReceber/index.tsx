import React from 'react';
import ContasAReceber from '@/components/corpo/contas-receber/ContasAReceber';

export default function PageSidebar() {
  return (
    <div className="h-full w-full flex flex-col bg-muted/40 text-black dark:text-gray-50">
      <div className="h-full w-full flex flex-col overflow-hidden">
        <ContasAReceber />
      </div>
    </div>
  );
}
