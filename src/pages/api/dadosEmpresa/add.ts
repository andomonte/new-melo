// src/pages/api/dadosEmpresa/cadastrarDadosEmpresa.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { encrypt } from '@/utils/crypto'; // Importa a função de criptografia
import {
  DadosEmpresa,
  DBDadosEmpresa,
} from '@/data/dadosEmpresa/dadosEmpresas'; // Importa as interfaces para dados da empresa

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  // Desestruturamos todos os campos que podem ser enviados no corpo da requisição para criação.
  // Note que 'token' e 'certificado' serão recebidos em texto claro aqui.
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
    token, // Campo a ser criptografado
    certificadoKey, // Campo a ser criptografado
    certificadoCrt, // Campo a ser criptografado
    cadeiaCrt, // Campo a ser criptografado
    inscricoesEstaduais, // Array de inscrições estaduais
  }: Partial<DadosEmpresa> & { inscricoesEstaduais?: any[] } = req.body;

  if (!cgc || !nomecontribuinte) {
    // Exemplo de validação mínima para campos obrigatórios
    return res
      .status(400)
      .json({ error: 'CGC e Nome do Contribuinte são obrigatórios.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    await client.query('BEGIN');

    // Arrays para construir a query dinamicamente
    const columns: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    // Adiciona campos à query apenas se eles foram fornecidos (não 'undefined')
    // A validação de `null` ou `""` para limpar o campo é feita pela função `encrypt`
    // para 'token' e 'certificado', e os outros campos aceitam `null` se enviados assim.

    if (cgc !== undefined) {
      columns.push('cgc');
      values.push(cgc);
      placeholders.push(`$${paramIndex++}`);
    }
    if (inscricaoestadual !== undefined) {
      columns.push('inscricaoestadual');
      values.push(inscricaoestadual);
      placeholders.push(`$${paramIndex++}`);
    }
    if (nomecontribuinte !== undefined) {
      columns.push('nomecontribuinte');
      values.push(nomecontribuinte);
      placeholders.push(`$${paramIndex++}`);
    }
    if (municipio !== undefined) {
      columns.push('municipio');
      values.push(municipio);
      placeholders.push(`$${paramIndex++}`);
    }
    if (uf !== undefined) {
      columns.push('uf');
      values.push(uf);
      placeholders.push(`$${paramIndex++}`);
    }
    if (fax !== undefined) {
      columns.push('fax');
      values.push(fax);
      placeholders.push(`$${paramIndex++}`);
    }
    if (codigoconvenio !== undefined) {
      columns.push('codigoconvenio');
      values.push(codigoconvenio);
      placeholders.push(`$${paramIndex++}`);
    }
    if (codigonatureza !== undefined) {
      columns.push('codigonatureza');
      values.push(codigonatureza);
      placeholders.push(`$${paramIndex++}`);
    }
    if (codigofinalidade !== undefined) {
      columns.push('codigofinalidade');
      values.push(codigofinalidade);
      placeholders.push(`$${paramIndex++}`);
    }
    if (logradouro !== undefined) {
      columns.push('logradouro');
      values.push(logradouro);
      placeholders.push(`$${paramIndex++}`);
    }
    if (numero !== undefined) {
      columns.push('numero');
      values.push(numero);
      placeholders.push(`$${paramIndex++}`);
    }
    if (complemento !== undefined) {
      columns.push('complemento');
      values.push(complemento);
      placeholders.push(`$${paramIndex++}`);
    }
    if (bairro !== undefined) {
      columns.push('bairro');
      values.push(bairro);
      placeholders.push(`$${paramIndex++}`);
    }
    if (cep !== undefined) {
      columns.push('cep');
      values.push(cep);
      placeholders.push(`$${paramIndex++}`);
    }
    if (contato !== undefined) {
      columns.push('contato');
      values.push(contato);
      placeholders.push(`$${paramIndex++}`);
    }
    if (telefone !== undefined) {
      columns.push('telefone');
      values.push(telefone);
      placeholders.push(`$${paramIndex++}`);
    }
    if (suframa !== undefined) {
      columns.push('suframa');
      values.push(suframa);
      placeholders.push(`$${paramIndex++}`);
    }
    if (email !== undefined) {
      columns.push('email');
      values.push(email);
      placeholders.push(`$${paramIndex++}`);
    }
    if (inscricaoestadual_07 !== undefined) {
      columns.push('inscricaoestadual_07');
      values.push(inscricaoestadual_07);
      placeholders.push(`$${paramIndex++}`);
    }
    if (inscricaomunicipal !== undefined) {
      columns.push('inscricaomunicipal');
      values.push(inscricaomunicipal);
      placeholders.push(`$${paramIndex++}`);
    }
    if (id_token !== undefined) {
      columns.push('id_token');
      values.push(id_token);
      placeholders.push(`$${paramIndex++}`);
    }

    // Campos críticos: criptografe-os antes de adicionar aos valores
    if (token !== undefined) {
      columns.push('token');
      values.push(await encrypt(token)); // Criptografa o token
      placeholders.push(`$${paramIndex++}`);
    }
    if (certificadoKey !== undefined) {
      columns.push('"certificadoKey"');
      values.push(await encrypt(certificadoKey)); // Criptografa a chave privada
      placeholders.push(`$${paramIndex++}`);
    }
    if (certificadoCrt !== undefined) {
      columns.push('"certificadoCrt"');
      values.push(await encrypt(certificadoCrt)); // Criptografa o certificado
      placeholders.push(`$${paramIndex++}`);
    }
    if (cadeiaCrt !== undefined) {
      columns.push('"cadeiaCrt"');
      values.push(await encrypt(cadeiaCrt)); // Criptografa a cadeia de certificados
      placeholders.push(`$${paramIndex++}`);
    }

    const insertQuery = `
      INSERT INTO dadosempresa (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;

    const result = await client.query<DBDadosEmpresa>(insertQuery, values);

    // Salvar inscrições estaduais em db_ie
    if (inscricoesEstaduais && Array.isArray(inscricoesEstaduais) && inscricoesEstaduais.length > 0) {
      console.log('Salvando inscrições estaduais:', inscricoesEstaduais);

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

    const createdDadosEmpresa = result.rows[0];
    // Omitir os campos sensíveis criptografados da resposta
    const {
      token: _tokenOmitido,
      certificadoKey: _certificadoKeyOmitido,
      certificadoCrt: _certificadoCrtOmitido,
      cadeiaCrt: _cadeiaCrtOmitido,
      ...responseEmpresa
    } = createdDadosEmpresa;

    res.status(201).json({ data: responseEmpresa }); // Retorna os dados, mas sem token/certificado
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao cadastrar dados da empresa:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao cadastrar dados da empresa.' });
  } finally {
    if (client) client.release();
  }
}
