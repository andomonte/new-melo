import type { NextApiRequest, NextApiResponse } from 'next';
import { selecionarTipoEmissao } from '@/services/fiscal/selecionarTipoEmissao';
import axios from 'axios';

/**
 * API Unificada para Emissão Fiscal
 * 
 * Decide automaticamente entre NF-e (CNPJ) ou NFC-e (CPF)
 * baseado no documento do destinatário
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const dados = req.body;

    console.log('📋 API Unificada - Iniciando processo de emissão fiscal');

    // 1. Identificar documento do destinatário
    const documentoDestinatario = 
      dados?.dbclien?.cpf_cnpj || 
      dados?.dbclien?.cpfcnpj || 
      dados?.dbclien?.cnpj || 
      dados?.dbclien?.cpf ||
      dados?.destinatario?.cpf_cnpj ||
      '';

    if (!documentoDestinatario) {
      console.error('❌ Documento do destinatário não encontrado');
      return res.status(400).json({ 
        erro: 'Documento do destinatário não encontrado',
        detalhes: 'CPF ou CNPJ do cliente é obrigatório para emissão fiscal'
      });
    }

    // 2. Selecionar tipo de emissão
    const selecao = selecionarTipoEmissao(documentoDestinatario);

    console.log('🎯 Tipo de emissão selecionado:', {
      documento: documentoDestinatario,
      tipoEmissao: selecao.tipoEmissao,
      modelo: selecao.modelo,
      descricao: selecao.descricao,
      endpoint: selecao.endpoint
    });

    // 3. Chamar a API específica
    const baseUrl = req.headers.host?.includes('localhost') 
      ? `http://${req.headers.host}`
      : `https://${req.headers.host}`;

    const urlApi = `${baseUrl}${selecao.endpoint}`;

    console.log(`📤 Redirecionando para: ${urlApi}`);

    // Fazer a requisição para a API específica
    const response = await axios.post(urlApi, dados, {
      headers: {
        'Content-Type': 'application/json',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000, // 2 minutos
    });

    // Retornar a resposta da API específica
    return res.status(response.status).json({
      ...response.data,
      tipoEmissao: selecao.tipoEmissao,
      modelo: selecao.modelo,
      descricao: selecao.descricao
    });

  } catch (error: any) {
    console.error('❌ Erro na API unificada de emissão:', error);

    // Se o erro veio de uma requisição axios
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    // Erro genérico
    return res.status(500).json({
      erro: 'Erro ao processar emissão fiscal',
      mensagem: error.message,
      detalhes: error.stack
    });
  }
}
