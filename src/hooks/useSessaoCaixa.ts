import { useCallback, useEffect, useState } from 'react';
import * as api from '@/data/caixa/sessao';
import type { SessaoCaixa, TotalForma, FormaPagamentoSessao } from '@/data/caixa/sessao';

/**
 * Estado + ações da sessão de caixa (abertura/fechamento) da conta do operador.
 * Camada por cima do recebimento — não interfere no fluxo atual.
 */
export function useSessaoCaixa(filial?: string, codConta?: string, operador?: string) {
  const [sessao, setSessao] = useState<SessaoCaixa | null>(null);
  const [saldoDinheiro, setSaldoDinheiro] = useState(0);
  const [totaisPorForma, setTotaisPorForma] = useState<TotalForma[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false); // filial sem caixa/schema → não bloqueia a tela
  const pronto = Boolean(filial && codConta);

  const refresh = useCallback(async () => {
    if (!filial || !codConta) return;
    setCarregando(true);
    try {
      const r = await api.getSessaoAtual(filial, codConta);
      setSessao(r.sessao);
      setSaldoDinheiro(r.saldoDinheiro ?? 0);
      setTotaisPorForma(r.totaisPorForma ?? []);
      setIndisponivel(false);
    } catch (e: any) {
      // FILIAL_INVALIDA (schema sem caixa) → sistema de sessão indisponível: não gate
      setSessao(null);
      setIndisponivel(true);
    } finally {
      setCarregando(false);
    }
  }, [filial, codConta]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const aberto = sessao?.status === 'ABERTO';
  const emFechamento = sessao?.status === 'EM_FECHAMENTO';

  const abrir = useCallback(
    async (fundo_troco: number, observacao?: string) => {
      await api.abrirCaixa({ filial: filial!, cod_conta: codConta!, operador: operador || '', fundo_troco, observacao });
      await refresh();
    },
    [filial, codConta, operador, refresh],
  );

  const sangria = useCallback(
    async (valor: number, motivo: string) => {
      if (!sessao) return;
      await api.sangria(sessao.id, { filial: filial!, operador: operador || '', valor, motivo });
      await refresh();
    },
    [sessao, filial, operador, refresh],
  );

  const suprimento = useCallback(
    async (valor: number, motivo: string) => {
      if (!sessao) return;
      await api.suprimento(sessao.id, { filial: filial!, operador: operador || '', valor, motivo });
      await refresh();
    },
    [sessao, filial, operador, refresh],
  );

  const iniciarFechamento = useCallback(async () => {
    if (!sessao) return null;
    const r = await api.iniciarFechamento(sessao.id, filial!);
    await refresh();
    return r as { saldoEsperadoDinheiro: number; esperadoPorForma: TotalForma[] };
  }, [sessao, filial, refresh]);

  const confirmarFechamento = useCallback(
    async (
      saldo_informado_dinheiro: number,
      valores_por_forma?: { forma_pagamento: FormaPagamentoSessao; valor_informado: number }[],
      observacao?: string,
    ) => {
      if (!sessao) return null;
      const r = await api.confirmarFechamento(sessao.id, {
        filial: filial!,
        operador: operador || '',
        saldo_informado_dinheiro,
        valores_por_forma,
        observacao,
      });
      await refresh();
      return r as { quebra: number; sessao: SessaoCaixa };
    },
    [sessao, filial, operador, refresh],
  );

  const cancelarFechamento = useCallback(async () => {
    if (!sessao) return;
    await api.cancelarFechamento(sessao.id, filial!);
    await refresh();
  }, [sessao, filial, refresh]);

  return {
    sessao, saldoDinheiro, totaisPorForma, carregando, indisponivel, pronto, aberto, emFechamento,
    refresh, abrir, sangria, suprimento, iniciarFechamento, confirmarFechamento, cancelarFechamento,
  };
}

export type SessaoCaixaHook = ReturnType<typeof useSessaoCaixa>;
