import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { z } from 'zod';
import { registrarHistoricoNfe } from '@/lib/nfe/historicoNfeHelper';

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
  parcelas: z.array(parcelaSchema).min(1, "Pelo menos uma parcela é necessária"),
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
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfigurarPagamentoResponse | { error: string }>
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
    await client.query('SET search_path TO db_manaus');

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
          INNER JOIN dbcredor c ON REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = REPLACE(REPLACE(REPLACE(emit.cpf_cnpj, '.', ''), '-', ''), '/', '')
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

    // 4. Buscar pagamento antecipado (parcela 0) se existir
    let valorAntecipado = 0;

    // Se foi passado valor antecipado manual, usar diretamente
    if (valorAntecipadoManual && valorAntecipadoManual > 0) {
      valorAntecipado = valorAntecipadoManual;
      console.log(`💰 Valor antecipado (manual): R$ ${valorAntecipado.toFixed(2)}`);
    } else if (ordensAssociadas && ordensAssociadas.length > 0) {
      // Buscar antecipado das ordens manuais
      const pgtoAntecipadoResult = await client.query(`
        SELECT COALESCE(SUM(p.valor_pgto), 0) as valor_antecipado
        FROM dbpgto p
        INNER JOIN ordem_pagamento_conta opc ON p.cod_pgto = opc.cod_pgto
        WHERE opc.orc_id = ANY($1::bigint[])
          AND opc.numero_parcela = 0
          AND p.paga = 'N'
      `, [ordensAssociadas]);
      valorAntecipado = parseFloat(pgtoAntecipadoResult.rows[0]?.valor_antecipado || 0);
    } else {
      // IMPORTANTE: Usar DISTINCT nas ordens para evitar multiplicação
      // (nfe_item_pedido_associacao tem múltiplas linhas por ordem - uma para cada item)
      const pgtoAntecipadoResult = await client.query(`
        SELECT COALESCE(SUM(p.valor_pgto), 0) as valor_antecipado
        FROM dbpgto p
        INNER JOIN ordem_pagamento_conta opc ON p.cod_pgto = opc.cod_pgto
        WHERE opc.orc_id IN (
          SELECT DISTINCT nipa.req_id::bigint
          FROM nfe_item_pedido_associacao nipa
          WHERE nipa.nfe_id = $1
        )
          AND opc.numero_parcela = 0
          AND p.paga = 'N'
      `, [nfeId]);
      valorAntecipado = parseFloat(pgtoAntecipadoResult.rows[0]?.valor_antecipado || 0);
    }

    // 5. Validar soma das parcelas + antecipado = valor NFe (tolerância de R$ 0.10)
    const somaParcelasRecebidas = parcelas.reduce((sum, p) => sum + p.valor_parcela, 0);
    const totalComAntecipado = somaParcelasRecebidas + valorAntecipado;
    const diferenca = Math.abs(totalComAntecipado - valorTotalNFe);

    console.log(`\n💰 Validação de valores:`);
    console.log(`   Parcelas recebidas: R$ ${somaParcelasRecebidas.toFixed(2)}`);
    console.log(`   Antecipado (parcela 0): R$ ${valorAntecipado.toFixed(2)}`);
    console.log(`   Total (parcelas + antecipado): R$ ${totalComAntecipado.toFixed(2)}`);
    console.log(`   Valor da NFe: R$ ${valorTotalNFe.toFixed(2)}`);
    console.log(`   Diferença: R$ ${diferenca.toFixed(2)}`);

    if (diferenca > 0.10) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `A soma das parcelas (R$ ${somaParcelasRecebidas.toFixed(2)}) + antecipado (R$ ${valorAntecipado.toFixed(2)}) = R$ ${totalComAntecipado.toFixed(2)} difere do valor da NFe (R$ ${valorTotalNFe.toFixed(2)}). Diferença: R$ ${diferenca.toFixed(2)}`
      });
    }

    console.log(`✅ Validação de valores OK!\n`);

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

      // Buscar TODOS os cod_pgto de todas as ordens em uma única query
      const pgtoAntigosResult = await client.query(`
        SELECT cod_pgto, orc_id FROM ordem_pagamento_conta
        WHERE orc_id IN (${placeholders}) AND numero_parcela > 0
      `, orcIds);

      const codPgtosParaDeletar = pgtoAntigosResult.rows.map(r => r.cod_pgto);

      // Deletar de dbpgto em batch (se houver cod_pgtos)
      if (codPgtosParaDeletar.length > 0) {
        const pgtoPlaceholders = codPgtosParaDeletar.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`DELETE FROM dbpgto WHERE cod_pgto IN (${pgtoPlaceholders})`, codPgtosParaDeletar);
      }

      // Deletar de ordem_pagamento_conta em batch
      await client.query(`
        DELETE FROM ordem_pagamento_conta WHERE orc_id IN (${placeholders}) AND numero_parcela > 0
      `, orcIds);

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

    // 7. Buscar próximo código de pagamento
    const lastPgtoResult = await client.query(`
      SELECT COALESCE(MAX(CAST(cod_pgto AS INTEGER)), 0) + 1 as proximo_cod,
             COALESCE(MAX(pag_cof_id), 0) + 1 as proximo_pag_cof_id
      FROM dbpgto
      WHERE cod_pgto ~ '^[0-9]+$'
    `);

    let proximoCodPgto = lastPgtoResult.rows[0]?.proximo_cod || 1;
    let proximoPagCofId = lastPgtoResult.rows[0]?.proximo_pag_cof_id || 1;

    console.log(`🔢 Próximo código de pagamento: ${proximoCodPgto}`);
    console.log(`🔢 Próximo pag_cof_id: ${proximoPagCofId}\n`);

    // 8. Criar registros em dbpgto APENAS para parcelas > 0
    // Parcela 0 (ANTECIPADO) JÁ EXISTE - foi criada no pagamento antecipado da ordem
    let parcelasCriadas = 0;
    let valorTotalCriado = 0;

    const parcelasNormais = parcelas.filter(p => p.numero_parcela > 0);
    const totalParcelasNormais = parcelasNormais.length;

    console.log(`📝 Criando ${parcelasNormais.length} parcela(s) em dbpgto (parcela 0 já existe)\n`);

    // IMPORTANTE: Usar o MESMO prefixo base para todas as parcelas
    // Isso permite que a listagem de contas a pagar identifique corretamente "X de Y"
    const codPgtoBase = proximoCodPgto.toString();

    for (const parcela of parcelasNormais) {
      // cod_pgto com 9 dígitos (zeros à esquerda) - igual ao pagamento antecipado
      const codPgto = proximoCodPgto.toString().padStart(9, '0');

      // Label da parcela
      const labelParcela = `Parcela ${parcela.numero_parcela}/${totalParcelasNormais} - ${parcela.tipo_documento}`;

      // Gerar nro_dup no formato OC{base}/{parcela}
      // Usar o MESMO prefixo (codPgtoBase) para todas as parcelas do mesmo pagamento
      // parcela COM zeros (2 dígitos)
      const nroDup = `OC${codPgtoBase}/${String(parcela.numero_parcela).padStart(2, '0')}`;

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
        nfeId,                                                      // nro_nf
        nroDup,                                                     // nro_dup (formato: OC{orc_id}/{parcela})
        proximoPagCofId,                                            // pag_cof_id
        banco,                                                      // banco
        ordemCompraJson,                                            // ordem_compra (JSON com lista de ordens)
        xmlNf || null                                               // xml_nf
      ]);

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

      parcelasCriadas++;
      valorTotalCriado += parcela.valor_parcela;
      proximoCodPgto++;
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

    // 11. Registrar historico de configuracao de pagamento
    if (userId && userName) {
      await registrarHistoricoNfe(client, {
        codNfeEnt: parseInt(nfeId),
        tipoAcao: 'CONFIG_PAGAMENTO',
        previousStatus: nfe.exec || 'C',
        newStatus: nfe.exec || 'C',
        userId,
        userName,
        comments: {
          tipo: 'CONFIG_PAGAMENTO',
          descricao: `Pagamento configurado: ${parcelasCriadas} parcela(s)`,
          banco,
          tipoDocumento,
          parcelas: parcelasCriadas,
          valorTotal: valorTotalCriado
        }
      });
      console.log(`✅ Historico registrado para usuario ${userName}`);
    }

    // Commit da transacao
    await client.query('COMMIT');

    console.log(`\n✅ PAGAMENTO CONFIGURADO COM SUCESSO!`);
    console.log(`   Parcelas criadas: ${parcelasCriadas}`);
    console.log(`   Valor total criado: R$ ${valorTotalCriado.toFixed(2)}`);
    console.log(`   Parcela 0 (antecipado): JÁ EXISTIA, não foi criada novamente`);
    console.log(`========================================\n`);

    return res.status(200).json({
      success: true,
      message: `Pagamento da NFe configurado com sucesso! ${parcelasCriadas} parcela(s) criada(s).`,
      parcelasCriadas,
      valorTotal: valorTotalCriado
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
