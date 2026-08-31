import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { parseExtratoCsv } from '@/lib/conciliacao/parseCsv';
import { classificarLancamento } from '@/lib/conciliacao/classificar';
import { extrairPagador } from '@/lib/conciliacao/extrairPagador';
import { encontrarSugestoes } from '@/lib/conciliacao/matcher';
import { decodificarExtrato, resolverCliente, buscarTitulosAbertos } from '@/lib/conciliacao/db';

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

/**
 * POST /api/conciliacao/importar
 * body: { arquivoBase64, nome, cod_conta?, usuario }
 *
 * Importa o extrato: parse → classifica → extrai pagador → resolve cliente (cpfcgc/nome)
 * → busca títulos em aberto (mês±1) → matcher → PERSISTE (conc_lote/conc_linha) e devolve.
 * Idempotência: mesmo arquivo (hash) não reimporta; linha já conciliada em lote anterior vira 'duplicado'.
 * NÃO dá baixa — isso é o passo de confirmação (próxima fase).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { arquivoBase64, nome, cod_conta, usuario } = req.body || {};
  if (!arquivoBase64) return res.status(400).json({ erro: 'Envie o arquivo (arquivoBase64).' });

  let texto: string;
  try {
    texto = decodificarExtrato(Buffer.from(String(arquivoBase64), 'base64'));
  } catch {
    return res.status(400).json({ erro: 'Não foi possível decodificar o arquivo.' });
  }

  const ext = parseExtratoCsv(texto);
  if (ext.linhas.length === 0) return res.status(400).json({ erro: 'Nenhuma linha de extrato reconhecida.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // Idempotência de arquivo: se já foi importado, REABRE o lote (não recusa) e devolve as
    // linhas persistidas — as conciliadas voltam como 'conciliado', as demais seguem validáveis.
    const jaImp = await client.query(`SELECT lot_id FROM conc_lote WHERE lot_hash_arquivo = $1`, [ext.hashArquivo]);
    if (jaImp.rows[0]) {
      const loteId = Number(jaImp.rows[0].lot_id);
      const ls = await client.query(
        `SELECT lin_id, lin_idx, to_char(lin_data,'YYYY-MM-DD') AS lin_data, lin_historico,
                lin_valor_cent, lin_tipo, lin_categoria, lin_pagador_doc, lin_pagador_tipo,
                lin_pagador_nome, lin_codcli, lin_cli_via, lin_status, lin_sugestoes
           FROM conc_linha WHERE lin_lote_id = $1 ORDER BY lin_idx`,
        [loteId],
      );
      // Recalcula o match das linhas de recebimento AINDA não conciliadas — cliente/título podem
      // ter sido criados depois da 1ª importação. Persiste o novo status/sugestões.
      const linhasReab: any[] = [];
      await client.query('BEGIN');
      try {
        for (const x of ls.rows) {
          let codcli = x.lin_codcli;
          let cliVia = x.lin_cli_via;
          let status = x.lin_status;
          let sugestoes = Array.isArray(x.lin_sugestoes) ? x.lin_sugestoes : x.lin_sugestoes || [];
          if (x.lin_categoria === 'recebimento' && (status === 'a_identificar' || status === 'pendente')) {
            const cliente = await resolverCliente(client, x.lin_pagador_doc, x.lin_pagador_nome);
            if (cliente) {
              codcli = cliente.codcli;
              cliVia = cliente.via;
              const titulos = await buscarTitulosAbertos(client, cliente.codcli, x.lin_data);
              sugestoes = encontrarSugestoes(Number(x.lin_valor_cent), cliente, titulos);
              status = sugestoes.length > 0 ? 'pendente' : 'a_identificar';
            } else {
              codcli = null; cliVia = null; sugestoes = []; status = 'a_identificar';
            }
            await client.query(
              `UPDATE conc_linha SET lin_codcli=$2, lin_cli_via=$3, lin_status=$4, lin_sugestoes=$5 WHERE lin_id=$1`,
              [x.lin_id, codcli, cliVia, status, JSON.stringify(sugestoes)],
            );
          }
          linhasReab.push({
            lin_id: Number(x.lin_id), idx: x.lin_idx, data: x.lin_data, historico: x.lin_historico,
            valorCentavos: Number(x.lin_valor_cent), tipo: x.lin_tipo, categoria: x.lin_categoria,
            pagador: { documento: x.lin_pagador_doc, tipo: x.lin_pagador_tipo, nome: x.lin_pagador_nome },
            codcli, cliVia, status, sugestoes,
          });
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
      const totalReceb = linhasReab.filter((l) => l.categoria === 'recebimento').length;
      const conciliadas = linhasReab.filter((l) => l.status === 'conciliado').length;
      return res.status(200).json({
        reaberto: true, lote_id: loteId,
        agencia: ext.agencia, conta: ext.conta,
        totalLinhas: linhasReab.length, totalRecebimento: totalReceb, conciliadas,
        linhas: linhasReab,
        mensagem: `Extrato já importado — reaberto (${conciliadas} conciliada(s), ${totalReceb - conciliadas} pendente(s)).`,
      });
    }

    await client.query('BEGIN');
    const loteRes = await client.query(
      `INSERT INTO conc_lote (lot_hash_arquivo, lot_banco, lot_agencia, lot_conta, lot_cod_conta, lot_arquivo_nome, lot_usuario, lot_qtd_linhas)
       VALUES ($1,'SANTANDER',$2,$3,$4,$5,$6,$7) RETURNING lot_id`,
      [ext.hashArquivo, ext.agencia, ext.conta, cod_conta || null, nome || null, String(usuario ?? '').substring(0, 60), ext.linhas.length],
    );
    const loteId = Number(loteRes.rows[0].lot_id);

    let qtdReceb = 0;
    const linhasOut: any[] = [];

    for (const l of ext.linhas) {
      const cls = classificarLancamento(l.historico, l.valorCentavos);
      let codcli: string | null = null;
      let cliVia: string | null = null;
      let pagDoc: string | null = null;
      let pagTipo: string | null = null;
      let pagNome: string | null = null;
      let sugestoes: any[] = [];
      let status: string = cls.categoria === 'descarte' ? 'descartado' : 'a_identificar';

      if (cls.categoria === 'recebimento') {
        qtdReceb++;
        const pag = extrairPagador(l.historico, l.documento);
        pagDoc = pag.documento;
        pagTipo = pag.docTipo;
        pagNome = pag.nome;
        const cliente = await resolverCliente(client, pag.documento, pag.nome);
        if (cliente) {
          codcli = cliente.codcli;
          cliVia = cliente.via;
          const titulos = await buscarTitulosAbertos(client, cliente.codcli, l.data);
          sugestoes = encontrarSugestoes(l.valorCentavos, cliente, titulos);
          status = sugestoes.length > 0 ? 'pendente' : 'a_identificar';
        } else {
          status = 'a_identificar';
        }
      }

      // Idempotência de linha: já conciliada em lote anterior?
      const dup = await client.query(
        `SELECT 1 FROM conc_linha WHERE lin_hash = $1 AND lin_status = 'conciliado' LIMIT 1`,
        [l.hashLinha],
      );
      if (dup.rows[0]) status = 'duplicado';

      const insRes = await client.query(
        `INSERT INTO conc_linha
           (lin_lote_id, lin_idx, lin_hash, lin_data, lin_historico, lin_documento, lin_valor_cent, lin_saldo_cent,
            lin_tipo, lin_categoria, lin_pagador_doc, lin_pagador_tipo, lin_pagador_nome, lin_codcli, lin_cli_via, lin_status, lin_sugestoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING lin_id`,
        [
          loteId, l.idx, l.hashLinha, l.data, l.historico, l.documento || null, l.valorCentavos, l.saldoCentavos,
          cls.tipo, cls.categoria, pagDoc, pagTipo, pagNome, codcli, cliVia, status, JSON.stringify(sugestoes),
        ],
      );

      linhasOut.push({
        lin_id: Number(insRes.rows[0].lin_id),
        idx: l.idx, data: l.data, historico: l.historico,
        valorCentavos: l.valorCentavos, tipo: cls.tipo, categoria: cls.categoria,
        pagador: { documento: pagDoc, tipo: pagTipo, nome: pagNome },
        codcli, cliVia, status, sugestoes,
      });
    }

    await client.query(`UPDATE conc_lote SET lot_qtd_receb = $2 WHERE lot_id = $1`, [loteId, qtdReceb]);
    await client.query('COMMIT');

    return res.status(200).json({
      lote_id: loteId,
      agencia: ext.agencia, conta: ext.conta,
      totalLinhas: ext.linhas.length, totalRecebimento: qtdReceb,
      linhas: linhasOut,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao importar extrato:', error);
    return res.status(500).json({ erro: 'Erro ao importar extrato', detalhes: error.message });
  } finally {
    client.release();
  }
}
