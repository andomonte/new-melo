import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { parseCookies } from 'nookies';

interface MultiploComprasRequest {
  ordemId: string;
  produtoId: string;
  novaQuantidade: number;
  usuario: string;
  senha: string;
}

interface MultiploComprasResponse {
  success: boolean;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MultiploComprasResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { ordemId, produtoId, novaQuantidade, usuario, senha }: MultiploComprasRequest = req.body;

  if (!ordemId || !produtoId || !novaQuantidade || !usuario || !senha) {
    return res.status(400).json({
      error: 'Todos os campos são obrigatórios'
    });
  }

  if (novaQuantidade <= 0) {
    return res.status(400).json({
      error: 'Nova quantidade deve ser maior que zero'
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client;

  try {
    client = await pool.connect();

    // Iniciar transação
    await client.query('BEGIN');

    // 1. Autenticar usuário usando tabela do sistema atual
    const authResult = await client.query(`
      SELECT
        u.login_user_login as usuario_id,
        u.login_user_name as nome,
        CASE
          WHEN g.login_group_is_admin = true THEN 1
          ELSE 2
        END as nivel_acesso
      FROM tb_login_user u
      INNER JOIN tb_login_group g ON u.login_group_name = g.login_group_name
      WHERE u.login_user_login = $1
        AND u.login_user_password = $2
    `, [usuario, senha]);

    if (authResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        error: 'Usuário ou senha inválidos'
      });
    }

    const usuarioData = authResult.rows[0];

    // 2. Verificar se o usuário tem permissão para múltiplo de compras
    // (assumindo que apenas admins ou gerentes podem fazer múltiplo)
    if (usuarioData.nivel_acesso > 2) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Usuário sem permissão para múltiplo de compras'
      });
    }

    // 3. Buscar informações da ordem de compra atual
    const ordemResult = await client.query(`
      SELECT
        o.orc_id,
        r.req_id_composto,
        ri.itr_codprod as codprod,
        ri.itr_quantidade as quantidade_atual,
        COALESCE(ri.itr_quantidade_atendida, 0) as quantidade_atendida,
        p.descr as produto_descricao,
        ri.itr_pr_unitario as preco_unitario
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      INNER JOIN cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
      INNER JOIN dbprod p ON ri.itr_codprod = p.codprod
      WHERE o.orc_id = $1 AND ri.itr_codprod = $2
        AND o.orc_status = 'A'
    `, [ordemId, produtoId]);

    if (ordemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Ordem de compra não encontrada ou inativa'
      });
    }

    const ordem = ordemResult.rows[0];

    // 4. Verificar se já tem quantidade atendida (não permitir alterar se já foi usado)
    if (parseInt(ordem.quantidade_atendida) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Não é possível alterar ordem já parcialmente atendida'
      });
    }

    // 5. Atualizar a quantidade na requisição
    const updateResult = await client.query(`
      UPDATE cmp_it_requisicao
      SET itr_quantidade = $1
      FROM cmp_ordem_compra o, cmp_requisicao r
      WHERE o.orc_id = $2
        AND r.req_id = o.orc_req_id
        AND r.req_versao = o.orc_req_versao
        AND cmp_it_requisicao.itr_req_id = r.req_id
        AND cmp_it_requisicao.itr_req_versao = r.req_versao
        AND cmp_it_requisicao.itr_codprod = $3
    `, [novaQuantidade, ordemId, produtoId]);

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Não foi possível atualizar a quantidade da ordem'
      });
    }

    // 6. Criar tabela de log se não existir (apenas para desenvolvimento)
    await client.query(`
      CREATE TABLE IF NOT EXISTS multiplo_compras_log (
        id SERIAL PRIMARY KEY,
        ordem_id VARCHAR(20) NOT NULL,
        produto_id VARCHAR(6) NOT NULL,
        quantidade_anterior INTEGER NOT NULL,
        quantidade_nova INTEGER NOT NULL,
        usuario_id VARCHAR(40),
        usuario_nome VARCHAR(100) NOT NULL,
        motivo VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Registrar o log da alteração
    await client.query(`
      INSERT INTO multiplo_compras_log (
        ordem_id,
        produto_id,
        quantidade_anterior,
        quantidade_nova,
        usuario_id,
        usuario_nome,
        motivo,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      ordemId,
      produtoId,
      parseInt(ordem.quantidade_atual),
      novaQuantidade,
      usuarioData.usuario_id,
      usuarioData.nome,
      'Alteração via múltiplo de compras - NFe'
    ]);

    console.log(`Múltiplo de compras executado: Ordem ${ordemId}, Produto ${produtoId}, ${ordem.quantidade_atual} -> ${novaQuantidade} por ${usuarioData.nome}`);

    // Commit da transação
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Quantidade alterada de ${ordem.quantidade_atual} para ${novaQuantidade} com sucesso!`
    });

  } catch (err) {
    // Rollback da transação em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('Erro no múltiplo de compras:', err);
    res.status(500).json({
      error: 'Falha na alteração da quantidade.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}