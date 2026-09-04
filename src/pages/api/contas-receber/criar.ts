import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { codigoFormaFatura } from '@/lib/faturamento/formaFatura';
import { bancoInternoDbreceb } from '@/lib/faturamento/bancoCobranca';

const pool = getPgPool();

// Regra banco↔forma do Delphi (UniContasR — Novo Título), a MESMA da cobrança GP:
//   - códigos do dropdown dbbanco_cobranca: 1 BRADESCO 2 BB 3 ITAU 4 RURAL 5 MELO
//     6 SANTANDER 7 SAFRA 8 CITIBANK 9 CAIXA.
//   - RURAL(4)/SAFRA(7)/CITIBANK(8): emissão de boleto SUSPENSA → bloqueia.
//   - MELO(5): forma só pode ser CARTEIRA(4)/PROMISSÓRIA(3)/RECIBO(1).
//   - Qualquer outro banco: forma forçada para BOLETO(2).
const BANCOS_BOLETO_SUSPENSO = new Set(['4', '7', '8']);
const MELO_DROPDOWN = '5';
const FORMAS_MELO = new Set(['4', '3', '1']);

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

    // Validações básicas (Delphi UniContasR.BtnCad_SalvarClick exige documento).
    if (!codcli) return res.status(400).json({ erro: 'Cliente é obrigatório' });
    if (!rec_cof_id) return res.status(400).json({ erro: 'Conta financeira é obrigatória' });
    if (!dt_venc) return res.status(400).json({ erro: 'Data de vencimento é obrigatória' });
    if (!valor_pgto || Number(valor_pgto) <= 0) return res.status(400).json({ erro: 'Valor inválido' });
    if (!nro_doc || !String(nro_doc).trim()) return res.status(400).json({ erro: 'Número do documento é obrigatório' });

    // --- Regra banco ↔ forma (fiel ao Delphi/GP) ---------------------------------
    // `banco` chega como código do dropdown dbbanco_cobranca ('1'..'9') ou vazio.
    const bancoDropdown = banco ? String(banco).trim() : '';
    if (bancoDropdown && BANCOS_BOLETO_SUSPENSO.has(bancoDropdown)) {
      return res
        .status(400)
        .json({ erro: 'Emissão de boleto está suspensa para este banco. Escolha outro banco.' });
    }
    // Forma coagida pela regra: MELO libera carteira/promissória/recibo; demais → boleto.
    let formaCod = codigoFormaFatura(forma_fat) || '2';
    if (bancoDropdown === MELO_DROPDOWN) {
      if (!FORMAS_MELO.has(formaCod)) formaCod = '4'; // default CARTEIRA na MELO
    } else if (bancoDropdown) {
      formaCod = '2'; // BOLETO obrigatório fora da MELO
    }
    // Código interno gravado em dbreceb.banco (ex.: MELO(5) → '9').
    const bancoInterno = bancoDropdown ? bancoInternoDbreceb(bancoDropdown) : null;

    // Normalizar campos
    const valorTotal = parseFloat(valor_pgto);
    const totalParcelas = parcelado && parcelas.length > 0 ? parcelas.length : 1;

    // Para distribuir os centavos restantes (vão na PRIMEIRA parcela)
    const valorParcela = Math.floor((valorTotal / totalParcelas) * 100) / 100;
    const restoCentavos = valorTotal - (valorParcela * totalParcelas);

    // Documento base (obrigatório, validado acima) — o Delphi acrescenta LETRA por parcela.
    const baseDoc = String(nro_doc).trim();
    // Letras por parcela (fiel ao Delphi: A..J, L..P — pula o 'K'). Mesmo com 1 parcela vira 'A'.
    const LETRA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P'];

    const created: string[] = [];
    const dataEmissao = dt_emissao || new Date().toISOString().split('T')[0];

    await client.query('BEGIN');

    // Buscar o maior cod_receb atual para gerar os próximos
    const maxCodResult = await client.query(`
      SELECT COALESCE(MAX(CAST(cod_receb AS INTEGER)), 0) as max_cod
      FROM dbreceb
      WHERE cod_receb ~ '^[0-9]+$'
    `);
    let proximoCod = parseInt(maxCodResult.rows[0]?.max_cod || '0') + 1;

    // cod_fat COMPARTILHADO pelas parcelas (o "Cod_Avulso" do Delphi) — é o que agrupa as
    // parcelas para o cálculo Parcela X/N. Gerado como MAX(numérico)+1, 9 dígitos.
    const maxFatResult = await client.query(
      `SELECT COALESCE(MAX(CAST(cod_fat AS bigint)), 0) AS mx FROM dbreceb WHERE cod_fat ~ '^[0-9]+$'`,
    );
    const codFatCompartilhado = String(Number(maxFatResult.rows[0]?.mx || 0) + 1).padStart(9, '0');

    // Criar cada parcela
    for (let i = 0; i < totalParcelas; i++) {
      // Calcular data de vencimento desta parcela
      // Se parcelado, usar vencimento do array, senão usar dt_venc
      const dataVencFormatada = parcelado && parcelas[i] 
        ? parcelas[i].vencimento 
        : dt_venc;

      // Calcular valor desta parcela (a PRIMEIRA parcela recebe os centavos restantes)
      const valorDestaParcela = i === 0
        ? valorParcela + restoCentavos
        : valorParcela;

      // nro_doc = documento digitado + LETRA da parcela (Delphi: 030484 → 030484A/B/C).
      const letra = LETRA[i] ?? String(i + 1);
      const nroDocParcela = `${baseDoc}${letra}`;

      // Gerar cod_receb para esta parcela
      const codReceb = String(proximoCod + i);

      const insertQuery = `
        INSERT INTO dbreceb (
          cod_receb, codcli, rec_cof_id, dt_venc, dt_emissao, valor_pgto, nro_doc, cod_fat, tipo, forma_fat, banco, rec, cancel, valor_rec, bradesco
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'N', 'N', 0, 'N'
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
        codFatCompartilhado, // cod_fat compartilhado → Parcela X/N funciona
        tipo || 'R',
        formaCod, // forma coagida pela regra banco↔forma (fonte única)
        bancoInterno, // código interno do Oracle (dbreceb.banco), 1 dígito
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
