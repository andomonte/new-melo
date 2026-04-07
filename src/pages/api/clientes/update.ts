// pages/api/cliente/update.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export interface Cliente {
  codcli: string;
  atraso?: number;
  kickback?: number;
  sit_tributaria?: number;
  codpais?: number;
  codpaiscobr?: number;
  codigo_filial?: number;
  [key: string]: any; // Para outros campos dinâmicos
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    res.status(400).json({ error: 'Filial não informada no cookie.' });
    return;
  }

  const cliente: Cliente = req.body;

  if (!cliente || !cliente.codcli) {
    res.status(400).json({
      error: 'Cliente com código é obrigatório.',
      received: {
        hasCliente: !!cliente,
        hasCodcli: !!(cliente && cliente.codcli),
      },
    });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    // Definir colunas permitidas baseadas no schema do banco legado (dbclien)
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

    // Filtrar campos do corpo da requisição que existem na tabela
    const fields = Object.keys(cliente).filter(
      (key) => key !== 'codcli' && ALLOWED_COLUMNS.includes(key),
    );

    if (fields.length === 0) {
      res
        .status(400)
        .json({ error: 'Nenhum campo válido para atualização fornecido.' });
      return;
    }

    const setClause = fields
      .map((field, index) => `"${field}" = $${index + 2}`)
      .join(', ');
    const sanitizeDbValue = (val: any) => (val === '' ? null : val);

    // Converte strings vazias para NULL para evitar erro de cast (ex: bigint = "")
    const values = [
      cliente.codcli,
      ...fields.map((field) => sanitizeDbValue(cliente[field])),
    ];

    const updateQuery = `
      UPDATE dbclien
      SET ${setClause}
      WHERE codcli = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }

    // --- UPDATE CONTACTS (dbclien_email & dbclien_contatos) ---
    if (
      Array.isArray(cliente.contatos) ||
      Array.isArray(cliente.vendedores_list) ||
      Array.isArray(cliente.pessoasContato)
    ) {
      // 1. Remove existing contacts
      await client.query('DELETE FROM dbclien_email WHERE codcli = $1', [
        cliente.codcli,
      ]);
      await client.query('DELETE FROM dbclien_contatos WHERE codcli = $1', [
        cliente.codcli,
      ]);

      // 2. Insert new contacts (telefones/emails)
      if (Array.isArray(cliente.contatos)) {
        for (const contact of cliente.contatos) {
          if (contact.type === 'email' && contact.value) {
            await client.query(
              'INSERT INTO dbclien_email (codcli, email) VALUES ($1, $2)',
              [cliente.codcli, contact.value.substring(0, 100)],
            );
          } else if (
            ['celular', 'fixo', 'comercial', 'whatsapp', 'phone'].includes(contact.type) &&
            contact.value
          ) {
            await client.query(
              'INSERT INTO dbclien_contatos (codcli, nome, fone) VALUES ($1, $2, $3)',
              [
                cliente.codcli,
                (contact.obs || contact.type).substring(0, 50),
                contact.value.substring(0, 20),
              ],
            );
          }
        }
      }

      // 3. Insert pessoas de contato
      if (Array.isArray(cliente.pessoasContato)) {
        for (const pessoa of cliente.pessoasContato) {
          if (pessoa.nome) {
            await client.query(
              'INSERT INTO dbclien_contatos (codcli, nome, fone) VALUES ($1, $2, $3)',
              [
                cliente.codcli,
                `${pessoa.nome}${pessoa.cargo ? ' (' + pessoa.cargo + ')' : ''}`.substring(0, 50),
                (pessoa.telefone || '').substring(0, 20),
              ],
            );
          }
        }
      }

      // 4. Salvar JSON estruturado no campo contato
      const contatoJson = JSON.stringify({
        telefones: cliente.contatos || [],
        pessoas: cliente.pessoasContato || [],
        vendedores: cliente.vendedores_list || [],
      });
      await client.query(
        'UPDATE dbclien SET contato = $1 WHERE codcli = $2',
        [contatoJson, cliente.codcli],
      );
    }

    await client.query('COMMIT');

    const updatedCliente = result.rows[0];

    res.status(200).json(
      serializeBigInt({
        ...updatedCliente,
        atraso: Number(updatedCliente.atraso || 0),
        kickback: Number(updatedCliente.kickback || 0),
        sit_tributaria: Number(updatedCliente.sit_tributaria || 0),
        codpais: Number(updatedCliente.codpais || 0),
        codpaiscobr: Number(updatedCliente.codpaiscobr || 0),
        codigo_filial: Number(updatedCliente.codigo_filial || 0),
      }),
    );
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('🚨 Erro ao atualizar cliente:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      codcli: cliente?.codcli,
    });

    // Identificar tipos específicos de erro
    let userMessage = 'Erro ao atualizar cliente';
    if (error.code === '23505') {
      userMessage = 'Conflito: dados duplicados';
    } else if (error.code === '23502') {
      userMessage = `Campo obrigatório não pode ser nulo: ${
        error.column || 'campo desconhecido'
      }`;
    } else if (error.code === '42703') {
      userMessage = 'Campo inexistente na tabela';
    }

    res.status(500).json({
      error: userMessage,
      detail: error.message,
      code: error.code,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
