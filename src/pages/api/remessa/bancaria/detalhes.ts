import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ erro: 'ID da remessa é obrigatório' });
    }

    // Buscar informações do arquivo de remessa
    const arquivoQuery = `
      SELECT
        a.cod_arquivo,
        a.dt_geracao,
        a.nome_arquivo,
        a.qtd_registros,
        a.valor_total,
        a.banco,
        a.tipo_remessa,
        a.sequencial_arquivo,
        CASE 
          WHEN a.banco = '237' THEN 'BRADESCO'
          WHEN a.banco = '033' THEN 'SANTANDER'
          ELSE 'OUTROS'
        END as nome_banco,
        -- Buscar borderô relacionado
        (
          SELECT b.cod_bodero
          FROM db_manaus.dbboderobb b
          WHERE b.dtemissao::date = a.dt_geracao::date
            AND b.cancel = 'N'
          ORDER BY b.dtemissao DESC
          LIMIT 1
        ) as cod_bodero
      FROM db_manaus.dbremessa_arquivo a
      WHERE a.cod_arquivo = $1
    `;

    const arquivoResult = await pool.query(arquivoQuery, [id]);

    if (arquivoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Remessa não encontrada' });
    }

    const arquivo = arquivoResult.rows[0];

    // Buscar títulos da remessa com detalhes completos
    const titulosQuery = `
      SELECT
        d.cod_remessa_detalhe,
        d.cod_receb,
        d.nosso_numero,
        d.valor_titulo,
        d.dt_vencimento,
        r.nro_doc as numero_documento,
        r.nro_docbanco,
        r.dt_emissao,
        r.bradesco as status_titulo,
        CASE 
          WHEN r.bradesco = 'N' THEN 'Disponível'
          WHEN r.bradesco = 'S' THEN 'Enviado'
          WHEN r.bradesco = 'B' THEN 'Liquidado'
          ELSE 'Desconhecido'
        END as status_descricao,
        c.codcli,
        c.nome as nome_cliente,
        c.cpfcgc as cpf_cnpj,
        c.ender as endereco,
        c.cidade,
        c.uf,
        -- Verificar se tem retorno
        (
          SELECT ret.codocorrencia
          FROM db_manaus.dbretorno_detalhe ret
          WHERE ret.codreceb = d.cod_receb::varchar
          ORDER BY ret.codretorno DESC
          LIMIT 1
        ) as codigo_ocorrencia_retorno,
        (
          SELECT ret.ocorrencia
          FROM db_manaus.dbretorno_detalhe ret
          WHERE ret.codreceb = d.cod_receb::varchar
          ORDER BY ret.codretorno DESC
          LIMIT 1
        ) as descricao_ocorrencia_retorno,
        (
          SELECT ret.dt_ocorrencia
          FROM db_manaus.dbretorno_detalhe ret
          WHERE ret.codreceb = d.cod_receb::varchar
          ORDER BY ret.codretorno DESC
          LIMIT 1
        ) as data_ocorrencia_retorno,
        (
          SELECT ret.valor_pago
          FROM db_manaus.dbretorno_detalhe ret
          WHERE ret.codreceb = d.cod_receb::varchar
          ORDER BY ret.codretorno DESC
          LIMIT 1
        ) as valor_pago_retorno
      FROM db_manaus.dbremessa_detalhe d
      INNER JOIN db_manaus.dbreceb r ON r.cod_receb = d.cod_receb
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      WHERE d.cod_arquivo = $1
      ORDER BY d.dt_vencimento, d.cod_receb
    `;

    const titulosResult = await pool.query(titulosQuery, [id]);

    // Estatísticas dos títulos
    const stats = {
      total: titulosResult.rows.length,
      enviados: titulosResult.rows.filter(t => t.status_titulo === 'S').length,
      liquidados: titulosResult.rows.filter(t => t.status_titulo === 'B').length,
      disponiveis: titulosResult.rows.filter(t => t.status_titulo === 'N').length,
      com_retorno: titulosResult.rows.filter(t => t.codigo_ocorrencia_retorno).length,
      valor_total: titulosResult.rows.reduce((sum, t) => sum + parseFloat(t.valor_titulo || 0), 0),
      valor_liquidado: titulosResult.rows
        .filter(t => t.valor_pago_retorno)
        .reduce((sum, t) => sum + parseFloat(t.valor_pago_retorno || 0) / 100, 0) // Converter de centavos
    };

    res.status(200).json({
      arquivo,
      titulos: titulosResult.rows,
      estatisticas: stats
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar detalhes da remessa:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}
