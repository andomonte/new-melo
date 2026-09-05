// Múltiplo de Compras — ajusta a quantidade do item da Ordem de Compra para
// casar com a quantidade que veio na NFe.
//
// Porte do btnMultiploCompra do Delphi (Formularios/XML ENTRADA/UniExecEntrada.pas:4974):
// o comprador seleciona o item da OC, informa usuário + senha de alguém
// autorizado, confirma, e o sistema grava na OC a quantidade da NOTA
// (stoCarregaMultCompras), registrando a auditoria (stoAudMultiploCompras).
// Serve para produtos que o fornecedor entrega fragmentados — a OC pediu 2 e a
// nota veio com 20.

import type { NextApiRequest, NextApiResponse } from 'next';
import { compare } from 'bcryptjs';
import { pool } from '@/lib/db';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

interface MultiploComprasRequest {
  ordemId: string;
  produtoId: string;
  novaQuantidade: number;
  usuario: string;
  senha: string;
  motivo?: string;
}

interface MultiploComprasResponse {
  success: boolean;
  message: string;
  quantidadeAnterior?: number;
  quantidadeNova?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MultiploComprasResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    ordemId,
    produtoId,
    novaQuantidade,
    usuario,
    senha,
    motivo,
  }: MultiploComprasRequest = req.body;

  if (!ordemId || !produtoId || !novaQuantidade || !usuario || !senha) {
    return res
      .status(400)
      .json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
  }

  if (Number(novaQuantidade) <= 0) {
    return res.status(400).json({ error: 'Quantidade inválida.' });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // --- 1. Autorização ---------------------------------------------------
    // O Delphi exige ADM_ENTRADA = 'S' (dbusuario, tabela legada). A maior
    // parte dos logins web não existe lá, então os perfis administrativos do
    // cadastro web também autorizam.
    const auth = await client.query(
      `SELECT u.login_user_login, u.login_user_name, u.login_user_password,
              u.login_perfil_name, d.adm_entrada
       FROM tb_login_user u
       LEFT JOIN dbusuario d
         ON TRIM(d.codusr) = LPAD(u.codusr::text, 4, '0')
       WHERE UPPER(u.login_user_login) = UPPER($1)
       LIMIT 1`,
      [usuario],
    );

    if (auth.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const autorizador = auth.rows[0];

    // As senhas são bcrypt (ver /api/postgresql/verUser). A comparação em
    // texto puro que existia aqui nunca casava — o recurso não funcionava.
    const senhaOk = await compare(
      String(senha),
      autorizador.login_user_password || '',
    );
    if (!senhaOk) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    // Autoriza pela flag do Delphi ou pelos perfis administrativos do cadastro
    // web. A lista aceita a forma acentuada e a sem acento porque o perfil vem
    // como "ADMINISTRAÇÃO" no banco.
    const PERFIS_AUTORIZADOS = ['ADMINISTRAÇÃO', 'ADMINISTRACAO', 'DIRETOR'];
    const perfil = String(autorizador.login_perfil_name || '').trim().toUpperCase();

    const autorizado =
      autorizador.adm_entrada === 'S' || PERFIS_AUTORIZADOS.includes(perfil);

    if (!autorizado) {
      await client.query('ROLLBACK');
      return res
        .status(403)
        .json({ error: 'Usuário sem permissão para múltiplo de compras' });
    }

    // --- 2. Item da OC ----------------------------------------------------
    const ordemResult = await client.query(
      `SELECT o.orc_id, o.orc_status, r.req_id, r.req_versao,
              ri.itr_quantidade AS quantidade_atual,
              COALESCE(ri.itr_quantidade_atendida, 0) AS quantidade_atendida,
              p.descr AS produto_descricao
       FROM cmp_ordem_compra o
       INNER JOIN cmp_requisicao r
         ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
       INNER JOIN cmp_it_requisicao ri
         ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
        AND ri.itr_codprod = $2
       LEFT JOIN dbprod p ON p.codprod = ri.itr_codprod
       WHERE o.orc_id = $1 AND o.orc_status = 'A'`,
      [ordemId, produtoId],
    );

    if (ordemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res
        .status(404)
        .json({ error: 'Ordem de compra não encontrada ou inativa' });
    }

    const ordem = ordemResult.rows[0];
    const quantidadeAtual = Number(ordem.quantidade_atual);
    const atendida = Number(ordem.quantidade_atendida);

    // Mesma recusa do Delphi: "Impossível fazer multiplo de compras pois a
    // quantidade do PEDIDO é igual a quantidade da NOTA!".
    if (Number(novaQuantidade) === quantidadeAtual) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'A quantidade do pedido já é igual à quantidade da nota.',
      });
    }

    // O Delphi grava a quantidade da nota, para mais ou para menos. O único
    // limite que faz sentido é não descer abaixo do que já foi atendido.
    if (Number(novaQuantidade) < atendida) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `A nova quantidade (${novaQuantidade}) é menor que a já atendida (${atendida}).`,
      });
    }

    // --- 3. Ajuste --------------------------------------------------------
    const updateResult = await client.query(
      `UPDATE cmp_it_requisicao
       SET itr_quantidade = $1
       WHERE itr_req_id = $2 AND itr_req_versao = $3 AND itr_codprod = $4`,
      [novaQuantidade, ordem.req_id, ordem.req_versao, produtoId],
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res
        .status(404)
        .json({ error: 'Não foi possível atualizar a quantidade da ordem' });
    }

    // --- 4. Auditoria -----------------------------------------------------
    // Mesma trilha de FECHAR_ITEM / BAIXAR_PENDENCIA: o histórico da OC fica
    // todo em cmp_ordem_historico.
    await registrarHistoricoOrdem(client, {
      orcId: ordem.orc_id,
      previousStatus: ordem.orc_status,
      newStatus: ordem.orc_status,
      userId: autorizador.login_user_login,
      userName: autorizador.login_user_name || autorizador.login_user_login,
      reason: `Múltiplo de compras no item ${produtoId} - ${quantidadeAtual} para ${novaQuantidade}`,
      comments: {
        tipo: 'MULTIPLO_COMPRA',
        codprod: produtoId,
        descricao: ordem.produto_descricao || null,
        quantidade_anterior: quantidadeAtual,
        quantidade_ajustada: Number(novaQuantidade),
        quantidade_atendida: atendida,
        autorizado_por: autorizador.login_user_login,
        motivo: motivo || 'Ajuste por múltiplo de compra',
      },
    });

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Múltiplo de compras aplicado. Quantidade alterada de ${quantidadeAtual} para ${novaQuantidade}.`,
      quantidadeAnterior: quantidadeAtual,
      quantidadeNova: Number(novaQuantidade),
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Erro ao aplicar múltiplo de compras:', err);
    return res.status(500).json({
      error:
        err instanceof Error ? err.message : 'Falha ao aplicar múltiplo de compras.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
