import { RelatorioValidacaoError, type Relatorio } from '../tipos';
import { NOME_FILIAL_SQL, VINCULO_VENDA_FATURA, listaCodigos, numeros, semLacoAninhado } from './_utilD';

/**
 * Relatórios › Gerenciais › Acompanhamento SONY (Delphi: FrmConsultaDiariaSony / procedure
 * CONSULTA_REL_DIARIO_SONY, que gravava em TMP_SONY). Vendas, item a item, dos produtos SONY para
 * enviar ao fabricante. Diferenças deliberadas:
 *  - genérico: grupos/marcas viram filtro; vazio = grupos SONY-MULTIMIDIA e SONY-FALANTES (por nome,
 *    vale em qualquer filial); só a filial atual (sem os dblinks PVH/REC/FLZ);
 *  - consulta direta (sem a tabela TMP_SONY); sem o DISTINCT do legado (itens iguais não somem);
 *  - base é a venda faturada: a NF vem de dbfecharvendas/fatura_venda (só o faturado pelo web);
 *    sem vínculo, entra a venda com status F e a data da venda (as regras da NF — tipofat 1,
 *    destino C, cobrança S, sem agrupamento — valem só quando há NF vinculada);
 *  - telefone de dbclien_contatos (DBFNCLI não existe); prazo de dbpzfat ou, sem ele, do prazo da venda;
 *  - regra do telemarketing (classe 003/008) só quando o vendedor da venda é conhecido;
 *  - clientes excluídos viram filtro (padrão: a lista fixa de Manaus).
 */
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** '030 060 000 …' → 'PRAZO: 30/60'; só zeros → 'A VISTA'. */
const prazoDaVenda = (s: any) => {
  const txt = String(s ?? '').trim();
  if (!txt) return '';
  if (/^[\d\s]+$/.test(txt)) {
    const dias = txt.split(/\s+/).map((d) => parseInt(d, 10)).filter((d) => d > 0);
    return dias.length ? `PRAZO: ${dias.join('/')}` : 'A VISTA';
  }
  return txt;
};

