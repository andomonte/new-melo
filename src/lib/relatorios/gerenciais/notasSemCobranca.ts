import type { ColunaDef, Relatorio } from '../tipos';
import { CFOP_SEM_COBRANCA, DOC_FATURA, FATURA_CLIENTE, consultar, numerosDasColunas, periodo } from './_utilB';

/**
 * Relatórios › Gerenciais › Relatório de Notas sem Cobrança ("Detalhamento Notas sem cobrança")
 * (Delphi: frmRelFatura / TabNotaSemCobranca — procedure NOTASSEMCOBRANCA).
 * Notas sem cobrança (mesma regra de "Faturas sem Títulos": cobranca='N' e CFOP da lista fixa) cuja venda é
 * de Telemarketing (dbvenda.tele='S') ou Externa ('N'), com o vendedor e o usuário que fez a venda.
 * Diferenças: a ligação nota → venda usa dbprodfat.codvenda, fatura_venda (web) e dbfecharvendas (o legado só
 * dbfecharvendas); o vendedor vem do item da venda — operador (codoperador) na venda tele, vendedor (codvend)
 * na externa — no lugar de dbvvend, que não foi migrada. Só há vínculo nota × venda a partir de 08/2025.
 */
const colunas: ColunaDef[] = [
  { campo: 'nroform', titulo: 'Nro. form.' },
  { campo: 'data', titulo: 'Data', tipo: 'data' },
  { campo: 'codfat', titulo: 'Fatura' },
  { campo: 'cliente', titulo: 'Cliente' },
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'tipo_vendedor', titulo: 'Tp. vendedor' },
  { campo: 'documento', titulo: 'Tp. nota' },
  { campo: 'usuario', titulo: 'Usuário' },
  { campo: 'vendas', titulo: 'Venda(s)' },
  { campo: 'totalfat', titulo: 'T. fatura', tipo: 'moeda', total: true },
  { campo: 'totalnf', titulo: 'T. nota', tipo: 'moeda', total: true },
];

export const relatorio: Relatorio = {
  slug: 'notasSemCobranca',
  titulo: 'Relatório de Notas sem Cobrança',
  descricao:
    'Notas sem cobrança gerada (indicador de cobrança = "N" e CFOP de venda) cuja venda é de telemarketing ou externa, com o vendedor (operador, na venda de telemarketing) e o usuário que fez a venda. ' +
    'Só aparecem as notas ligadas a uma venda — no banco novo esse vínculo existe a partir de 08/2025 (notas emitidas pelo web).',
  paisagem: true,
  filtros: [
    { campo: 'periodo', rotulo: 'Período (data da nota)', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' } },
    { campo: 'tipo', rotulo: 'Tipo de venda', tipo: 'select', obrigatorio: true, padrao: 'S',
      opcoes: [{ valor: 'S', rotulo: 'Telemarketing' }, { valor: 'N', rotulo: 'Externo' }, { valor: 'T', rotulo: 'Todos' }] },
  ],
  colunas,
  async executar(db, p) {
    const { de, ate } = periodo(p);
    const params: any[] = [de, ate, CFOP_SEM_COBRANCA];
    const ondeVenda: string[] = [];
    if (p.tipo === 'S' || p.tipo === 'N') { params.push(p.tipo); ondeVenda.push(`COALESCE(v.tele, 'N') = $${params.length}`); }
    const linhas = await consultar(db,
      `WITH nf AS (
         SELECT f.* FROM dbfatura f
          WHERE f.data BETWEEN $1::date AND $2::date AND f.cancel = 'N' AND ${FATURA_CLIENTE('f')}
            AND f.cobranca = 'N' AND COALESCE(NULLIF(f.cfop1, ''), '0') = ANY($3)),
       lig AS (
         SELECT DISTINCT pf.codfat, pf.codvenda FROM dbprodfat pf JOIN nf ON nf.codfat = pf.codfat WHERE pf.codvenda IS NOT NULL
         UNION SELECT fv.codfat, fv.codvenda FROM fatura_venda fv JOIN nf ON nf.codfat = fv.codfat WHERE COALESCE(fv.status, 'ativo') = 'ativo'
         UNION SELECT fe.codfat, fe.codvenda FROM dbfecharvendas fe JOIN nf ON nf.codfat = fe.codfat),
       vv AS (  -- vendedor da venda: operador na venda tele, vendedor na externa (no lugar de dbvvend)
         SELECT iv.codvenda, max(NULLIF(iv.codoperador, '')) AS codoperador, max(NULLIF(iv.codvend, '')) AS codvend
           FROM dbitvenda iv JOIN lig ON lig.codvenda = iv.codvenda GROUP BY 1)
       SELECT nf.nroform, to_char(nf.data, 'YYYY-MM-DD') AS data, nf.codfat, nf.codcli || ' - ' || COALESCE(c.nome, '') AS cliente,
              string_agg(DISTINCT COALESCE(ve.nome, '(sem vendedor)'), ', ') AS vendedor,
              string_agg(DISTINCT CASE WHEN v.tele = 'S' THEN 'TELEMARKETING' ELSE 'EXTERNO' END, ', ') AS tipo_vendedor,
              ${DOC_FATURA('nf')} AS documento,
              string_agg(DISTINCT u.nomeusr, ', ') AS usuario,
              string_agg(DISTINCT COALESCE(v.tipo, '') || COALESCE(v.nrovenda, v.codvenda), ', ') AS vendas,
              nf.totalfat, nf.totalnf
         FROM nf
         JOIN lig ON lig.codfat = nf.codfat
         JOIN dbvenda v ON v.codvenda = lig.codvenda
         LEFT JOIN vv ON vv.codvenda = v.codvenda
         LEFT JOIN dbvend ve ON ve.codvend = CASE WHEN v.tele = 'S' THEN COALESCE(vv.codoperador, vv.codvend) ELSE COALESCE(vv.codvend, v.codvend) END
         LEFT JOIN dbclien c ON c.codcli = nf.codcli
         LEFT JOIN dbusuario u ON u.codusr = v.codusr
        ${ondeVenda.length ? `WHERE ${ondeVenda.join(' AND ')}` : ''}
        GROUP BY nf.codfat, nf.nroform, nf.data, nf.codcli, c.nome, nf.tipofat, nf.totalfat, nf.totalnf
        ORDER BY nf.nroform`, params);
    return { linhas: numerosDasColunas(linhas, colunas) };
  },
};
