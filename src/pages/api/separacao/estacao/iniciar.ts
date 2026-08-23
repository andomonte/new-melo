import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';
import { autenticarSeparador } from '@/lib/separacao/estacaoAuth';

/**
 * Estação de Separação — iniciar separação por MATRÍCULA + CÓDIGO + Nº DO PEDIDO (nrovenda).
 *
 * Regras (fiéis ao módulo atual, tudo em dbvenda):
 *  - separador autenticado por matrícula + código (dbfunc_estoque)
 *  - se primeiroAcesso (codigoacesso===matricula) → exige criar código antes
 *  - pedido localizado por nrovenda (ignorando zeros à esquerda)
 *  - venda precisa estar em statuspedido='1' (aguardando separação)
 *  - 1 separação ativa por separador (bloqueia se já tem statuspedido='2')
 *  - grava statuspedido='2', separador=matricula, inicioseparacao=NOW()
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const nroPedido = String(req.body?.nroPedido ?? '').trim();
  if (!nroPedido) return res.status(400).json({ error: 'Informe o número do pedido.', code: 'PEDIDO_OBRIGATORIO' });

  const filial = String(req.body?.filial || parseCookies({ req }).filial_melo || 'MANAUS');
  const pool = poolDaFilial(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // 1) autenticar separador (matrícula + código)
    const auth = await autenticarSeparador(client, req.body?.matricula, req.body?.codigo);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code });
    if (auth.primeiroAcesso) {
      return res.status(200).json({ code: 'PRIMEIRO_ACESSO', matricula: auth.matricula, nome: auth.nome });
    }
    const func = { matricula: auth.matricula, nome: auth.nome };

    // 2) 1 separação ativa por separador
    const ativa = await client.query(
      `SELECT nrovenda FROM dbvenda WHERE separador = $1 AND statuspedido = '2' LIMIT 1`,
      [func.matricula],
    );
    if (ativa.rows.length > 0) {
      return res.status(409).json({
        error: `${String(func.nome).split(' ')[0]} já está com o pedido ${ativa.rows[0].nrovenda} em separação. Finalize antes de iniciar outro.`,
        code: 'SEPARACAO_JA_ATIVA',
      });
    }

    // 3) localizar venda por nrovenda (ignora zeros à esquerda)
    const v = await client.query(
      `SELECT codvenda, nrovenda, statuspedido, separador
         FROM dbvenda
        WHERE regexp_replace(COALESCE(nrovenda,''), '^0+', '') = regexp_replace($1, '^0+', '')
        ORDER BY data DESC NULLS LAST LIMIT 1`,
      [nroPedido],
    );
    if (v.rows.length === 0) {
      return res.status(404).json({ error: `Pedido ${nroPedido} não encontrado.`, code: 'PEDIDO_NAO_ENCONTRADO' });
    }
    const venda = v.rows[0];

    if (venda.statuspedido !== '1') {
      if (venda.statuspedido === '2') {
        return res.status(409).json({ error: `Pedido ${venda.nrovenda} já está em separação.`, code: 'JA_EM_SEPARACAO' });
      }
      if (venda.statuspedido === '3') {
        return res.status(409).json({ error: `Pedido ${venda.nrovenda} já teve a separação finalizada.`, code: 'JA_FINALIZADO' });
      }
      return res.status(409).json({
        error: `Pedido ${venda.nrovenda} não está disponível para separação (status ${venda.statuspedido ?? '—'}).`,
        code: 'STATUS_INVALIDO',
      });
    }

    // 4) update com controle de concorrência
    const upd = await client.query(
      `UPDATE dbvenda
          SET statuspedido='2', separador=$2, inicioseparacao=NOW(),
              fimseparacao=NULL, conferente=NULL, inicioconferencia=NULL,
              finalizadopedido=NULL, dtupdate=NOW()
        WHERE codvenda=$1 AND statuspedido='1'
        RETURNING codvenda, nrovenda, inicioseparacao`,
      [venda.codvenda, func.matricula],
    );
    if (upd.rowCount === 0) {
      return res.status(409).json({
        error: 'Não foi possível iniciar — o pedido pode ter sido alterado por outro usuário.',
        code: 'CONCORRENCIA',
      });
    }

    return res.status(200).json({
      message: 'Separação iniciada com sucesso',
      data: {
        codvenda: upd.rows[0].codvenda,
        nrovenda: upd.rows[0].nrovenda,
        nome: func.nome,
        inicioseparacao: upd.rows[0].inicioseparacao,
      },
    });
  } catch (error) {
    console.error('Erro em estacao/iniciar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
