// src/pages/api/dadosEmpresa/update.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';
import { encrypt } from '@/utils/crypto'; // Mantemos a importação e uso da função de criptografia
import {
  DadosEmpresa,
  DBDadosEmpresa,
} from '@/data/dadosEmpresa/dadosEmpresas'; // Caminho correto das interfaces

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  const {
    cgc,
    inscricaoestadual,
    nomecontribuinte,
    municipio,
    uf,
    fax,
    codigoconvenio,
    codigonatureza,
    codigofinalidade,
    logradouro,
    numero,
    complemento,
    bairro,
    cep,
    contato,
    telefone,
    suframa,
    email,
    inscricaoestadual_07,
    inscricaomunicipal,
    id_token,
    token,
    certificadoKey,
    certificadoCrt,
    cadeiaCrt,
    inscricoesEstaduais, // Array de inscrições estaduais
  }: Partial<DadosEmpresa> & { cgc: string; inscricoesEstaduais?: any[] } = req.body;

  if (!cgc) {
    return res
      .status(400)
      .json({ error: 'CGC é obrigatório para atualização.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN');

    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (inscricaoestadual !== undefined) {
      updates.push(`inscricaoestadual = $${paramIndex++}`);
      params.push(inscricaoestadual);
    }
    if (nomecontribuinte !== undefined) {
      updates.push(`nomecontribuinte = $${paramIndex++}`);
      params.push(nomecontribuinte);
    }
    if (municipio !== undefined) {
      updates.push(`municipio = $${paramIndex++}`);
      params.push(municipio);
    }
    if (uf !== undefined) {
      updates.push(`uf = $${paramIndex++}`);
      params.push(uf);
    }
    if (fax !== undefined) {
      updates.push(`fax = $${paramIndex++}`);
      params.push(fax);
    }
    if (codigoconvenio !== undefined) {
      updates.push(`codigoconvenio = $${paramIndex++}`);
      params.push(codigoconvenio);
    }
    if (codigonatureza !== undefined) {
      updates.push(`codigonatureza = $${paramIndex++}`);
      params.push(codigonatureza);
    }
    if (codigofinalidade !== undefined) {
      updates.push(`codigofinalidade = $${paramIndex++}`);
      params.push(codigofinalidade);
    }
    if (logradouro !== undefined) {
      updates.push(`logradouro = $${paramIndex++}`);
      params.push(logradouro);
    }
    if (numero !== undefined) {
      updates.push(`numero = $${paramIndex++}`);
      params.push(numero);
    }
    if (complemento !== undefined) {
      updates.push(`complemento = $${paramIndex++}`);
      params.push(complemento);
    }
    if (bairro !== undefined) {
      updates.push(`bairro = $${paramIndex++}`);
      params.push(bairro);
    }
    if (cep !== undefined) {
      updates.push(`cep = $${paramIndex++}`);
      params.push(cep);
    }
    if (contato !== undefined) {
      updates.push(`contato = $${paramIndex++}`);
      params.push(contato);
    }
    if (telefone !== undefined) {
      updates.push(`telefone = $${paramIndex++}`);
      params.push(telefone);
    }
    if (suframa !== undefined) {
      updates.push(`suframa = $${paramIndex++}`);
      params.push(suframa);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (inscricaoestadual_07 !== undefined) {
      updates.push(`inscricaoestadual_07 = $${paramIndex++}`);
      params.push(inscricaoestadual_07);
    }
    if (inscricaomunicipal !== undefined) {
      updates.push(`inscricaomunicipal = $${paramIndex++}`);
      params.push(inscricaomunicipal);
    }
    if (id_token !== undefined) {
      updates.push(`id_token = $${paramIndex++}`);
      params.push(id_token);
    }

    if (token !== undefined) {
      updates.push(`token = $${paramIndex++}`);
      params.push(await encrypt(token));
    }
    if (certificadoKey !== undefined) {
      updates.push(`"certificadoKey" = $${paramIndex++}`);
      params.push(await encrypt(certificadoKey));
    }
    if (certificadoCrt !== undefined) {
      updates.push(`"certificadoCrt" = $${paramIndex++}`);
      params.push(await encrypt(certificadoCrt));
    }
    if (cadeiaCrt !== undefined) {
      updates.push(`"cadeiaCrt" = $${paramIndex++}`);
      params.push(await encrypt(cadeiaCrt));
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ error: 'Nenhum campo fornecido para atualização.' });
    }

    const updateQuery = `
      UPDATE dadosempresa
      SET ${updates.join(', ')}
      WHERE cgc = $${paramIndex++}
      RETURNING *;
    `;

    params.push(cgc);

    const result = await client.query<DBDadosEmpresa>(updateQuery, params);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: `Dados da empresa com CGC ${cgc} não encontrados para atualização.`,
      });
    }

    // Atualizar/inserir inscrições estaduais em db_ie
    if (inscricoesEstaduais && Array.isArray(inscricoesEstaduais) && inscricoesEstaduais.length > 0) {
      console.log('Atualizando inscrições estaduais:', inscricoesEstaduais);

      for (const ie of inscricoesEstaduais) {
        if (ie.inscricaoestadual && ie.inscricaoestadual.trim() !== '') {
          // Verifica se a IE já existe
          const checkIEQuery = `
            SELECT inscricaoestadual FROM db_ie WHERE inscricaoestadual = $1
          `;
          const checkResult = await client.query(checkIEQuery, [ie.inscricaoestadual]);

          if (checkResult.rows.length === 0) {
            // Se não existe, insere
            const insertIEQuery = `
              INSERT INTO db_ie (cgc, inscricaoestadual, nomecontribuinte)
              VALUES ($1, $2, $3)
            `;
            await client.query(insertIEQuery, [
              cgc,
              ie.inscricaoestadual,
              ie.nomecontribuinte || nomecontribuinte
            ]);
          } else {
            // Se já existe, atualiza
            const updateIEQuery = `
              UPDATE db_ie
              SET cgc = $1, nomecontribuinte = $2
              WHERE inscricaoestadual = $3
            `;
            await client.query(updateIEQuery, [
              cgc,
              ie.nomecontribuinte || nomecontribuinte,
              ie.inscricaoestadual
            ]);
          }
        }
      }
    }

    await client.query('COMMIT');

    const updatedDadosEmpresa = result.rows[0];
    const {
      token: _tokenOmitido, // Usamos um nome com underscore para omitir
      certificadoKey: _certificadoKeyOmitido, // Usamos um nome com underscore para omitir
      certificadoCrt: _certificadoCrtOmitido, // Usamos um nome com underscore para omitir
      cadeiaCrt: _cadeiaCrtOmitido, // Usamos um nome com underscore para omitir
      ...responseEmpresa
    } = updatedDadosEmpresa;

    res.status(200).json({ data: responseEmpresa });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao atualizar dados da empresa:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao atualizar dados da empresa.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
