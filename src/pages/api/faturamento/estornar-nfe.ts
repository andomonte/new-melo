import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { gerarEstorno } from '@/lib/faturamento/gerarEstorno';

// ESTORNO DE NF-e — FASE 1: cria o Documento Interno (DI = fatura de devolução) que
// reverte a NF-e original, SEM emitir à SEFAZ. A emissão da devolução é um 2º passo.
// Regras (espelham o Delphi, opção A — vale NF-e e NFC-e):
//   - nota autorizada (status 100) e não cancelada;
//   - MAIS de 24h após a autorização (antes disso, use o Cancelamento);
//   - ainda não estornada;
//   - justificativa + CFOP (4 dígitos) obrigatórios.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { codfat, cfop, justificativa, usuario = 'API' } = req.body || {};
  if (!codfat) return res.status(400).json({ erro: 'codfat é obrigatório.' });
  if (!justificativa || String(justificativa).trim().length < 15) {
    return res
      .status(400)
      .json({ erro: 'Informe a justificativa do estorno (mín. 15 caracteres).' });
  }
  if (!/^\d{4}$/.test(String(cfop || '').trim())) {
    return res.status(400).json({ erro: 'Informe um CFOP de devolução válido (4 dígitos).' });
  }

  try {
    // 1. Buscar a NF-e autorizada da fatura.
    const cli = await getPgPool().connect();
    let nota: any;
    try {
      let r = await cli.query(
        "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
        [String(codfat)],
      );
      if (r.rowCount === 0) {
        r = await cli.query(
          "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
          [String(codfat).replace(/^0+/, '')],
        );
      }
      if (r.rowCount === 0) return res.status(404).json({ erro: 'Nota não encontrada.' });
      nota = r.rows[0];
    } finally {
      cli.release();
    }

    // 2. Validações
    if (nota.status !== '100' || nota.dthrcancelamento || nota.status === 'C') {
      return res.status(400).json({ erro: 'NF-e não autorizada ou cancelada — não pode ser estornada.' });
    }
    if (!nota.chave) {
      return res.status(400).json({ erro: 'Chave da NF-e inválida.' });
    }
    const autorizacao = nota.dthrprotocolo;
    if (!autorizacao) {
      return res.status(400).json({ erro: 'Data de autorização (dthrprotocolo) não encontrada.' });
    }
    const horas = (Date.now() - new Date(autorizacao).getTime()) / 3600000;
    if (Number.isFinite(horas) && horas < 24) {
      return res.status(400).json({
        erro:
          'O Estorno de NF-e só deve ser usado APÓS 24h da autorização. ' +
          `Faltam ${Math.ceil(24 - horas)}h — dentro de 24h use o Cancelamento.`,
        antesDe24h: true,
      });
    }

    // 3. Cria a DI numa transação (sem emitir).
    const db = await getPgPool().connect();
    try {
      await db.query('BEGIN');
      const resultado = await gerarEstorno(db, {
        codfatOriginal: String(nota.codfat),
        cfop: String(cfop).trim(),
        justificativa: String(justificativa).trim(),
        usuario,
      });
      await db.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        mensagem:
          'Documento de devolução (DI) gerado. Confira e, no 2º passo, emita a NF-e de devolução.',
        ...resultado,
        codfatOriginal: String(nota.codfat),
        chaveOriginal: nota.chave,
      });
    } catch (e: any) {
      await db.query('ROLLBACK').catch(() => {});
      return res.status(400).json({ sucesso: false, erro: e.message });
    } finally {
      db.release();
    }
  } catch (error: any) {
    console.error('Erro no estorno de NF-e:', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
}
