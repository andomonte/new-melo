import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

interface Funcao {
  id_functions: number;
  descricao: string;
  sigla: string;
  usadoEm: string;
  codigo_filial?: number; // Mantido como estava, se necessário para o front
}

interface Armazem {
  id_armazem: number;
  nome?: string; // Opcional, mas útil para interfaces
  filial?: string; // Opcional, representa a filial do armazém, não do acesso
  ativo?: boolean; // Adicionado 'ativo' para corresponder ao que o frontend envia
}

interface Filial {
  codigo_filial: string; // Vem como string do frontend
  nome_filial: string;
  codvend?: string | null;
  armazens?: Armazem[]; // <<--- CORREÇÃO: ADICIONADO AQUI
  funcoesDoUsuario: Funcao[];
}

interface Perfil {
  perfil_name: string;
  filial: Filial[]; // Filial agora tem 'armazens'
  funcoesPadraoPerfil?: Funcao[]; // Funções padrão do perfil (apenas referência)
  funcoesDoUsuario: Funcao[]; // Funções específicas do usuário a serem salvas
  // armazensPadraoPerfil?: Armazem[]; // <<--- REMOVIDO
  // armazensDoUsuario: Armazem[];    // <<--- REMOVIDO
  codvend?: string | null;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido. Use PUT.' });
  }

  if (!id) {
    return res
      .status(400)
      .json({ error: 'ID do usuário obrigatório para atualização.' });
  }

  const {
    login_user_name,
    login_user_login,
    perfis,
  }: {
    login_user_name: string;
    login_user_login?: string; // id do usuário (novo, para update do login)
    perfis: Perfil[];
  } = req.body;

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    await client.query('BEGIN');

    // 1. Atualizar o usuário
    await client.query(
      `UPDATE tb_login_user
        SET login_user_name = $1,
            login_user_login = $2
        WHERE login_user_login = $3`,
      [login_user_name, login_user_login, id],
    );

    // 2. Remover perfis antigos
    await client.query('DELETE FROM tb_user_perfil WHERE user_login_id = $1', [
      id,
    ]);

    // 3. Inserir novos perfis (com codvend)
    for (const perfil of perfis) {
      for (const filial of perfil.filial) {
        await client.query(
          `INSERT INTO tb_user_perfil
           (user_login_id, perfil_name, codigo_filial, nome_filial, codvend)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            login_user_login,
            perfil.perfil_name,
            Number(filial.codigo_filial),
            filial.nome_filial,
            filial.codvend ?? null,
          ],
        );
      }
    }

    // 4. Remover acessos de funções anteriores
    await client.query(
      'DELETE FROM tb_login_access_user WHERE login_user_login = $1',
      [id],
    );
    // 5. Inserir apenas as funções do usuário, com código_filial
    for (const perfil of perfis) {
      for (const filial of perfil.filial) {
        const codFilial = Number(filial.codigo_filial);

        // Filtrar funções do usuário que pertencem a ESTA filial

        const funcoesUsuarioNaFilial = filial.funcoesDoUsuario ?? [];

        // Filtrar também as funções do perfil (herdadas) para essa filial
        // Nota: A lógica de 'funcoesPadraoPerfil' no backend aqui pode precisar ser
        // revisada se a sua definição de função padrão depende de armazéns.
        // Por enquanto, ela continua como estava no seu código.
        const funcoesPerfilNaFilial = (perfil.funcoesPadraoPerfil ?? [])
          .filter((f) => Number((f as any).codigo_filial) === codFilial)
          .map((f) => f.id_functions);

        for (const funcao of funcoesUsuarioNaFilial) {
          const { id_functions } = funcao;

          if (funcoesPerfilNaFilial.includes(id_functions)) {
            continue; // ← pula a função que já está no perfil
          }

          await client.query(
            `INSERT INTO tb_login_access_user
           (login_user_login, id_functions, login_perfil_name, codigo_filial)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
            [login_user_login, id_functions, perfil.perfil_name, codFilial],
          );
        }
      }
    }

    // --- NOVA LÓGICA PARA ATUALIZAÇÃO DE ARMAZÉNS (INÍCIO) ---

    // 6. Remover acessos de armazéns anteriores do usuário
    await client.query(
      'DELETE FROM tb_login_armazem_user WHERE login_user_login = $1',
      [id],
    );

    // 7. Inserir apenas os armazéns do usuário, considerando a lógica de prioridade (não salvar se já for padrão do perfil)
    for (const perfil of perfis) {
      for (const filial of perfil.filial) {
        const codFilial = Number(filial.codigo_filial);
        const perfilName = perfil.perfil_name;

        // Armazéns que o frontend enviou, agora corretamente acessados via 'filial.armazens'
        const armazensParaSalvar = filial.armazens ?? []; // <<--- CORREÇÃO AQUI!

        // Se você precisar filtrar armazéns que são "padrão do perfil",
        // essa lógica deve ser reintroduzida aqui, garantindo que você tenha
        // a lista de armazéns padrão para este perfil/filial em particular.
        // O frontend é o responsável por determinar o que é "do usuário" vs. "padrão".
        // Por enquanto, este loop insere todos os armazéns que vieram na filial.

        for (const armazem of armazensParaSalvar) {
          const { id_armazem } = armazem;

          await client.query(
            `INSERT INTO tb_login_armazem_user
           (login_user_login, id_armazem, login_perfil_name, codigo_filial)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id_armazem, login_user_login, codigo_filial) DO NOTHING`, // Usando a PK composta
            [login_user_login, id_armazem, perfilName, codFilial],
          );
        }
      }
    }
    // --- NOVA LÓGICA PARA ATUALIZAÇÃO DE ARMAZÉNS (FIM) ---

    // 8. Remover filiais existentes
    await client.query(
      'DELETE FROM tb_login_filiais WHERE login_user_login = $1',
      [id],
    );

    // 9. Inserir filiais únicas
    const uniqueFiliais = new Map<
      string,
      { codigo_filial: number; nome_filial: string }
    >();

    for (const perfil of perfis) {
      for (const filial of perfil.filial) {
        uniqueFiliais.set(`${login_user_login}-${filial.codigo_filial}`, {
          codigo_filial: Number(filial.codigo_filial),
          nome_filial: filial.nome_filial,
        });
      }
    }

    for (const [, filial] of uniqueFiliais) {
      await client.query(
        `INSERT INTO tb_login_filiais
          (login_user_login, codigo_filial, nome_filial)
          VALUES ($1, $2, $3)`,
        [login_user_login, filial.codigo_filial, filial.nome_filial],
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  } finally {
    if (client) client.release();
  }
}
