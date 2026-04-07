import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import fs from 'fs';
import path from 'path';

const pool = getPgPool();

/**
 * API: DELETE /api/remessa/rollback
 * 
 * Implementa ROLLBACK_ALL do Oracle
 * Reverte uma remessa gerada:
 * - Remove registros de dbremessa_arquivo e dbremessa_detalhe
 * - Limpa flag bradesco='S' dos títulos
 * - Limpa export=1 da tabela de baixa
 * - Deleta arquivo físico (opcional)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ erro: 'Método não permitido. Use DELETE.' });
  }

  try {
    const { codremessa, codbodero, deletar_arquivo } = req.body;

    if (!codremessa && !codbodero) {
      return res.status(400).json({
        erro: 'Parâmetro codremessa ou codbodero é obrigatório'
      });
    }

    console.log('🔄 Iniciando rollback de remessa:', { codremessa, codbodero });

    await pool.query('BEGIN');

    let remessaInfo: any;
    let titulosAfetados: any[] = [];

    // 1. Buscar informações da remessa
    if (codremessa) {
      const result = await pool.query(`
        SELECT 
          a.codremessa,
          a.codbodero,
          a.banco,
          a.nome_arquivo,
          a.data_gerado
        FROM db_manaus.dbremessa_arquivo a
        WHERE a.codremessa = $1
      `, [codremessa]);

      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ erro: 'Remessa não encontrada' });
      }

      remessaInfo = result.rows[0];

    } else if (codbodero) {
      const result = await pool.query(`
        SELECT 
          a.codremessa,
          a.codbodero,
          a.banco,
          a.nome_arquivo,
          a.data_gerado
        FROM db_manaus.dbremessa_arquivo a
        WHERE a.codbodero = $1
      `, [codbodero]);

      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ erro: 'Remessa não encontrada' });
      }

      remessaInfo = result.rows[0];
    }

    console.log('📋 Remessa encontrada:', remessaInfo);

    // 2. Buscar títulos da remessa
    const titulosResult = await pool.query(`
      SELECT 
        d."CODRECEB" as cod_receb,
        d."DOCUMENTO" as nro_doc,
        d."VALOR" as valor,
        r.bradesco,
        r.situacao
      FROM db_manaus.dbremessa_detalhe d
      LEFT JOIN (
        -- Identificar situação original
        SELECT 
          cod_receb,
          bradesco,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM db_manaus.dbdocbodero_baixa_banco b 
              WHERE b.cod_receb = dbreceb.cod_receb
            ) THEN 'BAIXA'
            WHEN venc_ant IS NOT NULL AND dt_venc <> venc_ant THEN 'PRORROGACAO'
            ELSE 'REMESSA'
          END as situacao
        FROM db_manaus.dbreceb
      ) r ON r.cod_receb = d."CODRECEB"::varchar
      WHERE d."CODREMESSA" = $1
    `, [remessaInfo.codremessa]);

    titulosAfetados = titulosResult.rows;

    console.log(`📦 ${titulosAfetados.length} títulos a reverter`);

    // 3. Limpar flags dos títulos
    for (const titulo of titulosAfetados) {
      if (titulo.situacao === 'BAIXA') {
        // Reverter export=1 para export=0
        await pool.query(`
          UPDATE db_manaus.dbdocbodero_baixa_banco
          SET export = 0
          WHERE cod_receb = $1
        `, [titulo.cod_receb]);

        console.log(`  ✓ Revertido export da baixa: ${titulo.cod_receb}`);

      } else {
        // Limpar bradesco='S' -> bradesco='N'
        await pool.query(`
          UPDATE db_manaus.dbreceb
          SET bradesco = 'N'
          WHERE cod_receb = $1
        `, [titulo.cod_receb]);

        console.log(`  ✓ Limpado flag bradesco: ${titulo.cod_receb}`);
      }
    }

    // 4. Deletar detalhes da remessa
    await pool.query(`
      DELETE FROM db_manaus.dbremessa_detalhe
      WHERE "CODREMESSA" = $1
    `, [remessaInfo.codremessa]);

    console.log('  ✓ Detalhes deletados');

    // 5. Deletar arquivo da remessa
    await pool.query(`
      DELETE FROM db_manaus.dbremessa_arquivo
      WHERE codremessa = $1
    `, [remessaInfo.codremessa]);

    console.log('  ✓ Arquivo de controle deletado');

    // 6. Deletar arquivo físico (opcional)
    if (deletar_arquivo && remessaInfo.nome_arquivo) {
      try {
        const caminhoArquivo = path.join(
          process.cwd(),
          'public',
          'remessas',
          'bancaria',
          remessaInfo.nome_arquivo
        );

        if (fs.existsSync(caminhoArquivo)) {
          fs.unlinkSync(caminhoArquivo);
          console.log(`  ✓ Arquivo físico deletado: ${remessaInfo.nome_arquivo}`);
        }
      } catch (error) {
        console.warn('  ⚠️ Não foi possível deletar arquivo físico:', error);
      }
    }

    await pool.query('COMMIT');

    console.log('✅ Rollback concluído com sucesso');

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Remessa revertida com sucesso',
      remessa: {
        codremessa: remessaInfo.codremessa,
        codbodero: remessaInfo.codbodero,
        banco: remessaInfo.banco,
        nome_arquivo: remessaInfo.nome_arquivo,
        data_gerado: remessaInfo.data_gerado
      },
      titulos_afetados: titulosAfetados.length,
      estatisticas: {
        remessa: titulosAfetados.filter(t => t.situacao === 'REMESSA').length,
        baixa: titulosAfetados.filter(t => t.situacao === 'BAIXA').length,
        prorrogacao: titulosAfetados.filter(t => t.situacao === 'PRORROGACAO').length
      }
    });

  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('❌ Erro ao fazer rollback da remessa:', error);
    
    return res.status(500).json({
      erro: 'Erro ao reverter remessa',
      detalhes: error.message
    });
  }
}
