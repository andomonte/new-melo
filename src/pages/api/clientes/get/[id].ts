// ficheiro: /api/clientes/get/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'ID Obrigatório e deve ser uma string.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Consulta SQL CORRIGIDA
    const clienteResult = await client.query(
      `
      SELECT 
        codcli, nome, nomefant, cpfcgc, tipo, codcc, codvend, datacad, ender,
        bairro, cidade, uf, cep, iest, isuframa, imun, status, obs, tipoemp,
        debito, limite, contato, socios, icms, endercobr, cidadecobr,
        bairrocobr, ufcobr, cepcobr, claspgto, email, atraso, ipi, prvenda,
        codbairro, codbairrocobr, banco, tipocliente, codtmk, kickback,
        sit_tributaria, numero, referencia, codpais, numerocobr, codpaiscobr,
        referenciacobr, codmunicipio, codmunicipiocobr, complemento,
        complementocobr, acrescimo, desconto, habilitasuframa, emailnfe,
        faixafin, codunico, bloquear_preco, local_entrega, codigo_filial
      FROM dbclien
      WHERE codcli = $1
      LIMIT 1;
    `,
      [id],
    );

    const cliente = clienteResult.rows[0];

    if (!cliente) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    // --- FETCH CONTACTS ---
    const emailsResult = await client.query(
      'SELECT email FROM dbclien_email WHERE codcli = $1',
      [id],
    );
    const contatosResult = await client.query(
      'SELECT nome, fone FROM dbclien_contatos WHERE codcli = $1',
      [id],
    );

    const contatosList: any[] = [];
    const vendedoresList: any[] = [];

    // Add emails
    emailsResult.rows.forEach((row: any) => {
      contatosList.push({
        type: 'email',
        value: row.email,
        obs: 'Email',
      });
    });

    // Add phones
    contatosResult.rows.forEach((row: any) => {
      if (row.nome && row.nome.startsWith('VENDEDOR:')) {
        vendedoresList.push({ sellerId: row.fone });
      } else {
        contatosList.push({
          type: 'phone',
          value: row.fone,
          obs: row.nome || 'Telefone',
        });
      }
    });

    // Ensure primary codvend is in the list if valid
    if (
      cliente.codvend &&
      !vendedoresList.some((v) => v.sellerId === cliente.codvend)
    ) {
      vendedoresList.unshift({ sellerId: cliente.codvend });
    }

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );

    // O objeto 'cliente' retornado já deve ter os tipos corretos (números, datas).
    // O driver 'pg' geralmente lida bem com isso, mas se algum campo numérico
    // vier como string, a conversão para Number() é uma boa prática.
    res.status(200).json({
      ...cliente,
      // Serializa contatos como JSON string para compatibilidade com o frontend que espera JSON.parse
      contatos: JSON.stringify(contatosList),
      vendedores_list: vendedoresList,

      // Converte apenas os campos que você tem certeza que são numéricos, se necessário
      debito: Number(cliente.debito),
      limite: Number(cliente.limite),
      atraso: Number(cliente.atraso),
      kickback: Number(cliente.kickback),
      sit_tributaria: Number(cliente.sit_tributaria),
      codpais: Number(cliente.codpais),
      codpaiscobr: Number(cliente.codpaiscobr),
      codigo_filial: Number(cliente.codigo_filial),
      acrescimo: Number(cliente.acrescimo),
      desconto: Number(cliente.desconto),
    });
  } catch (error: any) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar cliente.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
