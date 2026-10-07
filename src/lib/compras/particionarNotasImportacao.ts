/**
 * Partição da DI em NOTAS de nacionalização (helper puro, sem DB).
 *
 * Gabarito Delphi: uma DI vira N notas, partidas por **grupo de pedidos**
 * (`id_orc` = cmp_ordem_compra.orc_id = nº do pedido). Cada nota tem UM
 * destinatário (exportador = cliente tipo X). Dentro de uma nota, o
 * `outros_valores` (Dados Gerais) é rateado FLAT por item; entre notas da
 * mesma DI, é rateado proporcional ao vProd de cada nota.
 *
 * Regras:
 *  - `grupos` informado (lista de listas de id_orc): uma nota por grupo,
 *    subdividida por exportador se o grupo misturar exportadores (destinatário
 *    é único por nota).
 *  - `grupos` ausente: default = uma nota por exportador (piso seguro).
 */

export interface ItemParticao {
  id_orc?: number | string | null; // nº do pedido
  codExportador: string;           // codcli do exportador (destinatário)
  vProd: number;
  row: unknown;                    // linha original (opaca)
}

export interface GrupoNota {
  codExportador: string;
  pedidos: number[];               // id_orc distintos, asc
  itens: ItemParticao[];
  vProd: number;
  vOutro: number;                  // total do grupo
  vOutroItem: number;              // flat por item
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function pedidosDistintos(itens: ItemParticao[]): number[] {
  const set = new Set<number>();
  for (const it of itens) {
    const p = Number(it.id_orc);
    if (Number.isFinite(p) && p > 0) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

/** Agrupa itens por exportador, preservando ordem de entrada. */
function porExportador(itens: ItemParticao[]): Map<string, ItemParticao[]> {
  const m = new Map<string, ItemParticao[]>();
  for (const it of itens) {
    const k = it.codExportador || '(sem exportador)';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

export function particionarNotas(
  itens: ItemParticao[],
  grupos: Array<Array<number | string>> | undefined,
  outrosTotal: number,
): GrupoNota[] {
  // 1) Monta os "blocos" de itens (antes de ratear outros_valores)
  const blocos: { codExportador: string; itens: ItemParticao[] }[] = [];

  if (grupos && grupos.length > 0) {
    for (const grupo of grupos) {
      const pedidosGrupo = new Set(grupo.map((p) => Number(p)));
      const doGrupo = itens.filter((it) => pedidosGrupo.has(Number(it.id_orc)));
      // destinatário único por nota → subdivide por exportador se preciso
      for (const [cod, its] of porExportador(doGrupo)) {
        if (its.length) blocos.push({ codExportador: cod, itens: its });
      }
    }
  } else {
    for (const [cod, its] of porExportador(itens)) {
      blocos.push({ codExportador: cod, itens: its });
    }
  }

  // 2) Rateio de outros_valores: proporcional ao vProd entre notas; flat por item dentro
  const totalVProd = blocos.reduce((s, b) => s + b.itens.reduce((x, i) => x + i.vProd, 0), 0);

  return blocos.map((b) => {
    const vProd = r2(b.itens.reduce((x, i) => x + i.vProd, 0));
    const vOutro = totalVProd > 0 ? r2((outrosTotal * vProd) / totalVProd) : 0;
    const vOutroItem = b.itens.length > 0 ? r2(vOutro / b.itens.length) : 0;
    return {
      codExportador: b.codExportador,
      pedidos: pedidosDistintos(b.itens),
      itens: b.itens,
      vProd,
      vOutro,
      vOutroItem,
    };
  });
}
