import type { Relatorio } from '../tipos';
import { avisoLacunaVendas, CTE_USUARIOS, diaBR, diaIso, numerar, periodo } from './_utilA';

/**
 * Relatórios › Gerenciais › Vendas Telemarketing por Vendedor (Delphi: FrmRelatorioGeral /
 * TabVendasTmk / RELATO.VENDAS_TELEMKT). Vendas de telemarketing (tele = 'S') em que o vendedor
 * escolhido participa como operador (ou como vendedor externo), mostrando o OUTRO vendedor da venda
 * (o loop do Delphi descartava as linhas do próprio vendedor filtrado), com total por dia.
 * Diferença do legado: os participantes vinham só de dbvvend (operador S/N), que quase não existe no
 * PG; aqui saem também dos itens (dbitvenda.codoperador = operador, dbitvenda.codvend = vendedor
 * externo — é como o histórico foi migrado) e de dbvenda.codvend (vendas do web).
 */
export const relatorio: Relatorio = {
  slug: 'vendasTelemarketing',
  titulo: 'Vendas Telemarketing por Vendedor',
  descricao: 'Vendas de telemarketing não canceladas do período em que o vendedor escolhido participou (como operador ou como vendedor externo), com o parceiro da venda (o outro vendedor), total por dia e geral. Operador e vendedor externo vêm dos itens da venda (histórico) e da venda/dbvvend (vendas do web).',
  filtros: [
    { campo: 'periodo', rotulo: 'Período', tipo: 'periodo', obrigatorio: true, padrao: { de: 'inicio_mes', ate: 'hoje' }, largura: 2 },
    { campo: 'vendedor', rotulo: 'Vendedor', tipo: 'lookup', lookup: 'vendedor', obrigatorio: true },
    { campo: 'operador', rotulo: 'Atuou como operador (telemarketing)', tipo: 'checkbox', padrao: true,
      ajuda: 'Marcado: vendas em que o vendedor foi o operador. Desmarcado: vendas em que ele foi o vendedor externo.' },
  ],
  colunas: [
    { campo: 'dia', titulo: 'Dia' },
    { campo: 'data', titulo: 'Data', tipo: 'data' },
    { campo: 'nrovenda', titulo: 'Nº venda' },
    { campo: 'codcli', titulo: 'Cód. cliente' },
    { campo: 'nomecli', titulo: 'Cliente' },
    { campo: 'usuario', titulo: 'Usuário' },
    { campo: 'total', titulo: 'Total', tipo: 'moeda', total: true },
    { campo: 'codvend', titulo: 'Vendedor parceiro' },
    { campo: 'nomevend', titulo: 'Nome do parceiro' },
    { campo: 'papel', titulo: 'Papel do parceiro' },
  ],
  quebra: 'dia',
  async executar(db, p) {
    const params: any[] = [p.de, p.ate, p.vendedor, p.operador ? 'S' : 'N'];
    const rows = (await db.query(
      `WITH v AS (
         SELECT v.codvenda, v.data, v.tipo, v.nrovenda, v.codcli, v.total, v.codvend, v.codusr
           FROM dbvenda v
          WHERE ${periodo('v.data', 1, 2, true)} AND v.tele = 'S' AND COALESCE(v.cancel, 'N') <> 'S'
       ), part AS (
         SELECT i.codvenda, i.codoperador AS codvend, 'S' AS operador
           FROM dbitvenda i JOIN v ON v.codvenda = i.codvenda WHERE i.codoperador IS NOT NULL
         UNION
         SELECT i.codvenda, i.codvend, 'N'
           FROM dbitvenda i JOIN v ON v.codvenda = i.codvenda WHERE i.codvend IS NOT NULL
         UNION
         SELECT v.codvenda, v.codvend, 'N' FROM v WHERE v.codvend IS NOT NULL
         UNION
         SELECT x.codvenda, x.codvend, x.operador FROM dbvvend x JOIN v ON v.codvenda = x.codvenda
       ), alvo AS (
         SELECT DISTINCT codvenda FROM part WHERE codvend = $3 AND operador = $4
       ), ${CTE_USUARIOS}
       SELECT ${diaBR('v.data', true)} AS dia, ${diaIso('v.data', true)} AS data,
              COALESCE(v.tipo, '') || COALESCE(v.nrovenda, v.codvenda) AS nrovenda,
              v.codcli, c.nome AS nomecli, COALESCE(u.nomeusr, v.codusr) AS usuario,
              round(COALESCE(v.total, 0)::numeric, 2) AS total,
              pa.codvend, ve.nome AS nomevend,
              CASE pa.operador WHEN 'S' THEN 'Operador' ELSE 'Vendedor externo' END AS papel
         FROM alvo a
         JOIN v ON v.codvenda = a.codvenda
         JOIN part pa ON pa.codvenda = v.codvenda AND pa.codvend <> $3
         LEFT JOIN dbclien c ON c.codcli = v.codcli
         LEFT JOIN dbvend ve ON ve.codvend = pa.codvend
         LEFT JOIN usr u ON u.codusr = lpad(v.codusr, 4, '0')
        ORDER BY v.data, v.nrovenda, pa.codvend`, params)).rows;
    return { linhas: numerar(rows, ['total']), avisos: await avisoLacunaVendas(db, p.de, p.ate) };
  },
};
