import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolDaFilial } from '@/lib/estacaoDb';
import { PoolClient } from 'pg';
import { autenticarSeparador } from '@/lib/separacao/estacaoAuth';

/**
 * Estação de Conferência — iniciar conferência por MATRÍCULA + CÓDIGO + Nº DO PEDIDO.
 *
 * Regras (fiéis ao módulo atual, tudo em dbvenda):
 *  - conferente autenticado por matrícula + código (dbfunc_estoque)
 *  - primeiro acesso (codigoacesso===matricula) → exige criar código antes
 *  - pedido localizado por nrovenda (ignora zeros à esquerda)
 *  - venda precisa estar em statuspedido='3' (separação finalizada)
 *  - 1 conferência ativa por conferente (bloqueia se já tem statuspedido='4')
 *  - grava statuspedido='4', conferente=matricula, inicioconferencia=NOW()
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

    const auth = await autenticarSeparador(client, req.body?.matricula, req.body?.codigo);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code });
    if (auth.primeiroAcesso) {
      return res.status(200).json({ code: 'PRIMEIRO_ACESSO', matricula: auth.matricula, nome: auth.nome });
    }
    const func = { matricula: auth.matricula, nome: auth.nome };

    // 1 conferência ativa por conferente
    const ativa = await client.query(
      `SELECT nrovenda FROM dbvenda WHERE conferente = $1 AND statuspedido = '4' LIMIT 1`,
      [func.matricula],
    );
    if (ativa.rows.length > 0) {
      return res.status(409).json({
        error: `${String(func.nome).split(' ')[0]} já está conferindo o pedido ${ativa.rows[0].nrovenda}. Finalize antes de iniciar outro.`,
        code: 'CONFERENCIA_JA_ATIVA',
      });
    }

    // localizar venda por nrovenda (ignora zeros à esquerda)
    const v = await client.query(
      `SELECT codvenda, nrovenda, statuspedido, conferente
         FROM dbvenda
        WHERE regexp_replace(COALESCE(nrovenda,''), '^0+', '') = regexp_replace($1, '^0+', '')
        ORDER BY data DESC NULLS LAST LIMIT 1`,
      [nroPedido],
    );
    if (v.rows.length === 0) {
      return res.status(404).json({ error: `Pedido ${nroPedido} não encontrado.`, code: 'PEDIDO_NAO_ENCONTRADO' });
    }
    const venda = v.rows[0];

    if (venda.statuspedido !== '3') {
      if (venda.statuspedido === '4') {
        return res.status(409).json({ error: `Pedido ${venda.nrovenda} já está em conferência.`, code: 'JA_EM_CONFERENCIA' });
      }
      if (venda.statuspedido === '5') {
        return res.status(409).json({ error: `Pedido ${venda.nrovenda} já foi conferido.`, code: 'JA_CONFERIDO' });
      }
      if (venda.statuspedido === '1' || venda.statuspedido === '2') {
        return res.status(409).json({ error: `Pedido ${venda.nrovenda} ainda não teve a separação finalizada.`, code: 'SEPARACAO_PENDENTE' });
      }
      return res.status(409).json({
        error: `Pedido ${venda.nrovenda} não está disponível para conferência (status ${venda.statuspedido ?? '—'}).`,
        code: 'STATUS_INVALIDO',
      });
    }

    const upd = await client.query(
      `UPDATE dbvenda
          SET statuspedido='4', conferente=$2, inicioconferencia=NOW(),
              finalizadopedido=NULL, dtupdate=NOW()
        WHERE codvenda=$1 AND statuspedido='3' AND (conferente IS NULL OR conferente='' OR conferente=$2)
        RETURNING codvenda, nrovenda, inicioconferencia AS inicio`,
      [venda.codvenda, func.matricula],
    );
    if (upd.rowCount === 0) {
      return res.status(409).json({
        error: 'Não foi possível iniciar — o pedido pode ter sido alterado por outro usuário.',
        code: 'CONCORRENCIA',
      });
    }

    return res.status(200).json({
      message: 'Conferência iniciada com sucesso',
      data: {
        codvenda: upd.rows[0].codvenda,
        nrovenda: upd.rows[0].nrovenda,
        nome: func.nome,
        inicio: upd.rows[0].inicio,
      },
    });
  } catch (error) {
    console.error('Erro em conferencia/estacao/iniciar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
  } finally {
    if (client) try { client.release(); } catch {}
  }
}
