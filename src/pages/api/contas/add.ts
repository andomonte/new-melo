import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const {
    banco,
    tipo,
    nroconta,
    convenio,
    variacao,
    carteira,
    melo,
    agencia,
  } = req.body; // Extrai todos os campos relevantes do corpo da requisição

  // Validação básica dos campos obrigatórios, você pode ajustar conforme a necessidade
  if (!banco || !tipo || !nroconta || !agencia) {
    return res.status(400).json({
      error: 'Campos obrigatórios (banco, tipo, nroconta, agencia) não informados.',
    });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Inicia uma transação para garantir a consistência
    await client.query('BEGIN');

    // Não precisamos de uma lógica para "próximo número" se 'id' for autoincrement.
    // O 'nroconta' é um campo que pode ser fornecido ou ter sua própria lógica.
    // Se 'nroconta' for sequencial e você quiser automatizar, a lógica abaixo é um exemplo.
    // Se 'nroconta' for um campo fornecido pelo usuário, você pode remover a busca pelo "lastNroConta".

    // Exemplo de como gerar um próximo 'nroconta' se ele for sequencial e não autoincrement
    // e você quiser que a API o gere automaticamente (assumindo que seja numérico).
    // Se 'nroconta' não for numérico ou sequencial, remova esta parte.
    const lastAccountResult = await client.query(
      'SELECT nroconta FROM dbdados_banco WHERE nroconta IS NOT NULL ORDER BY nroconta DESC LIMIT 1',
    );
    let nextNroConta = nroconta; // Assume que nroconta é fornecido
    if (!nroconta && lastAccountResult.rows[0]?.nroconta) {
        // Se nroconta não foi fornecido no body e existe um último nroconta, tenta incrementar
        const lastNro = parseInt(lastAccountResult.rows[0].nroconta, 10);
        if (!isNaN(lastNro)) {
            nextNroConta = (lastNro + 1).toString();
        }
    } else if (!nroconta) {
        // Se nroconta não foi fornecido e não há nenhum registro, inicia em '1' ou outro valor padrão
        nextNroConta = '1';
    }


    // Prepara a query de inserção para dbdados_banco
    const insertContaQuery = `
      INSERT INTO dbdados_banco (banco, tipo, nroconta, convenio, variacao, carteira, melo, agencia)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    // Executa a inserção
    const contaResult = await client.query(insertContaQuery, [
      banco,
      tipo,
      nextNroConta, // Usando o nroconta (fornecido ou gerado)
      convenio,
      variacao,
      carteira,
      melo,
      agencia,
    ]);
    const conta = contaResult.rows[0];

    // Commita a transação
    await client.query('COMMIT');

    res.status(201).json({ data: conta });
  } catch (error: any) {
    // Em caso de erro, faz rollback da transação
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ error: error.message || 'Erro ao criar conta' });
  } finally {
    if (client) {
      client.release();
    }
  }
}