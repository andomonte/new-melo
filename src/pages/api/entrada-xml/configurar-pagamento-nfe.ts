import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { z } from 'zod';
import { registrarHistoricoNfe, usuarioDoHistorico } from '@/lib/nfe/historicoNfeHelper';
import {
  adiantamentosDisponiveis, adiantamentosEmAberto, mensagemAdiantamentoEmAberto, consumirCreditoNaNota, desfazerConsumoDaNota, sincronizarCreditoAposBaixa,
} from '@/lib/compras/creditoFornecedor';
import {
  associarNotaAoAdiantamento, atualizarNfDoTitulo, codigoBanco, contaFinanceiraFornecedor,
  dadosNota, duplicataNota, proximoCodPgto, ufDaFilial, vincularNotaTitulo,
} from '@/lib/compras/tituloCompras';

const parcelaSchema = z.object({
  numero_parcela: z.number(),
  numero_duplicata: z.string(),
  valor_parcela: z.number().positive(),
  data_vencimento: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Data de vencimento inválida",
  }),
  tipo_documento: z.string(),
});

const bodySchema = z.object({
  nfeId: z.string().min(1, "NFE ID é obrigatório"),
  banco: z.string().min(1, "Banco é obrigatório"),
  tipoDocumento: z.string().min(1, "Tipo de documento é obrigatório"),
  // Pode vir VAZIO quando o antecipado já cobre toda a NFe (quitação por antecipado / excedente).
  parcelas: z.array(parcelaSchema).default([]),
  xmlNf: z.string().optional(), // XML da NFe para salvar no dbpgto
  ordensAssociadas: z.array(z.number()).optional(), // Lista de ordens associadas à NFe (manual ou automático)
  valorAntecipadoManual: z.number().optional(), // Valor antecipado quando ordens são selecionadas manualmente
  userId: z.string().optional(),
  userName: z.string().optional(),
});