export const relatorio: Relatorio = {
  slug: 'acompanhamentoSony',
  titulo: 'Acompanhamento SONY',
  paisagem: true,
  descricao: 'Vendas item a item dos produtos do fabricante (padrão: grupos SONY-MULTIMIDIA e SONY-FALANTES), com cliente, NF, prazo e vendedor, '
    + 'para enviar ao fabricante. Só a filial atual. O nº da NF só aparece para vendas faturadas pelo sistema web (desde 08/2025); '
    + 'nas demais vale a data da venda. Não há vendas SONY no histórico desde 2025.',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'grupos', rotulo: 'Grupos de produto', tipo: 'lookup', lookup: 'grupo', multiplo: true, ajuda: 'Vazio = grupos SONY-MULTIMIDIA e SONY-FALANTES.' },
    { campo: 'marcas', rotulo: 'Marcas', tipo: 'lookup', lookup: 'marca', multiplo: true, ajuda: 'Opcional; se preenchido junto com grupos, vale o produto que estiver em qualquer um dos dois.' },
    { campo: 'clientes_excluidos', rotulo: 'Clientes excluídos', tipo: 'texto', largura: 2, padrao: '00002,05634,03341,03775,04487,03313',
      ajuda: 'Códigos separados por vírgula (padrão: cliente retira, filiais Melo e HBUSTER, como no Delphi de Manaus).' },
  ],
  colunas: [
    { campo: 'mes', titulo: 'Mês' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'nf', titulo: 'NF' },
    { campo: 'cpfcgc', titulo: 'CNPJ/CPF' },
    { campo: 'nome', titulo: 'Razão social' },
    { campo: 'cidade', titulo: 'Cidade' },
    { campo: 'uf', titulo: 'UF' },
    { campo: 'telefone', titulo: 'Telefone' },
    { campo: 'produto', titulo: 'Produto' },
    { campo: 'qtd', titulo: 'Qtd', tipo: 'numero', total: true },
    { campo: 'prunit', titulo: 'Pr. unitário', tipo: 'moeda' },
    { campo: 'prazo_pgto', titulo: 'Prazo pgto' },
    { campo: 'faturamento', titulo: 'Faturamento', tipo: 'moeda', total: true },
    { campo: 'origem', titulo: 'Origem' },
    { campo: 'classificacao', titulo: 'Classificação da venda' },
    { campo: 'codvend', titulo: 'Cód. vendedor' },
  ],
  async executar(db, p) {
    if (!p.de || !p.ate) throw new RelatorioValidacaoError('Informe o período.');
    const params: any[] = [p.de, p.ate];
    const prod: string[] = [];
    if (p.grupos) { params.push(p.grupos); prod.push(`pd.codgpp = ANY($${params.length})`); }
    if (p.marcas) { params.push(p.marcas); prod.push(`pd.codmarca = ANY($${params.length})`); }
    if (!prod.length) prod.push(`pd.codgpp IN (SELECT codgpp FROM dbgpprod WHERE upper(trim(descr)) IN ('SONY-MULTIMIDIA', 'SONY-FALANTES'))`);
    const onde: string[] = [`(${prod.join(' OR ')})`];
    const excl = listaCodigos(p.clientes_excluidos);
    if (excl) { params.push(excl); onde.push(`v.codcli <> ALL($${params.length})`); }

    const rows = (await semLacoAninhado(db, () => db.query(
      `WITH vf AS MATERIALIZED (
         SELECT DISTINCT ON (x.codvenda) x.codvenda, f.codfat, f.nro_formulario, f.data, f.tipofat, f.tipodest, f.cobranca, f.codgp
           FROM ${VINCULO_VENDA_FATURA} x
           JOIN dbfatura f ON f.codfat = x.codfat AND f.cancel = 'N'
          ORDER BY x.codvenda, f.data, f.codfat
       ), vv AS MATERIALIZED (
         SELECT DISTINCT ON (codvenda) codvenda, codvend FROM dbvvend ORDER BY codvenda, codvend
       ), itens AS MATERIALIZED (
         SELECT v.codvenda, v.codcli, v.tele, v.prazo AS prazo_venda, COALESCE(vf.data, v.data::date) AS dt,
                vf.codfat, vf.nro_formulario, pd.descr AS produto, iv.qtd, iv.prunit,
                COALESCE(vv.codvend, NULLIF(trim(v.codvend), ''), NULLIF(trim(iv.codvend), '')) AS codvend
           FROM dbprod pd
           JOIN dbitvenda iv ON iv.codprod = pd.codprod
           JOIN dbvenda v ON v.codvenda = iv.codvenda
           LEFT JOIN vf ON vf.codvenda = v.codvenda
           LEFT JOIN vv ON vv.codvenda = v.codvenda
          WHERE ${onde.join(' AND ')}
            AND COALESCE(v.cancel, 'N') = 'N'
            AND v.data >= $1::date - 60 AND v.data < $2::date + 1
            AND ((vf.codfat IS NULL AND v.status = 'F')
                 OR (vf.tipofat = '1' AND vf.tipodest = 'C' AND vf.cobranca = 'S' AND vf.codgp IS NULL))
       ), fones AS MATERIALIZED (
         SELECT DISTINCT ON (ct.codcli) ct.codcli, trim(ct.fone) AS fone
           FROM dbclien_contatos ct
          WHERE NULLIF(trim(ct.fone), '') IS NOT NULL AND ct.codcli IN (SELECT codcli FROM itens)
          ORDER BY ct.codcli, ct.codcon
       )
       SELECT to_char(i.dt, 'MM-YY') AS mes_num, i.dt::text AS data, i.nro_formulario AS nf, c.cpfcgc, c.nome, c.cidade, c.uf,
              fo.fone AS telefone,
              i.produto, i.qtd, i.prunit, round((i.qtd * i.prunit)::numeric, 2) AS faturamento,
              (SELECT 'PRAZO: ' || string_agg(trim(z.prazo), '/' ORDER BY NULLIF(regexp_replace(z.prazo, '\\D', '', 'g'), '')::int)
                 FROM dbpzfat z WHERE z.codfat = i.codfat) AS prazo_fatura,
              i.prazo_venda, ${NOME_FILIAL_SQL} AS origem, cv.descr AS classificacao, i.codvend
         FROM itens i
         JOIN dbclien c ON c.codcli = i.codcli
         LEFT JOIN fones fo ON fo.codcli = i.codcli
         LEFT JOIN dbvend ve ON ve.codvend = i.codvend
         LEFT JOIN dbclassevendedor cv ON cv.codcv = ve.codcv
        WHERE i.dt BETWEEN $1::date AND $2::date
          AND (COALESCE(i.tele, 'N') <> 'S' OR ve.codcv IS NULL OR ve.codcv IN ('003', '008'))
        ORDER BY i.dt, c.nome, i.produto`, params))).rows;

    const linhas = numeros(rows, ['qtd', 'prunit', 'faturamento']).map(({ mes_num, prazo_fatura, prazo_venda, ...r }) => {
      const [mm, aa] = String(mes_num).split('-');
      return { ...r, mes: `${MESES[Number(mm) - 1]}-${aa}`, prazo_pgto: prazo_fatura || prazoDaVenda(prazo_venda) };
    });
    return { linhas };
  },
};
