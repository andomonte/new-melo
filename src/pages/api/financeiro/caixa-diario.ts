// src/pages/api/financeiro/caixa-diario.ts
//
// Movimento Diário do Caixa — porte do pacote Oracle GERAL.CAIXADIARIO2.
// Entradas = recebimentos (dbreceb + dbfreceb) por dt_pgto; Saídas = pagamentos
// (dbpgto + dbfpgto) por dt_pgto. Split por dbconta.oficial: '01' = oficial 'S',
// '02' = oficial 'N', "Geral" = ambos. Filtros: data, tipo (deposito), conta.
//
// Simplificação vs Oracle: o Delphi materializa as entradas numa temp por usuário
// (TMP_CAIXA_CONTA) e junta 5 fontes de fatura via UNION só para incluir todos os
// recebimentos — aqui calculamos direto por data (equivalente, sem temp/usuário).

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const num = (v: any) => (v == null ? 0 : Number(v)) || 0;

// tipo (vDeposito): N=Todos, S=Depósito, C=Crédito Cliente, P=PIX → filtra dbfreceb.tipo
const DEPOSITO_TIPOS: Record<string, string[]> = {
  C: ['05'],
  P: ['42', '43', '44'],
  S: ['09', '15', '21', '16', '34', '35', '36', '37', '38'],
};

