import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Relatórios da tela Pagamento de Títulos (Contas a Pagar) — fiel ao Delphi UniContasP
 * (procedure Gerar_Dados_Relatorio, SP CONTASP.NAVEGA_CONTASP e GERAL.PAGAS_SEMNF).
 *
 * 7 tipos (radios do Delphi):
 *   periodo            → por período (Data Vencimento ou Data Pagamento), agrupa por data
 *   conta_financeira   → agrupa por conta financeira (pag_cof_id)
 *   pagas_sem_nf       → paga='S' e tem_nota='N' no período de pagamento, agrupa por conta financeira
 *   comprador          → agrupa por comprador
 *   filtro_tela        → GERAL: todos os filtros do botão Filtros do Delphi (fornecedor, transportadora,
 *                        conta financeira, centro/grupo, comprador, NF, duplicata, observação, valor
 *                        do pagamento, valor pago, conhecimentos abertos, status e período por
 *                        vencimento/pagamento/emissão), combináveis; agrupa pela data escolhida
 *   centro_custo       → agrupa por centro de custo (cad_centro_custo)
 *   grupo_centro       → agrupa por grupo de centros de custo (cad_grupo_centro_custo)
 *
 * Regras comuns (Delphi): cancel='N'; VALOR_ABERTO = valor_pgto - valor_pago + valor_juros;
 * subtotais por grupo + total geral (Σpgto, Σpago, Σaberto, Σjuros).
 * Base = UNION credor/transportadora + joins conta financeira→centro→grupo, conta bancária,
 * comprador — aqui em LEFT JOIN para não esconder títulos com cadastro incompleto.
 */

const TITULOS: Record<string, string> = {
  periodo: 'RELATÓRIO DE TÍTULOS A PAGAR: POR PERÍODO',
  conta_financeira: 'RELATÓRIO DE TÍTULOS A PAGAR: POR CONTA FINANCEIRA',
  pagas_sem_nf: 'RELATÓRIO DE TÍTULOS A PAGAR: PAGAS SEM NF',
  comprador: 'RELATÓRIO DE TÍTULOS A PAGAR: POR COMPRADOR',
  filtro_tela: 'RELATÓRIO DE TÍTULOS A PAGAR: GERAL',
  centro_custo: 'RELATÓRIO DE TÍTULOS A PAGAR: POR CENTRO DE CUSTO',
  grupo_centro: 'RELATÓRIO DE TÍTULOS A PAGAR: POR GRUPO DE CENTROS DE CUSTO',
};

const BASE_SELECT = `
  SELECT
    p.cod_pgto,
    p.nro_dup,
    p.nro_nf,
    COALESCE(cr.nome, tr.nome) AS nome,
    p.tipo,
    p.dt_venc,
    p.dt_emissao,
    p.dt_pgto,
    COALESCE(p.valor_pgto, 0)  AS valor_pgto,
    COALESCE(p.valor_pago, 0)  AS valor_pago,
    COALESCE(p.valor_juros, 0) AS valor_juros,
    (COALESCE(p.valor_pgto,0) - COALESCE(p.valor_pago,0) + COALESCE(p.valor_juros,0)) AS valor_aberto,
    p.tem_nota,
    p.tem_cobr,
    p.obs,
    p.paga,
    p.cod_conta,
    ct.nro_conta,
    p.pag_cof_id,
    cf.cof_descricao AS descr_cf,
    cc.cec_id,
    cc.cec_descricao AS descr_cec,
    gcc.gcc_id,
    gcc.gcc_descricao AS descr_gcc,
    p.codcomprador,
    cp.nome AS nome_comprador
  FROM dbpgto p
  LEFT JOIN dbcredor cr             ON p.cod_credor   = cr.cod_credor
  LEFT JOIN dbtransp tr             ON p.cod_transp   = tr.codtransp
  LEFT JOIN cad_conta_financeira cf ON p.pag_cof_id   = cf.cof_id
  LEFT JOIN cad_centro_custo cc     ON cf.cof_cec_id  = cc.cec_id
  LEFT JOIN cad_grupo_centro_custo gcc ON cc.cec_gcc_id = gcc.gcc_id
  LEFT JOIN dbcompradores cp        ON p.codcomprador = cp.codcomprador
  LEFT JOIN dbconta ct              ON p.cod_conta    = ct.cod_conta
`;

type Row = Record<string, any>;

