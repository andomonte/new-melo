import { NextApiRequest, NextApiResponse } from 'next';
import { consultarTitulosCliente } from '@/lib/oracleService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { codcli, tipo = '1', taxa_juros = '8' } = req.query;

    if (!codcli) {
      return res.status(400).json({ 
        erro: 'Parâmetro obrigatório: codcli' 
      });
    }

    const tipoValido = ['1', '2', '3', '4', '5', '6'].includes(tipo as string);
    if (!tipoValido) {
      return res.status(400).json({ 
        erro: 'Tipo inválido. Use: 1=Atrasados, 2=Em dia, 3=Vencimentos, 4=Histórico vendas, 5=Prazo médio, 6=A vencer' 
      });
    }

    const titulos = await consultarTitulosCliente(
      codcli as string,
      tipo as '1' | '2' | '3' | '4' | '5' | '6',
      parseFloat(taxa_juros as string)
    );

    // Mapear nomes das colunas de acordo com o tipo
    let titulosFormatados;

    if (tipo === '1' || tipo === '2') {
      // Títulos atrasados ou em dia
      titulosFormatados = titulos.map((row: any) => ({
        nro_doc: row[0],
        cod_receb: row[1],
        dt_emissao: row[2],
        dt_pgto: row[3],
        dt_venc: row[4],
        valor_pgto: row[5],
        valor_rec: row[6],
        valor_aberto: row[7],
        cod_conta: row[8],
        codcli: row[9],
        nome_cli: row[10],
        dias: row[11],
        valor_juros: row[12]
      }));
    } else if (tipo === '3') {
      // Vencimentos por mês
      titulosFormatados = titulos.map((row: any) => ({
        vencimento: row[0],
        ordem: row[1],
        total_pagamento: row[2]
      }));
    } else if (tipo === '4') {
      // Histórico de vendas
      titulosFormatados = titulos.map((row: any) => ({
        data: row[0],
        ordem: row[1],
        total: row[2]
      }));
    } else if (tipo === '5') {
      // Prazo médio
      titulosFormatados = titulos.map((row: any) => ({
        data: row[0],
        ordem: row[1],
        prazo_medio: row[2],
        total: row[3]
      }));
    } else if (tipo === '6') {
      // Títulos a vencer
      titulosFormatados = titulos.map((row: any) => ({
        nro_doc: row[0],
        cod_receb: row[1],
        dt_emissao: row[2],
        dt_pgto: row[3],
        dt_venc: row[4],
        ordem: row[5],
        valor_pgto: row[6],
        valor_rec: row[7],
        cod_conta: row[8],
        codcli: row[9],
        nome_cli: row[10]
      }));
    } else {
      titulosFormatados = titulos;
    }

    const descricoes: Record<string, string> = {
      '1': 'Títulos Atrasados',
      '2': 'Títulos em Dia',
      '3': 'Vencimentos por Mês',
      '4': 'Histórico de Vendas',
      '5': 'Prazo Médio',
      '6': 'Títulos a Vencer'
    };

    res.status(200).json({
      sucesso: true,
      tipo: tipo,
      tipo_descricao: descricoes[tipo as string] || 'Desconhecido',
      codcli: codcli,
      taxa_juros: parseFloat(taxa_juros as string),
      total_registros: titulosFormatados.length,
      titulos: titulosFormatados
    });

  } catch (error: any) {
    console.error('❌ Erro ao consultar títulos do cliente:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
