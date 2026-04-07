import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';
import { z } from 'zod';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';

const parcelaSchema = z.object({
  numero_parcela: z.number(),
  dias: z.number(),
  data_vencimento: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Data de vencimento inválida",
  }),
  valor_parcela: z.number().positive(),
});

const bodySchema = z.object({
  banco: z.string().min(1, "Banco é obrigatório"),
  tipoDocumento: z.string().min(1, "Tipo de documento é obrigatório"),
  valorEntrada: z.number().min(0).optional(),
  parcelas: z.array(parcelaSchema).min(1, "Pelo menos uma parcela é necessária"),
  userId: z.string().optional(),
  userName: z.string().optional(),
});

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { id } = req.query;
  const orcId = parseInt(id as string, 10);

  if (isNaN(orcId)) {
    return res.status(400).json({ error: 'ID da ordem de compra inválido' });
  }

  const validation = bodySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados inválidos', details: validation.error.flatten() });
  }

  const { banco, tipoDocumento, valorEntrada = 0, parcelas, userId, userName } = validation.data;
  const userIdFinal = userId || 'SISTEMA';
  const userNameFinal = userName || 'Sistema';

  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar a Ordem de Compra e o Fornecedor (através da requisição)
    const ordemResult = await client.query(
      `SELECT
        orc.orc_id,
        orc.orc_valor_total,
        orc.orc_req_id,
        orc.orc_req_versao,
        r.req_cod_credor,
        r.req_codcomprador,
        f.cod_credor as for_cod,
        f.cpf_cgc as fornecedor_cnpj
      FROM db_manaus.cmp_ordem_compra orc
      LEFT JOIN db_manaus.cmp_requisicao r ON orc.orc_req_id = r.req_id AND orc.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      WHERE orc.orc_id = $1`,
      [orcId]
    );

    if (ordemResult.rows.length === 0) {
      throw new Error('Ordem de compra não encontrada');
    }

    const ordemCompra = ordemResult.rows[0];

    if (!ordemCompra.for_cod) {
      throw new Error('Fornecedor não encontrado para esta ordem');
    }

    // Validar apenas se o valor total das parcelas não excede o valor da ordem
    // Se parcela 0 já está incluída nas parcelas, não somar valorEntrada novamente
    const temParcela0NaValidacao = parcelas.some(p => p.numero_parcela === 0);
    const somaParcelas = parcelas.reduce((acc, p) => acc + p.valor_parcela, 0);

    // Se tem parcela 0, ela JÁ representa o valorEntrada, não somar duas vezes
    const valorTotalPago = temParcela0NaValidacao ? somaParcelas : valorEntrada + somaParcelas;
    const valorOrdem = parseFloat(ordemCompra.orc_valor_total || 0);

    console.log('=== DEBUG CONFIGURAÇÃO ===');
    console.log('Valor Entrada:', valorEntrada);
    console.log('Tem Parcela 0:', temParcela0NaValidacao);
    console.log('Soma Parcelas:', somaParcelas);
    console.log('Total Pago:', valorTotalPago);
    console.log('Valor Ordem:', valorOrdem);
    console.log('Parcelas recebidas:', parcelas.length, parcelas.map(p => ({ numero: p.numero_parcela, valor: p.valor_parcela })));

    // Permitir pagamento parcial - apenas verificar se não excede o valor da ordem
    if (valorOrdem > 0 && valorTotalPago > valorOrdem + 0.10) {
      throw new Error(`O valor total configurado (R$ ${valorTotalPago.toFixed(2)}) excede o valor da ordem (R$ ${valorOrdem.toFixed(2)}).`);
    }

    // 2. Atualizar a Ordem de Compra
    await client.query(
      `UPDATE db_manaus.cmp_ordem_compra
       SET
         orc_status = $1,
         orc_pagamento_configurado = $2,
         orc_banco = $3,
         orc_tipo_documento = $4,
         orc_valor_entrada = $5
       WHERE orc_id = $6`,
      ['A', true, banco, tipoDocumento, valorEntrada, orcId]
    );

    // 3. Deletar TODOS os registros antigos (parcelas, contas, pagamentos)
    // 3.1. Buscar códigos de pagamento existentes para deletar
    const pgtoAntigos = await client.query(
      `SELECT cod_pgto FROM db_manaus.ordem_pagamento_conta WHERE orc_id = $1`,
      [orcId]
    );

    // 3.2. Deletar pagamentos em dbpgto
    for (const row of pgtoAntigos.rows) {
      await client.query(
        `DELETE FROM db_manaus.dbpgto WHERE cod_pgto = $1`,
        [row.cod_pgto]
      );
    }

    // 3.3. Deletar ligações ordem_pagamento_conta
    await client.query(
      `DELETE FROM db_manaus.ordem_pagamento_conta WHERE orc_id = $1`,
      [orcId]
    );

    // 3.4. Deletar parcelas antigas
    await client.query(
      `DELETE FROM db_manaus.ordem_pagamento_parcelas WHERE orc_id = $1`,
      [orcId]
    );

    // 4. Preparar parcelas
    // Se parcelas já inclui parcela 0 (pagamento antecipado), usar direto
    // Senão, criar parcela 0 se valorEntrada > 0
    const todasParcelas = [];
    const temParcela0 = parcelas.some(p => p.numero_parcela === 0);

    // 4.1. Se tem entrada mas não veio parcela 0, criar automaticamente
    if (valorEntrada > 0 && !temParcela0) {
      todasParcelas.push({
        numero_parcela: 0,
        dias: 0,
        data_vencimento: new Date().toISOString().split('T')[0],
        valor_parcela: valorEntrada,
      });
    }

    // 4.2. Adicionar as parcelas recebidas
    todasParcelas.push(...parcelas);

    // 4.3. Criar as novas parcelas de pagamento
    for (const parcela of todasParcelas) {
      await client.query(
        `INSERT INTO db_manaus.ordem_pagamento_parcelas
         (orc_id, banco, tipo_documento, numero_parcela, valor_parcela, dias, data_vencimento, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orcId,
          banco,
          tipoDocumento,
          parcela.numero_parcela,
          parcela.valor_parcela,
          parcela.dias,
          parcela.data_vencimento,
          'PENDENTE'
        ]
      );
    }

    // 5. Criar registros em Contas a Pagar (dbpgto)
    // Buscar próximo código de pagamento (apenas códigos numéricos) e próximo pag_cof_id
    const lastPgtoResult = await client.query(
      `SELECT
        COALESCE(MAX(CAST(cod_pgto AS INTEGER)), 0) + 1 as proximo_cod,
        COALESCE(MAX(pag_cof_id), 0) + 1 as proximo_pag_cof_id
      FROM db_manaus.dbpgto
      WHERE cod_pgto ~ '^[0-9]+$'`
    );

    let proximoCodPgto = lastPgtoResult.rows[0]?.proximo_cod || 1;
    let proximoPagCofId = lastPgtoResult.rows[0]?.proximo_pag_cof_id || 1;

    // Calcular total de parcelas incluindo entrada
    const totalParcelas = todasParcelas.length;

    // Preparar ordem_compra como JSON (para futuro suporte a múltiplas ordens)
    const ordemCompraJson = JSON.stringify([orcId]);

    for (const parcela of todasParcelas) {
      const codPgto = proximoCodPgto.toString().padStart(9, '0'); // Padrão: 9 dígitos com zeros à esquerda (ex: 000027634)

      // Determinar label da parcela
      let labelParcela = '';
      // Contar apenas parcelas normais (excluir parcela 0 = entrada)
      const parcelasNormais = todasParcelas.filter(p => p.numero_parcela > 0).length;

      if (parcela.numero_parcela === 0) {
        // Pagamento antecipado - se é a única parcela, mostrar "1 de 1"
        if (parcelasNormais === 0) {
          labelParcela = `Pagamento Antecipado (1 de 1) - ${tipoDocumento}`;
        } else {
          labelParcela = `Pagamento Antecipado (Entrada) - ${tipoDocumento}`;
        }
      } else {
        labelParcela = `Parcela ${parcela.numero_parcela}/${parcelasNormais} - ${tipoDocumento}`;
      }

      // Gerar nro_dup no formato OC{cod_pgto}/{parcela}
      // cod_pgto SEM zeros à esquerda, parcela COM zeros (2 dígitos)
      // Para pagamento antecipado único (parcela 0 sem outras parcelas), usar 01 em vez de 00
      const codPgtoSemZeros = parseInt(codPgto, 10).toString();
      let numeroParcelaExibicao = parcela.numero_parcela;
      if (parcela.numero_parcela === 0 && parcelasNormais === 0) {
        // Pagamento antecipado único - mostrar como parcela 1
        numeroParcelaExibicao = 1;
      }
      const nroDup = `OC${codPgtoSemZeros}/${String(numeroParcelaExibicao).padStart(2, '0')}`;

      // Inserir em dbpgto (conta a pagar)
      await client.query(
        `INSERT INTO db_manaus.dbpgto
         (cod_pgto, cod_credor, cod_conta, cod_ccusto, dt_venc, dt_emissao,
          valor_pgto, valor_pago, nro_nf, obs, tem_nota, tipo, paga, cancel,
          codcomprador, valor_juros, pag_cof_id, banco, ordem_compra, nro_dup)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          codPgto,                                                     // cod_pgto (9 zeros à esquerda)
          ordemCompra.for_cod,                                        // cod_credor
          '0001',                                                     // cod_conta (padrão)
          '0001',                                                     // cod_ccusto (padrão)
          parcela.data_vencimento,                                    // dt_venc
          new Date(),                                                 // dt_emissao
          parcela.valor_parcela,                                      // valor_pgto
          0,                                                          // valor_pago (ainda não pago)
          null,                                                       // nro_nf (não tem nota ainda)
          `Pagamento ref. Ordem de Compra #${orcId} - ${labelParcela}`, // obs
          'N',                                                        // tem_nota
          'F',                                                        // tipo (F = Fornecedor)
          'N',                                                        // paga (ainda não)
          'N',                                                        // cancel (não cancelado)
          ordemCompra.req_codcomprador || '000',                      // codcomprador (da requisição)
          0,                                                          // valor_juros
          proximoPagCofId,                                            // pag_cof_id
          banco,                                                      // banco
          ordemCompraJson,                                            // ordem_compra (JSON com lista de ordens)
          nroDup                                                      // nro_dup (formato: OC{orc_id}/{parcela})
        ]
      );

      // Inserir em ordem_pagamento_conta (ligação ordem x conta a pagar)
      await client.query(
        `INSERT INTO db_manaus.ordem_pagamento_conta
         (orc_id, cod_pgto, numero_parcela, valor_parcela, data_vencimento, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orcId,
          codPgto,
          parcela.numero_parcela,
          parcela.valor_parcela,
          parcela.data_vencimento,
          'PENDENTE'
        ]
      );

      proximoCodPgto++;
    }

    // Registrar histórico da configuração de pagamento
    await registrarHistoricoOrdem(client, {
      orcId: orcId,
      previousStatus: 'A',
      newStatus: 'A',
      userId: userIdFinal,
      userName: userNameFinal,
      reason: 'Pagamento configurado',
      comments: {
        tipo: 'CONFIG_PAGAMENTO',
        banco,
        tipoDocumento,
        valor_entrada: valorEntrada,
        parcelas: todasParcelas.length,
        valor_total: valorTotalPago
      }
    });

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Configuração de pagamento salva com sucesso!' });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Erro ao salvar configuração de pagamento:", error);
    res.status(500).json({ success: false, error: error.message || 'Erro interno do servidor' });
  } finally {
    client.release();
  }
}
