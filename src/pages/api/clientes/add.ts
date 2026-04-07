import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

import { Cliente } from '@/data/clientes/clientes';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const data: Cliente = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Dados do cliente não informados' });
  }

  // 🔍 LOG DETALHADO
  console.log('📦 [add.ts] Dados recebidos:', {
    cpfcgc: data.cpfcgc,
    nome: data.nome,
    banco: data.banco,
    tipo_banco: typeof data.banco,
    bairro: data.bairro,
    codbairro: data.codbairro,
    keys: Object.keys(data).length,
  });

  data.debito = data.debito ?? 0;
  data.limite = data.limite ?? 0;

  if (!data.cpfcgc || !data.nome) {
    console.error('❌ [add.ts] Validação falhou - campos obrigatórios vazios');
    return res.status(400).json({
      error: 'CPF/CNPJ e Nome do cliente são obrigatórios.',
      missing: {
        cpfcgc: !data.cpfcgc,
        nome: !data.nome,
      },
    });
  }

  // ✅ SANITIZAÇÃO: converter campos problemáticos
  const sanitizeValue = (val: any): any => {
    if (val === '' || val === undefined) return null;
    return val;
  };

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    const latestClienteResult = await client.query(
      `SELECT codcli FROM dbclien WHERE codcli != '99999' ORDER BY codcli DESC LIMIT 1;`,
    );

    const latestCodCli = latestClienteResult.rows[0]?.codcli
      ? parseInt(latestClienteResult.rows[0].codcli, 10)
      : 0;
    const newCodCli = (latestCodCli + 1).toString();

    const clienteExistenteResult = await client.query(
      `SELECT codcli FROM dbclien WHERE cpfcgc = $1 LIMIT 1;`,
      [data.cpfcgc],
    );
    const clienteExistente = clienteExistenteResult.rows[0];

    let clienteAtualizadoOuCriado;

    if (clienteExistente) {
      console.log('🔄 [add.ts] Cliente existe - atualizando');
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      for (const key in data) {
        if (
          Object.prototype.hasOwnProperty.call(data, key) &&
          key !== 'codcli' &&
          key !== 'cpfcgc'
        ) {
          updateFields.push(`"${key}" = $${paramIndex}`);
          updateValues.push(sanitizeValue(data[key as keyof Cliente]));
          paramIndex++;
        }
      }

      updateValues.push(clienteExistente.codcli);

      const updateQuery = `
        UPDATE dbclien
        SET ${updateFields.join(', ')}
        WHERE codcli = $${paramIndex}
        RETURNING *;
      `;

      console.log('🔄 [add.ts] Executando UPDATE');
      const updateResult = await client.query(updateQuery, updateValues);
      clienteAtualizadoOuCriado = updateResult.rows[0];

      res.status(200).json({
        data: serializeBigInt(clienteAtualizadoOuCriado),
        message: `Cliente ${clienteAtualizadoOuCriado?.nome} atualizado com sucesso.`,
      });
    } else {
      console.log('➕ [add.ts] Cliente novo - criando');

      const ALLOWED_COLUMNS = [
        'nome',
        'nomefant',
        'cpfcgc',
        'tipo',
        'codcc',
        'codvend',
        'datacad',
        'ender',
        'bairro',
        'cidade',
        'uf',
        'cep',
        'iest',
        'isuframa',
        'imun',
        'status',
        'obs',
        'tipoemp',
        'debito',
        'limite',
        'contato',
        'socios',
        'icms',
        'endercobr',
        'cidadecobr',
        'bairrocobr',
        'ufcobr',
        'cepcobr',
        'claspgto',
        'email',
        'atraso',
        'ipi',
        'prvenda',
        'codbairro',
        'codbairrocobr',
        'banco',
        'tipocliente',
        'codtmk',
        'kickback',
        'sit_tributaria',
        'numero',
        'referencia',
        'codpais',
        'numerocobr',
        'codpaiscobr',
        'referenciacobr',
        'codmunicipio',
        'codmunicipiocobr',
        'complemento',
        'complementocobr',
        'acrescimo',
        'desconto',
        'habilitasuframa',
        'emailnfe',
        'faixafin',
        'codunico',
        'bloquear_preco',
        'local_entrega',
        'codigo_filial',
        'precovenda',
        'descontoaplic',
        'benmd',
        'habilitarlocalentrega',
      ];

      const clienteParaCriar: any = { codcli: newCodCli };

      for (const key in data) {
        if (
          Object.prototype.hasOwnProperty.call(data, key) &&
          ALLOWED_COLUMNS.includes(key)
        ) {
          clienteParaCriar[key] = sanitizeValue(data[key as keyof Cliente]);
        }
      }

      if (!clienteParaCriar.cpfcgc) clienteParaCriar.cpfcgc = data.cpfcgc;
      if (!clienteParaCriar.nome) clienteParaCriar.nome = data.nome;

      const insertFields = Object.keys(clienteParaCriar)
        .map((key) => `"${key}"`)
        .join(', ');
      const insertPlaceholders = Object.keys(clienteParaCriar)
        .map((_, i) => `$${i + 1}`)
        .join(', ');
      const insertValues = Object.values(clienteParaCriar);

      console.log(
        '➕ [add.ts] Criando cliente com',
        insertFields.split(',').length,
        'campos',
      );

      const insertQuery = `
        INSERT INTO dbclien (${insertFields})
        VALUES (${insertPlaceholders})
        RETURNING *;
      `;

      const createResult = await client.query(insertQuery, insertValues);
      clienteAtualizadoOuCriado = createResult.rows[0];

      res.status(201).json({
        data: serializeBigInt(clienteAtualizadoOuCriado),
        message: `Cliente ${clienteAtualizadoOuCriado?.nome} criado com sucesso.`,
      });
    }

    const finalCodCli = clienteAtualizadoOuCriado?.codcli;

    if (
      finalCodCli &&
      (Array.isArray(data.contatos) || Array.isArray(data.vendedores_list) || Array.isArray(data.pessoasContato))
    ) {
      await client.query('DELETE FROM dbclien_email WHERE codcli = $1', [
        finalCodCli,
      ]);
      await client.query('DELETE FROM dbclien_contatos WHERE codcli = $1', [
        finalCodCli,
      ]);

      // Salvar telefones/emails
      if (Array.isArray(data.contatos)) {
        for (const contact of data.contatos) {
          if (contact.type === 'email' && contact.value) {
            await client.query(
              'INSERT INTO dbclien_email (codcli, email) VALUES ($1, $2)',
              [finalCodCli, contact.value.substring(0, 100)],
            );
          } else if (
            ['celular', 'fixo', 'comercial', 'whatsapp', 'phone'].includes(contact.type) &&
            contact.value
          ) {
            await client.query(
              'INSERT INTO dbclien_contatos (codcli, nome, fone) VALUES ($1, $2, $3)',
              [
                finalCodCli,
                (contact.obs || contact.type).substring(0, 50),
                contact.value.substring(0, 20),
              ],
            );
          }
        }
      }

      // Salvar pessoas de contato
      if (Array.isArray(data.pessoasContato)) {
        for (const pessoa of data.pessoasContato) {
          if (pessoa.nome) {
            await client.query(
              'INSERT INTO dbclien_contatos (codcli, nome, fone) VALUES ($1, $2, $3)',
              [
                finalCodCli,
                `${pessoa.nome}${pessoa.cargo ? ' (' + pessoa.cargo + ')' : ''}`.substring(0, 50),
                (pessoa.telefone || '').substring(0, 20),
              ],
            );
          }
        }
      }

      // Salvar JSON estruturado no campo contato (inclui vendedores por segmento)
      const contatoJson = JSON.stringify({
        telefones: data.contatos || [],
        pessoas: data.pessoasContato || [],
        vendedores: data.vendedores_list || [],
      });
      await client.query(
        'UPDATE dbclien SET contato = $1 WHERE codcli = $2',
        [contatoJson, finalCodCli],
      );
    }

    await client.query('COMMIT');
    console.log('✅ [add.ts] Cliente salvo com sucesso');
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('🚨 [add.ts] Erro ao upsert cliente:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      routine: error.routine,
      stack: error.stack?.split('\n').slice(0, 3),
    });

    let userMessage = 'Erro ao salvar cliente';
    if (error.code === '23505') {
      userMessage = 'Cliente já existe com este CPF/CNPJ';
    } else if (error.code === '23502') {
      userMessage = `Campo obrigatório não informado: ${
        error.column || 'campo desconhecido'
      }`;
    } else if (error.code === '42703') {
      userMessage = 'Erro de estrutura do banco. Contate o suporte.';
    } else if (error.code === 'ECONNREFUSED') {
      userMessage = 'Erro de conexão com o banco de dados';
    }

    res.status(500).json({
      error: userMessage,
      detail: error.message || 'Erro ao upsert cliente.',
      code: error.code,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