const n = (v: any) => Number(v || 0);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido. Use GET.' });

  const pool = getPgPool();
  const {
    tipo = 'periodo',
    data_inicio,
    data_fim,
    tipo_data = 'venc', // venc | pgto (só afeta "periodo")
    param, // filtro do grupo (conta financeira, comprador, centro, grupo)
    status, // filtro_tela: pendente | pago | ...
    data_base = 'venc', // filtro_tela (Geral): venc | pgto | emissao
  } = req.query as Record<string, string>;

  if (!TITULOS[tipo]) return res.status(400).json({ erro: `Tipo de relatório inválido: ${tipo}` });

  const cond: string[] = [`p.cancel = 'N'`];
  const vals: any[] = [];
  const add = (v: any) => { vals.push(v); return `$${vals.length}`; };

  // --- filtros por tipo ---
  if (tipo === 'periodo') {
    if (!data_inicio || !data_fim) return res.status(400).json({ erro: 'Informe data_inicio e data_fim para o relatório por período.' });
    const colData = tipo_data === 'pgto' ? 'p.dt_pgto' : 'p.dt_venc';
    cond.push(`${colData} >= ${add(data_inicio)} AND ${colData} <= ${add(data_fim)}`);
  } else if (tipo === 'pagas_sem_nf') {
    if (!data_inicio || !data_fim) return res.status(400).json({ erro: 'Informe data_inicio e data_fim para Pagas sem NF.' });
    cond.push(`p.paga = 'S'`, `p.tem_nota = 'N'`);
    cond.push(`p.dt_pgto >= ${add(data_inicio)} AND p.dt_pgto <= ${add(data_fim)}`);
    if (param) cond.push(`p.pag_cof_id = ${add(param)}`);
  } else if (tipo === 'filtro_tela') {
    // GERAL (antes "Dados filtrados da tela"): todos os filtros do botão Filtros do Delphi
    // (Pagamento de Títulos), opcionais e combináveis numa tela só.
    const q = req.query as Record<string, string>;
    const colBase = data_base === 'pgto' ? 'p.dt_pgto' : data_base === 'emissao' ? 'p.dt_emissao' : 'p.dt_venc';
    if (data_inicio && data_fim) cond.push(`${colBase}::date >= ${add(data_inicio)} AND ${colBase}::date <= ${add(data_fim)}`);
    if (status === 'pago') cond.push(`p.paga = 'S'`);
    else if (status === 'pendente') cond.push(`COALESCE(p.paga,'N') <> 'S'`);
    const txt = (v?: string) => (v && v !== '__TODOS__' ? String(v).trim() : '');
    if (txt(q.credor)) cond.push(`p.cod_credor = ${add(txt(q.credor))}`);
    if (txt(q.transp)) cond.push(`p.cod_transp = ${add(txt(q.transp))}`);
    if (txt(q.conta_financeira)) cond.push(`p.pag_cof_id = ${add(txt(q.conta_financeira))}`);
    if (txt(q.centro_custo)) cond.push(`cc.cec_id = ${add(txt(q.centro_custo))}`);
    if (txt(q.grupo_centro)) cond.push(`gcc.gcc_id = ${add(txt(q.grupo_centro))}`);
    if (txt(q.comprador)) cond.push(`p.codcomprador = ${add(txt(q.comprador))}`);
    if (txt(q.nro_nf)) cond.push(`p.nro_nf ILIKE ${add(`%${txt(q.nro_nf)}%`)}`);
    if (txt(q.nro_dup)) cond.push(`p.nro_dup ILIKE ${add(`%${txt(q.nro_dup)}%`)}`);
    if (txt(q.obs)) cond.push(`p.obs ILIKE ${add(`%${txt(q.obs)}%`)}`);
    const valor = (v?: string) => {
      const t = txt(v).replace(/\./g, '').replace(',', '.');
      const num = parseFloat(t);
      return isNaN(num) ? null : num;
    };
    const vPgto = valor(q.valor_pgto);
    if (vPgto != null) cond.push(`abs(COALESCE(p.valor_pgto,0) - ${add(vPgto)}) < 0.005`);
    const vPago = valor(q.valor_pago);
    if (vPago != null) cond.push(`abs(COALESCE(p.valor_pago,0) - ${add(vPago)}) < 0.005`);
    // Conhecimentos abertos: títulos de transportadora (CT-e) ainda não pagos
    if (q.conhecimentos_abertos === '1') cond.push(`p.tipo = 'T'`, `COALESCE(p.paga,'N') <> 'S'`);
  } else {
    // conta_financeira / comprador / centro_custo / grupo_centro: período opcional (por vencimento)
    if (data_inicio && data_fim) cond.push(`p.dt_venc >= ${add(data_inicio)} AND p.dt_venc <= ${add(data_fim)}`);
    if (param) {
      const col =
        tipo === 'conta_financeira' ? 'p.pag_cof_id' :
        tipo === 'comprador' ? 'p.codcomprador' :
        tipo === 'centro_custo' ? 'cc.cec_id' :
        'gcc.gcc_id';
      cond.push(`${col} = ${add(param)}`);
    }
  }

  // --- ordenação (chave de grupo + cod_pgto) ---
  const ordem =
    tipo === 'periodo' ? (tipo_data === 'pgto' ? 'p.dt_pgto' : 'p.dt_venc') :
    tipo === 'filtro_tela' ? (data_base === 'pgto' ? 'p.dt_pgto' : data_base === 'emissao' ? 'p.dt_emissao' : 'p.dt_venc') :
    tipo === 'conta_financeira' || tipo === 'pagas_sem_nf' ? 'p.pag_cof_id' :
    tipo === 'comprador' ? 'p.codcomprador' :
    tipo === 'centro_custo' ? 'cc.cec_id' :
    'gcc.gcc_id';

  const sql = `${BASE_SELECT} WHERE ${cond.join(' AND ')} ORDER BY ${ordem} NULLS FIRST, p.cod_pgto`;

  try {
    const { rows } = await pool.query(sql, vals);

    // --- agrupamento + subtotais (feito em JS, igual ao "achatado" do Delphi) ---
    const fmtData = (d: any) => {
      if (!d) return '—';
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
    };

    const chaveERotulo = (r: Row): { chave: string; rotulo: string } => {
      switch (tipo) {
        case 'periodo':
          return tipo_data === 'pgto'
            ? { chave: String(r.dt_pgto || 'sem'), rotulo: `DATA PAGAMENTO: ${fmtData(r.dt_pgto)}` }
            : { chave: String(r.dt_venc || 'sem'), rotulo: `DATA VENCIMENTO: ${fmtData(r.dt_venc)}` };
        case 'filtro_tela':
          if (data_base === 'pgto') return { chave: String(r.dt_pgto || 'sem'), rotulo: `DATA PAGAMENTO: ${fmtData(r.dt_pgto)}` };
          if (data_base === 'emissao') return { chave: String(r.dt_emissao || 'sem'), rotulo: `DATA EMISSÃO: ${fmtData(r.dt_emissao)}` };
          return { chave: String(r.dt_venc || 'sem'), rotulo: `DATA VENCIMENTO: ${fmtData(r.dt_venc)}` };
        case 'conta_financeira':
        case 'pagas_sem_nf':
          return { chave: String(r.pag_cof_id ?? 'sem'), rotulo: `CONTA FINANCEIRA: ${r.pag_cof_id ?? '—'} - ${r.descr_cf || '(sem descrição)'}` };
        case 'comprador':
          return { chave: String(r.codcomprador ?? 'sem'), rotulo: `COMPRADOR: ${r.codcomprador ?? '—'} - ${r.nome_comprador || '(sem nome)'}` };
        case 'centro_custo':
          return { chave: String(r.cec_id ?? 'sem'), rotulo: `CENTRO DE CUSTO: ${r.cec_id ?? '—'} - ${r.descr_cec || '(sem descrição)'}` };
        case 'grupo_centro':
          return { chave: String(r.gcc_id ?? 'sem'), rotulo: `GRUPO DE CENTROS DE CUSTO: ${r.gcc_id ?? '—'} - ${r.descr_gcc || '(sem descrição)'}` };
        default:
          return { chave: 'todos', rotulo: 'TODOS' };
      }
    };

    const grupos: any[] = [];
    const idx: Record<string, number> = {};
    const totalGeral = { pgto: 0, pago: 0, aberto: 0, juros: 0, qtd: 0 };

    for (const r of rows) {
      const { chave, rotulo } = chaveERotulo(r);
      if (!(chave in idx)) {
        idx[chave] = grupos.length;
        grupos.push({ chave, rotulo, linhas: [], subtotais: { pgto: 0, pago: 0, aberto: 0, juros: 0, qtd: 0 } });
      }
      const g = grupos[idx[chave]];
      const linha = {
        cod_pgto: r.cod_pgto,
        nro_dup: r.nro_dup || '',
        nro_nf: r.nro_nf || '',
        nome: r.nome || '',
        cof_id: r.pag_cof_id ?? '',
        conta_financeira: r.descr_cf || '',
        dt_emissao: r.dt_emissao,
        dt_venc: r.dt_venc,
        dt_pgto: r.dt_pgto,
        valor_pgto: n(r.valor_pgto),
        valor_pago: n(r.valor_pago),
        valor_aberto: n(r.valor_aberto),
        valor_juros: n(r.valor_juros),
        tem_nota: r.tem_nota || '',
        tem_cobr: r.tem_cobr || '',
        nome_comprador: r.codcomprador ? `${r.codcomprador}${r.nome_comprador ? ' - ' + r.nome_comprador : ''}` : '',
        cod_conta: r.cod_conta ? `${r.cod_conta}${r.nro_conta ? ' - ' + r.nro_conta : ''}` : '',
        obs: r.obs || '',
        paga: r.paga || '',
      };
      g.linhas.push(linha);
      g.subtotais.pgto += linha.valor_pgto;
      g.subtotais.pago += linha.valor_pago;
      g.subtotais.aberto += linha.valor_aberto;
      g.subtotais.juros += linha.valor_juros;
      g.subtotais.qtd += 1;
      totalGeral.pgto += linha.valor_pgto;
      totalGeral.pago += linha.valor_pago;
      totalGeral.aberto += linha.valor_aberto;
      totalGeral.juros += linha.valor_juros;
      totalGeral.qtd += 1;
    }

    return res.status(200).json({
      tipo,
      titulo: TITULOS[tipo],
      grupos,
      totalGeral,
    });
  } catch (error: any) {
    console.error('[contas-pagar/consulta-avancada] erro:', error);
    return res.status(500).json({ erro: 'Erro ao gerar relatório', detalhes: error?.message });
  }
}
