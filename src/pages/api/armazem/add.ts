// src/pages/api/armazens/cadastrarArmazem.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Certifique-se de que este caminho está correto

// --- Interface DBArmazem para o objeto armazém ---
// Esta interface representa a estrutura da tabela dbarmazem no seu banco de dados.
interface DBArmazem {
  id_armazem: number;
  nome: string | null;
  filial: string | null; // Este campo agora aceita o valor DIRETO do frontend (nome ou código, conforme o que o DB espera)
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

// --- Handler principal da API de cadastro de armazém ---
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Garante que a requisição seja do tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const cookies = parseCookies({ req });
  // 'filialDoCookie' é usada EXCLUSIVAMENTE para determinar qual pool de conexão usar.
  // Ela NÃO é o valor que será salvo na coluna 'filial' da tabela 'dbarmazem'.
  const filialDoCookie = cookies.filial_melo;

  // Validação inicial: verifica se a filial para conexão está presente no cookie
  if (!filialDoCookie) {
    return res
      .status(400)
      .json({ error: 'Filial de conexão (cookie) não informada.' });
  }

  // Desestruturação dos dados do corpo da requisição (req.body)
  const {
    nome,
    logradouro,
    numero,
    complemento,
    bairro,
    cep,
    municipio,
    uf,
    ativo,
    inscricaoestadual,
    filial, // <-- AGORA, este é o valor DIRETO da filial vindo do frontend, sem conversão.
  }: Partial<DBArmazem> = req.body; // Removida a tipagem extra para `filial?: string` pois `Partial<DBArmazem>` já o cobre.

  // Validações de campos obrigatórios
  if (!nome) {
    return res.status(400).json({ error: 'Nome do armazém é obrigatório.' });
  }
  // A filial vinda do frontend é agora obrigatória para o cadastro
  if (!filial) {
    // Usamos 'filial' diretamente aqui
    return res
      .status(400)
      .json({
        error: 'Filial do armazém é obrigatória no corpo da requisição.',
      });
  }

  let clientPrincipal: PoolClient | undefined; // Cliente de conexão para a transação principal

  try {
    // Obtém o pool de conexão principal com base na filial do cookie
    const poolPrincipal = getPgPool(filialDoCookie);
    clientPrincipal = await poolPrincipal.connect(); // Conecta o cliente principal

    await clientPrincipal.query('BEGIN'); // Inicia a transação

    // --- Construção dinâmica da query de INSERT ---
    // A coluna 'filial' agora recebe o `filial` diretamente do req.body.
    const columns: string[] = ['nome', 'filial'];
    const values: (string | boolean | null)[] = [nome, filial]; // Usa o VALOR DIRETO DA FILIAL do frontend
    const placeholders: string[] = ['$1', '$2']; // Placeholders para 'nome' e 'filial'
    let paramIndex = 3; // Inicia o índice para os próximos parâmetros

    // Adiciona os outros campos opcionais à query se eles foram fornecidos no body
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
    if (ativo !== undefined) {
      columns.push('ativo');
      values.push(ativo);
      placeholders.push(`$${paramIndex++}`);
    }
    if (inscricaoestadual !== undefined) {
      columns.push('inscricaoestadual');
      values.push(inscricaoestadual);
      placeholders.push(`$${paramIndex++}`);
    }

    // `data_cadastro` é tipicamente definido como CURRENT_TIMESTAMP no banco e não precisa ser inserido manualmente.

    // A query agora se refere à tabela dbarmazem diretamente, sem prefixo de schema.
    const insertQuery = `
      INSERT INTO dbarmazem (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;

    // Executa a query de inserção usando o cliente principal da transação
    const result = await clientPrincipal.query<DBArmazem>(insertQuery, values);

    await clientPrincipal.query('COMMIT'); // Confirma a transação

    // Retorna o armazém recém-criado, incluindo o id_armazem e os defaults gerados pelo banco
    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    // Em caso de erro, tenta fazer o rollback da transação no cliente principal
    if (clientPrincipal) {
      await clientPrincipal.query('ROLLBACK');
    }
    console.error('Erro ao criar armazém:', error);
    // Retorna uma mensagem de erro genérica em produção, ou o erro específico em desenvolvimento
    res.status(500).json({ error: error.message || 'Erro ao criar armazém.' });
  } finally {
    // Garante que o cliente principal da transação seja liberado de volta para o pool
    if (clientPrincipal) {
      clientPrincipal.release();
    }
  }
}