interface ConfigurarPagamentoResponse {
  success: boolean;
  message: string;
  parcelasCriadas?: number;
  valorTotal?: number;
  quitadaPorAntecipado?: boolean;
  antecipadosCancelados?: number;
  creditoGerado?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfigurarPagamentoResponse | { error: string; adiantamentosNaoPagos?: any[] }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const validation = bodySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: validation.error.flatten()
    } as any);
  }

  const { nfeId, banco, tipoDocumento, parcelas, xmlNf, ordensAssociadas, valorAntecipadoManual, userId, userName } = validation.data;

  console.log(`\n💳 ===== CONFIGURANDO PAGAMENTO DA NFe ${nfeId} =====`);
  console.log(`Banco: ${banco}`);
  console.log(`Tipo Documento: ${tipoDocumento}`);
  console.log(`Total de parcelas: ${parcelas.length}`);

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}`);

    // Iniciar transação
    await client.query('BEGIN');

    // 1. Validar se NFe existe
    const nfeResult = await client.query(`
      SELECT codnfe_ent, vnf, exec
      FROM dbnfe_ent
      WHERE codnfe_ent = $1
    `, [nfeId]);

    if (nfeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'NFe não encontrada no sistema'
      });
    }

    const nfe = nfeResult.rows[0];

    // 2. Validar se NFe já foi processada (exec='S')
    if (nfe.exec === 'S') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Esta NFe já foi processada e gerou entrada de estoque. Não é possível configurar pagamento novamente.'
      });
    }

    const valorTotalNFe = parseFloat(nfe.vnf || 0);
    console.log(`📄 NFe encontrada: R$ ${valorTotalNFe.toFixed(2)}`);

    // 3. Buscar fornecedor através das ordens associadas OU via emitente da NFe
    let fornecedorCod: string;

    // Se foram passadas ordens manualmente, usá-las para buscar o fornecedor
    if (ordensAssociadas && ordensAssociadas.length > 0) {
      const fornecedorResult = await client.query(`
        SELECT DISTINCT r.req_cod_credor as fornecedor_cod
        FROM cmp_ordem_compra o
        INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
        WHERE o.orc_id = ANY($1::bigint[])
        LIMIT 1
      `, [ordensAssociadas]);

      if (fornecedorResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Não foi possível determinar o fornecedor das ordens selecionadas.'
        });
      }

      fornecedorCod = fornecedorResult.rows[0].fornecedor_cod;
      console.log(`👤 Fornecedor (via ordens manuais): ${fornecedorCod}`);
    } else {
      // Buscar fornecedor via associações normais da NFe
      const fornecedorResult = await client.query(`
        SELECT DISTINCT r.req_cod_credor as fornecedor_cod
        FROM nfe_item_pedido_associacao nipa
        INNER JOIN cmp_ordem_compra o ON nipa.req_id = o.orc_id
        INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
        WHERE nipa.nfe_id = $1
        LIMIT 1
      `, [nfeId]);

      if (fornecedorResult.rows.length === 0) {
        // Tentar buscar fornecedor via emitente da NFe
        const emitenteResult = await client.query(`
          SELECT c.cod_credor
          FROM dbnfe_ent_emit emit
          INNER JOIN dbcredor c ON upper(REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '')) = upper(REPLACE(REPLACE(REPLACE(emit.cpf_cnpj, '.', ''), '-', ''), '/', ''))
          WHERE emit.codnfe_ent = $1
          LIMIT 1
        `, [nfeId]);

        if (emitenteResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Não foi possível determinar o fornecedor da NFe. Verifique se existem associações com ordens de compra ou se o emitente está cadastrado.'
          });
        }

        fornecedorCod = emitenteResult.rows[0].cod_credor;
        console.log(`👤 Fornecedor (via emitente NFe): ${fornecedorCod}`);
      } else {
        fornecedorCod = fornecedorResult.rows[0].fornecedor_cod;
        console.log(`👤 Fornecedor (via ordem associada): ${fornecedorCod}`);
      }
    }

    // 4. Adiantamentos (parcela 0) das ordens e quanto cada um ainda pode abater DESTA NF
    //    (fase 3 do roteiro, 24/11/2026): o PAGO vale pelo crédito disponível (credor_credito);
    //    o NÃO PAGO, pelo que ainda não foi usado em outra NF. Antes só contava o não pago
    //    (paga='N'): adiantamento pago menor que a NF fazia a conferência das parcelas falhar.
    let orcIdsAnt: number[] = [];
    if (ordensAssociadas && ordensAssociadas.length > 0) {
      orcIdsAnt = ordensAssociadas;
    } else {
      const rOrc = await client.query(
        `SELECT DISTINCT req_id::bigint AS orc FROM nfe_item_pedido_associacao WHERE nfe_id = $1`, [nfeId]
      );
      orcIdsAnt = rOrc.rows.map((r: any) => Number(r.orc));
    }
    // reconfiguração: o que esta NF tinha consumido volta para os créditos
    await desfazerConsumoDaNota(client, nfeId);
    // adiantamento pago que ainda não tem o crédito (pago antes da rotina): cria agora
    if (orcIdsAnt.length > 0) {
      const pagosAnt = await client.query(`
        SELECT DISTINCT p.cod_pgto FROM dbpgto p
          JOIN ordem_pagamento_conta opc ON opc.cod_pgto = p.cod_pgto AND opc.numero_parcela = 0
         WHERE opc.orc_id = ANY($1::bigint[]) AND COALESCE(p.cancel,'N') <> 'S' AND COALESCE(p.valor_pago,0) > 0`,
        [orcIdsAnt]);
      for (const r of pagosAnt.rows) await sincronizarCreditoAposBaixa(client, r.cod_pgto, userName, { emTransacao: true });
    }
    const adiantamentos = await adiantamentosDisponiveis(client, orcIdsAnt, nfeId);
    // Regra de 25/11/2026: adiantamento NÃO PAGO trava a cobrança da NF (não cancela mais o
    // título nem gera a cobrança da NF inteira). O comprador pede o pagamento ao Financeiro.
    const emAberto = adiantamentosEmAberto(adiantamentos);
    if (emAberto.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: mensagemAdiantamentoEmAberto(emAberto),
        adiantamentosNaoPagos: emAberto.map((a) => ({
          cod_pgto: a.cod_pgto, nro_dup: a.nro_dup, orc_id: a.orc_id, valor: a.valor_pgto,
          valor_pago: a.valor_pago, em_aberto: a.em_aberto, data_vencimento: a.data_vencimento,
        })),
      });
    }
    // só os que ainda têm o que abater
    const antTitulos = adiantamentos
      .filter((a) => a.disponivel > 0.005)
      .map((a) => ({ ...a, atendido: 0, creditoUsado: 0 }));
    const antDisponivel = Math.round(antTitulos.reduce((s2, a) => s2 + a.disponivel, 0) * 100) / 100;
    const antPago = antTitulos.reduce((s2, a) => s2 + a.valor_pago, 0);

    let valorAntecipado = antDisponivel;
    if (valorAntecipadoManual && valorAntecipadoManual > 0) {
      // seleção manual: não passa do que os adiantamentos ainda têm para abater
      valorAntecipado = Math.min(valorAntecipadoManual, antDisponivel || valorAntecipadoManual);
      console.log(`💰 Valor antecipado (manual): R$ ${valorAntecipadoManual.toFixed(2)} → considerado R$ ${valorAntecipado.toFixed(2)}`);
    }
    console.log(`💰 Adiantamentos: ${antTitulos.length} com saldo, disponível R$ ${antDisponivel.toFixed(2)}`);
    const antTotal = antDisponivel;
    const TOL_EXC = 0.10;
    const antBase = valorAntecipado > 0 ? valorAntecipado : antTotal;
    const excedente = Math.round((antBase - valorTotalNFe) * 100) / 100;
    // Antecipado COBRE a NF quando é MAIOR OU IGUAL a ela (tolerância de R$ 0,10) — mesma
    // regra da tela (ConfiguracaoPagamentoNFeModal). Antes aqui era só "maior": com antecipado
    // IGUAL à NF e não pago, a tela mandava as parcelas da NF inteira e o servidor ainda somava
    // o antecipado (NF 19771: 8.314,20 + 8.314,20 ≠ 8.314,20) e recusava.
    const cobreNF = valorTotalNFe > 0 && antBase >= valorTotalNFe - TOL_EXC;
    // "pago" = algum adiantamento com crédito (pago sem NF) entre os que abatem esta NF
    const algumPago = antTitulos.some((a) => a.creditoId) || antPago > 0.005;
    // A ≥ NF: PAGO → quita (+ crédito do que passar da NF; 0 parcelas). NÃO PAGO → cancela os
    // antecipados e a cobrança da NF inteira vem das parcelas (XML ou manual). Spec §5.2.
    const quitaPorAntecipado = cobreNF && algumPago;
    const cancelaAntecipado = cobreNF && !algumPago;

    // Validação de DATA: nenhuma parcela pode vencer antes de hoje (obriga o usuário a corrigir).
    if (!quitaPorAntecipado && parcelas.length > 0) {
      const hojeStr = new Date().toISOString().slice(0, 10);
      const vencida = parcelas.find(p => p.data_vencimento && String(p.data_vencimento).slice(0, 10) < hojeStr);
      if (vencida) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Há parcela com vencimento no passado (${String(vencida.data_vencimento).slice(0, 10)}). Informe uma data de vencimento válida (hoje ou futura).`
        });
      }
    }

    if (quitaPorAntecipado) {
      console.log(`\n💰 ANTECIPADO PAGO COBRE A NF: antecipado R$ ${antBase.toFixed(2)} >= NF R$ ${valorTotalNFe.toFixed(2)}. NFe quitada; excedente pago vira crédito.\n`);
    } else {
      // Antecipado efetivo = 0 quando os antecipados serão cancelados (não pago); senão o detectado.
      const antecipadoEfetivo = cancelaAntecipado ? 0 : valorAntecipado;
      const somaParcelasRecebidas = parcelas.reduce((sum, p) => sum + p.valor_parcela, 0);
      const totalComAntecipado = somaParcelasRecebidas + antecipadoEfetivo;
      const diferenca = Math.abs(totalComAntecipado - valorTotalNFe);

      console.log(`\n💰 Validação: parcelas ${somaParcelasRecebidas.toFixed(2)} + antecipado ${antecipadoEfetivo.toFixed(2)} = ${totalComAntecipado.toFixed(2)} vs NF ${valorTotalNFe.toFixed(2)} (dif ${diferenca.toFixed(2)})${cancelaAntecipado ? ' [antecipados serão CANCELADOS]' : ''}`);

      if (parcelas.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: cancelaAntecipado
            ? 'Os antecipados não pagos cobrem a NFe e serão cancelados — informe as parcelas da cobrança (do XML ou manual).'
            : 'Pelo menos uma parcela é necessária.'
        });
      }
      if (diferenca > 0.10) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `A soma das parcelas (R$ ${somaParcelasRecebidas.toFixed(2)})${antecipadoEfetivo > 0 ? ` + antecipado (R$ ${antecipadoEfetivo.toFixed(2)})` : ''} = R$ ${totalComAntecipado.toFixed(2)} difere do valor da NFe (R$ ${valorTotalNFe.toFixed(2)}). Diferença: R$ ${diferenca.toFixed(2)}`
        });
      }
      console.log(`✅ Validação OK!\n`);
    }

    // 6. Buscar todas as ordens associadas à NFe (se não foram passadas) COM SEUS VALORES
    let todasOrdensAssociadas = ordensAssociadas || [];
    const ordensComValores: { orcId: number; valor: number; proporcao: number }[] = [];

    if (todasOrdensAssociadas.length === 0) {
      const ordensResult = await client.query(`
        SELECT DISTINCT nipa.req_id as orc_id
        FROM nfe_item_pedido_associacao nipa
        WHERE nipa.nfe_id = $1
      `, [nfeId]);
      todasOrdensAssociadas = ordensResult.rows.map(r => Number(r.orc_id));
    }

    // OTIMIZADO: Buscar valores de TODAS as ordens em uma única query
    let valorTotalOrdens = 0;
    if (todasOrdensAssociadas.length > 0) {
      const placeholders = todasOrdensAssociadas.map((_, i) => `$${i + 1}`).join(', ');
      const valoresResult = await client.query(`
        SELECT orc_id, orc_valor_total
        FROM cmp_ordem_compra
        WHERE orc_id IN (${placeholders})
      `, todasOrdensAssociadas);

      // Criar mapa para lookup
      const valoresMap = new Map<number, number>();
      for (const row of valoresResult.rows) {
        valoresMap.set(Number(row.orc_id), parseFloat(row.orc_valor_total || 0));
      }

      // Popular ordensComValores mantendo a ordem original
      for (const orcId of todasOrdensAssociadas) {
        const valorOrdem = valoresMap.get(orcId) || 0;
        ordensComValores.push({ orcId, valor: valorOrdem, proporcao: 0 });
        valorTotalOrdens += valorOrdem;
      }
    }

    // Calcular proporção de cada ordem
    for (const ordem of ordensComValores) {
      ordem.proporcao = valorTotalOrdens > 0 ? ordem.valor / valorTotalOrdens : 1 / ordensComValores.length;
    }

    console.log(`📦 Ordens associadas: ${JSON.stringify(todasOrdensAssociadas)}`);
    console.log(`📊 Proporções por ordem:`, ordensComValores.map(o => `ORC${o.orcId}: ${(o.proporcao * 100).toFixed(1)}%`).join(', '));

    // 6.1 LIMPEZA: Remover parcelas anteriores (EXCETO parcela 0 = antecipado) para permitir reconfiguração
    // OTIMIZADO: Usar batch deletes ao invés de loop por ordem
    if (ordensComValores.length > 0) {
      const orcIds = ordensComValores.map(o => o.orcId);
      const placeholders = orcIds.map((_, i) => `$${i + 1}`).join(', ');

      // Parcelas a refazer: as DESTA NF (reconfiguração) e as configuradas na própria ordem.
      // Uma ordem pode atender várias notas: as parcelas de OUTRA NF da mesma ordem ficam.
      const pgtoAntigosResult = await client.query(`
        SELECT DISTINCT opc.cod_pgto FROM ordem_pagamento_conta opc
          JOIN dbpgto p ON p.cod_pgto = opc.cod_pgto
         WHERE opc.orc_id = ANY($1::bigint[]) AND opc.numero_parcela > 0
           AND (p.obs ILIKE 'Pagamento ref. Ordem de Compra%'
                OR p.obs ILIKE $2
                OR EXISTS (SELECT 1 FROM dbpgto_nota t WHERE t.cod_pgto = p.cod_pgto AND t.codnfe_ent = $3)
                OR NOT EXISTS (SELECT 1 FROM dbpgto_nota t WHERE t.cod_pgto = p.cod_pgto))
      `, [orcIds, `Pagamento ref. NFe ${nfeId} -%`, nfeId]);

      const codPgtosParaDeletar = pgtoAntigosResult.rows.map(r => r.cod_pgto);

      if (codPgtosParaDeletar.length > 0) {
        await client.query(`DELETE FROM dbpgto_nota WHERE cod_pgto = ANY($1::varchar[])`, [codPgtosParaDeletar]);
        await client.query(`DELETE FROM dbpgto WHERE cod_pgto = ANY($1::varchar[])`, [codPgtosParaDeletar]);
        await client.query(
          `DELETE FROM ordem_pagamento_conta WHERE cod_pgto = ANY($1::varchar[]) AND numero_parcela > 0`,
          [codPgtosParaDeletar]);
      }

      // Deletar de ordem_pagamento_parcelas em batch
      await client.query(`
        DELETE FROM ordem_pagamento_parcelas WHERE orc_id IN (${placeholders}) AND numero_parcela > 0
      `, orcIds);

      if (codPgtosParaDeletar.length > 0) {
        console.log(`🗑️  Removidas ${codPgtosParaDeletar.length} parcela(s) anterior(es) de ${orcIds.length} ordem(ns) para reconfiguração`);
      }
    }

    // Preparar JSON das ordens para o campo ordem_compra
    const ordemCompraJson = JSON.stringify(todasOrdensAssociadas);

    // 7. Conta financeira, banco e código dos títulos (roteiro 24/11/2026, regra D1):
    //    conta pelo fornecedor (1 importação/exterior · 3 fora do estado · 2 local) — antes
    //    era MAX(pag_cof_id)+1 (conta errada/inexistente); cod_pgto com trava; banco pelo código.
    const natopRes = await client.query(`SELECT natop, nnf FROM dbnfe_ent WHERE codnfe_ent = $1`, [nfeId]);
    const numeroNF = String(natopRes.rows[0]?.nnf || '').trim() || String(nfeId).replace(/^0+/, '');
    const ehImportacao = natopRes.rows[0]?.natop === 'ENTRADA_IMPORTACAO';
    const ufFilial = ufDaFilial(String(process.env.DB_SCHEMA || 'db_manaus').replace(/^db_/, ''));
    const pagCofIdNfe = await contaFinanceiraFornecedor(client, fornecedorCod, { ufFilial, importacao: ehImportacao });
    const bancoCodigo = await codigoBanco(client, banco);
    const notaNF = await dadosNota(client, nfeId);
    console.log(`🔢 Conta financeira das parcelas: ${pagCofIdNfe} · banco ${bancoCodigo}\n`);

    // 8. Criar registros em dbpgto APENAS para parcelas > 0
    // Parcela 0 (ANTECIPADO) JÁ EXISTE - foi criada no pagamento antecipado da ordem
    let parcelasCriadas = 0;
    let valorTotalCriado = 0;
    // Para o histórico: cada parcela criada
    const parcelasDetalhe: { numero: number; cod_pgto: string; nro_dup: string; vencimento: string; valor: number }[] = [];

    // Quitado por antecipado PAGO → 0 parcelas. Nos demais casos (inclusive cancelaAntecipado),
    // a cobrança vem das parcelas enviadas (XML ou manual).
    const parcelasNormais = quitaPorAntecipado ? [] : parcelas.filter(p => p.numero_parcela > 0);
    const totalParcelasNormais = parcelasNormais.length;

    console.log(`📝 Criando ${parcelasNormais.length} parcela(s) em dbpgto (parcela 0 já existe)\n`);

    for (const parcela of parcelasNormais) {
      // cod_pgto com 9 dígitos, com trava (não repete entre usuários simultâneos)
      const codPgto = await proximoCodPgto(client);

      // Label da parcela
      const labelParcela = `Parcela ${parcela.numero_parcela}/${totalParcelasNormais} - ${parcela.tipo_documento}`;

      // Duplicata (decisão D2, 24/11/2026): {duplicata do XML}/{parcela}/{total}.
      // Se o XML traz só a sequência ("001") ou nada, usa o nº da NF: NF 78239 → 78239/1/2, 78239/2/2.
      const nroDup = duplicataNota(parcela.numero_duplicata, numeroNF, parcela.numero_parcela, totalParcelasNormais);

      console.log(`💳 Criando parcela ${parcela.numero_parcela}:`);
      console.log(`   cod_pgto: ${codPgto}`);
      console.log(`   valor: R$ ${parcela.valor_parcela.toFixed(2)}`);
      console.log(`   vencimento: ${parcela.data_vencimento}`);
      console.log(`   nro_dup: ${nroDup}`);

      await client.query(`
        INSERT INTO dbpgto (
          cod_pgto,
          cod_credor,
          dt_venc,
          dt_emissao,
          valor_pgto,
          obs,
          paga,
          cancel,
          tipo,
          nro_nf,
          nro_dup,
          pag_cof_id,
          banco,
          ordem_compra,
          xml_nf
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        codPgto,                                                    // cod_pgto (4 zeros à esquerda)
        fornecedorCod,                                              // cod_credor
        parcela.data_vencimento,                                    // dt_venc
        parcela.valor_parcela,                                      // valor_pgto
        `Pagamento ref. NFe ${nfeId} - ${labelParcela}`,           // obs
        'N',                                                        // paga (não)
        'N',                                                        // cancel (não)
        'F',                                                        // tipo (F = Fornecedor)
        notaNF.nnf,                                                 // nro_nf (nº real da NF; antes o código interno)
        nroDup,                                                     // nro_dup (formato: OC{orc_id}/{parcela})
        pagCofIdNfe,                                                // pag_cof_id (conta financeira, regra D1)
        bancoCodigo,                                                // banco (código dbbanco)
        ordemCompraJson,                                            // ordem_compra (JSON com lista de ordens)
        xmlNf || null                                               // xml_nf
      ]);

      // Vínculo título ↔ nota (dbpgto_nota, migration 089)
      await vincularNotaTitulo(client, codPgto, notaNF, 'PARCELA', parcela.valor_parcela, userName);

      // OTIMIZADO: Coletar inserts e executar em paralelo
      const insertPromises = ordensComValores.map(ordem => {
        const valorProporcional = parseFloat((parcela.valor_parcela * ordem.proporcao).toFixed(2));
        console.log(`   📌 Vinculado à ordem ${ordem.orcId}: R$ ${valorProporcional.toFixed(2)} (${(ordem.proporcao * 100).toFixed(1)}%)`);

        return Promise.all([
          // Inserir em ordem_pagamento_parcelas
          client.query(`
            INSERT INTO ordem_pagamento_parcelas
            (orc_id, banco, tipo_documento, numero_parcela, valor_parcela, dias, data_vencimento, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [ordem.orcId, banco, tipoDocumento, parcela.numero_parcela, valorProporcional, 0, parcela.data_vencimento, 'PENDENTE']),

          // Inserir em ordem_pagamento_conta
          client.query(`
            INSERT INTO ordem_pagamento_conta
            (orc_id, cod_pgto, numero_parcela, valor_parcela, data_vencimento, status)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [ordem.orcId, codPgto, parcela.numero_parcela, valorProporcional, parcela.data_vencimento, 'PENDENTE'])
        ]);
      });

      await Promise.all(insertPromises);

      parcelasDetalhe.push({
        numero: parcela.numero_parcela,
        cod_pgto: codPgto,
        nro_dup: nroDup,
        vencimento: String(parcela.data_vencimento).slice(0, 10),
        valor: parcela.valor_parcela,
      });
      parcelasCriadas++;
      valorTotalCriado += parcela.valor_parcela;
    }

    // 8.1 Antecipado ≥ NF (spec §5.2, ajustado na fase 3 do roteiro):
    //  - PAGO     → NFe quitada; a NF CONSOME o crédito do adiantamento (8.2) e o que passar da
    //               NF continua como crédito do fornecedor (antes: crédito "SOBRA" à parte);
    //  - NÃO PAGO → cancela os antecipados (a cobrança da NF veio das parcelas acima) — só os
    //               que não atendem outra NF (os demais seguem como estão).
    let creditoGeradoValor = 0;
    const algumComCredito = antTitulos.some((a) => a.creditoId);
    if (quitaPorAntecipado && !algumComCredito) {
      // pago sem o crédito da rotina (ex.: pago depois de outra NF já estar no título):
      // mantém a regra antiga — crédito do excedente pago
      const excedentePago = Math.min(excedente, Math.round(Math.max(0, antPago - valorTotalNFe) * 100) / 100);
      const grpRes = await client.query(
        `SELECT fn_grupo_credor(cpf_cgc) AS gk FROM dbcredor WHERE cod_credor = $1`, [fornecedorCod]
      );
      const grupoKey = grpRes.rows[0]?.gk || fornecedorCod;
      if (excedentePago > 0.005) {
        await client.query(`
          INSERT INTO credor_credito
            (grupo_key, cod_credor, origem, cod_pgto, nfe_id, valor_original, valor_disponivel, status, obs, username)
          VALUES ($1,$2,'SOBRA_PAGAMENTO',$3,$4,$5,$5,'ABERTO',$6,$7)`,
          [grupoKey, fornecedorCod, antTitulos[0]?.cod_pgto || null, nfeId, excedentePago,
           `Excedente de antecipado pago na NFe ${notaNF.nnf} (antecipado R$ ${antBase.toFixed(2)} - NF R$ ${valorTotalNFe.toFixed(2)})`,
           userName || null]);
        creditoGeradoValor = excedentePago;
      }
    } else if (cancelaAntecipado) {
      let cancelados = 0;
      for (const t of antTitulos) {
        if (t.creditoId || t.disponivel < t.valor_pgto - 0.005) continue; // atende outra NF
        await client.query(
          `UPDATE dbpgto SET cancel = 'S', obs = left(COALESCE(obs,'') || $2, 500) WHERE cod_pgto = $1`,
          [t.cod_pgto, ` [CANCELADO: antecipado nao pago substituido pela cobranca do XML da NFe ${notaNF.nnf}]`]);
        await client.query(`UPDATE ordem_pagamento_conta SET status = 'CANCELADO' WHERE cod_pgto = $1 AND numero_parcela = 0`, [t.cod_pgto]);
        await client.query(`UPDATE ordem_pagamento_parcelas SET status = 'CANCELADO' WHERE orc_id = $1 AND numero_parcela = 0`, [t.orc_id]);
        cancelados++;
      }
      console.log(`🚫 ${cancelados} antecipado(s) NAO pago(s) cancelado(s) (A >= NF). Cobranca gerada pelas parcelas.`);
    }

    // 8.2 Adiantamento ↔ nota (roteiro etapas 3/4/5, decisão D5): o adiantamento continua título
    // próprio; ganha o nº da NF no campo NF (várias por "/"), tem_nota='S', a observação
    // "NF … associada em …: R$ … atendido" e o vínculo em dbpgto_nota (histórico/modal).
    // Atendido = o que foi abatido da NF (quitou: o valor da NF; entrada: o antecipado
    // considerado), distribuído pelos títulos (primeiro os com crédito) sem passar do
    // disponível de cada um. Do título PAGO, a parte atendida CONSOME o crédito.
    if (!cancelaAntecipado && antTitulos.length > 0) {
      let aDistribuir = Math.round((quitaPorAntecipado ? valorTotalNFe : valorAntecipado) * 100) / 100;
      const usados = new Set<string>();
      for (const t of antTitulos) {
        if (aDistribuir <= 0.005) break;
        const parte = Math.round(Math.min(t.disponivel, aDistribuir) * 100) / 100;
        if (parte <= 0.005) continue;
        if (t.creditoId) {
          const doCredito = Math.round(Math.min(t.creditoDisponivel, parte) * 100) / 100;
          await consumirCreditoNaNota(client, t.creditoId, nfeId, notaNF.nnf, doCredito, userName);
          t.creditoUsado = doCredito;
        }
        await associarNotaAoAdiantamento(client, t.cod_pgto, notaNF, parte, userName);
        t.atendido = parte;
        usados.add(t.cod_pgto);
        aDistribuir = Math.round((aDistribuir - parte) * 100) / 100;
      }
      // reconfiguração: título que deixou de atender esta NF perde o vínculo
      const antigos = await client.query(
        `DELETE FROM dbpgto_nota WHERE codnfe_ent = $1 AND tipo = 'ADIANTAMENTO' AND NOT (cod_pgto = ANY($2::varchar[]))
         RETURNING cod_pgto`, [nfeId, Array.from(usados)]);
      for (const r of antigos.rows) {
        await atualizarNfDoTitulo(client, r.cod_pgto);
        await client.query(
          `UPDATE dbpgto SET nro_nf = NULL, tem_nota = 'N'
            WHERE cod_pgto = $1 AND NOT EXISTS (SELECT 1 FROM dbpgto_nota WHERE cod_pgto = $1)`, [r.cod_pgto]);
      }
      console.log(`🔗 Adiantamento(s) vinculado(s) à NF ${notaNF.nnf}: ${Array.from(usados).join(', ') || 'nenhum'}`);
    }
    // crédito que continua com o fornecedor depois desta NF (para a mensagem/histórico)
    if (algumComCredito) {
      const ids = antTitulos.filter((a) => a.creditoId).map((a) => a.creditoId);
      const rc = await client.query(
        `SELECT COALESCE(SUM(valor_disponivel),0) AS v FROM credor_credito WHERE id = ANY($1::bigint[])`, [ids]);
      creditoGeradoValor = Math.round(Number(rc.rows[0]?.v || 0) * 100) / 100;
    }

    // 9. Marcar NFe como com pagamento configurado
    // (Campo pode não existir ainda, então fazer UPDATE sem validação)
    await client.query(`
      UPDATE dbnfe_ent
      SET pagamento_configurado = true
      WHERE codnfe_ent = $1
    `, [nfeId]);

    // 10. Atualizar ordens com pagamento configurado
    // Para importações, NÃO marcar as ordens - o pagamento é da fatura/NFe, não da OC
    const nfeNatopResult = await client.query(
      `SELECT natop FROM dbnfe_ent WHERE codnfe_ent = $1`, [nfeId]
    );
    const isImportacao = nfeNatopResult.rows[0]?.natop === 'ENTRADA_IMPORTACAO';

    if (!isImportacao && ordensComValores.length > 0) {
      console.log(`Atualizando ${ordensComValores.length} ordens de compra...`);
      const updateOrdensPromises = ordensComValores.map(ordem =>
        client.query(`
          UPDATE cmp_ordem_compra
          SET
            orc_pagamento_configurado = true,
            orc_banco = $2,
            orc_tipo_documento = $3
          WHERE orc_id = $1
        `, [ordem.orcId, banco, tipoDocumento])
      );
      await Promise.all(updateOrdensPromises);
      console.log(`${ordensComValores.length} ordem(ns) atualizada(s) com pagamento configurado`);
    } else if (isImportacao) {
      console.log(`NFe de importacao - ordens NAO marcadas como pagamento configurado`);
    }

    // 11. Registrar historico de configuracao de pagamento — SEMPRE, com o que foi
    // feito com o antecipado (mantido / cancelado / quitou a NF) e cada parcela criada.
    {
      const quem = usuarioDoHistorico(req, userId, userName);
      const acaoAntecipado = antTitulos.length === 0
        ? 'SEM_ANTECIPADO'
        : quitaPorAntecipado
        ? 'QUITOU_NF'
        : cancelaAntecipado
        ? 'CANCELADO'
        : 'MANTIDO_COMO_ENTRADA';
      const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const partes: string[] = [];
      if (acaoAntecipado === 'CANCELADO') partes.push(`antecipado não pago de R$ ${fmt(antBase)} cancelado`);
      else if (acaoAntecipado === 'QUITOU_NF') partes.push(`NF quitada pelo antecipado pago de R$ ${fmt(antBase)}${creditoGeradoValor > 0 ? ` (fica crédito de R$ ${fmt(creditoGeradoValor)})` : ''}`);
      else if (acaoAntecipado === 'MANTIDO_COMO_ENTRADA') partes.push(`antecipado de R$ ${fmt(antBase)} mantido como entrada`);
      partes.push(`${parcelasCriadas} parcela(s) de cobrança${parcelasCriadas ? ` (R$ ${fmt(valorTotalCriado)})` : ''}`);
      await registrarHistoricoNfe(client, {
        codNfeEnt: parseInt(nfeId),
        tipoAcao: 'CONFIG_PAGAMENTO',
        previousStatus: nfe.exec || 'C',
        newStatus: nfe.exec || 'C',
        userId: quem.userId,
        userName: quem.userName,
        comments: {
          tipo: 'CONFIG_PAGAMENTO',
          descricao: `Pagamento configurado: ${partes.join('; ')}`,
          banco,
          tipoDocumento,
          valorNF: valorTotalNFe,
          parcelas: parcelasCriadas,
          valorTotal: valorTotalCriado,
          parcelasDetalhe,
          antecipado: {
            acao: acaoAntecipado,
            valor: antBase,
            pago: antPago,
            creditoGerado: creditoGeradoValor,
            titulos: antTitulos.map((t) => ({
              cod_pgto: t.cod_pgto,
              orc_id: t.orc_id,
              valor: t.valor_pgto,
              pago: t.valor_pago,
              nro_dup: t.nro_dup,
              atendido: t.atendido,
              creditoUsado: t.creditoUsado,
            })),
          },
        }
      });
      console.log(`✅ Historico registrado para usuario ${quem.userName}`);
    }

    // Commit da transacao
    await client.query('COMMIT');

    console.log(`\n✅ PAGAMENTO CONFIGURADO COM SUCESSO!`);
    console.log(`   Parcelas criadas: ${parcelasCriadas}`);
    console.log(`   Valor total criado: R$ ${valorTotalCriado.toFixed(2)}`);
    console.log(`   Parcela 0 (antecipado): JÁ EXISTIA, não foi criada novamente`);
    console.log(`========================================\n`);

    const msgExc = quitaPorAntecipado
      ? ` NFe quitada pelo antecipado.${creditoGeradoValor > 0 ? ` R$ ${creditoGeradoValor.toFixed(2)} continua como crédito do fornecedor.` : ''}`
      : cancelaAntecipado
      ? ` ${antTitulos.length} antecipado(s) não pago(s) cancelado(s); cobrança gerada pela NFe.`
      : '';
    return res.status(200).json({
      success: true,
      message: `Pagamento da NFe configurado com sucesso! ${parcelasCriadas} parcela(s) criada(s).${msgExc}`,
      parcelasCriadas,
      valorTotal: valorTotalCriado,
      quitadaPorAntecipado: quitaPorAntecipado,
      antecipadosCancelados: cancelaAntecipado ? antTitulos.length : 0,
      creditoGerado: creditoGeradoValor,
    });

  } catch (error: any) {
    console.error('❌ Erro ao configurar pagamento da NFe:', error);

    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao fazer rollback:', rollbackError);
      }
    }

    return res.status(500).json({
      error: 'Erro ao configurar pagamento da NFe',
      details: error.message || 'Erro desconhecido'
    } as any);

  } finally {
    if (client) {
      client.release();
    }
  }
}
