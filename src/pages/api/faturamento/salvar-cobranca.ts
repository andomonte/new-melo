import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { salvarParcelasPagamento } from '@/utils/parcelasPagamento';

// Mapeamento das formas de faturamento para seus códigos de 1 caractere
const mapaFormaFatura: { [key: string]: string } = {
  BOLETO: 'B',
  DUPLICATA: 'D',
  PIX: 'P',
  'CARTÃO DE CRÉDITO': 'C',
  'CARTÃO DE DÉBITO': 'V',
  DINHEIRO: '$',
  // Adicione outras formas de pagamento e seus códigos aqui
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const {
    codfat,
    codcli,
    banco,
    tipofat,
    _tipoDoc,
    parcelas,
    _impostoNa1Parcela,
    _freteNa1Parcela,
    codvenda, // Novo parâmetro opcional
  } = req.body;

  // --- INÍCIO DA CORREÇÃO ---

  // FIX: Traduz o texto completo para o código de 1 caractere
  const codigoFormaFatura = mapaFormaFatura[tipofat];

  if (!codigoFormaFatura) {
    return res.status(400).json({
      error: `O tipo de fatura '${tipofat}' não é válido ou não foi mapeado.`,
    });
  }

  const codBancoNumerico = parseInt(String(banco), 10);
  if (isNaN(codBancoNumerico)) {
    return res.status(400).json({ error: 'ID do banco inválido.' });
  }

  // Formata o código do banco com 4 dígitos (ex: 3 -> 0003)
  const codBancoFormatado = String(codBancoNumerico).padStart(4, '0');

  // --- FIM DA CORREÇÃO ---

  let client;
  try {
    client = await getPgPool().connect();

    // Auto-corrige a sequence de cod_receb quando ela está ATRÁS do maior
    // cod_receb da tabela (artefato de migração Oracle→Postgres): senão o
    // nextval devolve um valor já existente e o INSERT viola a PK (pkdbreceb).
    await client.query(
      `SELECT setval('seq_cod_receb', GREATEST(
         (SELECT last_value FROM seq_cod_receb),
         (SELECT COALESCE(MAX(cod_receb::bigint), 0) FROM dbreceb WHERE cod_receb ~ '^[0-9]+$')
       ), true)`,
    );

    // ATUALIZA A FATURA
    await client.query(
      `UPDATE dbfatura
       SET frmfat = $1,      -- Usar o código de 1 caractere
           cod_banco = $2,
           cobranca = 'S'
       WHERE codfat = $3`,
      [
        codigoFormaFatura, // <-- USA O CÓDIGO ('B') AQUI
        codBancoFormatado, // <-- Agora usa o código formatado com 4 dígitos
        codfat,
      ],
    );

    // Herda a conta financeira da fatura para os títulos (mesmo elo que o
    // Delphi/TCOBRANCA usa: o título de dbreceb carrega o cod_conta do documento).
    const contaFatura = await client.query(
      `SELECT cod_conta FROM dbfatura WHERE codfat = $1`,
      [codfat],
    );
    const codContaFatura = contaFatura.rows[0]?.cod_conta ?? null;
    // Data de emissão do título = hoje (equivale a trunc(sysdate) no Delphi).
    const dtEmissao = new Date().toISOString().split('T')[0];

    // INSERE AS PARCELAS
    for (const parcela of req.body.parcelas) {
      // ...código para gerar 'novoCod'...
      const { rows } = await client.query(
        `SELECT nextval('seq_cod_receb') as next_id`,
      );
      const nextId = rows[0].next_id;
      const novoCod = nextId.toString().padStart(9, '0');

      // Colunas estruturais alinhadas ao Delphi (TCOBRANCA.COBRANCA_INCLUIR) e à
      // convenção do próprio web (contas-receber/criar.ts): sem elas o título
      // "some" das listagens de recebíveis, que filtram cancel='N' / valor_rec.
      //   tipo='F' (fatura), valor_rec=0 (nada recebido), rec/cancel/bradesco='N',
      //   dt_emissao=hoje, venc_ant/dtvenc_previsao=dt_venc, cod_conta herdado da fatura.
      await client.query(
        `INSERT INTO dbreceb
         (cod_receb, codcli, cod_fat, cod_conta, dt_venc, dt_emissao, valor_pgto,
          valor_rec, nro_doc, forma_fat, banco, tipo, rec, cancel, bradesco,
          venc_ant, dtvenc_previsao)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
          0, $8, $9, $10, 'F', 'N', 'N', 'N',
          $5, $5)`,
        [
          novoCod,
          codcli,
          codfat,
          codContaFatura,
          parcela.vencimento,
          dtEmissao,
          parcela.valor,
          parcela.documento,
          codigoFormaFatura,
          codBancoFormatado, // <-- Usa o código formatado com 4 dígitos
        ],
      );
    }

    // SALVA AS PARCELAS NA NOVA TABELA dbprazo_pagamento (se codvenda foi fornecido)
    if (codvenda && parcelas && parcelas.length > 0) {
      // Calcula os dias para cada parcela baseado na data de vencimento
      const parcelasComDias = parcelas.map((parcela: any) => {
        const dataVencimento = new Date(parcela.vencimento);
        const hoje = new Date();
        const diffTime = dataVencimento.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { dia: diffDays };
      });

      await salvarParcelasPagamento(codvenda, parcelasComDias);
    }

    return res.status(200).json({ message: 'Cobrança salva com sucesso.' });
  } catch (error) {
    console.error('Erro ao salvar cobrança:', error);
    return res.status(500).json({
      error: `Erro ao salvar cobrança: ${(error as Error)?.message || 'erro desconhecido'}`,
    });
  } finally {
    if (client) client.release();
  }
}
