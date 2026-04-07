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
      codcli,
      rec_cof_id,
      dt_venc,
      dt_emissao,
      valor_pgto,
      nro_doc,
      tipo,
      forma_fat,
      banco,
      obs,
      parcelado = false,
      parcelas = [],
    } = req.body;

    // Validações básicas
    if (!codcli) return res.status(400).json({ erro: 'Cliente é obrigatório' });
    if (!rec_cof_id) return res.status(400).json({ erro: 'Conta financeira é obrigatória' });
    if (!dt_venc) return res.status(400).json({ erro: 'Data de vencimento é obrigatória' });
    if (!valor_pgto || Number(valor_pgto) <= 0) return res.status(400).json({ erro: 'Valor inválido' });

    // Normalizar campos
    const valorTotal = parseFloat(valor_pgto);
    const totalParcelas = parcelado && parcelas.length > 0 ? parcelas.length : 1;
    
    // Para distribuir os centavos restantes
    const valorParcela = Math.floor((valorTotal / totalParcelas) * 100) / 100;
    const restoCentavos = valorTotal - (valorParcela * totalParcelas);

    // Gerar base do nro_doc se não fornecido
    let baseDoc = nro_doc || '';
    if (!baseDoc && parcelado && totalParcelas > 1) {
      // Gerar um ID único baseado em timestamp
      baseDoc = `REC${Date.now().toString().slice(-8)}`;
    }

    const created: string[] = [];
    const dataEmissao = dt_emissao || new Date().toISOString().split('T')[0];

    await client.query('BEGIN');

    // Buscar o maior cod_receb atual para gerar os próximos
    const maxCodResult = await client.query(`
      SELECT COALESCE(MAX(CAST(cod_receb AS INTEGER)), 0) as max_cod
      FROM db_manaus.dbreceb
      WHERE cod_receb ~ '^[0-9]+$'
    `);
    let proximoCod = parseInt(maxCodResult.rows[0]?.max_cod || '0') + 1;

    // Criar cada parcela
    for (let i = 0; i < totalParcelas; i++) {
      // Calcular data de vencimento desta parcela
      // Se parcelado, usar vencimento do array, senão usar dt_venc
      const dataVencFormatada = parcelado && parcelas[i] 
        ? parcelas[i].vencimento 
        : dt_venc;

      // Calcular valor desta parcela (última parcela recebe os centavos restantes)
      const valorDestaParcela = i === totalParcelas - 1 
        ? valorParcela + restoCentavos
        : valorParcela;

      // Gerar nro_doc para esta parcela (formato: base/X ou X/Y)
      const nroDocParcela = totalParcelas > 1 
        ? `${baseDoc}/${String(i + 1).padStart(2, '0')}` 
        : (baseDoc || null);

      // Gerar cod_receb para esta parcela
      const codReceb = String(proximoCod + i);

      const insertQuery = `
        INSERT INTO db_manaus.dbreceb (
          cod_receb, codcli, rec_cof_id, dt_venc, dt_emissao, valor_pgto, nro_doc, tipo, forma_fat, banco, rec, cancel, valor_rec, bradesco
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'N', 'N', 0, 'N'
        ) RETURNING cod_receb
      `;

      const values = [
        codReceb,
        codcli,
        rec_cof_id,
        dataVencFormatada,
        dataEmissao,
        valorDestaParcela.toFixed(2),
        nroDocParcela,
        tipo || 'R',
        forma_fat || 'B',
        banco || null,
      ];

      const r = await client.query(insertQuery, values);
      created.push(r.rows[0].cod_receb);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      sucesso: true,
      mensagem: totalParcelas > 1 
        ? `${totalParcelas} parcelas criadas com sucesso!`
        : 'Título criado com sucesso',
      total_parcelas: totalParcelas,
      valor_total: valorTotal,
      valor_parcela: valorParcela,
      contas: created,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar título:', error);
    return res.status(500).json({ erro: 'Erro ao criar título', mensagem: error instanceof Error ? error.message : 'Erro desconhecido' });
  } finally {
    client.release();
  }
}
