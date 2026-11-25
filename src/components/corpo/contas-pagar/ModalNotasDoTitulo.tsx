import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { formatarMoeda } from './utils';

/**
 * Notas que um título atendeu (adiantamento com várias NFs, parcela da NF).
 * Dados: GET /api/contas-pagar/{cod_pgto}/notas (tabela dbpgto_nota, migration 089).
 */
interface Nota {
  codnfe_ent: string;
  nnf: string;
  serie: string | null;
  chave: string | null;
  tipo: 'ADIANTAMENTO' | 'PARCELA' | string;
  valor_nf: number;
  valor_atendido: number;
  criado_em: string | null;
  usuario: string | null;
  // recebimento físico da nota (tela de Recebimento) — situacaoRecebimento.ts
  recebimento?: 'recebida' | 'em_recebimento' | 'nao_recebida' | 'cancelada' | null;
  etapa?: string | null;
  recebedor_nome?: string | null;
  fim_recebimento?: string | null;
  codent?: string | null;
}

const RECEB: Record<string, { rotulo: string; cor: string }> = {
  recebida: { rotulo: 'Recebida', cor: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  em_recebimento: { rotulo: 'Saldo Parcial', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  nao_recebida: { rotulo: 'Pendente', cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  cancelada: { rotulo: 'Cancelada', cor: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};
const ETAPA: Record<string, string> = {
  PENDENTE: 'entrada pendente', PRECO_CONFIRMADO: 'preço confirmado', AGUARDANDO_RECEBIMENTO: 'aguardando recebimento',
  EM_RECEBIMENTO: 'em conferência', RECEBIDO: 'conferida', EM_ALOCACAO: 'em alocação', ALOCADO: 'alocada',
  DISPONIVEL_VENDA: 'disponível p/ venda', CANCELADA: 'entrada cancelada',
};

interface Resposta {
  titulo: { cod_pgto: string; nro_dup: string | null; valor_pgto: number; valor_pago: number; nome_credor: string | null } | null;
  notas: Nota[];
  total_atendido: number;
  saldo: number;
}

// data/hora vem como texto do banco ("2026-11-24 10:31:00…"): formata sem new Date() (fuso)
const dataBR = (s: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};

export default function ModalNotasDoTitulo({ codPgto, onFechar }: { codPgto: string | null; onFechar: () => void }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!codPgto) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    setDados(null);
    fetch(`/api/contas-pagar/${encodeURIComponent(codPgto)}/notas`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.erro || 'Erro ao buscar as notas');
        if (ativo) setDados(j);
      })
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [codPgto]);

  const ehAdiantamento = dados?.notas.some((n) => n.tipo === 'ADIANTAMENTO');

  return (
    <Dialog open={!!codPgto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Notas do título {dados?.titulo?.nro_dup || codPgto}</DialogTitle>
          <DialogDescription>
            {dados?.titulo?.nome_credor || ''}
            {dados?.titulo ? ` · valor do título ${formatarMoeda(dados.titulo.valor_pgto)}` : ''}
            {dados && dados.notas.length > 0 && (
              <span className="ml-1">
                · {dados.notas.filter((n) => n.recebimento === 'recebida').length} de {dados.notas.length} nota(s) recebida(s)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {carregando && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        {erro && <p className="py-4 text-sm text-red-600">{erro}</p>}

        {dados && !carregando && (
          dados.notas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma nota associada a este título.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">NF</th>
                    <th className="py-2 pr-3">Série</th>
                    <th className="py-2 pr-3">Associada em</th>
                    <th className="py-2 pr-3 text-right">Valor da NF</th>
                    <th className="py-2 pr-3 text-right">Atendido</th>
                    <th className="py-2">Recebimento</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.notas.map((n) => (
                    <tr key={n.codnfe_ent} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono" title={n.chave || ''}>{n.nnf}</td>
                      <td className="py-2 pr-3">{n.serie || '-'}</td>
                      <td className="py-2 pr-3">{dataBR(n.criado_em)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatarMoeda(n.valor_nf)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium">{formatarMoeda(n.valor_atendido)}</td>
                      <td className="py-2">
                        {n.recebimento && RECEB[n.recebimento] ? (
                          <>
                            <span className={`rounded px-1.5 py-0.5 text-xs ${RECEB[n.recebimento].cor}`}>{RECEB[n.recebimento].rotulo}</span>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {!n.codent
                                ? 'sem entrada no sistema'
                                : n.etapa
                                  ? `entrada ${n.codent} · ${ETAPA[n.etapa] || n.etapa}`
                                  : `entrada ${n.codent} · antiga (Delphi)`}
                              {n.recebedor_nome ? ` · ${n.recebedor_nome}` : ''}
                              {n.fim_recebimento ? ` em ${dataBR(n.fim_recebimento)}` : ''}
                            </div>
                          </>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-sm">
                    <td colSpan={4} className="pt-3 pr-3 text-right text-muted-foreground">Total atendido</td>
                    <td className="pt-3 pr-3 text-right tabular-nums font-semibold">{formatarMoeda(dados.total_atendido)}</td>
                    <td />
                  </tr>
                  {ehAdiantamento && (
                    <tr className="text-sm">
                      <td colSpan={4} className="pt-1 pr-3 text-right text-muted-foreground">Saldo do adiantamento</td>
                      <td className="pt-1 pr-3 text-right tabular-nums font-semibold">{formatarMoeda(dados.saldo)}</td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
