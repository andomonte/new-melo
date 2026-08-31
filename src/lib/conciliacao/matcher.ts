/**
 * Motor de correspondência (spec de conciliação). PURO/testável — recebe os títulos
 * candidatos já buscados (por cliente/período) e devolve sugestões por grau de confiança.
 *
 * Regra central: busca por valor APROXIMADO só é permitida com cliente identificado.
 * Sem cliente, só valor EXATO entra na lista.
 */

export interface TituloAberto {
  cod_receb: string;
  codcli: string;
  nome_cliente?: string | null;
  saldoCentavos: number; // valor_pgto - valor_rec, em centavos
  dt_venc: string;
  nro_doc?: string | null;
  parcelaX?: number | null; // posição da parcela (X de N)
  parcelaN?: number | null;
}

/** Detalhe do título exibido na sugestão para o operador validar antes de confirmar. */
export interface TituloDetalhe {
  cod_receb: string;
  nome_cliente?: string | null;
  saldoCentavos: number;
  dt_venc: string;
  nro_doc?: string | null;
  parcelaX?: number | null;
  parcelaN?: number | null;
}

export interface ClienteResolvido {
  codcli: string;
  via: 'cpfcgc' | 'nome' | 'apelido';
  score?: number; // similaridade (0..1) quando via='nome'
}

export type Confianca = 'alta' | 'media' | 'baixa';
export type TipoMatch = 'valor_exato' | 'tolerancia' | 'parcial' | 'grupo';

export interface Sugestao {
  confianca: Confianca;
  tipoMatch: TipoMatch;
  titulos: string[];               // cod_receb(s)
  detalhes: TituloDetalhe[];       // dados dos títulos p/ o operador validar
  motivo: string;
  valorRecebidoCentavos: number;
  saldoTitulosCentavos: number;    // soma dos saldos dos títulos sugeridos
  saldoRestanteCentavos?: number;  // > 0 em pagamento parcial
}

/** Extrai o detalhe exibível de um título candidato. */
const detalheDe = (t: TituloAberto): TituloDetalhe => ({
  cod_receb: t.cod_receb,
  nome_cliente: t.nome_cliente ?? null,
  saldoCentavos: t.saldoCentavos,
  dt_venc: t.dt_venc,
  nro_doc: t.nro_doc ?? null,
  parcelaX: t.parcelaX ?? null,
  parcelaN: t.parcelaN ?? null,
});

export interface MatchOpts {
  tolJurosPct?: number; // recebido pode ser até X% MAIOR (juros/multa). default 5
  tolDescPct?: number;  // recebido pode ser até X% MENOR (desconto). default 5
  maxGrupo?: number;    // tamanho máx. de combinação de títulos. default 3
}

const rebaixa = (c: Confianca): Confianca => (c === 'alta' ? 'media' : c === 'media' ? 'baixa' : 'baixa');

/** Combinações de tamanho k de um array (limitado para evitar explosão). */
function combinacoes<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) { res.push([...acc]); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return res;
}

