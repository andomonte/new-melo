/**
 * Secao de resumo com badges de status
 */

import React from 'react';
import { ResumoItens, STATUS_CONFIG } from '../constants';

interface ResumoSectionProps {
  resumo: ResumoItens;
}

const ResumoSection: React.FC<ResumoSectionProps> = ({ resumo }) => {
  return (
    <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-700/50 border-b border-gray-200 dark:border-zinc-700">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="font-medium">Resumo:</span>
        <span className={STATUS_CONFIG.OK.color + ' px-2 py-0.5 rounded'}>
          {resumo.ok} OK
        </span>
        <span className={STATUS_CONFIG.FALTA.color + ' px-2 py-0.5 rounded'}>
          {resumo.falta} Falta
        </span>
        <span className={STATUS_CONFIG.EXCESSO.color + ' px-2 py-0.5 rounded'}>
          {resumo.excesso} Excesso
        </span>
        <span className={STATUS_CONFIG.DANIFICADO.color + ' px-2 py-0.5 rounded'}>
          {resumo.danificado} Danificado
        </span>
        <span className={STATUS_CONFIG.ERRADO.color + ' px-2 py-0.5 rounded'}>
          {resumo.errado} Errado
        </span>
        <span className={STATUS_CONFIG.PENDENTE.color + ' px-2 py-0.5 rounded'}>
          {resumo.pendente} Pendente
        </span>
      </div>
    </div>
  );
};

export default ResumoSection;
