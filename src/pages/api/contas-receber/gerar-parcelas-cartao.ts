import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface ParcelaGerada {
  parcela: string;
  dt_venc: string;
  valor: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { 
    cod_receb, 
    codopera, 
    valorTotal, 
    numParcelas, 
    dt_base,
    cod_autorizacao,
    username 
  } = req.body;

  if (!cod_receb || !codopera || !valorTotal || !numParcelas) {
    return res.status(400).json({ 
      error: 'Parâmetros obrigatórios: cod_receb, codopera, valorTotal, numParcelas' 
    });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar dados da operadora
    const queryOperadora = `
      SELECT 
        codopera,
        descr,
        txopera,
        pzopera,
        codcli
      FROM db_manaus.dbopera
      WHERE codopera = $1
        AND COALESCE(desativado, 0) = 0
    `;

    const resultOperadora = await client.query(queryOperadora, [codopera]);

    if (resultOperadora.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Operadora não encontrada ou desativada' 
      });
    }

    const operadora = resultOperadora.rows[0];
    const valorBruto = parseFloat(valorTotal);
    const taxaPercentual = parseFloat(operadora.txopera || 0);
    const numParcelasInt = parseInt(numParcelas);
    
    // 2. Calcular valores
    const valorTaxa = valorBruto * (taxaPercentual / 100);
    const valorLiquido = valorBruto - valorTaxa;
    const valorParcela = valorLiquido / numParcelasInt;

    // 3. Gerar parcelas com vencimentos fixos (30, 60, 90, 120 dias...)
    const parcelas: ParcelaGerada[] = [];
    const dtBase = dt_base ? new Date(dt_base) : new Date();
    
    for (let i = 1; i <= numParcelasInt; i++) {
      const dtVencimento = new Date(dtBase);
      dtVencimento.setDate(dtVencimento.getDate() + (30 * i)); // 30, 60, 90, 120...
      
      // Ajuste na última parcela para compensar arredondamentos
      const valorParcelaFinal = i === numParcelasInt 
        ? valorLiquido - (valorParcela * (numParcelasInt - 1))
        : valorParcela;

      parcelas.push({
        parcela: `${String(i).padStart(2, '0')}-${String(numParcelasInt).padStart(2, '0')}`,
        dt_venc: dtVencimento.toISOString().split('T')[0],
        valor: parseFloat(valorParcelaFinal.toFixed(2))
      });
    }

    // 4. Buscar próximo código de freceb disponível
    const gerarCodFRecebQuery = `
      SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)), 0) as max_cod
      FROM db_manaus.dbfreceb
      WHERE cod_receb = $1
    `;
    const seqRes = await client.query(gerarCodFRecebQuery, [cod_receb]);
    let proximoCodFreceb = (seqRes.rows[0]?.max_cod ?? 0) + 1;

    // 5. Inserir parcelas em DBFRECEB
    const dtAgora = new Date().toISOString().split('T')[0];
    
    for (const parcela of parcelas) {
      await client.query(`
        INSERT INTO db_manaus.dbfreceb (
          cod_freceb,
          cod_receb,
          codopera,
          parcela,
          dt_pgto,
          dt_venc,
          valor,
          tipo,
          sf,
          tx_cartao,
          codautorizacao,
          nome
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        String(proximoCodFreceb),
        cod_receb,
        codopera,
        parcela.parcela,
        parcela.dt_venc, // Data de pgto = data de vencimento (prevista)
        parcela.dt_venc,
        parcela.valor,
        'D', // Tipo: Débito
        'S', // SF: Soma
        taxaPercentual,
        cod_autorizacao || null,
        `Parcela ${parcela.parcela} - ${operadora.descr}`
      ]);

      proximoCodFreceb++;
    }

    // 6. Atualizar título com valor recebido e marcar como recebido
    const somaValores = parcelas.reduce((acc, p) => acc + p.valor, 0);
    
    await client.query(`
      UPDATE db_manaus.dbreceb
      SET 
        valor_rec = COALESCE(valor_rec, 0) + $1,
        rec = CASE 
          WHEN COALESCE(valor_rec, 0) + $1 >= valor_pgto THEN 'S'
          ELSE 'N'
        END,
        dt_pgto = $2,
        forma_fat = '005'
      WHERE cod_receb = $3
    `, [somaValores, dtAgora, cod_receb]);

    // 7. Auditoria
    if (username) {
      try {
        const userQuery = `SELECT codusr FROM db_manaus.dbusuario WHERE nomeusr = $1 LIMIT 1`;
        const userRes = await client.query(userQuery, [username]);
        
        if (userRes.rows && userRes.rows.length > 0) {
          const codusr = userRes.rows[0].codusr;
          const detalhes = `COD:${cod_receb} PARCELAS:${numParcelasInt} VALOR_LIQ:${valorLiquido.toFixed(2)} OPER:${codopera}`;
          
          const tblAuditoriaRes = await client.query(
            `SELECT table_name FROM information_schema.tables 
             WHERE table_schema='db_manaus' 
             AND table_name IN ('dbusuario_acoes', 'dblog_acoes', 'dbauditoria')`
          );
          
          if (tblAuditoriaRes.rows.length > 0) {
            const tblNome = tblAuditoriaRes.rows[0].table_name;
            
            await client.query(
              `INSERT INTO db_manaus.${tblNome} (codusr, acao, tabela, detalhes, dt_acao) 
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
              [codusr, 'GERAR_PARCELAS_CARTAO', 'DBFRECEB', detalhes]
            );
          }
        }
      } catch (e) {
        console.warn('Não foi possível registrar auditoria:', e);
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      mensagem: `${numParcelasInt} parcelas geradas com sucesso`,
      parcelas,
      resumo: {
        valorBruto,
        taxaPercentual,
        valorTaxa,
        valorLiquido,
        valorParcela: parseFloat(valorParcela.toFixed(2)),
        numParcelas: numParcelasInt,
        operadora: operadora.descr
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao gerar parcelas de cartão:', error);
    return res.status(500).json({ 
      error: 'Erro ao gerar parcelas',
      details: error.message 
    });
  } finally {
    client.release();
  }
}
