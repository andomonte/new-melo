import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { dtini, dtfim, banco } = req.query;

    if (!dtini || !dtfim) {
      return res.status(400).json({ erro: 'Datas inicial e final são obrigatórias' });
    }

    // Query para buscar dados de remessa baseado no período
    // Se banco for informado, filtra por banco bancário (CNAB)
    // Se não, busca recebimentos para Equifax (remessa de crédito)
    const isRemessaBancaria = banco && (banco === '237' || banco === '033');

    let query = '';
    let params: any[] = [];

    if (isRemessaBancaria) {
      // Remessa BANCÁRIA (CNAB) - Títulos a RECEBER
      query = `
        SELECT
          c.codcli as codcli,
          c.cpfcgc,
          c.nome,
          c.ender as endereco,
          c.cidade,
          c.uf,
          c.cep,
          c.contato as telefone,
          c.bairro,
          c.numero,
          c.complemento,
          -- Dados do título a receber
          r.nro_doc,
          r.dt_emissao,
          r.dt_venc,
          r.valor_pgto,
          r.cod_receb,
          r.banco,
          -- Status do título
          CASE
            WHEN r.rec = 'S' THEN 'RECEBIDO'
            WHEN r.cancel = 'S' THEN 'CANCELADO'
            ELSE 'EM ABERTO'
          END as status_titulo,
          -- Informações adicionais
          b.nome as nome_banco
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
        LEFT JOIN db_manaus.dbbanco b ON b.cod_banco = r.banco
        WHERE r.dt_venc BETWEEN $1 AND $2
          AND r.cancel = 'N'
          AND r.rec = 'N'
          AND r.banco = $3
          AND r.valor_pgto > 0
          AND c.cpfcgc IS NOT NULL AND c.cpfcgc != ''
        ORDER BY r.dt_venc, c.nome
      `;
      params = [dtini, dtfim, banco];
    } else {
      // Remessa EQUIFAX (crédito) - RECEBIMENTOS (pagamentos já efetuados)
      query = `
        SELECT
          c.codcli as codcli,
          c.cpfcgc,
          c.nome,
          c.ender as endereco,
          c.cidade,
          c.uf,
          c.cep,
          c.contato as telefone,
          c.bairro,
          c.numero,
          c.complemento,
          -- Dados do recebimento/pagamento
          r.nro_doc,
          r.dt_emissao,
          r.dt_venc,
          r.dt_pgto,
          r.valor_pgto,
          r.cod_receb,
          -- Status do cliente
          CASE
            WHEN c.status = 'I' THEN 'INATIVO'
            WHEN c.status = 'B' THEN 'BLOQUEADO'
            ELSE 'ATIVO'
          END as status_cliente,
          -- Contagem de vendas do cliente no período (para estatísticas)
          (
            SELECT COUNT(*)
            FROM dbvenda v
            WHERE v.codcli = c.codcli
              AND v.data BETWEEN $1 AND $2
              AND v.cancel = 'N'
              AND v.status <> 'CANCELADO'
          ) as total_vendas,
          -- Valor total das vendas do cliente no período
          (
            SELECT COALESCE(SUM(v.total), 0)
            FROM dbvenda v
            WHERE v.codcli = c.codcli
              AND v.data BETWEEN $1 AND $2
              AND v.cancel = 'N'
              AND v.status <> 'CANCELADO'
          ) as valor_total_vendas,
          -- Última venda do cliente
          (
            SELECT MAX(v.data)
            FROM dbvenda v
            WHERE v.codcli = c.codcli
              AND v.data BETWEEN $1 AND $2
              AND v.cancel = 'N'
              AND v.status <> 'CANCELADO'
          ) as ultima_venda
        FROM db_manaus.dbreceb r
        LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
        WHERE r.dt_pgto BETWEEN $1 AND $2
          AND r.cancel = 'N'
          AND r.rec = 'S'
          AND r.valor_pgto > 0
          AND c.cpfcgc IS NOT NULL AND c.cpfcgc != ''
        ORDER BY r.dt_pgto DESC, c.nome
      `;
      params = [dtini, dtfim];
    }

    const result = await pool.query(query, params);

    // Formatar os dados para exibição
    const dadosFormatados = result.rows.map(row => {
      const baseData = {
        codcli: row.codcli,
        cpfcgc: row.cpfcgc,
        nome: row.nome,
        endereco: `${row.endereco}${row.numero ? ', ' + row.numero : ''}${row.complemento ? ' ' + row.complemento : ''}`,
        cidade: row.cidade,
        uf: row.uf,
        cep: row.cep,
        bairro: row.bairro,
        telefone: row.telefone,
        nro_doc: row.nro_doc,
        dt_emissao: row.dt_emissao ? new Date(row.dt_emissao).toLocaleDateString('pt-BR') : null,
        dt_venc: row.dt_venc ? new Date(row.dt_venc).toLocaleDateString('pt-BR') : null,
        valor_pgto: parseFloat(row.valor_pgto) || 0,
        cod_receb: row.cod_receb
      };

      if (isRemessaBancaria) {
        // Dados específicos de remessa bancária
        return {
          ...baseData,
          banco: row.banco,
          nome_banco: row.nome_banco,
          status_titulo: row.status_titulo
        };
      } else {
        // Dados específicos de remessa Equifax
        return {
          ...baseData,
          dt_pgto: row.dt_pgto ? new Date(row.dt_pgto).toLocaleDateString('pt-BR') : null,
          total_vendas: parseInt(row.total_vendas) || 0,
          valor_total_vendas: parseFloat(row.valor_total_vendas) || 0,
          ultima_venda: row.ultima_venda ? new Date(row.ultima_venda).toLocaleDateString('pt-BR') : null,
          status_cliente: row.status_cliente
        };
      }
    });

    // Estatísticas
    let estatisticas;
    if (isRemessaBancaria) {
      estatisticas = {
        total_clientes: new Set(dadosFormatados.map(r => r.codcli)).size,
        total_titulos: dadosFormatados.length,
        valor_total: dadosFormatados.reduce((sum, r) => sum + r.valor_pgto, 0),
        banco: banco === '237' ? 'BRADESCO' : 'SANTANDER',
        cod_banco: banco
      };
    } else {
      // Para Equifax, precisamos fazer type assertion pois sabemos que tem status_cliente
      const dadosEquifax = dadosFormatados as any[];
      estatisticas = {
        total_clientes: new Set(dadosEquifax.map(r => r.codcli)).size,
        clientes_ativos: new Set(dadosEquifax.filter(r => r.status_cliente === 'ATIVO').map(r => r.codcli)).size,
        clientes_bloqueados: new Set(dadosEquifax.filter(r => r.status_cliente === 'BLOQUEADO').map(r => r.codcli)).size,
        clientes_inativos: new Set(dadosEquifax.filter(r => r.status_cliente === 'INATIVO').map(r => r.codcli)).size,
        clientes_com_vendas: new Set(dadosEquifax.filter(r => r.total_vendas > 0).map(r => r.codcli)).size,
        valor_total_vendas: dadosEquifax.reduce((sum, r) => sum + r.valor_total_vendas, 0),
        valor_total_pendente: 0,
        clientes_para_remessa: new Set(dadosEquifax.map(r => r.codcli)).size,
        total_recebimentos: dadosEquifax.length,
        valor_total_recebimentos: dadosEquifax.reduce((sum, r) => sum + r.valor_pgto, 0)
      };
    }

    res.status(200).json({
      sucesso: true,
      dados: dadosFormatados,
      estatisticas,
      periodo: {
        inicio: dtini,
        fim: dtfim
      }
    });

  } catch (error: any) {
    console.error('Erro ao consultar dados de remessa:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}