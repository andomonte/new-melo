import type { NextApiRequest } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial, schemaDaFilial } from '@/lib/estacaoDb';

/**
 * Filial das telas soltas de Recebimento de Entradas (/entrada/recebimento/<codigo>)
 * e Alocação (/alocacao/<codigo>).
 *
 * As telas ficam fora do login do sistema e a filial vem do LINK, igual às estações de
 * Separação/Conferência. O front manda a filial no header `x-filial-recebimento`
 * (recebimento) ou `x-filial-estacao` (alocação) em todas as chamadas. Antes, só o
 * login recebia a filial escolhida e o resto caía no cookie do sistema ou em MANAUS.
 */
export function filialRecebimento(req: NextApiRequest): string {
  const ler = (nome: string) => {
    const h = req.headers[nome];
    return Array.isArray(h) ? h[0] : h;
  };
  const doHeader = ler('x-filial-estacao') || ler('x-filial-recebimento');
  const doBody = (req.body && typeof req.body === 'object' && (req.body as any).filial) || '';
  const valor = String(doHeader || doBody || parseCookies({ req }).filial_melo || 'MANAUS');
  return decodeURIComponent(valor).trim().toUpperCase() || 'MANAUS';
}

/** Pool no schema da filial (mesmo roteamento das estações: search_path fixo). */
export function poolRecebimento(req: NextApiRequest) {
  const filial = filialRecebimento(req);
  return { filial, pool: poolDaFilial(filial), schema: schemaDaFilial(filial) };
}

/** Mesmo helper, nome para as APIs de alocação. */
export const poolEstacaoEntrada = poolRecebimento;
