import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg'; // Importe PoolClient do 'pg'
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt'; // Mantenha se precisar serializar BigInts

import { Transportadora } from '@/data/transportadoras/transportadoras'; // Mantenha sua interface Transportadora

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Certifique-se de que o método da requisição é POST para upsert/criação
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const data: Transportadora = req.body;

  // Validação básica dos dados obrigatórios
  if (!data.nome) {
    return res
      .status(400)
      .json({ error: 'Nome da transportadora é obrigatório.' });
  }

  // Validação do nome (máximo 50 caracteres)
  if (data.nome.length > 50) {
    return res.status(400).json({
      error: 'Nome da transportadora deve ter no máximo 50 caracteres',
    });
  }

  let client: PoolClient | undefined; // Declare client aqui para garantir que ele esteja disponível no bloco finally

  try {
    const pool = getPgPool(filial); // Obtém o pool de conexão baseado na filial
    client = await pool.connect(); // Obtém um cliente de conexão do pool

    // Inicia uma transação para garantir atomicidade do "upsert"
    await client.query('BEGIN');

    let transportadoraAtualizadaOuCriada;

    if (data.codtransp) {
      // Se codtransp foi fornecido, tenta encontrar a transportadora existente
      const transportadoraExistenteResult = await client.query(
        `
        SELECT codtransp
        FROM dbtransp
        WHERE codtransp = $1
        LIMIT 1;
        `,
        [data.codtransp],
      );
      const transportadoraExistente = transportadoraExistenteResult.rows[0];

      if (transportadoraExistente) {
        // Se transportadora existe, atualiza
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        // Percorre todos os campos na 'data' (Transportadora) para construir o UPDATE
        // Exclua 'codtransp' se não quiser que ele seja atualizado
        for (const key in data) {
          if (
            Object.prototype.hasOwnProperty.call(data, key) &&
            key !== 'codtransp'
          ) {
            updateFields.push(`"${key}" = $${paramIndex}`);
            updateValues.push(data[key as keyof Transportadora]);
            paramIndex++;
          }
        }

        // Adiciona o codtransp da condição WHERE
        updateValues.push(transportadoraExistente.codtransp);

        const updateQuery = `
          UPDATE dbtransp
          SET ${updateFields.join(', ')}
          WHERE codtransp = $${paramIndex}
          RETURNING *;
        `;
        const updateResult = await client.query(updateQuery, updateValues);
        transportadoraAtualizadaOuCriada = updateResult.rows[0];

        await client.query('COMMIT'); // Confirma a transação

        return res
          .status(200)
          .setHeader('Content-Type', 'application/json')
          .json({
            data: serializeBigInt(transportadoraAtualizadaOuCriada),
            message: `Transportadora ${transportadoraAtualizadaOuCriada?.nome} atualizada com sucesso.`,
          });
      }
    }

    // Se chegou até aqui, precisa criar uma nova transportadora
    // 1. Lógica para obter o próximo codtransp se não foi fornecido
    if (!data.codtransp) {
      const latestTransportadoraResult = await client.query(
        `
        SELECT codtransp
        FROM dbtransp
        WHERE codtransp ~ '^[0-9]+$'
        ORDER BY CAST(codtransp AS INTEGER) DESC
        LIMIT 1;
        `,
      );

      // Converte codtransp para número, lida com '0' se não houver registros ou se for o primeiro
      const latestCodTransp = latestTransportadoraResult.rows[0]?.codtransp
        ? parseInt(latestTransportadoraResult.rows[0].codtransp, 10)
        : 0;
      const newCodTransp = (latestCodTransp + 1).toString(); // Mantém como string para codtransp
      data.codtransp = newCodTransp;
    } else {
      // Validação do código da transportadora (máximo 5 caracteres)
      if (data.codtransp.length > 5) {
        return res.status(400).json({
          error: 'Código da transportadora deve ter no máximo 5 caracteres',
        });
      }

      // Verifica se já existe transportadora com este código
      const checkResult = await client.query(
        'SELECT codtransp FROM dbtransp WHERE codtransp = $1',
        [data.codtransp],
      );

      if (checkResult.rows.length > 0) {
        return res.status(400).json({
          error: 'Já existe uma transportadora com este código',
        });
      }
    }

    // Definir data de cadastro se ainda não estiver definida
    if (!data.data_cad) {
      data.data_cad = new Date();
    }

    // 2. Cria a nova transportadora
    const createQuery = `
      INSERT INTO dbtransp (
        codtransp, nome, nomefant, cpfcgc, tipo, data_cad, ender, bairro, 
        cidade, uf, iest, isuframa, imun, tipoemp, contatos, cc, n_agencia, 
        banco, cod_ident, cep, codbairro, codmunicipio, numero, referencia, 
        codpais, complemento, codunico
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING *;
    `;

    const createValues = [
      data.codtransp,
      data.nome,
      data.nomefant || null,
      data.cpfcgc || null,
      data.tipo || null,
      data.data_cad,
      data.ender || null,
      data.bairro || null,
      data.cidade || null,
      data.uf || null,
      data.iest || null,
      data.isuframa || null,
      data.imun || null,
      data.tipoemp || null,
      data.contatos || null,
      data.cc || null,
      data.n_agencia || null,
      data.banco || null,
      data.cod_ident || null,
      data.cep || null,
      data.codbairro || null,
      data.codmunicipio || null,
      data.numero || null,
      data.referencia || null,
      data.codpais ? parseInt(data.codpais.toString()) : null,
      data.complemento || null,
      data.codunico || null,
    ];

    const createResult = await client.query(createQuery, createValues);
    transportadoraAtualizadaOuCriada = createResult.rows[0];

    await client.query('COMMIT'); // Confirma a transação

    // Toast para "Transportadora Criada"
    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(transportadoraAtualizadaOuCriada),
        message: `Transportadora ${transportadoraAtualizadaOuCriada?.nome} criada com sucesso.`,
      });
  } catch (error: any) {
    await client?.query('ROLLBACK'); // Reverte a transação em caso de erro
    console.error('Erro ao upsert transportadora:', error);

    // Verificar se é erro de violação de constraint
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return res.status(400).json({
          error: 'Já existe uma transportadora com este código',
        });
      }

      if (error.message.includes('violates not-null constraint')) {
        return res.status(400).json({
          error: 'Campos obrigatórios não foram preenchidos',
        });
      }

      if (error.message.includes('value too long')) {
        return res.status(400).json({
          error: 'Um ou mais campos excedem o tamanho máximo permitido',
        });
      }
    }

    res
      .status(500)
      .json({ error: error.message || 'Erro ao upsert transportadora.' });
  } finally {
    if (client) {
      client.release(); // Libera o cliente de volta para o pool
    }
  }
}
