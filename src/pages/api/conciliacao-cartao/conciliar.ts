import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API de Conciliação de Cartão
 * 
 * Baseado na procedure Oracle: GERAL.CONTASR.CON_CARTAO_RECEB
 * 
 * Implementa matching com 2 modos conforme lógica Oracle:
 * 
 * Modo 1 - Match Simples (quando total_parcelas é null):
 *   - NSU (car_nrodocumento)
 *   - Autorização (car_nroautorizacao)
 *   - Cliente operadora (CIELO% ou SANTANDER%)
 * 
 * Modo 2 - Match Estrito (quando total_parcelas informado):
 *   - NSU (car_nrodocumento)
 *   - Autorização (car_nroautorizacao)
 *   - Documento = 'C' + NSU + '-' + parcela (02 dígitos)
 *   - Total Parcelas (car_nroparcela)
 *   - Cliente operadora (CIELO% ou SANTANDER%)
 */

interface ResultadoConciliacao {
  totalProcessados: number;
  conciliados: number;
  naoLocalizados: number;
  erros: number;
  detalhes: {
    nsu: string;
    autorizacao: string;
    parcela: string | null;
    status: 'CONCILIADO' | 'NAO_LOCALIZADO' | 'ERRO';
    cod_receb?: string;
    modo_match?: string;
    mensagem?: string;
  }[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Buscar registros pendentes de conciliação
    const registrosPendentes = await client.query(`
      SELECT *
      FROM db_manaus.fin_cartao_receb_import
      WHERE status = 'PENDENTE'
      ORDER BY dt_transacao, nsu, parcela
    `);

    const resultado: ResultadoConciliacao = {
      totalProcessados: registrosPendentes.rows.length,
      conciliados: 0,
      naoLocalizados: 0,
      erros: 0,
      detalhes: []
    };

    // Processar cada registro
    for (const registro of registrosPendentes.rows) {
      try {
        const {
          id, nsu, autorizacao, parcela, bandeira,
          valor_bruto, valor_liquido
        } = registro;

        // Extrair número da parcela e total de parcelas
        let nroParcela: string | null = null;
        let totalParcelas: string | null = null;

        if (parcela && parcela.includes('-')) {
          const [num, total] = parcela.split('-');
          nroParcela = num;
          totalParcelas = total;
        }

        // Determinar tipo de operadora baseado na bandeira
        const tipo = determinarTipoOperadora(bandeira);

        if (!tipo) {
          // Bandeira não mapeada para operadora conhecida
          await client.query(`
            UPDATE db_manaus.fin_cartao_receb_import
            SET status = 'NAO_LOCALIZADO',
                observacao = 'Bandeira não mapeada para operadora CIELO/SANTANDER'
            WHERE id = $1
          `, [id]);

          resultado.naoLocalizados++;
          resultado.detalhes.push({
            nsu,
            autorizacao,
            parcela,
            status: 'NAO_LOCALIZADO',
            mensagem: 'Bandeira não mapeada'
          });
          continue;
        }

        // Montar query de busca baseada na lógica Oracle CON_CARTAO_RECEB
        let query: string;
        let params: any[];
        let modoMatch: string;

        if (totalParcelas) {
          // MODO 2: Match Estrito (com parcelas)
          const nroDoc = `C${nsu}-${nroParcela!.padStart(2, '0')}`;
          const totParc = totalParcelas.padStart(2, '0');

          query = `
            SELECT r.cod_receb, r.nro_doc, r.valor_pgto, r.valor_rec, 
                   c.codcli, c.nome, car.car_id
            FROM dbreceb r
            INNER JOIN dbclien c ON r.codcli = c.codcli
            INNER JOIN fin_cartao_receb crr ON r.cod_receb = crr.car_cod_receb
            INNER JOIN fin_cartao car ON crr.car_car_id = car.car_id
            WHERE car.car_nrodocumento = $1
              AND car.car_nroautorizacao = $2
              AND r.nro_doc = $3
              AND car.car_nroparcela = $4
              AND car.car_codcli IN (
                SELECT codcli FROM dbclien WHERE nome LIKE $5
              )
              AND r.cancel = 'N'
            LIMIT 1
          `;
          params = [nsu, autorizacao, nroDoc, totParc, `${tipo}%`];
          modoMatch = 'MATCH_ESTRITO';

        } else {
          // MODO 1: Match Simples (sem parcelas)
          query = `
            SELECT r.cod_receb, r.nro_doc, r.valor_pgto, r.valor_rec,
                   c.codcli, c.nome, car.car_id
            FROM dbreceb r
            INNER JOIN dbclien c ON r.codcli = c.codcli
            INNER JOIN fin_cartao_receb crr ON r.cod_receb = crr.car_cod_receb
            INNER JOIN fin_cartao car ON crr.car_car_id = car.car_id
            WHERE car.car_nrodocumento = $1
              AND car.car_nroautorizacao = $2
              AND car.car_codcli IN (
                SELECT codcli FROM dbclien WHERE nome LIKE $3
              )
              AND r.cancel = 'N'
            LIMIT 1
          `;
          params = [nsu, autorizacao, `${tipo}%`];
          modoMatch = 'MATCH_SIMPLES';
        }

        // Executar busca
        const resultadoBusca = await client.query(query, params);

        if (resultadoBusca.rows.length > 0) {
          // ENCONTRADO - Conciliar
          const titulo = resultadoBusca.rows[0];

          // Buscar o cod_freceb correspondente
          const frecebResult = await client.query(`
            SELECT cod_freceb
            FROM dbfreceb
            WHERE cod_receb = $1
              AND coddocumento = $2
              AND codautorizacao = $3
              AND sf = 'N'
            ORDER BY cod_freceb DESC
            LIMIT 1
          `, [titulo.cod_receb, nsu, autorizacao]);

          const cod_freceb = frecebResult.rows.length > 0
            ? frecebResult.rows[0].cod_freceb
            : null;

          // Atualizar registro como conciliado
          await client.query(`
            UPDATE db_manaus.fin_cartao_receb_import
            SET status = 'CONCILIADO',
                cod_receb = $1,
                cod_freceb = $2,
                criterio_match = $3,
                observacao = $4
            WHERE id = $5
          `, [
            titulo.cod_receb,
            cod_freceb,
            modoMatch,
            `${modoMatch} - ${titulo.nome} - Doc: ${titulo.nro_doc}`,
            id
          ]);

          resultado.conciliados++;
          resultado.detalhes.push({
            nsu,
            autorizacao,
            parcela,
            status: 'CONCILIADO',
            cod_receb: titulo.cod_receb,
            modo_match: modoMatch,
            mensagem: `Cliente: ${titulo.nome}`
          });

        } else {
          // NÃO ENCONTRADO - Tentar descobrir o motivo (DEBUG)
          let debugMsg = 'Título não encontrado com os critérios Oracle';

          try {
            // Debug 1: Verificar se existe pelo menos o NSU
            const checkNsu = await client.query(`
              SELECT car_id, car_nrodocumento, car_nroautorizacao, car_codcli, car_nroparcela
              FROM fin_cartao WHERE car_nrodocumento = $1 OR car_nrodocumento LIKE $2
            `, [nsu, `%${nsu}`]);

            if (checkNsu.rows.length > 0) {
              const debugReg = checkNsu.rows[0];
              debugMsg += ` | ACHOU NSU (ID: ${debugReg.car_id}, Doc: ${debugReg.car_nrodocumento}, Auth: ${debugReg.car_nroautorizacao})`;

              // Debug 2: Se achou NSU, ver Autorização
              if (debugReg.car_nroautorizacao !== autorizacao) {
                debugMsg += ` | Auth diverge: Banco=${debugReg.car_nroautorizacao} vs Import=${autorizacao}`;
              }

              // Debug 3: Ver Cliente
              const checkCli = await client.query(`SELECT nome FROM dbclien WHERE codcli = $1`, [debugReg.car_codcli]);
              if (checkCli.rows.length > 0) {
                debugMsg += ` | Cliente: ${checkCli.rows[0].nome} (Esperado ${tipo}%)`;
              }

            } else {
              debugMsg += ` | NSU ${nsu} NÃO encontrado em fin_cartao`;
            }

            // Logar detalhado em arquivo
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'conciliacao_debug.log');
            const logContent = `
--- ${new Date().toISOString()} ---
FALHA MATCH:
NSU Import: ${nsu}
Auth Import: ${autorizacao}
Tipo Calc: ${tipo}
Query Executada: ${query.replace(/\s+/g, ' ')}
Params: ${JSON.stringify(params)}
Analise: ${debugMsg}
-----------------------------------
`;
            fs.appendFileSync(logPath, logContent);

          } catch (dbgErr) {
            console.error('Erro no debug:', dbgErr);
          }

          await client.query(`
            UPDATE db_manaus.fin_cartao_receb_import
            SET status = 'NAO_LOCALIZADO',
                observacao = $2
            WHERE id = $1
          `, [id, debugMsg.substring(0, 255)]); // Limitar tamanho msg

          resultado.naoLocalizados++;
          resultado.detalhes.push({
            nsu,
            autorizacao,
            parcela,
            status: 'NAO_LOCALIZADO',
            mensagem: debugMsg
          });
        }

      } catch (error: any) {
        console.error('Erro ao processar registro:', error);

        // Marcar como erro
        await client.query(`
          UPDATE db_manaus.fin_cartao_receb_import
          SET status = 'ERRO',
              observacao = $1
          WHERE id = $2
        `, [error.message, registro.id]);

        resultado.erros++;
        resultado.detalhes.push({
          nsu: registro.nsu,
          autorizacao: registro.autorizacao,
          parcela: registro.parcela,
          status: 'ERRO',
          mensagem: error.message
        });
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      resultado
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro na conciliação:', error);
    return res.status(500).json({
      error: 'Erro ao processar conciliação',
      message: error.message
    });
  } finally {
    client.release();
  }
}

/**
 * Mapeia bandeira do cartão para tipo de operadora (CIELO ou SANTANDER)
 * 
 * Baseado nos clientes cadastrados no sistema que representam as operadoras
 */
function determinarTipoOperadora(bandeira: string): 'CIELO' | 'SANTANDER' | null {
  if (!bandeira) return null;

  const bandeiraNorm = bandeira.toUpperCase().trim();

  // Bandeiras operadas pela CIELO
  const bandeirasCielo = [
    'VISA',
    'MASTERCARD',
    'ELO',
    'AMEX',
    'AMERICAN EXPRESS',
    'DINERS',
    'DISCOVER',
    'JCB',
    'AURA',
    'HIPERCARD'
  ];

  // Bandeiras operadas pelo SANTANDER
  const bandeirasSantander = [
    'GETNET',
    'SANTANDER'
  ];

  if (bandeirasCielo.some(b => bandeiraNorm.includes(b))) {
    return 'CIELO';
  }

  if (bandeirasSantander.some(b => bandeiraNorm.includes(b))) {
    return 'SANTANDER';
  }

  // Por padrão, assume CIELO (maioria das bandeiras)
  return 'CIELO';
}
