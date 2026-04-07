/**
 * API de Busca Automática de Ordem de Compra para NFe
 *
 * Implementa 3 estratégias de busca:
 * 1. xPed do XML - Busca direta pelo campo <xPed> nos itens
 * 2. Parser infCpl - Extrai O.C./N.PEDIDO das informações complementares
 * 3. Sugestão inteligente - Sugere ordens abertas do fornecedor
 *
 * @method POST
 * @route /api/entrada-xml/buscar-ordem-automatica
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import {
  buscarAssociacaoOrdem,
  buscarPorXPed,
  buscarPorInfCpl,
  buscarSugestoesFornecedor,
  DadosNFe,
  ItemNFe,
  ResultadoAssociacao
} from '@/lib/compras/associacaoOrdemHelper';

interface RequestBody {
  // Dados básicos da NFe
  chave: string;
  numero: string;
  serie: string;
  cnpjEmitente: string;
  nomeEmitente?: string;
  dataEmissao?: string;
  valorTotal?: number;
  infCpl?: string;

  // Itens da NFe
  itens: Array<{
    nItem: string;
    cProd: string;
    xProd: string;
    qCom: number;
    vUnCom: number;
    xPed?: string;
    nItemPed?: string;
  }>;

  // Opções de busca
  estrategias?: ('xped' | 'infcpl' | 'sugestao')[];
  limiteResultados?: number;
}

interface ResponseBody {
  success: boolean;
  data?: {
    metodo_utilizado: string;
    ordens: Array<{
      orc_id: number;
      req_id: number;
      req_versao: number;
      req_id_composto: string;
      fornecedor_nome: string;
      fornecedor_cnpj: string;
      data_ordem: string;
      status: string;
      valor_total: number;
      fonte: string;
      score?: number;
      itens_match?: Array<{
        codprod: string;
        referencia: string;
        descricao: string;
        quantidade_oc: number;
        quantidade_nfe: number;
        quantidade_disponivel: number;
      }>;
    }>;
    detalhes: {
      xped_encontrado: string[];
      infcpl_extraido: string[];
      total_sugestoes: number;
    };
  };
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  const body: RequestBody = req.body;

  // Validações básicas
  if (!body.chave || !body.cnpjEmitente) {
    return res.status(400).json({
      success: false,
      error: 'Chave da NFe e CNPJ do emitente são obrigatórios'
    });
  }

  if (!body.itens || body.itens.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Itens da NFe são obrigatórios'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    console.log('🔍 [API] Busca automática de ordem para NFe:', body.chave);
    console.log('📦 [API] Total de itens:', body.itens.length);
    console.log('🏢 [API] CNPJ Fornecedor:', body.cnpjEmitente);

    // Montar dados da NFe
    const dadosNFe: DadosNFe = {
      chave: body.chave,
      numero: body.numero || '',
      serie: body.serie || '',
      cnpjEmitente: body.cnpjEmitente,
      nomeEmitente: body.nomeEmitente || '',
      dataEmissao: body.dataEmissao || new Date().toISOString(),
      valorTotal: body.valorTotal || 0,
      infCpl: body.infCpl,
      itens: body.itens.map(item => ({
        nItem: item.nItem,
        cProd: item.cProd,
        xProd: item.xProd,
        qCom: item.qCom,
        vUnCom: item.vUnCom,
        xPed: item.xPed,
        nItemPed: item.nItemPed
      }))
    };

    // Log dos xPeds encontrados nos itens
    const xPedsNosItens = dadosNFe.itens
      .filter(i => i.xPed)
      .map(i => `Item ${i.nItem}: ${i.xPed}`);

    if (xPedsNosItens.length > 0) {
      console.log('📋 [API] xPeds encontrados nos itens:', xPedsNosItens);
    }

    let resultado: ResultadoAssociacao;

    // Se especificou estratégias específicas, executar apenas elas
    if (body.estrategias && body.estrategias.length > 0) {
      console.log('🎯 [API] Executando estratégias específicas:', body.estrategias);

      const resultados: ResultadoAssociacao[] = [];

      for (const estrategia of body.estrategias) {
        switch (estrategia) {
          case 'xped':
            resultados.push(await buscarPorXPed(client, dadosNFe.itens));
            break;
          case 'infcpl':
            resultados.push(await buscarPorInfCpl(client, dadosNFe.infCpl, dadosNFe.cnpjEmitente, dadosNFe.itens));
            break;
          case 'sugestao':
            resultados.push(await buscarSugestoesFornecedor(
              client,
              dadosNFe.cnpjEmitente,
              dadosNFe.itens,
              dadosNFe.dataEmissao
            ));
            break;
        }
      }

      // Combinar resultados
      const todasOrdens = resultados.flatMap(r => r.ordens);
      const ordemUnica = todasOrdens.filter((ordem, index, self) =>
        index === self.findIndex(o => o.orc_id === ordem.orc_id)
      );

      // Ordenar por score
      ordemUnica.sort((a, b) => (b.score || 0) - (a.score || 0));

      resultado = {
        sucesso: ordemUnica.length > 0,
        metodo: resultados.find(r => r.sucesso)?.metodo || 'nenhum',
        ordens: ordemUnica.slice(0, body.limiteResultados || 10),
        mensagem: ordemUnica.length > 0
          ? `Encontrada(s) ${ordemUnica.length} ordem(ns)`
          : 'Nenhuma ordem encontrada',
        detalhes: {
          xped_encontrado: resultados.find(r => r.metodo === 'xped')?.detalhes?.xped_encontrado || [],
          infcpl_extraido: resultados.find(r => r.metodo === 'infcpl')?.detalhes?.infcpl_extraido || [],
          total_sugestoes: resultados.find(r => r.metodo === 'sugestao')?.detalhes?.total_sugestoes || 0
        }
      };
    } else {
      // Executar busca completa (todas as estratégias em sequência)
      resultado = await buscarAssociacaoOrdem(client, dadosNFe);
    }

    // Limitar resultados se especificado
    if (body.limiteResultados && resultado.ordens.length > body.limiteResultados) {
      resultado.ordens = resultado.ordens.slice(0, body.limiteResultados);
    }

    console.log(`✅ [API] Resultado: ${resultado.metodo} - ${resultado.ordens.length} ordens encontradas`);

    return res.status(200).json({
      success: resultado.sucesso,
      data: {
        metodo_utilizado: resultado.metodo,
        ordens: resultado.ordens,
        detalhes: resultado.detalhes || {
          xped_encontrado: [],
          infcpl_extraido: [],
          total_sugestoes: 0
        }
      },
      message: resultado.mensagem
    });

  } catch (error) {
    console.error('❌ [API] Erro na busca automática de ordem:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar ordem de compra',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
