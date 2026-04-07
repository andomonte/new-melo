import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ error: `Método ${req.method} não permitido.` });
  }

  const { codfat } = req.query;

  if (!codfat || typeof codfat !== 'string') {
    return res.status(400).json({ error: "Parâmetro 'codfat' é obrigatório." });
  }

  const client = await getPgPool().connect();

  try {
    // 1. Buscar os boletos e o código do cliente (codcli)
    const boletosQuery = `
      SELECT
        r.cod_receb,
        r.nro_doc AS numero_documento,
        r.dt_venc AS vencimento,
        r.valor_pgto AS valor,
        r.nro_banco AS nosso_numero,
        f.cod_banco,
        b.nome AS nome_banco,
        f.codcli,
        f.data AS data_emissao_fatura,
        f.frmfat AS especie_doc_codigo,
        f.tipofat
      FROM dbreceb r
      LEFT JOIN dbfatura f ON r.cod_fat = f.codfat
      LEFT JOIN dbbanco_cobranca b ON f.cod_banco = b.banco
      WHERE r.cod_fat = $1
      ORDER BY r.dt_venc ASC;
    `;
    const boletosResult = await client.query(boletosQuery, [codfat]);
    const boletos = boletosResult.rows;

    if (boletos.length === 0) {
      return res
        .status(404)
        .json({ error: 'Nenhum boleto encontrado para esta fatura.' });
    }

    // 2. Buscar os dados do Sacado (Cliente)
    const codcli = boletos[0].codcli;
    const sacadoQuery = `
      SELECT codcli, nome, nomefant, cpfcgc, ender, bairro, cidade, uf, cep
      FROM dbclien WHERE codcli = $1;
    `;
    const sacadoResult = await client.query(sacadoQuery, [codcli]);
    const sacado = sacadoResult.rows[0] || null;

    // --- CORREÇÃO APLICADA AQUI ---
    // 3. Buscar os dados do Cedente (Sua Empresa) da tabela 'dadosempresa'
    const cedenteQuery = `
      SELECT 
        nomecontribuinte, 
        cgc, 
        logradouro, 
        numero, 
        bairro, 
        municipio AS cidade, -- Usando a coluna correta 'municipio' e renomeando para 'cidade'
        uf, 
        cep
      FROM dadosempresa LIMIT 1;
    `;
    const cedenteResult = await client.query(cedenteQuery);
    const cedente = cedenteResult.rows[0] || null;

    // 4. Montar e retornar a resposta completa
    return res.status(200).json({
      cedente,
      sacado,
      boletos,
    });
  } catch (error) {
    console.error('Erro ao buscar dados completos dos boletos:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  } finally {
    client.release();
  }
}
