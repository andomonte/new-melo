import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface NFeItem {
  id: string;
  referencia: string;
  descricao: string;
  codigoBarras?: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  nitem: string;
}

interface NFeItensResponse {
  data: NFeItem[];
  success: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NFeItensResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId } = req.query;

  if (!nfeId) {
    return res.status(400).json({ error: 'ID da NFe é obrigatório' });
  }

  let client;

  try {
    client = await pool.connect();
    console.log('Buscando itens da NFe:', nfeId);
    
    // Buscar itens da NFe no banco usando a nova estrutura
    let itensResult;
    if (!isNaN(parseInt(nfeId as string))) {
      // Se nfeId é um número, buscar por ID da NFe
      itensResult = await client.query(`
        SELECT 
          ni.id::text,
          ni.codigo_produto_nfe as referencia,
          ni.descricao,
          ni.codigo_barras as "codigoBarras",
          ni.ncm,
          ni.cfop,
          ni.unidade,
          ni.quantidade,
          ni.valor_unitario as "valorUnitario",
          ni.valor_total as "valorTotal",
          ni.nitem
        FROM nfe_itens ni
        WHERE ni.nfe_id = $1
        ORDER BY ni.nitem::integer
      `, [parseInt(nfeId as string)]);
    } else {
      // Se não é um número, buscar por chave_nfe ou numero_nf
      itensResult = await client.query(`
        SELECT 
          ni.id::text,
          ni.codigo_produto_nfe as referencia,
          ni.descricao,
          ni.codigo_barras as "codigoBarras",
          ni.ncm,
          ni.cfop,
          ni.unidade,
          ni.quantidade,
          ni.valor_unitario as "valorUnitario",
          ni.valor_total as "valorTotal",
          ni.nitem
        FROM nfe_itens ni
        JOIN nfe_entrada ne ON ni.nfe_id = ne.id
        WHERE ne.chave_nfe = $1 OR ne.numero_nf = $1
        ORDER BY ni.nitem::integer
      `, [nfeId]);
    }

    console.log('Itens encontrados no banco:', itensResult.rows);

    if (itensResult.rows.length === 0) {
      console.log('Nenhum item encontrado para a NFe:', nfeId);
      return res.status(200).json({
        data: [],
        success: true
      });
    }

    console.log('Retornando itens reais da NFe:', itensResult.rows);
    
    res.status(200).json({
      data: itensResult.rows,
      success: true
    });

  } catch (error) {
    console.error('Erro ao buscar itens da NFe:', error);
    res.status(500).json({ 
      error: 'Falha ao buscar itens da NFe' 
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}