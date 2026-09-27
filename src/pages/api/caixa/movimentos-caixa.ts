// src/pages/api/caixa/movimentos-caixa.ts
//
// Sangrias/Suprimentos + resumo do caixa + conferência por forma, para o
// comprovante de FECHAMENTO de caixa.
//
// >>> AGREGA O DIA INTEIRO DA CONTA (não por sessão) <<<
// Não existe "turno": fechar e reabrir o caixa no mesmo dia é operacional, então
// o fechamento soma TODAS as sessões da conta naquela data. O troco do dia é o
// fundo da PRIMEIRA sessão (reabrir não injeta troco novo); recebimentos, sangrias
// e suprimentos são somados de todas as sessões.
// Entrada: (data + conta) OU (sessao) — a sessão é usada só para resolver conta+data.
// Fonte: caixa_movimento / caixa_sessao / caixa_fechamento_forma.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const num = (v: any) => (v == null ? 0 : Number(v)) || 0;
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  let data = String(req.query.data || '');
  let conta = String(req.query.conta || '').trim();
  const sessaoId = String(req.query.sessao || '').trim();

  const pool = getPgPool();
  try {
    // Se veio a sessão, resolve a conta + a data (dia) a partir dela.
    if (sessaoId) {
      const rs = await pool.query(`
        SELECT cod_conta,
               to_char(aberto_em AT TIME ZONE 'America/Manaus', 'YYYY-MM-DD') AS dia
        FROM caixa_sessao WHERE id = $1`, [sessaoId]);
      if (rs.rows[0]) {
        conta = String(rs.rows[0].cod_conta || conta);
        data = String(rs.rows[0].dia || data);
      }
    }

    if (!conta || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ ok: false, erro: 'Informe a sessão, ou a conta + a data (YYYY-MM-DD).' });
    }

    // ---- Todas as sessões da conta no dia (ordem cronológica) ----
    const ss = await pool.query(`
      SELECT id, fundo_troco AS fundo, saldo_esperado_dinheiro AS esperado,
             saldo_informado_dinheiro AS informado, quebra, status, cod_conta,
             operador_abertura, operador_fechamento,
             to_char(aberto_em  AT TIME ZONE 'America/Manaus', 'DD/MM/YYYY HH24:MI') AS abertura,
             to_char(fechado_em AT TIME ZONE 'America/Manaus', 'DD/MM/YYYY HH24:MI') AS fechamento,
             to_char(aberto_em  AT TIME ZONE 'America/Manaus', 'HH24:MI') AS abertura_h,
             to_char(fechado_em AT TIME ZONE 'America/Manaus', 'HH24:MI') AS fechamento_h
      FROM caixa_sessao
      WHERE (aberto_em AT TIME ZONE 'America/Manaus')::date = $1::date AND cod_conta = $2
      ORDER BY aberto_em`, [data, conta]);
    const sessoes = ss.rows;

    if (!sessoes.length) {
      return res.status(200).json({
        ok: true, data, conta, sessao: sessaoId || null,
        sangrias: [], suprimentos: [], totalSangria: 0, totalSuprimento: 0,
        recebidoDinheiro: 0, recebimentosPorForma: [],
        sessao_info: null, conferencia: [], sessoesDoDia: [],
      });
    }

    const ids = sessoes.map((s) => s.id);

    // ---- Sangrias / Suprimentos (todas as sessões do dia) ----
    const { rows } = await pool.query(`
      SELECT m.tipo, m.forma_pagamento, m.valor, m.motivo, m.operador,
             to_char(m.criado_em AT TIME ZONE 'America/Manaus', 'HH24:MI') AS hora
      FROM caixa_movimento m
      WHERE m.sessao_id = ANY($1) AND m.tipo IN ('SANGRIA','SUPRIMENTO')
      ORDER BY m.criado_em`, [ids]);
    const linhas = rows.map((r) => ({
      tipo: r.tipo, forma_pagamento: r.forma_pagamento, valor: num(r.valor),
      motivo: r.motivo, operador: r.operador, hora: r.hora,
    }));
    const sangrias = linhas.filter((l) => l.tipo === 'SANGRIA');
    const suprimentos = linhas.filter((l) => l.tipo === 'SUPRIMENTO');
    const totalSangria = r2(sangrias.reduce((a, x) => a + x.valor, 0));
    const totalSuprimento = r2(suprimentos.reduce((a, x) => a + x.valor, 0));

    // ---- Recebimentos por forma (somando todas as sessões do dia) ----
    const rf = await pool.query(`
      SELECT forma_pagamento AS forma, COALESCE(SUM(valor),0) AS valor
      FROM caixa_movimento
      WHERE sessao_id = ANY($1) AND tipo = 'RECEBIMENTO'
      GROUP BY forma_pagamento ORDER BY forma_pagamento`, [ids]);
    const recebimentosPorForma = rf.rows.map((r) => ({ forma: r.forma, valor: num(r.valor) }));
    const recebidoDinheiro = r2(recebimentosPorForma.filter((x) => x.forma === 'DINHEIRO').reduce((a, x) => a + x.valor, 0));

    // ---- Conferência por forma (não-dinheiro) — somada das sessões fechadas ----
    const cf = await pool.query(`
      SELECT forma_pagamento AS forma,
             COALESCE(SUM(valor_esperado),0)  AS esperado,
             COALESCE(SUM(valor_informado),0) AS informado,
             COALESCE(SUM(diferenca),0)       AS diferenca
      FROM caixa_fechamento_forma WHERE sessao_id = ANY($1)
      GROUP BY forma_pagamento ORDER BY forma_pagamento`, [ids]);
    const conferencia = cf.rows.map((r) => ({
      forma: r.forma, esperado: num(r.esperado), informado: num(r.informado), diferenca: num(r.diferenca),
    }));

    // ---- Resumo do dia (dinheiro na gaveta) ----
    // Troco do dia = fundo da PRIMEIRA sessão (reabrir não injeta troco novo).
    const fundoInicial = num(sessoes[0].fundo);
    // Esperado (gaveta) = troco + dinheiro recebido + suprimentos − sangrias  (dia inteiro).
    const saldoEsperado = r2(fundoInicial + recebidoDinheiro + totalSuprimento - totalSangria);

    const todasFechadas = sessoes.every((s) => s.status === 'FECHADO');
    // Informado só é finalizável quando não há caixa aberto no dia. Ao fechar todas,
    // desconta os fundos re-lançados nas reaberturas (a 2ª sessão em diante) para não
    // contar o troco duas vezes.
    let saldoInformado: number | null = null;
    let quebra: number | null = null;
    if (todasFechadas) {
      const somaInformado = sessoes.reduce((a, s) => a + num(s.informado), 0);
      const fundosReabertura = sessoes.slice(1).reduce((a, s) => a + num(s.fundo), 0);
      saldoInformado = r2(somaInformado - fundosReabertura);
      quebra = r2(saldoEsperado - saldoInformado);
    }

    const ultima = sessoes[sessoes.length - 1];
    const operador = ultima.operador_fechamento || ultima.operador_abertura || sessoes[0].operador_abertura || null;

    const sessao_info = {
      data,
      fundoInicial, saldoEsperado, saldoInformado, quebra,
      status: todasFechadas ? 'FECHADO' : 'ABERTO',
      caixaAberto: !todasFechadas,
      abertura: sessoes[0].abertura || null,
      fechamento: todasFechadas ? (ultima.fechamento || null) : null,
      codConta: conta,
      operadorAbertura: sessoes[0].operador_abertura || null,
      operadorFechamento: operador,
      operador,
      qtdSessoes: sessoes.length,
    };

    // Detalhe das sessões do dia (transparência quando houve reabertura).
    const sessoesDoDia = sessoes.map((s) => ({
      id: s.id, status: s.status,
      abertura: s.abertura_h || null, fechamento: s.fechamento_h || null,
      fundo: num(s.fundo), esperado: num(s.esperado), informado: num(s.informado), quebra: num(s.quebra),
    }));

    return res.status(200).json({
      ok: true, data, conta, sessao: sessaoId || null,
      sangrias, suprimentos, totalSangria, totalSuprimento,
      recebidoDinheiro, recebimentosPorForma,
      sessao_info, conferencia, sessoesDoDia,
    });
  } catch (e: any) {
    console.error('[caixa/movimentos-caixa] erro:', e?.message);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao buscar movimentos do caixa.' });
  }
}
