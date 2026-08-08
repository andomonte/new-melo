import { useState } from 'react';
import FaturamentoNotaV2 from '@/components/corpo/faturamento/novoFaturamento/v2/FaturamentoNotaV2';

// Página de PREVIEW (fase de layout) — sem auth, só para visualizar/medir a V2.
// Dados de exemplo via ctx. NÃO é rota de produção.
const ITENS = [
  { codprod: '424304', descr: 'PNEU 175/70 R14', qtd: 50, prunit: 101.8, cfop: '5405', totalproduto: 5090 },
  { codprod: '424306', descr: 'PNEU 185/65 R15', qtd: 20, prunit: 91.9, cfop: '5405', totalproduto: 1838 },
];

export default function PreviewV2() {
  const [f, setF] = useState<Record<string, any>>({
    tipodoc: 'N', cobranca: 'N', inscFat: '04', nfeAmbiente: '2', nfeFinalidade: '1', nfeFormaEmissao: '1',
    tipoMovimentacao: 'SAIDA', operacaoFiscal: 'VENDA',
  });
  return (
    <FaturamentoNotaV2
      ctx={{
        f,
        set: (k, v) => setF((p) => ({ ...p, [k]: v })),
        data: {
          titulo: 'FATURA · VENDA 002439921 · LOCALIZA RENT A CAR SA (35692)',
          itens: ITENS,
          resumo: { produtos: 6928, totalNf: 6928, ibs_valor: 6.93, cbs_valor: 62.35, ibs_mun: 0.5, ibs_est: 0.2 },
        },
        actions: {},
      }}
    />
  );
}
