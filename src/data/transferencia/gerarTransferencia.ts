/**
 * Orquestrador "Gerar Transferência entre Filiais" (front). Por filial destino:
 *   criar-venda (TRANSFERENCIA) → faturarPreVenda (salvar TRANSFERENCIA + emitir NF-e, sem cobrança)
 *   → falha? exclui a venda → sucesso? registrar arm_transferencia + qtd_transferido.
 * Reusa o pipeline de faturamento/NF (mesma técnica do faturar-no-caixa).
 */
import { faturarPreVenda, type DetalhesPreVenda } from '@/data/caixa/faturarPreVenda';

export interface ItemTransf {
  codprod: string;
  qtd: number;
  pr_transf: number;
  arm_id?: number | string | null;
}
export interface FilialDistribuicao {
  codcli_destino: string;
  sigla?: string;
  transp?: string;
  codtptransp?: string;
  vlr_frete?: number;
  pedido?: string;
  obs?: string;
  arm_id_origem?: number | string | null;
  itens: ItemTransf[];
}
export interface ResultadoFilial {
  codcli_destino: string;
  sigla?: string;
  ok: boolean;
  codfat?: string;
  tra_id?: number;
  nfe?: any;
  erro?: string;
}

async function jfetch(url: string, opts?: { method?: string; body?: any }) {
  const resp = await fetch(url, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, httpStatus: resp.status, json };
}

export async function gerarTransferencia(params: {
  codent: string;
  username: string;
  codvend?: string;
  filiais: FilialDistribuicao[];
  onStep?: (etapa: string) => void;
}): Promise<ResultadoFilial[]> {
  const { codent, username, codvend, filiais, onStep } = params;
  const resultados: ResultadoFilial[] = [];

  for (const f of filiais) {
    const rot = f.sigla || f.codcli_destino;
    try {
      // 1) cria a venda de transferência
      onStep?.(`[${rot}] Criando venda de transferência…`);
      const cv = await jfetch('/api/transferencia/criar-venda', {
        method: 'POST',
        body: {
          codent,
          codcli_destino: f.codcli_destino,
          codvend,
          transp: f.transp,
          codtptransp: f.codtptransp,
          vlr_frete: f.vlr_frete,
          pedido: f.pedido,
          obs: f.obs,
          itens: f.itens.map((i) => ({ ...i, arm_id: i.arm_id ?? f.arm_id_origem })),
        },
      });
      if (!cv.ok || !cv.json?.codvenda) throw new Error(cv.json?.detalhes || cv.json?.erro || 'Falha ao criar venda.');
      const codvenda = cv.json.codvenda;
      const nrovenda = cv.json.nrovenda;

      // 2) detalhes p/ faturar
      const dv = await jfetch(`/api/faturamento/detalhes-venda?nrovenda=${encodeURIComponent(nrovenda)}`);
      if (!dv.ok || !dv.json?.resumoFinanceiro) {
        await jfetch('/api/transferencia/excluir-venda', { method: 'POST', body: { codvenda } }).catch(() => {});
        throw new Error('Falha ao carregar a venda para faturar.');
      }
      const detalhes: DetalhesPreVenda = {
        dbclien: dv.json.dbclien,
        dbvenda: dv.json.dbvenda,
        dbitvenda: dv.json.dbitvenda,
        resumoFinanceiro: dv.json.resumoFinanceiro,
      };

      // 3) fatura + NF-e de transferência (CFOP 6152, sem cobrança/título)
      let r;
      try {
        r = await faturarPreVenda({
          detalhes,
          codConta: '',
          username,
          tipoOperacao: 'TRANSFERENCIA',
          comCobranca: false,
          onStep: (e) => onStep?.(`[${rot}] ${e}`),
        });
      } catch (e: any) {
        // faturarPreVenda já reverteu a fatura; remove a venda de transferência órfã
        await jfetch('/api/transferencia/excluir-venda', { method: 'POST', body: { codvenda } }).catch(() => {});
        throw e;
      }

      // 4) registra a transferência (status ENVIADO) + qtd_transferido
      onStep?.(`[${rot}] Registrando transferência…`);
      const reg = await jfetch('/api/transferencia/registrar', {
        method: 'POST',
        body: {
          codent,
          codcli_destino: f.codcli_destino,
          codfat: r.codfat,
          arm_id_origem: f.arm_id_origem,
          username,
          transp: f.transp,
          codtptransp: f.codtptransp,
          vlr_frete: f.vlr_frete,
          pedido: f.pedido,
          obs: f.obs,
          itens: f.itens,
        },
      });

      resultados.push({
        codcli_destino: f.codcli_destino,
        sigla: f.sigla,
        ok: true,
        codfat: r.codfat,
        tra_id: reg.json?.tra_id,
        nfe: r.nfe,
      });
    } catch (err: any) {
      resultados.push({ codcli_destino: f.codcli_destino, sigla: f.sigla, ok: false, erro: err.message });
    }
  }

  return resultados;
}
