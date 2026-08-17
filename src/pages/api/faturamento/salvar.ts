// pages/api/faturamento/salvar.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { naturezaPorOperacao } from '@/utils/naturezaPorOperacao';
import { inserirCobranca } from '@/lib/faturamento/inserirCobranca';

/**
 * Resolve a operação fiscal do faturamento a partir de Movimentação (SAIDA/ENTRADA)
 * + Operação (VENDA, TRANSFERENCIA, ...), fiel ao Delphi (dois níveis).
 * FASE 4 P1: só SAÍDA/VENDA está portado; demais operações e ENTRADA retornam null
 * e o faturamento cai no snapshot (comportamento atual) até FASE 4 P2/P3.
 */
type FlagsFat = {
  tipofat: string;
  insc: string;
  zerarIpi: string;
  zerarIcms: string;
  zerarSubst: string;
  suframa: string;
  mvaAnt: number;
  cfopManual: string | null;
};

/**
 * Grava os itens da fatura RECALCULANDO o imposto por item via
 * db_manaus.calcular_imposto_item (motor PG = tradução fiel do Oracle CALCULO_IMPOSTO),
 * aplicando os flags de ajuste do faturamento. Substitui o snapshot cego de dbitvenda.
 */
async function gravarItensFatRecalculado(
  client: any,
  codfat: number | string,
  codvenda: string,
  codcli: string,
  movimento: string,
  tipoOp: string,
  f: FlagsFat,
): Promise<number> {
  const itens = (
    await client.query(
      `SELECT codprod, qtd, prunit, descr, ref, codint, nrequis, nritem,
              totalicmsdesconto, fretebase, acrescimo, freteicms, desconto,
              fcp, base_fcp, valor_fcp, fcp_subst, basefcp_subst, valorfcp_subst,
              ftp_st, fcp_substret, basefcp_substret, valorfcp_substret
         FROM dbitvenda WHERE codvenda = $1`,
      [codvenda],
    )
  ).rows;

  const num = (v: any) => Number(v ?? 0);
  let n = 0;
  for (const it of itens) {
    const { rows } = await client.query(
      `SELECT * FROM db_manaus.calcular_imposto_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        String(it.codprod).trim().padStart(6, '0'),
        String(codcli).trim(),
        num(it.qtd),
        num(it.prunit),
        movimento,
        tipoOp,
        f.tipofat,
        f.insc,
        f.zerarSubst,
        f.mvaAnt,
        f.zerarIpi,
        f.zerarIcms,
        f.suframa,
        f.cfopManual,
      ],
    );
    const r = rows[0];
    if (!r) {
      throw new Error(
        `Recálculo fiscal: produto ${it.codprod} / cliente ${codcli} não encontrado.`,
      );
    }

    // Mesma convenção de dbitvenda: coluna `icms` = VALOR; `aliquota_icms` = alíquota.
    const cols: Record<string, any> = {
      codfat,
      qtde: num(it.qtd),
      codprod: it.codprod,
      prunit: num(it.prunit),
      descr: it.descr,
      codvenda,
      codint: it.codint,
      ref: it.ref,
      nrequis: it.nrequis,
      nritem: it.nritem,
      // ICMS
      icms: num(r.totalicms),
      aliquota_icms: num(r.icms),
      baseicms: num(r.baseicms),
      totalicms: num(r.totalicms),
      icmsinterno_dest: num(r.icmsinterno_dest),
      icmsexterno_orig: num(r.icmsexterno_orig),
      csticms: r.csticms ?? '',
      // ST
      mva: num(r.mva),
      basesubst_trib: num(r.basesubst_trib),
      totalsubst_trib: num(r.totalsubst_trib),
      // IPI
      ipi: num(r.totalipi),
      aliquota_ipi: num(r.ipi),
      baseipi: num(r.baseipi),
      totalipi: num(r.totalipi),
      cstipi: r.cstipi ?? '',
      // PIS/COFINS
      pis: num(r.pis),
      basepis: num(r.basepis),
      valorpis: num(r.valorpis),
      cstpis: r.cstpis ?? '',
      cofins: num(r.cofins),
      basecofins: num(r.basecofins),
      valorcofins: num(r.valorcofins),
      cstcofins: r.cstcofins ?? '',
      // CFOP/NCM/total
      cfop: r.cfop,
      tipocfop: '',
      ncm: r.ncm,
      totalproduto: num(r.totalproduto),
      totalicmsdesconto: num(it.totalicmsdesconto),
      // IBS/CBS (migration 007 — hoje ficavam NULL no snapshot)
      aliquota_ibs: num(r.ibs_e) + num(r.ibs_m),
      aliquota_cbs: num(r.cbs_aliquota),
      ibs_e: num(r.ibs_e),
      ibs_m: num(r.ibs_m),
      valor_ibs: num(r.valor_ibs),
      valor_cbs: num(r.valor_cbs),
      // pass-through não-fiscal (a procedure não computa; herdado da venda)
      fretebase: num(it.fretebase),
      acrescimo: num(it.acrescimo),
      freteicms: num(it.freteicms),
      desconto: num(it.desconto),
      fcp: num(it.fcp),
      base_fcp: num(it.base_fcp),
      valor_fcp: num(it.valor_fcp),
      fcp_subst: num(it.fcp_subst),
      basefcp_subst: num(it.basefcp_subst),
      valorfcp_subst: num(it.valorfcp_subst),
      ftp_st: num(it.ftp_st),
      fcp_substret: num(it.fcp_substret),
      basefcp_substret: num(it.basefcp_substret),
      valorfcp_substret: num(it.valorfcp_substret),
    };
    const keys = Object.keys(cols);
    const ph = keys.map((_, i) => `$${i + 1}`);
    await client.query(
      `INSERT INTO dbprodfat (${keys.join(', ')}) VALUES (${ph.join(', ')})`,
      keys.map((k) => cols[k]),
    );
    n++;
  }
  return n;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  // `nfs` = flag "Nota Fiscal de Serviço" (significado do Delphi). MELO vende
  // mercadoria: o padrão é 'N'. Só vira 'S' quando a operação for de serviço.
  // (NÃO é status de emissão — o estado real da NF-e vive em dbfat_nfe.)
  const nfsnota = 'N';
  const {
    cliente,
    vendedor,
    transportadora,
    data,
    pedido,
    totalprod,
    totalfat,
    totalnf,
    cod_conta,     // Referência à dbconta (renomeado)
    tipodoc,
    cobranca,
    insc07,
    nfs = nfsnota,
    observacoes: _observacoes,
    vendas = [], // Array de codvenda
    usuario_associacao = '',
    // FASE 4 (A) — ajustes fiscais do faturamento (default = comportamento de venda "limpo")
    tipo_movimentacao,      // SAIDA | ENTRADA
    tipo_operacao,          // operação do CFOP (VENDA, TRANSFERENCIA, REMESSA_*, ...)
    natureza_operacao,      // natureza informada (usada quando operação = OUTROS)
    cfop: cfopManual,       // CFOP manual (override)
    zerar_ipi = 'N',
    zerar_icms = 'N',
    zerar_substituicao = 'N',
    desconto_suframa = 'N',
    imposto_antecipado = 'N',
    mva_antecipado = 0,
    // COBRANÇA ATÔMICA: dados da cobrança gravados na MESMA transação da fatura.
    // Se null/ausente, a fatura é criada sem cobrança (fluxo de agrupamento/edição).
    cobranca_dados = null,
  } = req.body;

  // DEBUG: Log do payload recebido
  console.log('📦 Payload recebido:', {
    cliente_codcli: cliente?.codcli,
    vendedor,
    transportadora,
    pedido,
    vendas_tipo: typeof vendas,
    vendas_conteudo: vendas,
    vendas_length: Array.isArray(vendas) ? vendas.length : 'não é array',
  });

  // Garantir que vendas é um array
  const vendasArray = Array.isArray(vendas) ? vendas : [vendas].filter(Boolean);

  if (!cliente || !pedido) {
    return res.status(400).json({
      error: 'Dados essenciais como cliente e pedido estão faltando.',
    });
  }

  const client = await getPgPool().connect();

  try {
    console.log('🔄 Iniciando transação...');
    await client.query('BEGIN');

    // 🛡️ EVITAR FATURA DUPLICADA POR VENDA (política: "bloquear e avisar").
    // Se qualquer venda já possui fatura ativa, NÃO cria outra — orienta a reemitir
    // a partir da existente. Antes, cada tentativa de emissão criava uma fatura nova.
    const dupCheck = await client.query(
      `SELECT fv.codvenda, fv.codfat,
              CASE WHEN nfe.status = '100' THEN 'autorizada'
                   WHEN nfe.status IS NOT NULL THEN 'com NF rejeitada/pendente'
                   ELSE 'sem NF emitida' END AS situacao
         FROM fatura_venda fv
         JOIN dbfatura f ON f.codfat = fv.codfat
         LEFT JOIN LATERAL (
           SELECT status FROM dbfat_nfe n
           WHERE n.codfat = f.codfat
           ORDER BY (n.status = '100') DESC LIMIT 1
         ) nfe ON true
        WHERE fv.codvenda = ANY($1) AND fv.status = 'ativo'
        LIMIT 1`,
      [vendasArray],
    );
    if (dupCheck.rows.length > 0) {
      const d = dupCheck.rows[0];
      await client.query('ROLLBACK');
      const msg = `A venda ${d.codvenda} já possui a fatura ${d.codfat} (${d.situacao}). Não foi criada uma fatura duplicada — reemita a partir dela na Consulta de Faturas.`;
      console.warn('⛔ [salvar] Fatura duplicada evitada:', msg);
      return res.status(409).json({
        sucesso: false,
        error: msg,
        erro: msg,
        detalhe: msg,
        codfatExistente: d.codfat,
      });
    }

    console.log('🔒 Aplicando lock na tabela...');
    // Lock na tabela para evitar race conditions
    await client.query('LOCK TABLE dbfatura IN EXCLUSIVE MODE');

    console.log('🔍 Buscando último código de fatura...');
    // Busca o último código de fatura gerado (apenas valores numéricos válidos)
    const maxCodResult = await client.query(
      `SELECT COALESCE(MAX(CAST(codfat AS INTEGER)), 0) as ultimo_codigo 
       FROM dbfatura 
       WHERE codfat ~ '^[0-9]+$'`,
    );

    const ultimoCodigo = maxCodResult.rows[0].ultimo_codigo || 0;
    const novoCodigoInt = ultimoCodigo + 1;
    const novoCodfat = String(novoCodigoInt).padStart(9, '0');

    console.log('📝 Buscando último nroform...');
    // Busca o último nroform gerado (incremental, apenas valores numéricos válidos)
    const maxNroFormResult = await client.query(
      `SELECT COALESCE(MAX(CAST(nroform AS INTEGER)), 0) as ultimo_nroform 
       FROM dbfatura 
       WHERE nroform ~ '^[0-9]+$'`,
    );

    const ultimoNroForm = maxNroFormResult.rows[0].ultimo_nroform || 0;
    const novoNroFormInt = ultimoNroForm + 1;
    const novoNroForm = String(novoNroFormInt).padStart(9, '0');

    console.log('🔖 Buscando último selo...');
    // Busca o último selo gerado (incremental, apenas valores numéricos válidos)
    const maxSeloResult = await client.query(
      `SELECT COALESCE(MAX(CAST(selo AS INTEGER)), 0) as ultimo_selo 
       FROM dbfatura 
       WHERE selo IS NOT NULL AND selo ~ '^[0-9]+$'`,
    );

    const ultimoSelo = maxSeloResult.rows[0].ultimo_selo || 0;
    const novoSeloInt = ultimoSelo + 1;
    const novoSelo = String(novoSeloInt).padStart(9, '0');

    console.log(
      `🔢 Último código: ${ultimoCodigo}, Novo código: ${novoCodfat}`,
    );
    console.log(
      `📝 Último nroform: ${ultimoNroForm}, Novo nroform: ${novoNroForm}`,
    );
    console.log(`🔖 Último selo: ${ultimoSelo}, Novo selo: ${novoSelo}`);

    // Verifica se o código já existe (segurança extra)
    const verificaExistente = await client.query(
      `SELECT codfat FROM dbfatura WHERE codfat = $1`,
      [novoCodfat],
    );

    if (verificaExistente.rows.length > 0) {
      throw new Error(
        `Código de fatura ${novoCodfat} já existe! Isso não deveria acontecer.`,
      );
    }

    // Processar campo pedido: se for múltiplos pedidos, usar apenas o primeiro ou truncar
    let pedidoProcessado = pedido;
    if (typeof pedido === 'string') {
      // Se tem vírgula, pegar apenas o primeiro
      if (pedido.includes(',')) {
        pedidoProcessado = pedido.split(',')[0].trim();
        console.log(
          `⚠️ Múltiplos pedidos detectados. Usando apenas o primeiro: ${pedidoProcessado}`,
        );
      }
      // Truncar para 30 caracteres se necessário
      if (pedidoProcessado.length > 30) {
        pedidoProcessado = pedidoProcessado.substring(0, 30);
        console.log(
          `⚠️ Pedido truncado para 30 caracteres: ${pedidoProcessado}`,
        );
      }
    }

    // 🔍 Busca inteligente do cod_conta pelo cod_banco enviado
    let codContaFinal = null; // Padrão NULL para evitar erro de FK
    
    if (cod_conta) {
      console.log(`🔍 Buscando cod_conta para o banco: ${cod_conta}`);
      
      // 1. Tenta encontrar a conta pelo código do banco (exato)
      let contaPorBanco = await client.query(
        `SELECT cod_conta FROM dbconta WHERE cod_banco = $1 LIMIT 1`,
        [cod_conta]
      );

      // 1.1 Se não achou exato, tenta com zeros à esquerda (ex: "5" -> "0005")
      if (contaPorBanco.rows.length === 0) {
        const codBancoPadded = String(cod_conta).padStart(4, '0');
        console.log(`⚠️ Não achou exato. Tentando com padding: ${codBancoPadded}`);
        contaPorBanco = await client.query(
          `SELECT cod_conta FROM dbconta WHERE cod_banco = $1 LIMIT 1`,
          [codBancoPadded]
        );
      }

      if (contaPorBanco.rows.length > 0) {
        codContaFinal = contaPorBanco.rows[0].cod_conta;
        console.log(`✅ Conta encontrada via cod_banco: ${codContaFinal}`);
      } else {
        // 2. Se não achou por banco, verifica se o valor passado já é um cod_conta válido
        console.log(`⚠️ Não achou por cod_banco. Verificando se '${cod_conta}' é um cod_conta válido...`);
        
        const contaPorId = await client.query(
          `SELECT cod_conta FROM dbconta WHERE cod_conta = $1 LIMIT 1`,
          [cod_conta]
        );
        
        if (contaPorId.rows.length > 0) {
          codContaFinal = contaPorId.rows[0].cod_conta;
          console.log(`✅ O valor informado já é um cod_conta válido: ${codContaFinal}`);
        } else {
          console.log(`❌ Nenhuma conta encontrada para '${cod_conta}' (nem como banco, nem como conta). Será salvo como NULL.`);
          codContaFinal = null;
        }
      }
    }

    // CORREÇÃO: Comentários removidos de dentro da string SQL
    // Colunas com FK (codtransp -> dbtransp, codvend -> dbvend): string vazia
    // viola a FK (não existe registro de código ''). Normaliza vazio -> NULL.
    const nzFk = (v: any) => {
      const s = String(v ?? '').trim();
      return s === '' ? null : s;
    };
    const codtranspFinal = nzFk(transportadora);
    const codvendFinal = nzFk(vendedor);

    // 🔧 CORREÇÃO CRÍTICA: Adicionar série='2' ao criar fatura
    // Natureza da Operação (cabeçalho) = derivada da OPERAÇÃO (tipo_operacao),
    // NÃO do CFOP dos itens. Gravada em dbfatura.descrcfop (coluna existente).
    const natOpFatura = naturezaPorOperacao(tipo_operacao, natureza_operacao);

    const insertQuery = `
      INSERT INTO dbfatura (
        codfat, codcli, nroform, data, codvend, codtransp,
        totalprod, totalfat, totalnf, cod_conta, tipodoc, cobranca, insc07, pedido, nfs, selo, serie, descrcfop
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `;

    // Log dos valores antes do INSERT para debug
    console.log('📝 Valores para INSERT:', {
      codfat: novoCodfat,
      codcli: cliente.codcli,
      nroform: novoNroForm,
      data: data,
      codvend: vendedor,
      codtransp: transportadora,
      totalprod: totalprod,
      totalfat: totalfat,
      totalnf: totalnf,      // ✅ Total da NF
      cod_conta: codContaFinal,    // ✅ Referência dbconta (processada e renomeada)
      tipodoc: tipodoc,
      cobranca: cobranca,
      insc07: insc07,
      pedido: pedidoProcessado,
      nfs: nfs,
      selo: novoSelo,
      serie: '2'  // ✅ Série padrão NFe
    });

    await client.query(insertQuery, [
      novoCodfat,
      cliente.codcli,
      novoNroForm, // Agora usa o nroform incremental
      data,
      codvendFinal,
      codtranspFinal,
      totalprod,
      totalfat,
      totalnf || totalfat,    // ✅ Total da NF (fallback para totalfat)
      codContaFinal || null,  // ✅ Referência dbconta (processada)
      tipodoc,
      cobranca,
      insc07,
      pedidoProcessado, // Usa o pedido processado (truncado se necessário)
      nfs, // 'N' = mercadoria (padrão); 'S' só p/ nota de serviço
      novoSelo,       // Adiciona o selo incremental
      '2',            // ✅ série padrão para NFe
      natOpFatura.substring(0, 60), // descrcfop = Natureza da Operação
    ]);

    // Associa todas as vendas à fatura na tabela intermediária
    for (const codvenda of vendasArray) {
      await client.query(
        `INSERT INTO fatura_venda (codfat, codvenda, data_associacao, usuario_associacao, status)
         VALUES ($1, $2, NOW(), $3, 'ativo')`,
        [novoCodfat, codvenda, usuario_associacao],
      );

      // Atualiza o status da venda para 'F' (faturado) e statuspedido
      await client.query(
        `UPDATE dbvenda
         SET status = 'F'
         WHERE codvenda = $1`,
        [codvenda],
      );

      console.log(
        `✅ Status da venda ${codvenda} atualizado para 'F' (faturado) - Fatura: ${novoCodfat}`,
      );

      // ===== ITENS DA FATURA (DBPRODFAT) =====
      // FASE 4 (A): quando a operação é VENDA (portada), RECALCULA o imposto por item
      // via db_manaus.calcular_imposto_item aplicando os flags de ajuste do faturamento
      // (zerar IPI/ICMS/subst, desconto Suframa, MVA antecipado, Insc 04/07).
      // Para VENDA sem flags, o resultado é idêntico ao snapshot (idempotente) e ainda
      // preenche IBS/CBS. Operações não portadas (P2) mantêm o snapshot de dbitvenda.
      // Portão removido (homolog): recalcula TODAS as operações via calcular_imposto_item,
      // passando tipo_movimentacao/tipo_operacao reais. Se alguma operação precisar de
      // ajuste, corrige-se a função PG / os flags — sem cair pro snapshot cego da venda.
      const movFat = String(tipo_movimentacao ?? 'SAIDA').toUpperCase();
      const opFat = String(tipo_operacao ?? 'VENDA').toUpperCase();
      const cliRes = await client.query(
        `SELECT codcli FROM dbvenda WHERE codvenda = $1`,
        [codvenda],
      );
      const codcliVenda = cliRes.rows[0]?.codcli;
      const flagsFat: FlagsFat = {
        tipofat: String(tipodoc ?? '').toUpperCase().includes('FAG') ? 'FAG' : 'NOTA_FISCAL',
        insc: insc07 === 'S' ? '07' : '04',
        zerarIpi: zerar_ipi === 'S' ? 'S' : 'N',
        zerarIcms: zerar_icms === 'S' ? 'S' : 'N',
        zerarSubst: zerar_substituicao === 'S' ? 'S' : 'N',
        suframa: desconto_suframa === 'S' ? 'S' : 'N',
        mvaAnt: imposto_antecipado === 'S' ? Number(mva_antecipado) || 0 : 0,
        cfopManual: cfopManual ? String(cfopManual).trim() : null,
      };
      const qtdItens = await gravarItensFatRecalculado(
        client, novoCodfat, codvenda, codcliVenda, movFat, opFat, flagsFat,
      );
      console.log(
        `🧾 DBPRODFAT (recalc PG ${movFat}/${opFat}): ${qtdItens} item(ns) da venda ${codvenda} na fatura ${novoCodfat}`,
      );

      // ===== BAIXA DE ESTOQUE =====
      // Buscar itens da venda para fazer a baixa de estoque
      const itensVenda = await client.query(
        `SELECT codprod, qtd, arm_id FROM dbitvenda WHERE codvenda = $1`,
        [codvenda],
      );

      console.log(`📦 Processando baixa de estoque para ${itensVenda.rows.length} itens da venda ${codvenda}`);

      for (const item of itensVenda.rows) {
        const { codprod, qtd, arm_id } = item;
        const quantidade = parseFloat(qtd) || 0;

        if (quantidade <= 0 || !codprod) {
          console.log(`⚠️ Item ignorado (sem quantidade ou codprod): codprod=${codprod}, qtd=${quantidade}`);
          continue;
        }

        // 1. Atualizar cad_armazem_produto: subtrair de arp_qtest e arp_qtest_reservada
        if (arm_id) {
          const updateArmazem = await client.query(
            `UPDATE cad_armazem_produto
             SET arp_qtest = GREATEST(0, COALESCE(arp_qtest, 0) - $1),
                 arp_qtest_reservada = GREATEST(0, COALESCE(arp_qtest_reservada, 0) - $1)
             WHERE arp_codprod = $2 AND arp_arm_id = $3
             RETURNING arp_qtest, arp_qtest_reservada`,
            [quantidade, codprod, arm_id],
          );

          if (updateArmazem.rowCount && updateArmazem.rowCount > 0) {
            console.log(`✅ Estoque armazém atualizado: codprod=${codprod}, arm_id=${arm_id}, qtd=${quantidade}, novo_qtest=${updateArmazem.rows[0]?.arp_qtest}`);
          } else {
            console.log(`⚠️ Registro não encontrado em cad_armazem_produto: codprod=${codprod}, arm_id=${arm_id}`);
          }
        }

        // 2. Atualizar dbprod: subtrair de qtest (estoque total)
        const updateProd = await client.query(
          `UPDATE dbprod
           SET qtest = GREATEST(0, COALESCE(qtest, 0) - $1)
           WHERE codprod = $2
           RETURNING qtest`,
          [quantidade, codprod],
        );

        if (updateProd.rowCount && updateProd.rowCount > 0) {
          console.log(`✅ Estoque produto atualizado: codprod=${codprod}, qtd=${quantidade}, novo_qtest=${updateProd.rows[0]?.qtest}`);
        } else {
          console.log(`⚠️ Produto não encontrado em dbprod: codprod=${codprod}`);
        }
      }

      console.log(`📦 Baixa de estoque concluída para venda ${codvenda}`);
    }

    // ===== COBRANÇA NA MESMA TRANSAÇÃO (atomicidade fatura + cobrança) =====
    // Fiel ao GERAR_FATURA do Delphi: fatura, baixa de estoque e cobrança são UMA
    // unidade. Se a cobrança falhar aqui, o catch abaixo faz ROLLBACK de tudo — não
    // sobra fatura órfã (o bug de antes, quando a cobrança era uma 2ª chamada HTTP).
    if (cobranca === 'S' && cobranca_dados) {
      console.log('💳 Gravando cobrança na mesma transação da fatura...');
      await inserirCobranca(client, {
        codfat: novoCodfat,
        codcli: cliente.codcli,
        banco: cobranca_dados.banco,
        tipofat: cobranca_dados.tipofat,
        codvenda: cobranca_dados.codvenda ?? vendasArray[0] ?? null,
        parcelas: cobranca_dados.parcelas ?? [],
      });
      console.log('✅ Cobrança gravada na transação da fatura');
    }

    await client.query('COMMIT');

    return res.status(201).json({
      sucesso: true,
      message: 'Fatura salva com sucesso!',
      codfat: novoCodfat,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar fatura:', error);
    return res.status(500).json({
      error: `Erro ao salvar a fatura: ${(error as Error)?.message || 'erro desconhecido'}`,
    });
  } finally {
    client.release();
  }
}
