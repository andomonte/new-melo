import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
    }

    try {
        const {
            page = 1,
            limit = 20,
            status, // 'pendente', 'pago', 'pago_parcial', 'cancelado'
            data_inicio,
            data_fim,
            credor, // Pode ser código ou nome
            conta,
            tipo, // 'F' ou 'T'
            cod_pgto, // ID da conta
            nro_nf, // Número da NF
            nro_dup, // Número da duplicata
            banco,
            cod_ccusto, // Centro de custo
            codcomprador,
            valor_min,
            valor_max,
            ordem_compra, // Ordem de compra
            moeda,
            nro_invoice,
            nro_contrato,
            search // Busca geral
        } = req.query;

        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

        // Construir filtros WHERE
        // FORÇAR FILTRO INTERNACIONAL
        let whereClause = ` AND p.eh_internacional = 'S'`;
        const params: any[] = [];
        let paramIndex = 1;

        const statusFilter = status as string | undefined;

        // Filtro por período de vencimento (Mantido conforme solicitado)
        if (data_inicio) {
            whereClause += ` AND p.dt_venc >= $${paramIndex}`;
            params.push(data_inicio);
            paramIndex++;
        }

        if (data_fim) {
            whereClause += ` AND p.dt_venc <= $${paramIndex}`;
            params.push(data_fim);
            paramIndex++;
        }

        // Filtro por credor (aceita código ou nome)
        if (credor) {
            whereClause += ` AND (CAST(p.cod_credor AS TEXT) LIKE $${paramIndex} OR UPPER(c.nome) LIKE UPPER($${paramIndex + 1}))`;
            params.push(`%${credor}%`);
            params.push(`%${credor}%`);
            paramIndex += 2;
        }

        // Filtro por conta
        if (conta) {
            whereClause += ` AND p.cod_conta = $${paramIndex}`;
            params.push(conta);
            paramIndex++;
        }

        // Filtro por tipo (Fornecedor ou Transporte)
        if (tipo) {
            whereClause += ` AND p.tipo = $${paramIndex}`;
            params.push(tipo);
            paramIndex++;
        }

        // Filtro por ID (suporta múltiplos IDs separados por vírgula)
        if (cod_pgto) {
            const cod_pgtoStr = Array.isArray(cod_pgto) ? cod_pgto[0] : cod_pgto;
            // Verificar se é uma lista de IDs separados por vírgula
            if (cod_pgtoStr.includes(',')) {
                const ids = cod_pgtoStr.split(',').map(id => id.trim()).filter(id => id);
                const placeholders = ids.map((_, i) => `$${paramIndex + i}`).join(', ');
                whereClause += ` AND p.cod_pgto IN (${placeholders})`;
                params.push(...ids);
                paramIndex += ids.length;
            } else {
                whereClause += ` AND CAST(p.cod_pgto AS TEXT) LIKE $${paramIndex}`;
                params.push(`%${cod_pgtoStr}%`);
                paramIndex++;
            }
        }

        // Filtro por número de NF
        if (nro_nf) {
            whereClause += ` AND p.nro_nf LIKE $${paramIndex}`;
            params.push(`%${nro_nf}%`);
            paramIndex++;
        }

        // Filtro por número de duplicata
        if (nro_dup) {
            whereClause += ` AND p.nro_dup LIKE $${paramIndex}`;
            params.push(`%${nro_dup}%`);
            paramIndex++;
        }

        // Filtro por banco
        if (banco) {
            whereClause += ` AND p.banco LIKE $${paramIndex}`;
            params.push(`%${banco}%`);
            paramIndex++;
        }

        // Filtro por ordem de compra
        if (ordem_compra) {
            whereClause += ` AND p.ordem_compra LIKE $${paramIndex}`;
            params.push(`%${ordem_compra}%`);
            paramIndex++;
        }

        // Filtro por centro de custo
        if (cod_ccusto) {
            whereClause += ` AND p.cod_ccusto = $${paramIndex}`;
            params.push(cod_ccusto);
            paramIndex++;
        }

        // Filtro por comprador (aceita código ou nome)
        if (codcomprador) {
            whereClause += ` AND (p.codcomprador LIKE $${paramIndex} OR UPPER(comp.nome) LIKE UPPER($${paramIndex + 1}))`;
            params.push(`%${codcomprador}%`);
            params.push(`%${codcomprador}%`);
            paramIndex += 2;
        }

        // Filtro por valor mínimo
        if (valor_min) {
            whereClause += ` AND p.valor_pgto >= $${paramIndex}`;
            params.push(parseFloat(valor_min as string));
            paramIndex++;
        }

        // Filtro por valor máximo
        if (valor_max) {
            whereClause += ` AND p.valor_pgto <= $${paramIndex}`;
            params.push(parseFloat(valor_max as string));
            paramIndex++;
        }

        // Filtro por moeda
        if (moeda) {
            whereClause += ` AND UPPER(p.moeda) LIKE UPPER($${paramIndex})`;
            params.push(`%${moeda}%`);
            paramIndex++;
        }

        // Filtro por número da invoice
        if (nro_invoice) {
            whereClause += ` AND p.nro_invoice LIKE $${paramIndex}`;
            params.push(`%${nro_invoice}%`);
            paramIndex++;
        }

        // Filtro por número do contrato
        if (nro_contrato) {
            whereClause += ` AND p.nro_contrato LIKE $${paramIndex}`;
            params.push(`%${nro_contrato}%`);
            paramIndex++;
        }

        // Busca geral (ID, credor, NF, duplicata, contrato, invoice)
        if (search) {
            const s = `%${search}%`;
            whereClause += ` AND (
        CAST(p.cod_pgto AS TEXT) LIKE $${paramIndex}
        OR CAST(p.cod_credor AS TEXT) LIKE $${paramIndex + 1}
        OR UPPER(c.nome) LIKE UPPER($${paramIndex + 2})
        OR p.nro_nf LIKE $${paramIndex + 3}
        OR p.nro_dup LIKE $${paramIndex + 4}
        OR p.nro_contrato LIKE $${paramIndex + 5}
        OR p.nro_invoice LIKE $${paramIndex + 6}
        OR p.obs LIKE $${paramIndex + 7}
      )`;
            params.push(s, s, s, s, s, s, s, s);
            paramIndex += 8;
        }

        // Importante: NÃO ocultar cancelados por padrão para listagem completa, 
        // a menos que o usuário explicitamente filtre status.
        // Mas mantendo a lógica original para consistência se statusFilter for passado.
        if (statusFilter && statusFilter !== 'cancelado') {
            whereClause += ` AND p.cancel != 'S'`;
        }

        // Query principal com cálculo de status baseado no histórico
        const query = `
      WITH contas_com_status AS (
        SELECT
          p.cod_pgto as id,
          p.cod_conta,
          p.cod_credor,
          p.cod_transp,
          c.nome as nome_credor,
          CASE
            WHEN p.tipo = 'T' THEN t.nome
            ELSE c.nome
          END as nome_exibicao,
          p.cod_ccusto,
          cc.descr as descricao_ccusto,
          p.dt_venc,
          p.dt_pgto,
          p.dt_emissao,
          p.valor_pgto,
          p.valor_pago,
          p.nro_nf,
          p.obs,
          p.tem_nota,
          p.tem_cobr,
          p.tipo,
          p.paga,
          p.cancel,
          p.nro_dup,
          p.codcomprador,
          comp.nome as nome_comprador,
          p.valor_juros,
          p.banco,
          b.nome as nome_banco,
          p.ordem_compra,
          cf.cof_descricao as descricao_conta,
          p.eh_internacional,
          p.moeda,
          p.taxa_conversao,
          p.valor_moeda,
          p.nro_invoice,
          p.nro_contrato,
          p.xml_nf,
          p.titulo_importado,
         
          COALESCE(
            (SELECT SUM(f.valor_pgto) 
             FROM db_manaus.dbfpgto f 
             WHERE f.cod_pgto = p.cod_pgto 
               AND (f.cancel IS NULL OR f.cancel != 'S')
            ), 0
          ) as total_pago_historico,
          (SELECT f.cod_fpgto 
           FROM db_manaus.dbfpgto f 
           WHERE f.cod_pgto = p.cod_pgto 
             AND (f.cancel IS NULL OR f.cancel != 'S')
           ORDER BY f.dt_pgto DESC, f.fpg_cof_id DESC
           LIMIT 1
          ) as forma_pgto,
          CASE
            WHEN p.cancel = 'S' THEN 'cancelado'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) >= p.valor_pgto THEN 'pago'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) > 0 THEN 'pago_parcial'
            ELSE 'pendente'
          END as status
      FROM db_manaus.dbpgto p
      LEFT JOIN db_manaus.dbcredor c ON c.cod_credor = p.cod_credor
      LEFT JOIN db_manaus.dbtransp t ON t.codtransp = p.cod_transp
      LEFT JOIN db_manaus.dbccusto cc ON cc.cod_ccusto = p.cod_ccusto
      LEFT JOIN db_manaus.cad_conta_financeira cf ON cf.cof_id = CAST(p.cod_conta AS INTEGER)
      LEFT JOIN db_manaus.dbbanco b ON b.cod_banco = p.banco
        LEFT JOIN db_manaus.dbcompradores comp ON comp.codcomprador = p.codcomprador
        WHERE 1=1 ${whereClause}
      )
      SELECT * FROM contas_com_status
      WHERE 1=1
      ${statusFilter
                ? statusFilter === 'pendente_parcial'
                    ? `AND status IN ('pendente', 'pago_parcial')`
                    : `AND status = '${statusFilter}'`
                : ''
            }
      ORDER BY dt_venc DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        params.push(parseInt(limit as string), offset);

        const result = await pool.query(query, params);

        // Query de contagem total com o mesmo filtro de status
        const countQuery = `
      WITH contas_com_status AS (
        SELECT
          p.cod_pgto,
          CASE
            WHEN p.cancel = 'S' THEN 'cancelado'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) >= p.valor_pgto THEN 'pago'
            WHEN COALESCE(
              (SELECT SUM(f.valor_pgto) 
               FROM db_manaus.dbfpgto f 
               WHERE f.cod_pgto = p.cod_pgto 
                 AND (f.cancel IS NULL OR f.cancel != 'S')
              ), 0
            ) > 0 THEN 'pago_parcial'
            ELSE 'pendente'
          END as status
        FROM db_manaus.dbpgto p
        LEFT JOIN db_manaus.dbcredor c ON c.cod_credor = p.cod_credor
        LEFT JOIN db_manaus.dbtransp t ON t.codtransp = p.cod_transp
        LEFT JOIN db_manaus.dbccusto cc ON cc.cod_ccusto = p.cod_ccusto
        LEFT JOIN db_manaus.cad_conta_financeira cf ON cf.cof_id = CAST(p.cod_conta AS INTEGER)
        LEFT JOIN db_manaus.dbbanco b ON b.cod_banco = p.banco
        LEFT JOIN db_manaus.dbcompradores comp ON comp.codcomprador = p.codcomprador
        WHERE 1=1 ${whereClause}
      )
      SELECT COUNT(*) as total
      FROM contas_com_status
      WHERE 1=1
      ${statusFilter
                ? statusFilter === 'pendente_parcial'
                    ? `AND status IN ('pendente', 'pago_parcial')`
                    : `AND status = '${statusFilter}'`
                : ''
            }
    `;

        const countParams = params.slice(0, -2); // Remove limit e offset
        const countResult = await pool.query(countQuery, countParams);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit as string));

        // Formatar dados de resposta - MOSTRAR CADA PARCELA INDIVIDUALMENTE
        const contasFormatadas = await Promise.all(result.rows.map(async row => {
            // Extrair número da parcela do campo nro_dup (formato: "base/01", "base/02")
            let parcela_atual = null;
            if (row.nro_dup && row.nro_dup.includes('/')) {
                const partes = row.nro_dup.split('/');
                const base = partes[0]; // base do nro_dup
                const numParcela = parseInt(partes[1]); // "01" -> 1

                // Buscar total de parcelas com mesmo base
                const totalParcelasResult = await pool.query(
                    `SELECT COUNT(*) as total FROM dbpgto WHERE nro_dup LIKE $1`,
                    [`${base}/%`]
                );
                const totalParcelas = parseInt(totalParcelasResult.rows[0].total);

                // Formato: "1 de 2", "2 de 2"
                parcela_atual = `${numParcela} de ${totalParcelas}`;
            }

            return {
                ...row,
                dt_venc: row.dt_venc ? new Date(row.dt_venc).toISOString().split('T')[0] : null,
                dt_pgto: row.dt_pgto ? new Date(row.dt_pgto).toISOString().split('T')[0] : null,
                dt_emissao: row.dt_emissao ? new Date(row.dt_emissao).toISOString().split('T')[0] : null,
                valor_pgto: parseFloat(row.valor_pgto || 0),
                valor_pago: parseFloat(row.valor_pago || 0),
                valor_juros: parseFloat(row.valor_juros || 0),
                taxa_conversao: row.taxa_conversao ? parseFloat(row.taxa_conversao) : null,
                valor_moeda: row.valor_moeda ? parseFloat(row.valor_moeda) : null,
                parcela_atual: parcela_atual, // Formato: "1 de 2", "2 de 2"
                eh_parcelada: parcela_atual !== null, // Se tem parcela, é parcelada
                moeda_simbolo: row.moeda === 'USD' ? '$' : row.moeda === 'EUR' ? '€' : 'R$'
            };
        }));

        res.status(200).json({
            contas_pagar: contasFormatadas,
            paginacao: {
                pagina: parseInt(page as string),
                limite: parseInt(limit as string),
                total: total,
                totalPaginas: totalPages
            }
        });

    } catch (error: any) {
        console.error('❌ Erro ao consultar contas a pagar internacionais:', error);
        res.status(500).json({
            erro: 'Erro interno do servidor',
            detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
}
