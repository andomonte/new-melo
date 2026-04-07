import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  const client = await pool.connect();

  try {
    const {
      cod_receb,
      dt_pgto,
      dt_venc,
      dt_emissao,
      valor_recebido,
      valor_juros,
      observacoes,
      banco,
      username,
      cod_conta,
      cof_id,
      forma_pgto,
      nro_cheque,
      nome,
      cod_operadora,
      codopera,
      caixa,
      cod_bc,
      ctrl,
      tipo,
      sf,
      cod_opera,
      tx_cartao,
      dt_cartao,
      parcela,
      num_parcela,
      total_parcelas,
      cod_documento,
      cod_autorizacao,
      cmc7,
      id_autenticacao
    } = req.body;

    if (!cod_receb) {
      return res.status(400).json({ erro: 'cod_receb é obrigatório' });
    }

    // Validar se o título existe e não está cancelado
    const verificarQuery = `
      SELECT 
        cod_receb, 
        valor_pgto, 
        COALESCE(valor_rec, 0) as valor_rec,
        rec,
        cancel,
        bradesco
      FROM db_manaus.dbreceb
      WHERE cod_receb = $1
      FOR UPDATE
    `;
    
    const verificarResult = await client.query(verificarQuery, [cod_receb]);

    if (verificarResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Título não encontrado' });
    }

    const titulo = verificarResult.rows[0];

    if (titulo.cancel === 'S') {
      return res.status(400).json({ erro: 'Não é possível dar baixa em título cancelado' });
    }

    if (titulo.rec === 'S') {
      return res.status(400).json({ erro: 'Título já está totalmente recebido' });
    }

    // ✅ Validar se título está em remessa bancária (Oracle business rule)
    if (titulo.bradesco === 'S') {
      return res.status(400).json({ 
        erro: 'Título está em remessa bancária. Aguarde retorno do banco ou processe manualmente na tela de retorno.',
        detalhes: 'Use a tela de processamento de retorno CNAB para baixar títulos em remessa'
      });
    }

    const recebidoAtual = parseFloat(titulo.valor_rec || 0);
    const valorReceberNum = typeof valor_recebido !== 'undefined' ? parseFloat(valor_recebido) : 0;
    const jurosNum = typeof valor_juros !== 'undefined' ? parseFloat(valor_juros) : 0;

    const novoValorRec = recebidoAtual + valorReceberNum + jurosNum;
    const valorTotal = parseFloat(titulo.valor_pgto || 0);
    const totalmentePago = novoValorRec >= valorTotal ? 'S' : 'N';

    // Iniciar transação
    await client.query('BEGIN');

    // Atualizar título com novo valor recebido (não marcar como pago até atingir o total)
    const updateQuery = `
      UPDATE db_manaus.dbreceb
      SET 
        valor_rec = $2,
        rec = $3,
        dt_pgto = COALESCE($4, dt_pgto),
        banco = COALESCE($5, banco),
        cod_conta = COALESCE($6, cod_conta),
        rec_cof_id = COALESCE($7, rec_cof_id),
        forma_fat = COALESCE($8, forma_fat),
        bradesco = CASE 
          WHEN $3 = 'S' THEN 'B'
          ELSE bradesco
        END
      WHERE cod_receb = $1
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, [
      cod_receb,
      novoValorRec,
      totalmentePago,
      dt_pgto || new Date().toISOString().split('T')[0],
      banco || null,
      cod_conta || null,
      cof_id || null,
      forma_pgto || null
    ]);

    // Registrar no histórico (dbfreceb) - valor principal e juros
    const gerarCodFRecebQuery = `
      SELECT COALESCE(MAX(CAST(cod_freceb AS INTEGER)), 0) + 1 as novo
      FROM db_manaus.dbfreceb
      WHERE cod_receb = $1
    `;
    const seqRes = await client.query(gerarCodFRecebQuery, [cod_receb]);
    let novoCodF = seqRes.rows[0]?.novo ?? 1;

    // Detectar colunas existentes em dbfreceb para montar insert dinâmico
    const colsRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'db_manaus' AND table_name = 'dbfreceb'`
    );
    const existingCols = new Set(colsRes.rows.map((r: any) => String(r.column_name).toLowerCase()));

    const buildInsert = (valuesMap: Record<string, any>) => {
      const cols: string[] = [];
      const placeholders: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const [k, v] of Object.entries(valuesMap)) {
        if (existingCols.has(k.toLowerCase())) {
          cols.push(k);
          placeholders.push(`$${idx}`);
          vals.push(v);
          idx++;
        }
      }
      if (cols.length === 0) {
        throw new Error('Nenhuma coluna válida encontrada para inserir em dbfreceb');
      }
      const sql = `INSERT INTO db_manaus.dbfreceb (${cols.join(',')}) VALUES (${placeholders.join(',')})`;
      return { sql, vals };
    };

    // Formatar parcela no formato XX-YY (ex: 01-03, 02-03, 03-03)
    let parcelaFormatada = parcela || null;
    if (num_parcela && total_parcelas) {
      parcelaFormatada = `${String(num_parcela).padStart(2, '0')}-${String(total_parcelas).padStart(2, '0')}`;
    }

    // Valores base para o lançamento principal
    const baseDtPgto = dt_pgto || new Date().toISOString().split('T')[0];
    const valuesPrincipal: Record<string, any> = {
      cod_freceb: String(novoCodF),
      cod_receb: cod_receb,
      valor: valorReceberNum,
      dt_pgto: baseDtPgto,
      dt_emissao: dt_emissao || baseDtPgto,
      tipo: tipo || 'D',
      sf: sf || 'S',
      nome: observacoes || nome || 'Baixa via sistema',
      nro_cheque: nro_cheque || null,
      cod_operadora: cod_operadora || cod_opera || codopera || null,
      codopera: cod_operadora || cod_opera || codopera || null,
      tx_cartao: tx_cartao || null,
      dt_cartao: dt_cartao || null,
      codbc: cod_bc || null,
      cxgeral: caixa || null,
      fre_cof_id: cof_id || null,
      cod_conta: cod_conta || null,
      parcela: parcelaFormatada,
      coddocumento: cod_documento || null,
      cod_documento: cod_documento || null,
      codautorizacao: cod_autorizacao || null,
      id_autenticacao: id_autenticacao || null,
      cmc7: cmc7 || null,
      codusr: null // será preenchido se encontrarmos usuário
    };

    // Tentar mapear username -> codusr
    if (username && existingCols.has('codusr')) {
      try {
        const userQuery = `SELECT codusr FROM db_manaus.dbusuario WHERE nomeusr = $1 LIMIT 1`;
        const userRes = await client.query(userQuery, [username]);
        if (userRes.rows && userRes.rows.length > 0) {
          valuesPrincipal.codusr = userRes.rows[0].codusr;
        }
      } catch (e) {
        console.warn('Não foi possível buscar codusr para', username);
      }
    }

    const insertPrincipal = buildInsert(valuesPrincipal);
    await client.query(insertPrincipal.sql, insertPrincipal.vals);

    // Se houver juros, registrar como lançamento separado
    if (jurosNum > 0) {
      novoCodF = String((parseInt(String(novoCodF), 10) || 0) + 1);
      const valuesJuros: Record<string, any> = {
        cod_freceb: String(novoCodF),
        cod_receb: cod_receb,
        valor: jurosNum,
        dt_pgto: baseDtPgto,
        dt_emissao: dt_emissao || baseDtPgto,
        tipo: 'J',
        sf: 'S',
        nome: 'Juros de atraso'
      };
      const insertJuros = buildInsert(valuesJuros);
      await client.query(insertJuros.sql, insertJuros.vals);
    }

    // 1. INSERIR em DBFPRERECEB (histórico de movimentos de pré-recebimento) - Paridade Oracle
    const fpreRecebColsRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='db_manaus' AND table_name = 'dbfprereceb'`
    );
    if (fpreRecebColsRes.rows.length > 0) {
      await client.query(
        `INSERT INTO db_manaus.dbfprereceb (cod_receb, dt_pgto, valor) VALUES ($1, $2, $3)`,
        [cod_receb, baseDtPgto, valorReceberNum]
      );
    }

    // 2. REDUZIR DÉBITO DO CLIENTE (Red_Debcli) - Paridade Oracle
    // Somente quando tipo='D' (Débito) e sf='S' (Soma)
    const tipoFinal = tipo || 'D';
    const sfFinal = sf || 'S';
    if (tipoFinal === 'D' && sfFinal === 'S') {
      // Buscar codcli do título
      const clienteRes = await client.query(
        'SELECT codcli FROM db_manaus.dbreceb WHERE cod_receb = $1',
        [cod_receb]
      );
      
      if (clienteRes.rows.length > 0 && clienteRes.rows[0].codcli) {
        const codcli = clienteRes.rows[0].codcli;
        const valorTotalBaixa = valorReceberNum + jurosNum;
        
        // Verificar se tabela dbclien existe
        const tblClienteRes = await client.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema='db_manaus' AND table_name = 'dbclien'`
        );
        
        if (tblClienteRes.rows.length > 0) {
          // Reduzir débito do cliente (Red_Debcli)
          await client.query(
            `UPDATE db_manaus.dbclien 
             SET debito = COALESCE(debito, 0) - $1 
             WHERE codcli = $2`,
            [valorTotalBaixa, codcli]
          );
        }
      }
    }

    // Pre-recebimento / dbPreReceb (inserir ou atualizar similar a ContasR_Baixa)
    const preRecebColsRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='db_manaus' AND table_name = 'dbprereceb'`
    );
    if (preRecebColsRes.rows.length > 0) {
      const countPre = await client.query(`SELECT count(*) as c from db_manaus.dbprereceb where cod_receb = $1`, [cod_receb]);
      const cnt = parseInt(countPre.rows[0].c, 10);
      const vRec = novoValorRec >= valorTotal ? 'S' : 'N';
      if (cnt === 0) {
        await client.query(`INSERT INTO db_manaus.dbprereceb (cod_receb, dt_pgto, valor_rec, cod_conta, rec) VALUES ($1,$2,$3,$4,$5)`, [cod_receb, baseDtPgto, valorReceberNum + jurosNum, cod_conta || null, vRec]);
      } else {
        await client.query(`UPDATE db_manaus.dbprereceb SET valor_rec = $1, cod_conta = $2, dt_pgto = $3, rec = $4 WHERE cod_receb = $5`, [novoValorRec, cod_conta || null, baseDtPgto, vRec, cod_receb]);
      }
    }

    // 3. AUDITORIA FORMAL (inc_acao_usr) - Paridade Oracle
    if (username) {
      try {
        const userQuery = `SELECT codusr FROM db_manaus.dbusuario WHERE nomeusr = $1 LIMIT 1`;
        const userRes = await client.query(userQuery, [username]);
        if (userRes.rows && userRes.rows.length > 0) {
          const codusr = userRes.rows[0].codusr;
          const valorTotalBaixa = valorReceberNum + jurosNum;
          
          // Verificar se tabela de auditoria existe
          const tblAuditoriaRes = await client.query(
            `SELECT table_name FROM information_schema.tables 
             WHERE table_schema='db_manaus' 
             AND table_name IN ('dbusuario_acoes', 'dblog_acoes', 'dbauditoria')`
          );
          
          if (tblAuditoriaRes.rows.length > 0) {
            const tblNome = tblAuditoriaRes.rows[0].table_name;
            const detalhes = `COD:${cod_receb} VALOR:${valorTotalBaixa.toFixed(2)}`;
            
            // Registrar ação em tabela de auditoria
            await client.query(
              `INSERT INTO db_manaus.${tblNome} (codusr, acao, tabela, detalhes, dt_acao) 
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
              [codusr, 'DAR_BAIXA', 'DBRECEB', detalhes]
            );
          }
        }
      } catch (e) {
        // Não quebrar a operação principal caso não encontre usuário ou tabela de auditoria
        console.warn('Não foi possível registrar auditoria para', username, ':', e);
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Baixa registrada com sucesso',
      totalmentePago: totalmentePago === 'S',
      titulo: updateResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao dar baixa:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}
