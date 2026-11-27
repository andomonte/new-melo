/**
 * Alerta de devoluções de compra para o Faturamento: consulta a cada 2 minutos quantas
 * devoluções do web aguardam emissão da NF e, quando chega uma NOVA (dev_id maior que o
 * último já avisado neste navegador), mostra o alerta central uma vez. Só roda para quem tem
 * acesso à tela Faturamento › Devolução. Devolve o total (contador no menu).
 */
import { useEffect, useState } from 'react';
import api from '@/components/services/api';
import { mostrarAlerta } from '@/components/common/AlertaCentralGlobal';

const CHAVE = 'devolucoesCompraAvisadas';
const INTERVALO_MS = 120_000;

export function useAlertaDevolucoes(ativo: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const consultar = async () => {
      try {
        const { data } = await api.get('/api/devolucao/pendentes');
        if (!vivo) return;
        const n = Number(data?.total) || 0;
        setTotal(n);
        const ultimo = String(data?.ultimo ?? '');
        const avisado = typeof window !== 'undefined' ? localStorage.getItem(CHAVE) : null;
        if (n > 0 && ultimo && (!avisado || Number(ultimo) > Number(avisado))) {
          const r = data?.recente;
          mostrarAlerta({
            tipo: 'warning',
            titulo: 'Devolução de compra aguardando NF',
            mensagem:
              `${n === 1 ? 'Há 1 devolução' : `Há ${n} devoluções`} de compra aguardando a emissão da NF ` +
              `em Faturamento › Devolução.` +
              (r ? ` A mais recente: ${r.devId}${r.fornecedor ? ` — ${r.fornecedor}` : ''}${r.obs ? ` (${r.obs})` : ''}.` : ''),
          });
          localStorage.setItem(CHAVE, ultimo);
        }
      } catch {
        /* sem alerta se a consulta falhar */
      }
    };
    consultar();
    const t = setInterval(consultar, INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [ativo]);

  return total;
}
