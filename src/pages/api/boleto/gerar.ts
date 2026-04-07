import type { NextApiRequest, NextApiResponse } from 'next';
import { getAsaasClient } from '@/lib/asaas';
import { getPgPool } from '@/lib/pg';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { codfat, valor, vencimento, descricao } = req.body;

    // Validações
    if (!codfat) {
      return res.status(400).json({ erro: 'codfat é obrigatório' });
    }

    if (!valor || valor <= 0) {
      return res.status(400).json({ erro: 'Valor inválido' });
    }

    if (!vencimento) {
      return res.status(400).json({ erro: 'Data de vencimento é obrigatória' });
    }

    console.log('🎫 [Boleto] Iniciando geração de boleto:', {
      codfat,
      valor,
      vencimento,
    });

    // 1. Buscar dados da fatura e cliente no banco
    const client = await pool!.connect();
    let dadosFatura;
    let dadosCliente;

    try {
      const resultFatura = await client.query(
        `SELECT f.*, c.nome, c.cpfcgc, c.email, c.telefone, c.celular, 
                c.endereco, c.numero, c.complemento, c.bairro, c.cep
         FROM db_manaus.dbfatura f
         INNER JOIN db_manaus.dbclien c ON c.codcli = f.codcli
         WHERE f.codfat = $1`,
        [codfat],
      );

      if (resultFatura.rows.length === 0) {
        return res.status(404).json({ erro: 'Fatura não encontrada' });
      }

      dadosFatura = resultFatura.rows[0];
      dadosCliente = {
        nome: dadosFatura.nome,
        cpfCnpj: dadosFatura.cpfcgc?.replace(/\D/g, ''),
        email: dadosFatura.email,
        telefone: dadosFatura.telefone,
        celular: dadosFatura.celular,
        endereco: dadosFatura.endereco,
        numero: dadosFatura.numero,
        complemento: dadosFatura.complemento,
        bairro: dadosFatura.bairro,
        cep: dadosFatura.cep,
      };

      console.log('✅ [Boleto] Dados da fatura carregados:', {
        codfat,
        cliente: dadosCliente.nome,
        cpfCnpj: dadosCliente.cpfCnpj,
      });
    } finally {
      client.release();
    }

    // 2. Gerar boleto no Asaas
    const asaas = getAsaasClient();
    const resultado = await asaas.gerarBoleto({
      cliente: dadosCliente,
      cobranca: {
        valor: parseFloat(valor),
        vencimento: vencimento, // Formato: YYYY-MM-DD
        descricao: descricao || `Fatura ${codfat}`,
        referencia: codfat,
        multa: 2, // 2% de multa após vencimento
        juros: 1, // 1% de juros ao mês
      },
    });

    console.log('✅ [Boleto] Boleto gerado com sucesso:', {
      cobrancaId: resultado.cobrancaId,
      linhaDigitavel: resultado.linhaDigitavel?.substring(0, 20) + '...',
    });

    // 3. Salvar dados do boleto no banco
    const clientUpdate = await pool!.connect();
    try {
      await clientUpdate.query(
        `UPDATE db_manaus.dbfatura 
         SET asaas_cobranca_id = $1,
             asaas_cliente_id = $2,
             linha_digitavel = $3,
             codigo_barras = $4,
             url_boleto = $5,
             status_boleto = $6
         WHERE codfat = $7`,
        [
          resultado.cobrancaId,
          resultado.clienteId,
          resultado.linhaDigitavel,
          resultado.codigoBarras,
          resultado.urlBoleto,
          resultado.status,
          codfat,
        ],
      );
      console.log('✅ [Boleto] Dados salvos no banco de dados');
    } catch (updateError) {
      console.warn(
        '⚠️ [Boleto] Erro ao atualizar banco (campos podem não existir):',
        updateError,
      );
      // Não bloqueia o retorno, pois o boleto já foi gerado
    } finally {
      clientUpdate.release();
    }

    // 4. Retornar dados do boleto
    return res.status(200).json({
      sucesso: true,
      boleto: {
        cobrancaId: resultado.cobrancaId,
        clienteId: resultado.clienteId,
        linhaDigitavel: resultado.linhaDigitavel,
        codigoBarras: resultado.codigoBarras,
        urlBoleto: resultado.urlBoleto,
        urlFatura: resultado.urlFatura,
        vencimento: resultado.vencimento,
        valor: resultado.valor,
        status: resultado.status,
      },
    });
  } catch (error: any) {
    console.error('❌ [Boleto] Erro ao gerar boleto:', error);
    return res.status(500).json({
      erro: 'Erro ao gerar boleto',
      detalhes: error.message,
    });
  }
}