interface Linha {
  banco: string; conta: string; codconta: string;
  valor: number; historico: string; forma_pgto: string; cx_geral: string; oficial: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  }

  const data = String(req.query.data || ''); // 'YYYY-MM-DD'
  const tipo = String(req.query.tipo || 'N').toUpperCase(); // N|S|C|P
  const conta = String(req.query.conta || '').trim(); // código de conta (opcional)
  const codusr = String(req.query.codusr || '').trim(); // operador por código (opcional) — só entradas (dbfreceb.codusr)
  const operador = String(req.query.operador || '').trim(); // operador por username (resolve → codusr via dbusuario)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ ok: false, erro: 'Informe a data (YYYY-MM-DD).' });
  }

  const pool = getPgPool();
  try {
    // Resolve o operador (username) → codusr (mesmo mapeamento do receber.ts).
    // Se veio username mas não resolveu, usa sentinela p/ não retornar de outros operadores.
    let codusrFinal = codusr;
    if (!codusrFinal && operador) {
      const u = await pool.query(`SELECT codusr FROM dbusuario WHERE nomeusr = $1 LIMIT 1`, [operador]);
      // Se o operador não estiver no dbusuario, NÃO filtra por codusr (evita zerar);
      // o escopo fica pela conta do caixa. dbfreceb.codusr também pode vir null.
      codusrFinal = (u.rows[0]?.codusr || '').trim();
    }

    // ---------- ENTRADAS (recebimentos) ----------
    const vals: any[] = [data];
    let filtroTipo = '';
    if (DEPOSITO_TIPOS[tipo]) {
      const ph = DEPOSITO_TIPOS[tipo].map((_, i) => `$${vals.length + i + 1}`).join(',');
      filtroTipo = ` AND p.tipo IN (${ph})`;
      vals.push(...DEPOSITO_TIPOS[tipo]);
    }
    let filtroContaE = '';
    if (conta) { vals.push(conta + '%'); filtroContaE = ` AND ct.cod_conta LIKE $${vals.length}`; }
    let filtroUsrE = '';
    if (codusrFinal) { vals.push(codusrFinal); filtroUsrE = ` AND p.codusr = $${vals.length}`; }

    const sqlEntradas = `
      SELECT
        ct.cod_banco || ' - ' || COALESCE(b.nome,'') AS banco,
        ct.cod_conta || ' - ' || ct.nro_conta AS conta,
        ct.cod_conta AS codconta,
        p.valor AS valor,
        COALESCE(r.nro_doc,'') || ' - ' || COALESCE(c.nome,'') AS historico,
        SUBSTR(COALESCE(fp.descricao,''),1,20) AS forma_pgto,
        CASE WHEN UPPER(COALESCE(fp.descricao,'')) LIKE 'DINHEIRO%' THEN 'S' ELSE 'N' END AS cx_geral,
        ct.oficial AS oficial
      FROM dbreceb r
      JOIN dbfreceb p       ON p.cod_receb = r.cod_receb
      JOIN dbclien c        ON c.codcli = r.codcli
      JOIN dbconta ct       ON ct.cod_conta = p.cod_conta
      LEFT JOIN dbbanco b   ON b.cod_banco = ct.cod_banco
      JOIN dbforma_pagto fp ON fp.codfpgt = p.tipo
      WHERE p.dt_pgto::date = $1::date AND r.cancel = 'N' AND p.sf <> 'C'
        AND ct.cod_conta NOT IN ('0129','0130')
        ${filtroTipo} ${filtroContaE} ${filtroUsrE}
      ORDER BY conta, forma_pgto, valor`;
    const rE = await pool.query(sqlEntradas, vals);

    // ---------- SAÍDAS (pagamentos) ----------
    const valsS: any[] = [data];
    let filtroContaS = '';
    if (conta) { valsS.push(conta + '%'); filtroContaS = ` AND ct.cod_conta LIKE $${valsS.length}`; }

    const sqlSaidas = `
      SELECT
        ct.cod_banco || ' - ' || COALESCE(b.nome,'') AS banco,
        ct.cod_conta || ' - ' || ct.nro_conta AS conta,
        ct.cod_conta AS codconta,
        fp.valor_pgto AS valor,
        (CASE WHEN p.nro_dup IS NULL THEN 'NF ' || COALESCE(p.nro_nf,'') ELSE p.nro_dup END)
          || ' - ' || COALESCE(cr.nome, tr.nome, '') AS historico,
        CASE fp.tp_pgto
          WHEN 'C' THEN 'CHEQUE' WHEN 'D' THEN 'DINHEIRO' WHEN 'B' THEN 'BALCAO'
          WHEN 'A' THEN 'DEB.BANCO' WHEN 'F' THEN 'FINANCIAMENTO' WHEN 'S' THEN 'SISPAG'
          WHEN 'R' THEN 'CARTAO CREDITO' WHEN 'V' THEN 'VALE' WHEN 'N' THEN 'COMPENSACAO'
          ELSE 'OUTROS' END AS forma_pgto,
        CASE WHEN fp.tp_pgto = 'D' THEN 'S' ELSE 'N' END AS cx_geral,
        ct.oficial AS oficial
      FROM dbpgto p
      JOIN dbfpgto fp       ON fp.cod_pgto = p.cod_pgto AND fp.cancel = 'N'
      JOIN dbconta ct       ON ct.cod_conta = fp.cod_conta
      LEFT JOIN dbbanco b   ON b.cod_banco = ct.cod_banco
      LEFT JOIN dbcredor cr ON cr.cod_credor = p.cod_credor AND p.cod_transp IS NULL
      LEFT JOIN dbtransp tr ON tr.codtransp = p.cod_transp AND p.cod_credor IS NULL
      WHERE p.dt_pgto::date = $1::date AND p.cancel = 'N'
        AND ct.cod_conta NOT IN ('0129','0130')
        ${filtroContaS}
      ORDER BY conta, forma_pgto, valor`;
    const rS = await pool.query(sqlSaidas, valsS);

    const mapear = (rows: any[]): Linha[] => rows.map((x) => ({
      banco: x.banco, conta: x.conta, codconta: x.codconta,
      valor: num(x.valor), historico: x.historico,
      forma_pgto: (x.forma_pgto || '').trim(), cx_geral: x.cx_geral, oficial: x.oficial,
    }));
    const entradas = mapear(rE.rows);
    const saidas = mapear(rS.rows);

    const entradas01 = entradas.filter((l) => l.oficial === 'S');
    const entradas02 = entradas.filter((l) => l.oficial === 'N');
    const saidas01 = saidas.filter((l) => l.oficial === 'S');
    const saidas02 = saidas.filter((l) => l.oficial === 'N');

    const soma = (l: Linha[]) => l.reduce((a, x) => a + x.valor, 0);
    const totalEntrada = soma(entradas);
    const totalSaida = soma(saidas);

    return res.status(200).json({
      ok: true,
      data, tipo, conta: conta || null,
      entradas01, entradas02, saidas01, saidas02,
      geralEntradas: entradas, geralSaidas: saidas,
      totalEntrada, totalSaida, saldo: totalEntrada - totalSaida,
      geradoEm: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[financeiro/caixa-diario] erro:', e?.message, e?.stack);
    return res.status(500).json({ ok: false, erro: e?.message || 'Erro ao gerar o movimento diário do caixa.' });
  }
}
