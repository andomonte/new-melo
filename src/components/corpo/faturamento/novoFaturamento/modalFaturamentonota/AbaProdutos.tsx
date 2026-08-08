import React from 'react';

// Aba "Produtos" (FASE DE LAYOUT): grid SOMENTE-LEITURA dos itens + totalizador por CFOP.
// Lê os itens já carregados (shape de dbitvenda). NÃO calcula imposto — só exibe.

type Props = { itens: any[] };

const n = (v: any) => Number(v ?? 0);
const money = (v: any) =>
  n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AbaProdutos({ itens }: Props) {
  const linhas = Array.isArray(itens) ? itens : [];

  // Totalizador agrupado por CFOP
  const porCfop = new Map<
    string,
    { itens: number; prod: number; icms: number; st: number; ipi: number }
  >();
  for (const it of linhas) {
    const cfop = String(it.cfop ?? '—');
    const g = porCfop.get(cfop) ?? { itens: 0, prod: 0, icms: 0, st: 0, ipi: 0 };
    g.itens += 1;
    g.prod += n(it.totalproduto) || n(it.qtd) * n(it.prunit);
    g.icms += n(it.totalicms);
    g.st += n(it.totalsubst_trib);
    g.ipi += n(it.totalipi);
    porCfop.set(cfop, g);
  }
  const grupos = [...porCfop.entries()];
  const tot = grupos.reduce(
    (s, [, g]) => ({
      prod: s.prod + g.prod,
      icms: s.icms + g.icms,
      st: s.st + g.st,
      ipi: s.ipi + g.ipi,
    }),
    { prod: 0, icms: 0, st: 0, ipi: 0 },
  );

  if (!linhas.length) {
    return (
      <div className="fat-sec text-xs text-gray-500 dark:text-gray-400">
        Nenhum item para exibir.
      </div>
    );
  }

  return (
    <div className="fat-secs">
      <div className="fat-sec">
        <div className="fat-sec-header">Produtos ({linhas.length})</div>
        <div className="fat-prodgrid-wrap">
          <table className="fat-tbl">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Qtde</th>
                <th>Unitário</th>
                <th>CFOP</th>
                <th>Base ICMS</th>
                <th>Alíq ICMS</th>
                <th>ICMS</th>
                <th>Base ST</th>
                <th>MVA</th>
                <th>ST</th>
                <th>Base IPI</th>
                <th>Alíq IPI</th>
                <th>IPI</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((it, i) => (
                <tr key={`${it.codprod ?? i}-${i}`}>
                  <td>{it.codprod}</td>
                  <td>{it.descr}</td>
                  <td>{n(it.qtd)}</td>
                  <td>{money(it.prunit)}</td>
                  <td>{it.cfop ?? '—'}</td>
                  <td>{money(it.baseicms)}</td>
                  <td>{n(it.aliquota_icms ?? it.icms)}%</td>
                  <td>{money(it.totalicms)}</td>
                  <td>{money(it.basesubst_trib)}</td>
                  <td>{n(it.mva)}</td>
                  <td>{money(it.totalsubst_trib)}</td>
                  <td>{money(it.baseipi)}</td>
                  <td>{n(it.aliquota_ipi ?? it.ipi)}%</td>
                  <td>{money(it.totalipi)}</td>
                  <td>{money(n(it.totalproduto) || n(it.qtd) * n(it.prunit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fat-sec">
        <div className="fat-sec-header">Totalizador por CFOP</div>
        <div className="fat-prodgrid-wrap">
          <table className="fat-tbl">
            <thead>
              <tr>
                <th>CFOP</th>
                <th>Itens</th>
                <th>Produtos</th>
                <th>ICMS</th>
                <th>ST</th>
                <th>IPI</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(([cfop, g]) => (
                <tr key={cfop}>
                  <td>{cfop}</td>
                  <td>{g.itens}</td>
                  <td>{money(g.prod)}</td>
                  <td>{money(g.icms)}</td>
                  <td>{money(g.st)}</td>
                  <td>{money(g.ipi)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td>{linhas.length}</td>
                <td>{money(tot.prod)}</td>
                <td>{money(tot.icms)}</td>
                <td>{money(tot.st)}</td>
                <td>{money(tot.ipi)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
