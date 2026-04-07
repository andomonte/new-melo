// src/pages/api/armazens/atualizarArmazem.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

interface DBArmazem {
  id_armazem: number;
  nome: string | null;
  filial: string | null; // Manter como parte da interface
  ativo: boolean | null;
  data_cadastro: Date | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  inscricaoestadual: string | null;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  // 'filialDoCookie' é usada APENAS para selecionar o banco de dados.
  // Não tem relação com o campo 'filial' da tabela dbarmazem na query.
  const filialDoCookie = cookies.filial_melo;

  if (!filialDoCookie) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  const {
    id_armazem,
    nome,
    ativo,
    logradouro,
    numero,
    complemento,
    bairro,
    cep,
    municipio,
    uf,
    inscricaoestadual,
    filial, // Este é o campo 'filial' do armazém que pode ser atualizado
  }: Partial<DBArmazem> & { id_armazem: number } = req.body;

  if (!id_armazem) {
    return res.status(400).json({ error: 'ID do armazém é obrigatório.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filialDoCookie); // Usa filialDoCookie APENAS AQUI
    client = await pool.connect();

    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`);
      params.push(nome);
    }
    if (ativo !== undefined) {
      updates.push(`ativo = $${paramIndex++}`);
      params.push(ativo);
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
    if (municipio !== undefined) {
      updates.push(`municipio = $${paramIndex++}`);
      params.push(municipio);
    }
    if (uf !== undefined) {
      updates.push(`uf = $${paramIndex++}`);
      params.push(uf);
    }
    if (inscricaoestadual !== undefined) {
      updates.push(`inscricaoestadual = $${paramIndex++}`);
      params.push(inscricaoestadual);
    }
    // Inclua 'filial' (do body) na lista de updates se ela for fornecida
    if (filial !== undefined) {
      updates.push(`filial = $${paramIndex++}`);
      params.push(filial);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ error: 'Nenhum campo fornecido para atualização.' });
    }

    const updateQuery = `
      UPDATE dbarmazem
      SET ${updates.join(', ')}
      WHERE id_armazem = $${paramIndex++} -- AQUI ESTÁ A MUDANÇA CRÍTICA: REMOVIDA A CONDIÇÃO DE FILIAL
      RETURNING *;
    `;

    params.push(id_armazem); // O ID do armazém é o último parâmetro para o WHERE

    const result = await client.query<DBArmazem>(updateQuery, params);

    if (result.rowCount === 0) {
      // A mensagem de erro agora reflete que o armazém não foi encontrado apenas pelo ID
      return res.status(404).json({
        error: `Armazém com ID ${id_armazem} não encontrado.`,
      });
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Erro ao atualizar armazém:', error);
    res
      .status(500)
      .json({ error: error.message || 'Erro ao atualizar armazém.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
