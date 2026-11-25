import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { avisoLacunaVendas, diaIso, moeda, numerar, periodo, qtd } from './_utilA';

/**
 * Relatórios › Gerenciais › Extrato de Itens (Delphi: FrmRelatorioGeral / tabExtItem /
 * CONSULTAPRODUTO.EXTRATO_ITEM). Movimento de um produto no período — garantias, vendas, entradas,
 * acertos de inventário e transferências entre armazéns — com entradas, saídas, saldo e preço médio
 * de venda.
 * Diferenças do legado:
 *  - acertos de estoque (dbacerto) não existem no PG: esse ramo não aparece;
 *  - nº da NF da venda: pela ligação do web (fatura_venda) e, na falta, por dbfecharvendas;
 *  - entradas: sem armazém, a quantidade da nota (dbitent.quant); com armazém, a do romaneio
 *    (dbitent_armazem) — para notas sem romaneio, conta no armazém GERAL;
 *  - transferências entre armazéns só entram quando um armazém é escolhido (no total do produto
 *    elas se anulam);
 *  - o preço de entrada não é zerado para usuário sem permissão (rel = 'N'): controlar pelo acesso
 *    ao relatório.
 */
export const relatorio: Relatorio = {
  slug: 'extratoItens',
  titulo: 'Extrato de Itens',
  descricao: 'Movimento de um produto no período (vendas, entradas, garantias, acertos de inventário e transferências entre armazéns), com saldo acumulado, total de entradas e saídas e preço médio de venda. Limitações do banco novo: vendas migradas até 06/2025 e as do web desde 08/2026; entradas só de 07/2025 a 11/2025 (notas migradas) e as lançadas no web; não há acertos de estoque (dbacerto) nem garantias/transferências antigas.',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'produto', rotulo: 'Produto', tipo: 'lookup', lookup: 'produto', obrigatorio: true, largura: 2 },
    { campo: 'armazem', rotulo: 'Armazém (código)', tipo: 'numero', ajuda: 'Vazio = todos. Ex.: 1001 = GERAL.' },
  ],
  colunas: [
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'origem', titulo: 'Movimento' },
    { campo: 'documento', titulo: 'Documento' },
    { campo: 'nota_fiscal', titulo: 'Nota fiscal' },
    { campo: 'codcf', titulo: 'Cód. C/F' },
    { campo: 'nomecf', titulo: 'Cliente / fornecedor' },
    { campo: 'sit', titulo: 'E/S' },
    { campo: 'entrada', titulo: 'Entrada', tipo: 'numero', total: true },
    { campo: 'saida', titulo: 'Saída', tipo: 'numero', total: true },
    { campo: 'saldo', titulo: 'Saldo no período', tipo: 'numero' },
    { campo: 'preco', titulo: 'Preço', tipo: 'moeda' },
  ],
  async executar(db, p) {
    const arm = p.armazem == null ? null : Math.trunc(Number(p.armazem));
    const prod = (await db.query(
      `SELECT pd.codprod, pd.ref, pd.descr, m.descr AS marca, pd.qtest, pd.qtdreservada, pd.local
         FROM dbprod pd LEFT JOIN dbmarcas m ON m.codmarca = pd.codmarca WHERE pd.codprod = $1`, [p.produto])).rows[0];
    if (!prod) throw new RelatorioValidacaoError('Produto não encontrado.');
    let armDescr: string | null = null;
    if (arm != null) {
      armDescr = (await db.query(`SELECT arm_descricao FROM cad_armazem WHERE arm_id = $1`, [arm])).rows[0]?.arm_descricao ?? null;
      if (!armDescr) throw new RelatorioValidacaoError(`Armazém ${arm} não encontrado.`);
    }

    // $1 de, $2 até, $3 codprod, $4 armazém (ou null)
    const params: any[] = [p.de, p.ate, prod.codprod, arm];
    const rows = (await db.query(
      `WITH geral AS (SELECT min(arm_id) AS arm_id FROM cad_armazem WHERE arm_descricao = 'GERAL'),
       vendas AS (
         SELECT v.codvenda, v.data, v.tipo, v.nrovenda, v.codcli, v.status, iv.qtd, iv.prunit
           FROM dbitvenda iv JOIN dbvenda v ON v.codvenda = iv.codvenda
          WHERE iv.codprod = $3 AND ${periodo('v.data', 1, 2, true)}
            AND COALESCE(v.cancel, 'N') <> 'S' AND COALESCE(v.estoque_virtual, 'N') = 'N'
            AND ($4::int IS NULL OR iv.arm_id = $4::int)
       ), nf AS (
         SELECT x.codvenda, min(CASE WHEN f.tipofat = '3' THEN 'F.' || f.codfat ELSE COALESCE(f.nroform, 'F.' || f.codfat) END) AS nota
           FROM (SELECT fv.codvenda, fv.codfat FROM fatura_venda fv WHERE fv.status <> 'cancelado' AND fv.codvenda IN (SELECT codvenda FROM vendas)
                 UNION SELECT fh.codvenda, fh.codfat FROM dbfecharvendas fh WHERE fh.codvenda IN (SELECT codvenda FROM vendas)) x
           JOIN dbfatura f ON f.codfat = x.codfat AND COALESCE(f.cancel, 'N') <> 'S'
          GROUP BY x.codvenda
       ), mov AS (
         -- garantias
         SELECT g.dt_gar AS dt, 'Garantia' AS origem, 'G' || g.codgar AS documento, NULL::text AS nota_fiscal,
                g.codcli AS codcf, c.nome AS nomecf, 'S' AS sit, ig.qtde AS quant, ig.prunit AS preco
           FROM dbitgarantiaprod ig JOIN dbgarantiaprod g ON g.codgar = ig.codgar
           LEFT JOIN dbclien c ON c.codcli = g.codcli
          WHERE ig.codprod = $3 AND ${periodo('g.dt_gar', 1, 2)} AND COALESCE(g.cancel, 'N') <> 'S'
            AND ($4::int IS NULL OR ig.arm_id = $4::int)
         UNION ALL
         -- vendas
         SELECT v.data::timestamp, 'Venda', COALESCE(v.tipo, '') || COALESCE(v.nrovenda, v.codvenda),
                CASE WHEN v.status = 'F' THEN COALESCE(nf.nota, 'faturada') END,
                v.codcli, c.nome, 'S', v.qtd, v.prunit
           FROM vendas v LEFT JOIN nf ON nf.codvenda = v.codvenda LEFT JOIN dbclien c ON c.codcli = v.codcli
         UNION ALL
         -- entradas (nota fiscal de compra)
         SELECT e.dtent, 'Entrada', e.codent, e.nroform, e.cod_credor, cr.nome, 'E',
                CASE WHEN $4::int IS NULL THEN ie.quant
                     ELSE COALESCE(
                       (SELECT sum(a.qtd) FROM dbitent_armazem a WHERE a.codent = ie.codent AND a.codprod = ie.codprod AND a.codreq IS NOT DISTINCT FROM ie.codreq AND a.arm_id = $4::int),
                       CASE WHEN $4::int = (SELECT arm_id FROM geral)
                             AND NOT EXISTS (SELECT 1 FROM dbitent_armazem a WHERE a.codent = ie.codent AND a.codprod = ie.codprod)
                            THEN ie.quant END) END,
                ie.prunit
           FROM dbitent ie JOIN dbent e ON e.codent = ie.codent
           LEFT JOIN dbcredor cr ON cr.cod_credor = e.cod_credor
          WHERE ie.codprod = $3 AND ${periodo('e.dtent', 1, 2)} AND COALESCE(e.status, '') <> 'C'
         UNION ALL
         -- acertos de inventário
         SELECT iv.data, 'Inventário', 'INV', NULL, NULL, 'MELO DISTRIBUIDORA',
                CASE WHEN iv.operacao = 'SUBTRAIU' THEN 'S' ELSE 'E' END,
                abs(COALESCE(iv.qtd_ant, 0) - COALESCE(iv.qtd_cont, 0)), 0
           FROM dbinventario_melo iv
          WHERE lpad(iv.codprod, 6, '0') = $3 AND ${periodo('iv.data', 1, 2)} AND COALESCE(iv.ajuste, 0) <> 0
            AND ($4::int IS NULL OR iv.arm_id = $4::int)
         UNION ALL
         -- transferência entre armazéns: saída da origem
         SELECT t.tra_data::timestamp, 'Transferência', t.tra_id::text, NULL, d.arm_id::text, d.arm_descricao, 'S', it.itt_qtd, it.itt_prunit
           FROM arm_transferencia t JOIN arm_it_transferencia it ON it.itt_tra_id = t.tra_id
           JOIN cad_armazem d ON d.arm_id = t.tra_arm_id_destino
          WHERE $4::int IS NOT NULL AND t.tra_arm_id_origem = $4::int AND it.itt_codprod = $3
            AND t.tra_status IN ('N', 'E', 'A') AND COALESCE(t.tra_cancel, 'N') = 'N' AND ${periodo('t.tra_data', 1, 2)}
         UNION ALL
         -- transferência entre armazéns: entrada no destino (só as recebidas)
         SELECT t.tra_data::timestamp, 'Transferência', t.tra_id::text, NULL, o.arm_id::text, o.arm_descricao, 'E', it.itt_qtd, it.itt_prunit
           FROM arm_transferencia t JOIN arm_it_transferencia it ON it.itt_tra_id = t.tra_id
           JOIN cad_armazem o ON o.arm_id = t.tra_arm_id_origem
          WHERE $4::int IS NOT NULL AND t.tra_arm_id_destino = $4::int AND it.itt_codprod = $3
            AND t.tra_status = 'A' AND COALESCE(t.tra_cancel, 'N') = 'N' AND ${periodo('t.tra_data', 1, 2)}
       )
       SELECT ${diaIso('dt')} AS data, origem, documento, nota_fiscal, codcf, nomecf, sit,
              CASE WHEN sit = 'E' THEN quant END AS entrada, CASE WHEN sit = 'S' THEN quant END AS saida,
              round(COALESCE(preco, 0)::numeric, 2) AS preco
         FROM mov
        WHERE COALESCE(quant, 0) <> 0
        ORDER BY dt::date, sit, dt, documento`, params)).rows;
    numerar(rows, ['entrada', 'saida', 'preco']);

    let saldo = 0; let qtdVenda = 0; let valVenda = 0;
    for (const r of rows) {
      saldo += (r.entrada || 0) - (r.saida || 0);
      r.saldo = saldo;
      if (r.origem === 'Venda') { qtdVenda += r.saida || 0; valVenda += (r.saida || 0) * (r.preco || 0); }
    }
    const tE = rows.reduce((s, r) => s + (r.entrada || 0), 0);
    const tS = rows.reduce((s, r) => s + (r.saida || 0), 0);

    let estArm = '';
    if (arm != null) {
      const a = (await db.query(
        `SELECT ap.arp_qtest, ap.arp_qtest_reservada,
                (SELECT string_agg(l.apl_descricao, ', ') FROM cad_armazem_produto_locacao l WHERE l.apl_arm_id = ap.arp_arm_id AND l.apl_codprod = ap.arp_codprod) AS locacao
           FROM cad_armazem_produto ap WHERE ap.arp_arm_id = $1 AND ap.arp_codprod = $2`, [arm, prod.codprod])).rows[0];
      estArm = a
        ? ` · Armazém ${arm} ${armDescr}: estoque ${qtd(Number(a.arp_qtest))}, reservado ${qtd(Number(a.arp_qtest_reservada))}${a.locacao ? `, locação ${a.locacao}` : ''}`
        : ` · Armazém ${arm} ${armDescr}: sem estoque cadastrado`;
    }
    const resumo = [
      `${prod.ref ?? ''} — ${prod.descr ?? ''} (${prod.marca ?? 'sem marca'}) · Estoque atual ${qtd(Number(prod.qtest))}, disponível ${qtd(Number(prod.qtest || 0) - Number(prod.qtdreservada || 0))}${prod.local ? `, local ${prod.local}` : ''}${estArm}`,
      `Entradas ${qtd(tE)} · Saídas ${qtd(tS)} · Saldo do período ${qtd(tE - tS)} · Preço médio de venda R$ ${moeda(qtdVenda ? valVenda / qtdVenda : 0)}`,
    ];
    return { linhas: rows, resumo, avisos: await avisoLacunaVendas(db, p.de, p.ate) };
  },
};
