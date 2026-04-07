import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { recalcularPrecosProduto, DadosProduto } from '@/lib/calcularPrecos';

interface ItemEditado {
  id?: string;
  produto_cod: string;
  preco_unitario: number;
  preco_total: number;
  unidade_venda?: string; // UN, CX, KT, etc
}

interface ConfirmarPrecoRequest {
  observacao?: string;
  atualizarPrecoVenda?: boolean;
  itensEditados?: ItemEditado[];
}

interface ConfirmarPrecoResponse {
  success: boolean;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmarPrecoResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { observacao, atualizarPrecoVenda, itensEditados }: ConfirmarPrecoRequest = req.body;

  if (!id) {
    return res.status(400).json({
      error: 'ID da entrada é obrigatório'
    });
  }

  // Criar mapa de preços editados para lookup rápido
  const precosEditados = new Map<string, number>();
  const unidadesEditadas = new Map<string, string>();
  if (itensEditados && itensEditados.length > 0) {
    itensEditados.forEach(item => {
      precosEditados.set(item.produto_cod, item.preco_unitario);
      if (item.unidade_venda) {
        unidadesEditadas.set(item.produto_cod, item.unidade_venda);
      }
    });
    console.log(`Usando preços editados para ${precosEditados.size} itens`);
    console.log(`Usando unidades editadas para ${unidadesEditadas.size} itens`);
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || cookies.filial || 'MANAUS';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Iniciar transação
    await client.query('BEGIN');

    // Verificar se entrada existe e está no status correto
    const entradaResult = await client.query(`
      SELECT id, numero_entrada, status, tipo_operacao
      FROM entradas_estoque
      WHERE id = $1
    `, [id]);

    if (entradaResult.rows.length === 0) {
      throw new Error('Entrada não encontrada');
    }

    const entrada = entradaResult.rows[0];

    if (entrada.status !== 'PENDENTE') {
      throw new Error(`Não é possível confirmar preço. Status atual: ${entrada.status}. Esperado: PENDENTE`);
    }

    // Buscar itens da entrada
    const itensResult = await client.query(`
      SELECT
        ei.produto_cod,
        ei.quantidade,
        ei.valor_unitario as custo_entrada
      FROM entrada_itens ei
      WHERE ei.entrada_id = $1
    `, [id]);

    const isImportacao = entrada.tipo_operacao === 'ENTRADA_IMPORTACAO';

    console.log(`Processando ${itensResult.rows.length} itens para cálculo de custo médio${isImportacao ? ' (IMPORTAÇÃO)' : ''}`);

    // Dados de importação (carregados uma vez se necessário)
    let txDolarMedioImportacao = 0;
    const custosDolarImportacao = new Map<string, number>();

    if (isImportacao) {
      // Buscar DI associada via codent
      const diResult = await client.query(`
        SELECT ie.id_importacao
        FROM db_manaus.dbent_importacao_entrada ie
        WHERE ie.codent = $1
        LIMIT 1
      `, [entrada.numero_entrada]);

      if (diResult.rows.length > 0) {
        const importacaoId = diResult.rows[0].id_importacao;

        // Calcular taxa_dolar_medio dos contratos
        const contratosResult = await client.query(`
          SELECT taxa_dolar, vl_merc_dolar
          FROM db_manaus.dbent_importacao_contratos
          WHERE id_importacao = $1
        `, [importacaoId]);

        if (contratosResult.rows.length > 0) {
          let sumTaxaVlMerc = 0;
          let sumVlMerc = 0;
          for (const c of contratosResult.rows) {
            const taxa = parseFloat(String(c.taxa_dolar || 0));
            const vlMerc = parseFloat(String(c.vl_merc_dolar || 0));
            sumTaxaVlMerc += taxa * vlMerc;
            sumVlMerc += vlMerc;
          }
          if (sumVlMerc > 0) {
            txDolarMedioImportacao = sumTaxaVlMerc / sumVlMerc;
          }
        }

        // Buscar custo_unit_dolar de cada item da importação
        const itensImportResult = await client.query(`
          SELECT codprod, custo_unit_dolar
          FROM db_manaus.dbent_importacao_it_ent
          WHERE id_importacao = $1 AND custo_unit_dolar IS NOT NULL
        `, [importacaoId]);

        for (const row of itensImportResult.rows) {
          custosDolarImportacao.set(row.codprod, parseFloat(String(row.custo_unit_dolar)));
        }

        console.log(`Importação ${importacaoId}: txDolarMedio=${txDolarMedioImportacao.toFixed(4)}, ${custosDolarImportacao.size} itens com custo`);
      }
    }

    // Para cada item, calcular custo médio e atualizar
    for (const item of itensResult.rows) {
      const produtoCod = item.produto_cod;
      const qtdEntrada = parseFloat(item.quantidade);

      // Buscar estoque atual, custo atual, margens e dados de dolar do produto
      const produtoResult = await client.query(`
        SELECT
          qtest,
          prcustoatual as custo_atual,
          prcompra,
          dolar,
          txdolarcompra
        FROM dbprod
        WHERE codprod = $1
      `, [produtoCod]);

      if (produtoResult.rows.length === 0) {
        console.warn(`Produto ${produtoCod} não encontrado no dbprod, pulando...`);
        continue;
      }

      const produto = produtoResult.rows[0];
      const estoqueAtual = parseFloat(produto.qtest || 0);
      const custoAtual = parseFloat(produto.custo_atual || 0);

      if (isImportacao) {
        // --- BRANCH IMPORTAÇÃO ---
        const custoUnitDolar = custosDolarImportacao.get(produtoCod) || parseFloat(item.custo_entrada);
        const custoUnitBRL = custoUnitDolar * txDolarMedioImportacao;

        // Custo médio ponderado com estoque existente (em BRL)
        let novoCusto: number;
        if (estoqueAtual + qtdEntrada === 0) {
          novoCusto = custoUnitBRL;
        } else {
          novoCusto = ((estoqueAtual * custoAtual) + (qtdEntrada * custoUnitBRL)) / (estoqueAtual + qtdEntrada);
        }

        console.log(`Produto ${produtoCod} (importação):`, {
          custoUnitDolar,
          txDolarMedio: txDolarMedioImportacao,
          custoUnitBRL: custoUnitBRL.toFixed(2),
          novoCusto: novoCusto.toFixed(2),
        });

        // Atualizar dbprod com dados de importação
        await client.query(`
          UPDATE dbprod
          SET
            prcompra = $1,
            dolar = 'S',
            txdolarcompra = $2,
            prcustoatual = $3,
            dtprcustoatual = CURRENT_DATE
          WHERE codprod = $4
        `, [custoUnitDolar, txDolarMedioImportacao, novoCusto, produtoCod]);

        // Atualizar entrada_itens com valor em BRL
        await client.query(`
          UPDATE entrada_itens
          SET valor_unitario = $1,
              valor_total = $1 * quantidade
          WHERE entrada_id = $2 AND produto_cod = $3
        `, [custoUnitBRL, id, produtoCod]);

        // Recalcular preços de venda (já suporta dolar='S')
        const dadosProduto: DadosProduto = {
          codprod: produtoCod,
          prcustoatual: novoCusto,
          prcompra: custoUnitDolar,
          dolar: 'S',
          txdolarcompra: txDolarMedioImportacao,
        };
        await recalcularPrecosProduto(client, dadosProduto);
      } else {
        // --- BRANCH PADRÃO (NFe) ---
        // Usar preço editado se disponível, senão usar preço da nota
        const custoEntrada = precosEditados.has(produtoCod)
          ? precosEditados.get(produtoCod)!
          : parseFloat(item.custo_entrada);

        // Calcular custo médio ponderado
        let novoCusto: number;
        if (estoqueAtual + qtdEntrada === 0) {
          novoCusto = custoEntrada;
        } else {
          novoCusto = ((estoqueAtual * custoAtual) + (qtdEntrada * custoEntrada)) / (estoqueAtual + qtdEntrada);
        }

        console.log(`Produto ${produtoCod}:`, {
          estoqueAtual,
          custoAtual,
          qtdEntrada,
          custoEntrada,
          novoCusto: novoCusto.toFixed(2)
        });

        // Atualizar custo no dbprod
        await client.query(`
          UPDATE dbprod
          SET
            prcustoatual = $1,
            dtprcustoatual = CURRENT_DATE
          WHERE codprod = $2
        `, [novoCusto, produtoCod]);

        // Atualizar unidade de medida se especificada
        if (unidadesEditadas.has(produtoCod)) {
          const novaUnidade = unidadesEditadas.get(produtoCod);
          console.log(`Atualizando unidade de medida do produto ${produtoCod} para ${novaUnidade}`);
          await client.query(`
            UPDATE dbprod
            SET unimed = $1
            WHERE codprod = $2
          `, [novaUnidade, produtoCod]);
        }

        // Se solicitado, recalcular preços de venda usando margens da DBFORMACAOPRVENDA
        if (atualizarPrecoVenda) {
          const dadosProduto: DadosProduto = {
            codprod: produtoCod,
            prcustoatual: novoCusto,
            prcompra: parseFloat(produto.prcompra || 0),
            dolar: produto.dolar || 'N',
            txdolarcompra: parseFloat(produto.txdolarcompra || 0),
          };

          await recalcularPrecosProduto(client, dadosProduto);
        }
      }
    }

    // Se houve preços editados, atualizar os itens da entrada
    if (precosEditados.size > 0) {
      for (const [prodCod, precoUnit] of precosEditados) {
        await client.query(`
          UPDATE entrada_itens
          SET valor_unitario = $1,
              valor_total = $1 * quantidade
          WHERE entrada_id = $2 AND produto_cod = $3
        `, [precoUnit, id, prodCod]);
      }
      console.log(`Atualizados ${precosEditados.size} itens com preços editados`);
    }

    // Verificar se tem romaneio
    const romaneioResult = await client.query(`
      SELECT COUNT(*) as total
      FROM dbitent_armazem
      WHERE codent = $1
    `, [entrada.numero_entrada]);

    let temRomaneio = parseInt(romaneioResult.rows[0].total) > 0;
    let tipoRomaneio = 'manual';

    // Se não tem romaneio, criar automaticamente com armazém padrão
    if (!temRomaneio) {
      const ARMAZEM_PADRAO = 1003;
      tipoRomaneio = 'automático';
      console.log(`Criando romaneio automático com armazém padrão ${ARMAZEM_PADRAO}`);

      // Buscar itens da entrada para criar romaneio
      const itensRomaneio = await client.query(`
        SELECT ei.produto_cod, ei.quantidade, ei.req_id
        FROM entrada_itens ei
        WHERE ei.entrada_id = $1
      `, [id]);

      for (const item of itensRomaneio.rows) {
        const qtd = parseFloat(item.quantidade);
        await client.query(`
          INSERT INTO dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [entrada.numero_entrada, item.produto_cod, item.req_id, ARMAZEM_PADRAO, qtd]);
      }

      console.log(`Romaneio automático criado: ${itensRomaneio.rows.length} itens → armazém ${ARMAZEM_PADRAO}`);
    }

    // Atualizar status direto para AGUARDANDO_RECEBIMENTO (eliminando etapa confirmar-estoque)
    const obsCompleta = precosEditados.size > 0
      ? `${observacao || ''} [Preços editados: ${precosEditados.size} item(ns)]`.trim()
      : (observacao || '');

    await client.query(`
      UPDATE entradas_estoque
      SET
        status = 'AGUARDANDO_RECEBIMENTO',
        data_confirmacao_preco = CURRENT_TIMESTAMP,
        data_confirmacao_estoque = CURRENT_TIMESTAMP,
        observacao_preco = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [obsCompleta, id]);

    // Log da operação
    const logObs = precosEditados.size > 0
      ? `Preço confirmado e liberado para recebimento (${precosEditados.size} item(ns) com preço editado, romaneio ${tipoRomaneio})`
      : `Preço confirmado e liberado para recebimento (romaneio ${tipoRomaneio})`;

    await client.query(`
      INSERT INTO entrada_operacoes_log (
        entrada_id,
        operacao,
        status_anterior,
        status_novo,
        observacao,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      id,
      'CONFIRMAR_PRECO',
      'PENDENTE',
      'AGUARDANDO_RECEBIMENTO',
      logObs
    ]);

    // Commit da transação
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: tipoRomaneio === 'manual'
        ? `Preço confirmado! Entrada ${entrada.numero_entrada} liberada para recebimento.`
        : `Preço confirmado! Entrada ${entrada.numero_entrada} liberada para recebimento (romaneio automático criado).`
    });
  } catch (err) {
    // Rollback da transação em caso de erro
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('Erro ao confirmar preço:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Falha ao confirmar preço.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}