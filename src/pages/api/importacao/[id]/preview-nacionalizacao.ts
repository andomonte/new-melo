/**
 * POST /api/importacao/[id]/preview-nacionalizacao
 *
 * Monta o(s) XML(s) da NF-e de nacionalização em modo PREVIEW (NÃO transmite ao SEFAZ).
 * Toda a lógica de dados fica em `construirNotasNacionalizacao` (compartilhada com o
 * preview do DANFE). Aqui só vira XML via `gerarNotasNacionalizacao`.
 *
 * Body: { grupos?: Array<Array<number|string>> }  // grupos de pedidos (id_orc) → 1 nota cada
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';
import {
  gerarNotasNacionalizacao,
  type DadosNacionalizacao,
} from '@/components/services/sefazNfe/gerarXmlImportacao';
import { construirNotasNacionalizacao } from '@/lib/compras/construirNotasNacionalizacao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const importacaoId = parseInt(String(req.query.id), 10);
  if (!importacaoId) return res.status(400).json({ message: 'ID de importação inválido' });

  const grupos = Array.isArray(req.body?.grupos)
    ? (req.body.grupos as Array<Array<number | string>>)
    : undefined;
  const numeroNFInicial = String(req.body?.numeroNFInicial || '1');

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const r = await construirNotasNacionalizacao(client, importacaoId, grupos);
    if (!r.ok) return res.status(r.status).json({ message: r.message });

    const { emitente, diHeader, forns, principal, regra, codPrincipal, qtdAdicoes, notas, di } = r.data;

    let nnf = parseInt(numeroNFInicial, 10) || 1;
    const notasOut: any[] = [];
    let totalItens = 0;
    for (const nota of notas) {
      const dados: DadosNacionalizacao = {
        modo: 'POR_DI',
        ambiente: 2, // preview = homologação
        serie: '1',
        naturezaOperacao: 'COMPRA PARA COMERCIALIZACAO',
        cfopPadrao: '3102',
        emitente,
        respTec: { cnpj: emitente.cnpj },
        di: diHeader,
        destExterior: nota.dest,
        infCpl: nota.infCpl,
        itens: nota.itensNfe,
      };
      totalItens += nota.itensNfe.length;
      const geradas = gerarNotasNacionalizacao(dados, String(nnf));
      nnf += geradas.length;
      for (const n of geradas) {
        notasOut.push({
          cod_exportador: nota.codExportador,
          pedidos: nota.pedidos,
          seq_nota: n.seq_nota,
          chave: n.chave,
          totais: n.totais,
          xml: n.xml,
        });
      }
    }

    return res.status(200).json({
      success: true,
      regra_principal: regra,
      di: { id: importacaoId, nro_di: di.nro_di },
      principal: principal ? { fornecedor: principal.nome, cod_cliente: codPrincipal || null } : null,
      qtd_itens: totalItens,
      qtd_adicoes: qtdAdicoes,
      qtd_fornecedores: forns.length,
      qtd_notas: notasOut.length,
      notas: notasOut,
    });
  } catch (e: any) {
    console.error('[preview-nacionalizacao] erro:', e);
    return res.status(500).json({ message: 'Erro ao gerar preview da nota de nacionalização', detail: e.message });
  } finally {
    if (client) client.release();
  }
}