export function encontrarSugestoes(
  valorRecebidoCentavos: number,
  cliente: ClienteResolvido | null,
  titulos: TituloAberto[],
  opts: MatchOpts = {},
): Sugestao[] {
  const valor = valorRecebidoCentavos;
  const tolJuros = opts.tolJurosPct ?? 5;
  const tolDesc = opts.tolDescPct ?? 5;
  const maxGrupo = opts.maxGrupo ?? 3;
  const sugestoes: Sugestao[] = [];

  if (valor <= 0) return [];

  // ── Sem cliente identificado: SÓ valor exato (baixa confiança). ──
  if (!cliente) {
    for (const t of titulos) {
      if (t.saldoCentavos === valor) {
        sugestoes.push({
          confianca: 'baixa',
          tipoMatch: 'valor_exato',
          titulos: [t.cod_receb],
          detalhes: [detalheDe(t)],
          motivo: `Valor exato do título ${t.cod_receb} (cliente não identificado)`,
          valorRecebidoCentavos: valor,
          saldoTitulosCentavos: t.saldoCentavos,
        });
      }
    }
    return sugestoes;
  }

  // ── Com cliente identificado ──
  // CPF/CNPJ e apelido memorizado são identificações fortes → alta; nome por similaridade → média.
  const base: Confianca = cliente.via === 'cpfcgc' || cliente.via === 'apelido' ? 'alta' : 'media';
  const cli = titulos.filter((t) => String(t.codcli) === String(cliente.codcli));
  const limMaior = Math.round(valor * (1 + tolJuros / 100));
  const limMenor = Math.round(valor * (1 - tolDesc / 100));
  const idCli =
    cliente.via === 'cpfcgc'
      ? 'CPF/CNPJ confere'
      : cliente.via === 'apelido'
        ? 'pagador memorizado'
        : `nome ~${Math.round((cliente.score ?? 0) * 100)}%`;

  for (const t of cli) {
    if (t.saldoCentavos === valor) {
      sugestoes.push({
        confianca: base,
        tipoMatch: 'valor_exato',
        titulos: [t.cod_receb],
        detalhes: [detalheDe(t)],
        motivo: `${idCli} · valor exato`,
        valorRecebidoCentavos: valor,
        saldoTitulosCentavos: t.saldoCentavos,
      });
    } else if (t.saldoCentavos >= limMenor && t.saldoCentavos <= limMaior) {
      const dif = valor - t.saldoCentavos;
      sugestoes.push({
        confianca: rebaixa(base),
        tipoMatch: 'tolerancia',
        titulos: [t.cod_receb],
        detalhes: [detalheDe(t)],
        motivo: `${idCli} · ${dif > 0 ? 'recebido a mais (juros/multa)' : 'recebido a menos (desconto)'} R$ ${(Math.abs(dif) / 100).toFixed(2)}`,
        valorRecebidoCentavos: valor,
        saldoTitulosCentavos: t.saldoCentavos,
      });
    } else if (t.saldoCentavos > valor) {
      sugestoes.push({
        confianca: rebaixa(base),
        tipoMatch: 'parcial',
        titulos: [t.cod_receb],
        detalhes: [detalheDe(t)],
        motivo: `${idCli} · pagamento parcial, restam R$ ${((t.saldoCentavos - valor) / 100).toFixed(2)}`,
        valorRecebidoCentavos: valor,
        saldoTitulosCentavos: t.saldoCentavos,
        saldoRestanteCentavos: t.saldoCentavos - valor,
      });
    }
  }

  // Grupo: combinação de títulos cuja soma dos saldos = valor recebido.
  if (cli.length >= 2) {
    const cand = cli.slice(0, 20); // limita p/ não explodir
    for (let k = 2; k <= Math.min(maxGrupo, cand.length); k++) {
      for (const combo of combinacoes(cand, k)) {
        const soma = combo.reduce((s, t) => s + t.saldoCentavos, 0);
        if (soma === valor) {
          sugestoes.push({
            confianca: rebaixa(base),
            tipoMatch: 'grupo',
            titulos: combo.map((t) => t.cod_receb),
            detalhes: combo.map(detalheDe),
            motivo: `${idCli} · ${k} títulos somam o valor recebido`,
            valorRecebidoCentavos: valor,
            saldoTitulosCentavos: soma,
          });
        }
      }
    }
  }

  // Ordena por confiança (alta→baixa) e depois exato→tolerância→parcial→grupo.
  const ordemConf: Record<Confianca, number> = { alta: 0, media: 1, baixa: 2 };
  const ordemTipo: Record<TipoMatch, number> = { valor_exato: 0, tolerancia: 1, parcial: 2, grupo: 3 };
  sugestoes.sort((a, b) => ordemConf[a.confianca] - ordemConf[b.confianca] || ordemTipo[a.tipoMatch] - ordemTipo[b.tipoMatch]);
  return sugestoes;
}
