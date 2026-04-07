// pages/api/vendas/salvar-draft.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';

/* ---------------- Logger ---------------- */
function mkLogger(tag: string) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) => console.log(`[${tag}] [${traceId}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[${tag}] [${traceId}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
      if (e?.code) console.error('code:', e.code);
      if (e?.detail) console.error('detail:', e.detail);
      if (e?.hint) console.error('hint:', e.hint);
    }
  };
  return { traceId, log, err };
}

/* ---------------- Tipos do payload ---------------- */
type ItemPayloadIn = {
  codprod?: string;
  codigo?: string;
  qtd?: number | string;
  quantidade?: number | string;
  prunit?: number | string;
  precoItemEditado?: number | string;
  preço?: number | string;
  preco?: number | string;
  desconto?: number | string;
  arm_id?: number | string;
  ref?: string;
  descr?: string;
  [k: string]: any;
};

type PrazoIn = {
  data?: string | Date;
  dia?: number;
  dataVencimento?: string | Date;
  dias?: number;
  vencimento?: string | Date;
  parcela?: number;
  valor?: number;
};

type VendaHeader = {
  operacao?: number;
  codcli: string;
  codusr: string | number; // salvo como string
  pedido?: string;
  tipo: string;
  tele?: 'S' | 'N';
  transp?: string;
  codtptransp?: string | number | null;
  vlrfrete?: number;
  prazo?: string;
  tipo_desc?: string;
  obs?: string;
  obsfat?: string;
  bloqueada?: 'S' | 'N' | '0' | '1';
  estoque_virtual?: 'S' | 'N';
  uName?: string;
  localentregacliente?: string | null;
  vendedor?: string | null;
  operador?: string | null;
  operadorNome?: string | null;
  checkOperador?: boolean;
  nomecf?: string | null;
  label?: string | null;
  draft_id?: string;
  requisicao?: string;

  // chega do front e será priorizado se válido
  totalVenda?: number | string | null;
};

type DraftSaveBody = {
  draft_id?: string;
  header: VendaHeader;
  itens: ItemPayloadIn[];
  prazos?: PrazoIn[];
};

type DraftUpdateBody = {
  draft_id: string;
  // atualização parcial; qualquer um pode vir
  header?: Partial<VendaHeader>;
  itens?: ItemPayloadIn[];
  prazos?: PrazoIn[];
  label?: string | null;
  tipo?: string | null;
  codcli?: string | null;
  codusr?: string | number | null;
  status?: string | null; // ex.: 'A', 'I', etc.
};

/* ---------------- Helpers ---------------- */
const nul = <T>(v: T | undefined | null | '') =>
  v === undefined || v === null || v === '' ? null : (v as T);

// remove tudo que não for dígito, ponto, vírgula, sinal
const sanitizeNumeric = (s: string) => s.replace(/[^\d.,-]/g, '');

const toNumber = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;

  const s = sanitizeNumeric(raw);

  // possui ponto e vírgula -> ponto milhar / vírgula decimal
  if (s.includes('.') && s.includes(',')) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  // só vírgula -> vírgula decimal
  if (s.includes(',')) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  // só ponto -> ponto decimal
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Normaliza item e calcula total líquido do item (aplicando desconto %).
 */
function normalizeAndComputeItem(it: ItemPayloadIn) {
  const codprod = String(it.codprod ?? it.codigo ?? '');

  // tenta usar o total já calculado pelo front, se existir
  const frontTotal =
    toNumber((it as any).totalItem) || toNumber((it as any).vltotalItem);

  if (frontTotal > 0) {
    return {
      ...it,
      codprod,
      quantidadeNum: toNumber(it.qtd ?? it.quantidade),
      precoUnitario: toNumber(
        it.prunit ?? it.precoItemEditado ?? it.preço ?? it.preco,
      ),
      vltotalItem: round2(frontTotal),
    };
  }

  // caso não tenha vindo total do front, recalcula
  const quantidadeNum = toNumber(it.qtd ?? it.quantidade);
  const precoUnitario = toNumber(
    it.prunit ?? it.precoItemEditado ?? it.preço ?? it.preco,
  );
  const descontoPct = toNumber(it.desconto ?? 0);

  const bruto = quantidadeNum * precoUnitario;
  const liquido = round2(bruto * (1 - descontoPct / 100));

  return {
    ...it,
    codprod,
    quantidadeNum,
    precoUnitario,
    vltotalItem: liquido,
  };
}

/**
 * Recalcula total a partir dos itens normalizados.
 */
function computeTotalVenda(itens: any[]): number {
  return round2(
    itens.reduce((acc, it: any) => acc + toNumber(it.vltotalItem ?? 0), 0),
  );
}

/* -------- Helpers para draft_id sequencial com lock e retry -------- */

// hash simples estável (para chave de lock por filial)
function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// Gera próximo draft_id numérico (string) de forma transacional e segura
async function generateNextDraftId(
  client: PoolClient,
  filial: string | null,
): Promise<string> {
  // Use um lock por filial para sequência por filial; se quiser global, use chave fixa
  const lockKey = filial ? Math.abs(hashCode(filial)) : 987654321;
  await client.query('SELECT pg_advisory_xact_lock($1);', [lockKey]);

  // Maior draft_id estritamente numérico (se quiser por filial, adicione "AND filial = $2" e passe o parâmetro)
  const r = await client.query(`
    SELECT COALESCE(MAX(draft_id::numeric), 0)::numeric AS last
    FROM dbvenda_draft
    WHERE draft_id ~ '^[0-9]+$'
  `);

  const last = (r.rows?.[0]?.last ?? 0) as number;
  const next = (Number(last) || 0) + 1;
  // ✅ LPAD com 9 dígitos (padrão igual ao finalizarVenda)
  return String(next).padStart(9, '0');
}

/* ---------------- Handler ---------------- */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { traceId, err: logErr } = mkLogger('drafts');

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res
      .status(400)
      .json({ ok: false, error: 'Filial não informada no cookie', traceId });
  }

  let client: PoolClient | null = null;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    /* ---------------- POST (upsert / insert com draft_id sequencial) ---------------- */
    if (req.method === 'POST') {
      const body = req.body as DraftSaveBody;

      if (
        !body?.header ||
        !Array.isArray(body?.itens) ||
        body.itens.length === 0
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Campos obrigatórios: header, itens[] (min 1).',
          traceId,
        });
      }

      const h = body.header;
      if (!h.codusr || !h.codcli || !h.tipo) {
        return res.status(400).json({
          ok: false,
          error:
            'Campos obrigatórios: header.codusr, header.codcli, header.tipo.',
          traceId,
        });
      }

      // 1) normaliza itens e injeta vltotalItem
      const itensNorm = (body.itens || []).map(normalizeAndComputeItem);

      // 2) total: PRIORIDADE ao header.totalVenda (se vier válido) senão recalcula
      const totalFromHeader = toNumber((h as any).totalVenda);
      const total =
        totalFromHeader > 0
          ? round2(totalFromHeader)
          : computeTotalVenda(itensNorm);

      // 3) demais campos de agregação
      const itensCount = itensNorm.length;
      const armId = (() => {
        const a = itensNorm?.[0]?.arm_id;
        const n = toNumber(a);
        return Number.isFinite(n) && n > 0 ? n : null;
      })();
      const clienteNome = nul(h.nomecf);
      const label = nul(h.label);

      // 4) local de entrega normalizado
      const localEntrega = (() => {
        if (h && typeof h.localentregacliente === 'string') {
          const s = h.localentregacliente.trim();
          return s.length ? s : null;
        }
        const rawObj =
          (h as any)?.localSel || (req.body as any)?.localSel || null;
        if (rawObj && typeof rawObj === 'object') {
          const codigo = String(rawObj.codigo ?? '').trim();
          const nome = String(rawObj.nome ?? '').trim();
          if (codigo || nome) {
            return codigo && nome ? `${codigo} - ${nome}` : codigo || nome;
          }
        }
        return null;
      })();

      // header normalizado (codusr string, totalVenda coerente, entrega normalizada)
      const headerNormalized: VendaHeader = {
        ...h,
        codusr: String(h.codusr),
        localentregacliente: localEntrega,
        totalVenda: total, // mantém o total coerente no JSON
      };

      // payload final (mantém prazos caso venham em body)
      const payloadToStore: DraftSaveBody = {
        ...body,
        header: headerNormalized,
        itens: itensNorm,
      };

      // --- draft_id pode vir do front (body.draft_id ou header.draft_id) ---
      const incomingDraftId = body.draft_id || h.draft_id || null;

      // Abrimos a transação aqui; se for upsert com ID fornecido, mantemos seu fluxo
      await client.query('BEGIN');

      if (incomingDraftId) {
        // ---------------- UPSERT com draft_id fornecido (comportamento original) ----------------
        const upsertSql = `
          INSERT INTO dbvenda_draft
            (draft_id, filial, codusr, codcli, tipo, arm_id, cliente_nome, label,
             itens_count, total, payload, status, created_at, updated_at)
          VALUES
            ($1,       $2,     $3,     $4,     $5,   $6,     $7,           $8,
             $9,        $10,   $11,    'A',    NOW(),  NOW())
          ON CONFLICT (draft_id)
          DO UPDATE SET
             payload      = EXCLUDED.payload,
             total        = EXCLUDED.total,
             itens_count  = EXCLUDED.itens_count,
             arm_id       = EXCLUDED.arm_id,
             cliente_nome = EXCLUDED.cliente_nome,
             label        = EXCLUDED.label,
             codusr       = EXCLUDED.codusr,
             codcli       = EXCLUDED.codcli,
             tipo         = EXCLUDED.tipo,
             status       = 'A',
             updated_at   = NOW()
          RETURNING draft_id, (xmax = 0) AS inserted
        `;

        const up = await client.query(upsertSql, [
          incomingDraftId,
          filial,
          String(h.codusr),
          h.codcli,
          h.tipo,
          armId,
          clienteNome,
          label,
          itensCount,
          total,
          payloadToStore,
        ]);

        await client.query('COMMIT');

        const returnedId = up.rows[0].draft_id as string;
        const wasInsert = up.rows[0].inserted as boolean;

        return res.status(wasInsert ? 201 : 200).json({
          ok: true,
          draft_id: returnedId,
          total,
          itensCount,
          operation: wasInsert ? 'insert' : 'update',
          traceId,
        });
      }

      // ---------------- Sem draft_id: gerar sequencial seguro + INSERT com retry ----------------
      const maxAttempts = 5;
      let attempt = 0;

      // a transação já está aberta aqui
      while (true) {
        try {
          // advisory lock + leitura do último +1 (na mesma transação)
          const newId = await generateNextDraftId(client, filial);

          const qIns = `
            INSERT INTO dbvenda_draft
              (draft_id, filial, codusr, codcli, tipo, arm_id, cliente_nome, label,
               itens_count, total, payload, status, created_at, updated_at)
            VALUES
              ($1,       $2,     $3,     $4,     $5,   $6,     $7,           $8,
               $9,        $10,   $11,    'A',    NOW(),  NOW())
            RETURNING draft_id
          `;
          const rIns = await client.query(qIns, [
            newId,
            filial,
            String(h.codusr),
            h.codcli,
            h.tipo,
            armId,
            clienteNome,
            label,
            itensCount,
            total,
            payloadToStore,
          ]);

          await client.query('COMMIT');
          return res.status(201).json({
            ok: true,
            draft_id: rIns.rows[0].draft_id,
            total,
            itensCount,
            operation: 'insert',
            traceId,
          });
        } catch (e: any) {
          const isUniqueViolation = e?.code === '23505';
          attempt++;
          await client.query('ROLLBACK');

          if (!isUniqueViolation || attempt >= maxAttempts) {
            return res.status(500).json({
              ok: false,
              error:
                e?.detail ||
                e?.message ||
                'Falha ao gerar draft_id sequencial (tente novamente).',
              traceId,
            });
          }

          // tenta novamente: reabre transação e roda o fluxo
          await client.query('BEGIN');
          continue;
        }
      }
    }

    /* ---------------- PUT (update parcial por draft_id) ---------------- */
    if (req.method === 'PUT') {
      const body = req.body as DraftUpdateBody;
      if (!body?.draft_id) {
        return res.status(400).json({
          ok: false,
          error: 'Campo obrigatório: draft_id',
          traceId,
        });
      }

      // Carrega o draft atual (para merge quando necessário)
      const cur = await client.query(
        `SELECT draft_id, payload, total, itens_count, codusr, codcli, tipo, label, status
           FROM dbvenda_draft
          WHERE draft_id = $1 AND filial = $2`,
        [body.draft_id, filial],
      );
      if (cur.rowCount !== 1) {
        return res
          .status(404)
          .json({ ok: false, error: 'Rascunho não encontrado', traceId });
      }

      // Base atual
      const curRow = cur.rows[0];
      const currentPayload = curRow.payload ?? {};
      const currentHeader = (currentPayload.header ??
        {}) as Partial<VendaHeader>;
      const incomingHeader = (body.header ?? {}) as Partial<VendaHeader>;

      // Merge de header (se vier no PUT)
      const mergedHeader: VendaHeader = {
        ...(currentHeader as any),
        ...(incomingHeader as any),
      } as VendaHeader;

      // Se vier codusr/codcli/tipo/label no root do PUT, também atualiza
      if (body.codusr != null) mergedHeader.codusr = String(body.codusr);
      if (body.codcli != null) mergedHeader.codcli = String(body.codcli);
      if (body.tipo != null) mergedHeader.tipo = String(body.tipo);
      if (body.label !== undefined) mergedHeader.label = nul(body.label);

      // Normalização de itens caso venham; se não vierem, mantém os atuais
      let itensNorm: any[] | undefined;
      if (Array.isArray(body.itens)) {
        itensNorm = body.itens.map(normalizeAndComputeItem);
      }

      // Decide total/itens_count:
      // 1) se vierem itens, recalcula
      // 2) se não vierem itens mas vier header.totalVenda, usa ele
      // 3) senão mantém o existente
      let total = Number(curRow.total) || 0;
      let itensCount = Number(curRow.itens_count) || 0;

      if (itensNorm && itensNorm.length > 0) {
        total = computeTotalVenda(itensNorm);
        itensCount = itensNorm.length;
      } else {
        const totalFromHeader = toNumber(mergedHeader.totalVenda);
        if (totalFromHeader > 0) {
          total = round2(totalFromHeader);
        }
      }

      // payload novo
      const newPayload = {
        ...(currentPayload || {}),
        ...(body.prazos ? { prazos: body.prazos } : {}),
        header: mergedHeader,
        itens: itensNorm ?? currentPayload.itens ?? [],
      };

      // Campos raiz da tabela (patch simples)
      const newCodusr =
        body.codusr != null ? String(body.codusr) : curRow.codusr;
      const newCodcli =
        body.codcli != null ? String(body.codcli) : curRow.codcli;
      const newTipo =
        body.tipo != null
          ? String(body.tipo)
          : mergedHeader?.tipo ?? curRow.tipo;
      const newLabel =
        body.label !== undefined ? nul(body.label) : curRow.label;
      const newStatus =
        body.status != null ? String(body.status).toUpperCase() : curRow.status;

      await client.query('BEGIN');
      const q = `
        UPDATE dbvenda_draft
           SET payload      = $1,
               total        = $2,
               itens_count  = $3,
               codusr       = $4,
               codcli       = $5,
               tipo         = $6,
               label        = $7,
               status       = $8,
               updated_at   = NOW()
         WHERE draft_id     = $9
           AND filial       = $10
        RETURNING draft_id
      `;
      const r = await client.query(q, [
        newPayload,
        total,
        itensCount,
        String(newCodusr),
        String(newCodcli),
        newTipo,
        newLabel,
        newStatus,
        body.draft_id,
        filial,
      ]);
      await client.query('COMMIT');

      if (r.rowCount !== 1) {
        return res.status(404).json({
          ok: false,
          error: 'Rascunho não encontrado para atualizar',
          traceId,
        });
      }

      return res.status(200).json({
        ok: true,
        draft_id: r.rows[0].draft_id,
        total,
        itensCount,
        operation: 'update',
        traceId,
      });
    }

    /* ---------------- GET ---------------- */
    if (req.method === 'GET') {
      const {
        id,
        codusr,
        codcli,
        status = 'A',
        page = '1',
        pageSize = '20',
      } = req.query as any;

      if (id) {
        const r = await client.query(
          `SELECT draft_id, filial, codusr, codcli, tipo, arm_id, cliente_nome, label,
                  itens_count, total, payload, status, created_at, updated_at, expires_at
             FROM dbvenda_draft
            WHERE draft_id = $1 AND filial = $2`,
          [id, filial],
        );
        if (r.rowCount !== 1) {
          return res
            .status(404)
            .json({ ok: false, error: 'Rascunho não encontrado', traceId });
        }
        return res.status(200).json({ ok: true, draft: r.rows[0], traceId });
      }

      const p = Math.max(1, parseInt(String(page), 10) || 1);
      const ps = Math.min(
        100,
        Math.max(1, parseInt(String(pageSize), 10) || 20),
      );

      const off = (p - 1) * ps;

      const params: any[] = [filial];
      const where: string[] = ['filial = $1'];

      if (codusr) {
        params.push(String(codusr));
        where.push(`codusr = $${params.length}`);
      }
      if (codcli) {
        params.push(String(codcli));
        where.push(`codcli = $${params.length}`);
      }
      if (status) {
        params.push(String(status).toUpperCase());
        where.push(`status = $${params.length}`);
      }

      params.push(ps, off);

      const sql = `
        SELECT draft_id, filial, codusr, codcli, tipo, arm_id, cliente_nome, label,
               itens_count, total, status, created_at, updated_at
          FROM dbvenda_draft
         WHERE ${where.join(' AND ')}
         ORDER BY updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const r = await client.query(sql, params);
      return res
        .status(200)
        .json({ ok: true, drafts: r.rows, page: p, pageSize: ps, traceId });
    }

    /* ---------------- DELETE (hard delete) ---------------- */
    if (req.method === 'DELETE') {
      const { id } = req.query as any;
      if (!id) {
        return res
          .status(400)
          .json({ ok: false, error: 'Parâmetro id é obrigatório', traceId });
      }

      const r = await client.query(
        `DELETE FROM dbvenda_draft WHERE draft_id = $1 AND filial = $2`,
        [id, filial],
      );

      if (r.rowCount !== 1) {
        return res
          .status(404)
          .json({ ok: false, error: 'Rascunho não encontrado', traceId });
      }

      return res.status(204).end();
    }

    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed', traceId });
  } catch (e: any) {
    logErr('falha geral', e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'Erro no drafts', traceId });
  } finally {
    try {
      client?.release();
    } catch {}
  }
}
