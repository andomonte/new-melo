import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { ambienteAdn, clientePorDocumento, cnpjAtualNfse, servicoPorCodigoNacional } from '@/lib/nfse/adn/distribuicao';

/**
 * Documentos baixados do ADN.
 *   GET ?aba=pendentes (NFS-e prestadas a conferir) | tomadas | eventos | tratadas
 * Nas pendentes já vêm as sugestões de cliente (pelo CNPJ do tomador) e de serviço (pelo código nacional).
 */
const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  const aba = String(req.query.aba || 'pendentes');
  const filtro: Record<string, string> = {
    pendentes: `d.situacao = 'NOVA' AND d.papel = 'PRESTADOR'`,
    tomadas: `d.tipo_documento = 'NFSE' AND d.papel = 'TOMADOR'`,
    eventos: `d.tipo_documento = 'EVENTO'`,
    tratadas: `d.situacao IN ('IMPORTADA','IGNORADA')`,
  };
  try {
    const cnpj = await cnpjAtualNfse(pool);
    const controle = (await pool.query(
      `SELECT cnpj, ambiente, ultimo_nsu, atualizado_em::text AS atualizado_em, ultima_situacao FROM nfs_adn_controle
        WHERE ambiente = $1 AND cnpj = $2 ORDER BY atualizado_em DESC NULLS LAST`, [ambienteAdn(), cnpj])).rows;
    const docs = (await pool.query(
      `SELECT d.id, d.nsu, d.chave_acesso, d.tipo_documento, d.tipo_evento, d.papel, d.numero, d.dt_emissao::text AS dt_emissao,
              d.competencia, d.cnpj_prestador, d.nome_prestador, d.doc_tomador, d.nome_tomador, d.cod_servico, d.descricao,
              d.valor_servico, d.valor_liquido, d.chave_referida, d.situacao, d.codfat, d.tratado_em::text AS tratado_em, d.tratado_por,
              (SELECT n.codfat FROM nfs_nota n WHERE n.chave_acesso = d.chave_referida LIMIT 1) AS codfat_referida,
              (SELECT n.cancel FROM nfs_nota n WHERE n.chave_acesso = d.chave_referida LIMIT 1) AS cancel_referida
         FROM nfs_adn_documento d
        WHERE d.ambiente = $1 AND d.cnpj = $2 AND ${filtro[aba] || filtro.pendentes}
        ORDER BY d.nsu DESC LIMIT 500`, [ambienteAdn(), cnpj])).rows;
    if (aba === 'pendentes') {
      for (const d of docs) {
        d.clientes = await clientePorDocumento(pool, d.doc_tomador);
        d.servicos = await servicoPorCodigoNacional(pool, d.cod_servico);
      }
    }
    docs.forEach((d) => { d.valor_servico = Number(d.valor_servico || 0); d.valor_liquido = Number(d.valor_liquido || 0); });
    return res.status(200).json({ ambiente: ambienteAdn(), cnpj, controle, documentos: docs });
  } catch (e: any) {
    if (e?.code === '42P01') return res.status(200).json({ ambiente: ambienteAdn(), controle: [], documentos: [] });
    console.error('Erro ao listar documentos do ADN:', e);
    return res.status(500).json({ erro: 'Erro ao listar documentos do ADN' });
  }
}
