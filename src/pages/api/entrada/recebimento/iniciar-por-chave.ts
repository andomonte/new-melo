/**
 * Endpoint para iniciar recebimento por chave da NFe ou importacao
 * POST /api/entrada/recebimento/iniciar-por-chave
 *
 * Body:
 * - chaveNFe: chave de acesso da NFe (44 digitos) ou chave de importacao
 * - matriculaRecebedor: matricula do operador
 * - nomeRecebedor: nome do operador
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

interface IniciarPorChaveRequest {
  chaveNFe: string;
  matriculaRecebedor: string;
  nomeRecebedor: string;
}

interface EntradaParaReceber {
  id: number;
  entrada_id: number;
  numero_entrada: string;
  nfe_numero: string;
  nfe_serie: string;
  fornecedor: string;
  valor_total: number;
  qtd_itens: number;
  data_entrada: string;
  status: string;
  status_label: string;
  recebedor_nome?: string;
  inicio_recebimento?: string;
}

interface IniciarPorChaveResponse {
  success: boolean;
  message: string;
  data?: EntradaParaReceber;
}

// Buscar NFe pela chave de acesso
const BUSCAR_NFE_QUERY = `
  SELECT
    n.codnfe_ent,
    n.nnf,
    n.serie,
    n.demi,
    n.vnf as valor_total,
    emit.xnome as fornecedor
  FROM dbnfe_ent n
  LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
  WHERE n.chave = $1
  LIMIT 1
`;

// Buscar entrada existente pelo nfe_id
const BUSCAR_ENTRADA_QUERY = `
  SELECT
    e.id as entrada_id,
    e.numero_entrada,
    e.valor_total,
    e.created_at as data_entrada,
    COALESCE(item_count.total, 0) as qtd_itens,
    COALESCE(op.id, 0) as operacao_id,
    COALESCE(op.status, 'AGUARDANDO_RECEBIMENTO') as status,
    op.recebedor_nome,
    op.inicio_recebimento
  FROM entradas_estoque e
  LEFT JOIN (
    SELECT entrada_id, COUNT(*) as total
    FROM entrada_itens
    GROUP BY entrada_id
  ) item_count ON item_count.entrada_id = e.id
  LEFT JOIN entrada_operacoes op ON op.entrada_id = e.id
  WHERE e.nfe_id::text = $1::text
  LIMIT 1
`;

// Verificar se operador ja tem recebimento ativo
const CHECK_ATIVO_QUERY = `
  SELECT id, entrada_id
  FROM entrada_operacoes
  WHERE recebedor_matricula = $1
    AND status = 'EM_RECEBIMENTO'
  LIMIT 1
`;

// Verificar se entrada ja esta em recebimento
const CHECK_ENTRADA_RECEBIMENTO_QUERY = `
  SELECT id, recebedor_nome
  FROM entrada_operacoes
  WHERE entrada_id = $1
    AND status = 'EM_RECEBIMENTO'
  LIMIT 1
`;

// Criar/atualizar operacao de recebimento
const UPSERT_OPERACAO_QUERY = `
  INSERT INTO entrada_operacoes (
    entrada_id,
    status,
    recebedor_matricula,
    recebedor_nome,
    inicio_recebimento,
    created_at,
    updated_at
  )
  VALUES ($1, 'EM_RECEBIMENTO', $2, $3, NOW(), NOW(), NOW())
  ON CONFLICT (entrada_id)
  DO UPDATE SET
    status = 'EM_RECEBIMENTO',
    recebedor_matricula = $2,
    recebedor_nome = $3,
    inicio_recebimento = NOW(),
    updated_at = NOW()
  WHERE entrada_operacoes.status IN ('AGUARDANDO_RECEBIMENTO', 'EM_RECEBIMENTO')
  RETURNING id
`;

// Criar registros de itens para conferencia
const CREATE_ITENS_RECEBIMENTO_QUERY = `
  INSERT INTO entrada_itens_recebimento (
    entrada_operacao_id,
    entrada_item_id,
    produto_cod,
    qtd_esperada,
    status_item,
    created_at,
    updated_at
  )
  SELECT
    $1,
    ei.id,
    ei.produto_cod,
    ei.quantidade,
    'PENDENTE',
    NOW(),
    NOW()
  FROM entrada_itens ei
  WHERE ei.entrada_id = $2
    AND NOT EXISTS (
      SELECT 1 FROM entrada_itens_recebimento eir
      WHERE eir.entrada_item_id = ei.id
    )
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IniciarPorChaveResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const body = req.body as IniciarPorChaveRequest;
  const { chaveNFe, matriculaRecebedor, nomeRecebedor } = body;

  // Validacoes
  if (!chaveNFe || !matriculaRecebedor || !nomeRecebedor) {
    return res.status(400).json({
      error: 'chaveNFe, matriculaRecebedor e nomeRecebedor sao obrigatorios',
    });
  }

  // Detectar chave de importacao (prefixo IMP)
  const isImportacao = chaveNFe.trim().toUpperCase().startsWith('IMP');
  const chaveLimpa = isImportacao
    ? 'IMP' + chaveNFe.trim().slice(3).replace(/\D/g, '')
    : chaveNFe.replace(/\D/g, '');

  const digitosCount = isImportacao
    ? chaveLimpa.slice(3).length
    : chaveLimpa.length;

  if (digitosCount < 20) {
    return res.status(400).json({
      error: 'A chave deve ter pelo menos 20 digitos numericos',
    });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // 1. Buscar NFe pela chave
    const nfeResult = await client.query(BUSCAR_NFE_QUERY, [chaveLimpa]);

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'NFe nao encontrada com esta chave de acesso. Verifique se a nota foi processada no sistema.',
      });
    }

    const nfe = nfeResult.rows[0];

    // 2. Buscar entrada vinculada a esta NFe
    const entradaResult = await client.query(BUSCAR_ENTRADA_QUERY, [nfe.codnfe_ent]);

    if (entradaResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Nenhuma entrada de estoque encontrada para esta NFe. A nota pode nao ter sido processada ainda.',
      });
    }

    const entradaRow = entradaResult.rows[0];
    const entradaId = parseInt(entradaRow.entrada_id);

    // 3. Verificar se ja esta em recebimento
    if (entradaRow.status === 'EM_RECEBIMENTO') {
      if (entradaRow.recebedor_nome === nomeRecebedor) {
        // E o proprio usuario, retornar a entrada para continuar
        const entradaData: EntradaParaReceber = {
          id: parseInt(entradaRow.operacao_id),
          entrada_id: entradaId,
          numero_entrada: entradaRow.numero_entrada,
          nfe_numero: nfe.nnf?.toString() || '',
          nfe_serie: nfe.serie?.toString() || '',
          fornecedor: nfe.fornecedor || 'Fornecedor nao identificado',
          valor_total: parseFloat(entradaRow.valor_total || nfe.valor_total || 0),
          qtd_itens: parseInt(entradaRow.qtd_itens || 0),
          data_entrada: entradaRow.data_entrada,
          status: 'EM_RECEBIMENTO',
          status_label: 'Em Recebimento',
          recebedor_nome: nomeRecebedor,
          inicio_recebimento: entradaRow.inicio_recebimento,
        };

        return res.status(200).json({
          success: true,
          message: 'Voce ja possui este recebimento em andamento',
          data: entradaData,
        });
      } else {
        return res.status(400).json({
          error: `Esta entrada ja esta sendo recebida por ${entradaRow.recebedor_nome}`,
        });
      }
    }

    // 4. Verificar se ja esta finalizado
    if (entradaRow.status === 'RECEBIDO') {
      return res.status(400).json({
        error: 'Esta entrada ja foi recebida anteriormente.',
      });
    }

    // 5. Verificar se operador ja tem outro recebimento ativo
    const ativoResult = await client.query(CHECK_ATIVO_QUERY, [matriculaRecebedor]);
    if (ativoResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Voce ja possui um recebimento em andamento. Finalize-o primeiro.',
      });
    }

    // 6. Iniciar transacao para criar o recebimento
    await client.query('BEGIN');

    // Criar/atualizar operacao
    const operacaoResult = await client.query(UPSERT_OPERACAO_QUERY, [
      entradaId,
      matriculaRecebedor,
      nomeRecebedor,
    ]);

    if (operacaoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Nao foi possivel iniciar o recebimento. A entrada pode estar em um status invalido.',
      });
    }

    const operacaoId = operacaoResult.rows[0].id;

    // Criar registros de itens para conferencia
    await client.query(CREATE_ITENS_RECEBIMENTO_QUERY, [operacaoId, entradaId]);

    await client.query('COMMIT');

    console.log('Recebimento iniciado por chave NFe:', {
      operacaoId,
      entradaId,
      chaveNFe: chaveLimpa.substring(0, 10) + '...',
      recebedor: nomeRecebedor,
      filial,
    });

    const entradaData: EntradaParaReceber = {
      id: operacaoId,
      entrada_id: entradaId,
      numero_entrada: entradaRow.numero_entrada,
      nfe_numero: nfe.nnf?.toString() || '',
      nfe_serie: nfe.serie?.toString() || '',
      fornecedor: nfe.fornecedor || 'Fornecedor nao identificado',
      valor_total: parseFloat(entradaRow.valor_total || nfe.valor_total || 0),
      qtd_itens: parseInt(entradaRow.qtd_itens || 0),
      data_entrada: entradaRow.data_entrada,
      status: 'EM_RECEBIMENTO',
      status_label: 'Em Recebimento',
      recebedor_nome: nomeRecebedor,
      inicio_recebimento: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      message: 'Recebimento iniciado com sucesso',
      data: entradaData,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao iniciar recebimento por chave:', error);

    return res.status(500).json({
      error: 'Erro ao iniciar recebimento. Tente novamente.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
