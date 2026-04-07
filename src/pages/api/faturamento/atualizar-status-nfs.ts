import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function atualizarStatusNFS(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat, nfs, motivo_erro } = req.body;

  if (!codfat) {
    return res.status(400).json({ error: 'Código da fatura é obrigatório' });
  }

  if (!nfs || (nfs !== 'S' && nfs !== 'N')) {
    return res.status(400).json({ error: 'Status NFS deve ser S ou N' });
  }

  const client = await getPgPool().connect();

  try {
    // Atualizar o status NFS da fatura
    let updateQuery;
    let params;

    if (motivo_erro && motivo_erro.trim() !== '') {
      // 1. Atualizar dbfatura
      updateQuery = `
        UPDATE dbfatura
        SET nfs = $1,
            info_compl = COALESCE(info_compl, '') || CASE WHEN COALESCE(info_compl, '') = '' THEN '' ELSE ' | ' END || 'ERRO SEFAZ: ' || $3
        WHERE codfat = $2
        RETURNING codfat, nfs, info_compl, nroform
      `;
      params = [nfs, codfat, motivo_erro];

      // 2. Inserir ou atualizar registro de erro na dbfat_nfe para aparecer na listagem
      try {
        // Determinar modelo (55=NFe, 65=NFCe). Se não veio, usa 55 como padrão.
        const modelo = req.body.modelo || '55'; 
        const statusErro = '999'; // Status genérico de erro (não é '100')

        // Verificar se já existe registro em dbfat_nfe
        const checkResult = await client.query(
          `SELECT codfat FROM db_manaus.dbfat_nfe WHERE codfat = $1`,
          [codfat]
        );

        if (checkResult.rows.length > 0) {
          // Atualizar existente
          await client.query(`
            UPDATE db_manaus.dbfat_nfe 
            SET status = $1, motivo = $2, data = NOW(), modelo = $3
            WHERE codfat = $4
          `, [statusErro, motivo_erro, modelo, codfat]);
          console.log(`✅ dbfat_nfe ATUALIZADO com erro para fatura ${codfat}`);
        } else {
          // Buscar nroform da fatura para usar como nrodoc_fiscal
          const faturaRes = await client.query(
            'SELECT nroform FROM db_manaus.dbfatura WHERE codfat = $1',
            [codfat]
          );
          const nrodoc = faturaRes.rows[0]?.nroform || '0';

          // Inserir novo registro de erro (chave e emailenviado são NOT NULL)
          const chaveErro = `ERRO-${codfat}`;
          await client.query(`
            INSERT INTO db_manaus.dbfat_nfe (codfat, nrodoc_fiscal, status, motivo, data, modelo, tpemissao, chave, emailenviado)
            VALUES ($1, $2, $3, $4, NOW(), $5, 1, $6, 'N')
          `, [codfat, nrodoc, statusErro, motivo_erro, modelo, chaveErro]);
          console.log(`✅ dbfat_nfe INSERIDO com erro para fatura ${codfat}`);
        }
      } catch (errNfe) {
        console.error('⚠️ Erro ao atualizar dbfat_nfe:', errNfe);
        // Não falhar o request principal por isso, apenas logar
      }

    } else {
      updateQuery = `
        UPDATE dbfatura
        SET nfs = $1
        WHERE codfat = $2
        RETURNING codfat, nfs, info_compl
      `;
      params = [nfs, codfat];
    }

    const result = await client.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada' });
    }

    const faturaAtualizada = result.rows[0];

    console.log(`✅ Status NFS da fatura ${codfat} atualizado para: ${nfs}`);
    if (motivo_erro) {
      console.log(`📝 Motivo do erro registrado: ${motivo_erro}`);
    }

    res.status(200).json({
      message: 'Status NFS atualizado com sucesso',
      fatura: faturaAtualizada,
    });
  } catch (error) {
    console.error('Erro ao atualizar status NFS:', error);
    res.status(500).json({
      error: 'Erro interno do servidor ao atualizar status NFS',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}
