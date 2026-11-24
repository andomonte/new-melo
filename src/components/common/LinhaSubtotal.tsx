import React from 'react';

/**
 * Linha de SUBTOTAL das tabelas de Contas a Pagar / Contas a Receber.
 * Soma, nas linhas VISÍVEIS (depois dos filtros), as colunas que a tela anexou em cada linha
 * como `(linha as any)._valores = { 'Valor Total': 123.45, ... }` (chave = nome da coluna).
 * Fica presa no rodapé da área rolável. Sem `_valores` nas linhas, não aparece.
 */
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function LinhaSubtotal({ linhas, colunas, totalFiltro }: {
  linhas: any[];
  colunas: string[];
  /** Soma de TODOS os registros do filtro, vinda do servidor (tabelas paginadas no servidor).
   *  Mostrada numa 2ª linha quando o filtro tem mais registros do que a página. */
  totalFiltro?: ({ qtd: number } & Record<string, number>) | null;
}) {
  const somas: Record<string, number> = {};
  let tem = false;
  for (const l of linhas) {
    const v = l?._valores;
    if (!v) continue;
    tem = true;
    for (const k of Object.keys(v)) somas[k] = (somas[k] || 0) + (Number(v[k]) || 0);
  }
  if (!tem || linhas.length === 0) return null;

  // rótulo ocupa as colunas antes da primeira coluna somada
  const primeiraSoma = colunas.findIndex((c) => c in somas);
  const span = primeiraSoma > 0 ? primeiraSoma : 1;
  const cel = 'sticky bottom-0 z-10 px-2 py-1.5 text-xs font-semibold whitespace-nowrap bg-blue-50 dark:bg-zinc-800 border-t-2 border-blue-300 dark:border-blue-800 text-gray-900 dark:text-gray-100';

  const mostrarTotal = !!totalFiltro && Number(totalFiltro.qtd) > linhas.length;
  const qtd = (n: number) => `${n} ${n === 1 ? 'registro' : 'registros'}`;
  // com a 2ª linha, a 1ª sobe a altura de uma linha para as duas ficarem presas no rodapé
  const celSub = mostrarTotal ? cel.replace('bottom-0', 'bottom-[30px]') : cel;
  const celTot = cel.replace('bg-blue-50', 'bg-blue-100').replace('border-t-2', 'border-t');

  return (
    <>
      <tr>
        <td colSpan={span} className={`${celSub} text-right`}>
          Subtotal ({qtd(linhas.length)} na tela)
        </td>
        {colunas.slice(span).map((c) => (
          <td key={c} className={`${celSub} text-center font-mono`}>
            {c in somas ? brl(Math.round(somas[c] * 100) / 100) : ''}
          </td>
        ))}
      </tr>
      {mostrarTotal && (
        <tr>
          <td colSpan={span} className={`${celTot} text-right`}>
            Total do filtro ({qtd(Number(totalFiltro!.qtd))})
          </td>
          {colunas.slice(span).map((c) => (
            <td key={c} className={`${celTot} text-center font-mono`}>
              {c in somas && c in totalFiltro! ? brl(Math.round(Number(totalFiltro![c]) * 100) / 100) : ''}
            </td>
          ))}
        </tr>
      )}
    </>
  );
}
