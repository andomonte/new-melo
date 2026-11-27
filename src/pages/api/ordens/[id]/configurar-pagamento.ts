import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';
import { z } from 'zod';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';
import {
  COF_ADIANTAMENTO,
  codigoBanco,
  contaFinanceiraFornecedor,
  duplicataOrdem,
  fornecedorEhExterior,
  MSG_ANTECIPADO_EXTERIOR,
  proximoCodPgto,
  ufDaFilial,
} from '@/lib/compras/tituloCompras';

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
      FROM cmp_ordem_compra orc
      LEFT JOIN cmp_requisicao r ON orc.orc_req_id = r.req_id AND orc.orc_req_versao = r.req_versao
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
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

    // Exterior não tem pagamento antecipado (entrada / parcela 0)
    const temAntecipado = (valorEntrada ?? 0) > 0 || parcelas.some((p) => p.numero_parcela === 0);
    if (temAntecipado && (await fornecedorEhExterior(client, ordemCompra.for_cod))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: MSG_ANTECIPADO_EXTERIOR });
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
      `UPDATE cmp_ordem_compra
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
      `SELECT cod_pgto FROM ordem_pagamento_conta WHERE orc_id = $1`,
      [orcId]
    );

    // 3.2. Deletar pagamentos em dbpgto
    for (const row of pgtoAntigos.rows) {
      await client.query(
        `DELETE FROM dbpgto WHERE cod_pgto = $1`,
        [row.cod_pgto]
      );
    }

    // 3.3. Deletar ligações ordem_pagamento_conta
    await client.query(
      `DELETE FROM ordem_pagamento_conta WHERE orc_id = $1`,
      [orcId]
    );

    // 3.4. Deletar parcelas antigas
    await client.query(
      `DELETE FROM ordem_pagamento_parcelas WHERE orc_id = $1`,
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
        `INSERT INTO ordem_pagamento_parcelas
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
    // Roteiro 24/11/2026 (docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md):
    //  - conta financeira: antecipado (parcela 0) = 4 ADIANTAMENTO A FORNECEDOR; demais pela
    //    regra do fornecedor (D1). Antes: MAX(pag_cof_id)+1 → conta errada/inexistente.
    //  - cod_pgto com trava; duplicata OC{nº da ordem}/{parcela}/{total}.
    //  - banco pelo código (dbbanco); conta bancária/centro de custo em branco (o Financeiro
    //    escolhe ao pagar) — antes iam fixos '0001' (DESC.COMISSAO / EXTRA).
    const ordemCompraJson = JSON.stringify([orcId]);
    const parcelasOrdenadas = [...todasParcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
    const totalTitulos = parcelasOrdenadas.length;
    const bancoCodigo = await codigoBanco(client, banco);
    const cofFornecedor = await contaFinanceiraFornecedor(client, ordemCompra.for_cod, { ufFilial: ufDaFilial(filial) });

    for (const [idx, parcela] of parcelasOrdenadas.entries()) {
      const codPgto = await proximoCodPgto(client);
      const pagCofId = parcela.numero_parcela === 0 ? COF_ADIANTAMENTO : cofFornecedor;

      // Duplicata: OC{nº da ordem}/{posição}/{total} — antecipado único = OC{orc}/1/1;
      // entrada + 2 parcelas = /1/3 (entrada), /2/3, /3/3.
      const nroDup = duplicataOrdem(orcId, idx + 1, totalTitulos);

      // Inserir em dbpgto (conta a pagar)
      await client.query(
        `INSERT INTO dbpgto
         (cod_pgto, cod_credor, cod_conta, cod_ccusto, dt_venc, dt_emissao,
          valor_pgto, valor_pago, nro_nf, obs, tem_nota, tipo, paga, cancel,
          codcomprador, valor_juros, pag_cof_id, banco, ordem_compra, nro_dup)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          codPgto,                                                     // cod_pgto (9 dígitos, com trava)
          ordemCompra.for_cod,                                        // cod_credor
          null,                                                       // cod_conta (Financeiro escolhe ao pagar)
          null,                                                       // cod_ccusto
          parcela.data_vencimento,                                    // dt_venc
          new Date(),                                                 // dt_emissao
          parcela.valor_parcela,                                      // valor_pgto
          0,                                                          // valor_pago (ainda não pago)
          null,                                                       // nro_nf (não tem nota ainda)
          null,                                                       // obs: exclusiva do Financeiro (ordem em ordem_compra e na duplicata)
          'N',                                                        // tem_nota
          'F',                                                        // tipo (F = Fornecedor)
          'N',                                                        // paga (ainda não)
          'N',                                                        // cancel (não cancelado)
          ordemCompra.req_codcomprador || '000',                      // codcomprador (da requisição)
          0,                                                          // valor_juros
          pagCofId,                                                   // pag_cof_id (conta financeira)
          bancoCodigo,                                                // banco (código dbbanco)
          ordemCompraJson,                                            // ordem_compra (JSON com lista de ordens)
          nroDup                                                      // nro_dup OC{orc_id}/{parcela}/{total}
        ]
      );

      // Inserir em ordem_pagamento_conta (ligação ordem x conta a pagar)
      await client.query(
        `INSERT INTO ordem_pagamento_conta
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
