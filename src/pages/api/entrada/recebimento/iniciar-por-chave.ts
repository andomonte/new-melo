/**
 * Iniciar recebimento por chave da NFe.
 * Fonte: dbent (por chave) + dbent_recebimento (workflow) + entrada_operacoes (por codent).
 * POST /api/entrada/recebimento/iniciar-por-chave
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolRecebimento } from '@/lib/recebimentoEntrada/filial';
import { STATUS_PODE_RECEBER } from '@/lib/recebimentoEntrada/status';
import { PoolClient } from 'pg';

interface IniciarPorChaveRequest {
  chaveNFe: string;
  matriculaRecebedor: string;
  nomeRecebedor: string;
}

interface EntradaParaReceber {
  id: number;
  entrada_id: string; // codent (chave opaca)
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IniciarPorChaveResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { chaveNFe, matriculaRecebedor, nomeRecebedor } = (req.body || {}) as IniciarPorChaveRequest;
  // Alternativa à chave: o número da entrada (codent), vindo da lista "Entradas para receber".
  const codentBody = String((req.body as any)?.codent || '').trim();

  if ((!chaveNFe && !codentBody) || !matriculaRecebedor || !nomeRecebedor) {
    return res.status(400).json({ error: 'Informe a chave da NFe (ou a entrada), a matrícula e o nome do recebedor' });
  }

  // filial do link da tela (header x-filial-recebimento); ver lib/recebimentoEntrada/filial.ts
  const { pool } = poolRecebimento(req);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Pela entrada: descobre a chave dela e segue o fluxo normal
    let chaveLimpa = '';
    if (codentBody) {
      const r = await client.query(`SELECT chave FROM dbent WHERE codent = $1 LIMIT 1`, [codentBody]);
      if (r.rows.length === 0 || !r.rows[0].chave) {
        return res.status(404).json({ error: `Entrada ${codentBody} não encontrada (ou sem chave de NFe).` });
      }
      chaveLimpa = String(r.rows[0].chave).trim();
    } else {
      const isImportacao = String(chaveNFe).trim().toUpperCase().startsWith('IMP');
      chaveLimpa = isImportacao
        ? 'IMP' + String(chaveNFe).trim().slice(3).replace(/\D/g, '')
        : String(chaveNFe).replace(/\D/g, '');
      const digitosCount = isImportacao ? chaveLimpa.slice(3).length : chaveLimpa.length;
      if (digitosCount < 20) {
        return res.status(400).json({ error: 'A chave deve ter pelo menos 20 digitos numericos' });
      }
    }

    // 1. NFe pela chave
    const nfeResult = await client.query(
      `SELECT n.codnfe_ent, n.nnf, n.serie, n.demi, n.vnf as valor_total, emit.xnome as fornecedor
         FROM dbnfe_ent n
         LEFT JOIN dbnfe_ent_emit emit ON n.codnfe_ent = emit.codnfe_ent
        WHERE n.chave = $1 LIMIT 1`, [chaveLimpa]);
    if (nfeResult.rows.length === 0) {
      return res.status(404).json({ error: 'NFe nao encontrada com esta chave de acesso. Verifique se a nota foi processada.' });
    }
    const nfe = nfeResult.rows[0];

    // 2. Entrada (dbent) vinculada pela chave + workflow + operacao
    const entradaResult = await client.query(
      `SELECT e.codent,
              COALESCE(e.totalnf, 0) as valor_total,
              e.dtent as data_entrada,
              rec.status as workflow_status,
              e.status as ent_status,
              (SELECT COUNT(*) FROM dbitent WHERE codent = e.codent) as qtd_itens,
              COALESCE(op.id, 0) as operacao_id,
              op.status as op_status,
              op.recebedor_nome, op.inicio_recebimento
         FROM dbent e
         LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
         LEFT JOIN entrada_operacoes op ON op.codent = e.codent
        WHERE e.chave = $1
        ORDER BY (COALESCE(e.status, '') = 'C'), e.codent DESC
        LIMIT 1`, [chaveLimpa]);
    if (entradaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma entrada encontrada para esta NFe.' });
    }
    const entradaRow = entradaResult.rows[0];
    const codent: string = entradaRow.codent;

    const dados = (statusLabel: string): EntradaParaReceber => ({
      id: parseInt(entradaRow.operacao_id) || 0,
      entrada_id: codent,
      numero_entrada: codent,
      nfe_numero: nfe.nnf?.toString() || '',
      nfe_serie: nfe.serie?.toString() || '',
      fornecedor: nfe.fornecedor || 'Fornecedor nao identificado',
      valor_total: parseFloat(entradaRow.valor_total || nfe.valor_total || 0),
      qtd_itens: parseInt(entradaRow.qtd_itens || 0),
      data_entrada: entradaRow.data_entrada,
      status: 'EM_RECEBIMENTO',
      status_label: statusLabel,
      recebedor_nome: nomeRecebedor,
      inicio_recebimento: entradaRow.inicio_recebimento,
    });

    // 3. Já em recebimento?
    if (entradaRow.op_status === 'EM_RECEBIMENTO') {
      if (entradaRow.recebedor_nome === nomeRecebedor) {
        return res.status(200).json({ success: true, message: 'Voce ja possui este recebimento em andamento', data: dados('Em Recebimento') });
      }
      return res.status(400).json({ error: `Esta entrada ja esta sendo recebida por ${entradaRow.recebedor_nome}` });
    }
    // Só entrada liberada pode iniciar: recomeçar uma já alocada somaria o estoque de novo.
    if (entradaRow.workflow_status === 'CANCELADA' || entradaRow.ent_status === 'C') {
      return res.status(400).json({ error: 'Esta entrada foi cancelada.' });
    }
    if (
      ['RECEBIDO', 'EM_ALOCACAO', 'ALOCADO'].includes(entradaRow.op_status) ||
      ['RECEBIDO', 'EM_ALOCACAO', 'DISPONIVEL_VENDA'].includes(entradaRow.workflow_status)
    ) {
      return res.status(400).json({ error: 'Esta entrada ja foi recebida anteriormente.' });
    }
    // Regra (22/11/2026): entrada GERADA já pode ser recebida, com ou sem preço confirmado.
    // O preço é confirmado à parte (dbent_recebimento.data_confirmacao_preco) e não
    // depende mais do status do fluxo físico. Ver lib/recebimentoEntrada/status.ts.
    if (!STATUS_PODE_RECEBER.includes(entradaRow.workflow_status)) {
      return res.status(400).json({
        error: `A entrada ${entradaRow.codent} não pode ser recebida (situação: ${entradaRow.workflow_status || 'sem registro de fluxo'}).`,
      });
    }

    // 4. Operador já tem outro recebimento ativo?
    const ativoResult = await client.query(
      `SELECT codent FROM entrada_operacoes WHERE recebedor_matricula = $1 AND status = 'EM_RECEBIMENTO' LIMIT 1`,
      [matriculaRecebedor]);
    if (ativoResult.rows.length > 0) {
      return res.status(400).json({ error: 'Voce ja possui um recebimento em andamento. Finalize-o primeiro.' });
    }

    // 5. Transação: cria/atualiza operação + itens de conferência + workflow
    await client.query('BEGIN');

    const operacaoResult = await client.query(
      `INSERT INTO entrada_operacoes (codent, status, recebedor_matricula, recebedor_nome, inicio_recebimento, created_at, updated_at)
       VALUES ($1, 'EM_RECEBIMENTO', $2, $3, NOW(), NOW(), NOW())
       ON CONFLICT (codent) DO UPDATE SET
         status = 'EM_RECEBIMENTO', recebedor_matricula = $2, recebedor_nome = $3,
         inicio_recebimento = NOW(), updated_at = NOW()
       RETURNING id`,
      [codent, matriculaRecebedor, nomeRecebedor]);
    const operacaoId = operacaoResult.rows[0].id;

    // itens de conferência a partir de dbitent (por codent/produto/codreq)
    await client.query(
      `INSERT INTO entrada_itens_recebimento
         (entrada_operacao_id, codent, codreq, produto_cod, qtd_esperada, status_item, created_at, updated_at)
       SELECT $1, ie.codent, ie.codreq, ie.codprod, ie.quant, 'PENDENTE', NOW(), NOW()
         FROM dbitent ie
        WHERE ie.codent = $2
          AND NOT EXISTS (
            SELECT 1 FROM entrada_itens_recebimento r
             WHERE r.entrada_operacao_id = $1 AND r.produto_cod = ie.codprod
               AND COALESCE(r.codreq,'') = COALESCE(ie.codreq,''))`,
      [operacaoId, codent]);

    // Romaneio: o recebimento passa a ser o lugar de escolher o armazém. Se a entrada
    // ainda não tem romaneio (dbitent_armazem), cria o padrão (armazém 1001, quantidade
    // da nota) — o mesmo que o "Confirmar Estoque" fazia.
    await client.query(
      `INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
       SELECT ie.codent, ie.codprod, ie.codreq, 1001, ie.quant
         FROM dbitent ie
        WHERE ie.codent = $1
          AND NOT EXISTS (SELECT 1 FROM dbitent_armazem a WHERE a.codent = $1)
       ON CONFLICT DO NOTHING`,
      [codent]);

    await client.query(
      `UPDATE dbent_recebimento SET status = 'EM_RECEBIMENTO', updated_at = now() WHERE codent = $1`,
      [codent]);

    await client.query('COMMIT');

    return res.status(200).json({ success: true, message: 'Recebimento iniciado com sucesso', data: { ...dados('Em Recebimento'), id: operacaoId, inicio_recebimento: new Date().toISOString() } });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao iniciar recebimento por chave:', error);
    return res.status(500).json({ error: 'Erro ao iniciar recebimento. Tente novamente.' });
  } finally {
    if (client) client.release();
  }
}
