import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const pool = getPgPool(filial);
  const { id } = req.query;

  if (req.method === 'GET') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Buscar dados da entrada (ordem de compra)
      const entradaResult = await client.query(`
        SELECT
          o.orc_id,
          o.orc_data,
          o.orc_status,
          r.req_id_composto,
          r.req_cod_credor,
          r.req_codcomprador,
          r.req_data,
          r.req_observacao,
          r.req_cond_pagto,
          r.req_previsao_chegada,
          c.nome as comprador_nome,
          cr.nome as fornecedor_nome,
          cr.cpf_cgc as fornecedor_cnpj,
          cr.endereco as fornecedor_endereco,
          cr.cidade as fornecedor_cidade,
          cr.uf as fornecedor_uf,
          cr.cep as fornecedor_cep,
          cr.contatos as fornecedor_telefone
        FROM db_manaus.cmp_ordem_compra o
        JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
        LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
        LEFT JOIN db_manaus.dbcredor cr ON r.req_cod_credor = cr.cod_credor
        WHERE o.orc_id = $1
      `, [Number(id)]);

      // Buscar itens da entrada
      const itensResult = await client.query(`
        SELECT
          ri.itr_codprod as codprod,
          ri.itr_pr_unitario as preco_unitario,
          ri.itr_quantidade as quantidade,
          (ri.itr_quantidade * ri.itr_pr_unitario) as preco_total,
          ri.itr_quantidade_atendida as quantidade_atendida,
          p.descricao as produto_descricao,
          p.ref as produto_referencia,
          p.marca as produto_marca
        FROM db_manaus.cmp_ordem_compra o
        JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
        JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
        LEFT JOIN dbprod p ON ri.itr_codprod = p.codprod
        WHERE o.orc_id = $1
        ORDER BY ri.itr_codprod
      `, [Number(id)]);

      await client.query('COMMIT');

      const entrada = entradaResult.rows[0];
      const itens = itensResult.rows;

      if (!entrada) {
        return res.status(404).json({ error: 'Entrada não encontrada' });
      }

      // Transformar dados para o formato esperado pelo frontend
      const entradaFormatted = {
        id: entrada.orc_id.toString(),
        numeroNF: entrada.req_id_composto || entrada.orc_id.toString(),
        serie: '001',
        fornecedorNome: entrada.fornecedor_nome || 'N/A',
        fornecedorCnpj: entrada.fornecedor_cnpj || '',
        dataEmissao: entrada.req_data ? new Date(entrada.req_data).toISOString() : '',
        dataEntrada: entrada.orc_data ? new Date(entrada.orc_data).toISOString() : '',
        valorTotal: itens.reduce((sum, item) => sum + (Number(item.preco_total?.toString()) || 0), 0),
        status: entrada.orc_status === 'P' ? 'P' :
                entrada.orc_status === 'C' ? 'C' : 'F',
        tipoEntrada: 'MANUAL',
        comprador: entrada.comprador_nome || '',
        observacao: entrada.req_observacao || '',
        condicoesPagamento: entrada.req_cond_pagto || '',
        previsaoChegada: entrada.req_previsao_chegada ? new Date(entrada.req_previsao_chegada).toISOString() : '',

        // Dados do fornecedor
        dadosFornecedor: {
          razaoSocial: entrada.fornecedor_nome || '',
          cnpj: entrada.fornecedor_cnpj || '',
          endereco: {
            logradouro: entrada.fornecedor_endereco || '',
            cidade: entrada.fornecedor_cidade || '',
            uf: entrada.fornecedor_uf || '',
            cep: entrada.fornecedor_cep || '',
          },
          telefone: entrada.fornecedor_telefone || '',
        },

        // Itens da entrada
        itens: itens.map(item => ({
          codigo: item.codprod || '',
          descricao: item.produto_descricao || '',
          referencia: item.produto_referencia || '',
          marca: item.produto_marca || '',
          quantidade: Number(item.quantidade?.toString()) || 0,
          quantidadeAtendida: Number(item.quantidade_atendida?.toString()) || 0,
          valorUnitario: Number(item.preco_unitario?.toString()) || 0,
          valorTotal: Number(item.preco_total?.toString()) || 0,
        })),
      };

      res.status(200).json(entradaFormatted);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao carregar entrada:', error);
      res.status(500).json({ error: (error as Error).message });
    } finally {
      client.release();
    }
  } else if (req.method === 'PUT') {
    const client = await pool.connect();
    try {
      const { status, observacao } = req.body;

      await client.query('BEGIN');

      // Atualizar status da ordem de compra
      await client.query(`
        UPDATE db_manaus.cmp_ordem_compra
        SET orc_status = $1
        WHERE orc_id = $2
      `, [status, Number(id)]);

      if (observacao) {
        // Atualizar observação na requisição
        await client.query(`
          UPDATE db_manaus.cmp_requisicao
          SET req_observacao = $1
          WHERE req_id = (
            SELECT orc_req_id FROM db_manaus.cmp_ordem_compra WHERE orc_id = $2
          )
        `, [observacao, Number(id)]);
      }

      await client.query('COMMIT');

      res.status(200).json({ message: 'Entrada atualizada com sucesso' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao atualizar entrada:', error);
      res.status(500).json({ error: (error as Error).message });
    } finally {
      client.release();
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
