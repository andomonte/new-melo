/**
 * Busca das NFS-e no ADN e importação para as Notas de Serviço (etapa 3).
 *   sincronizarAdn  : baixa os documentos novos (a partir do último NSU), lê o XML, guarda em
 *                     nfs_adn_documento e liga os que já foram lançados à mão (mesma chave).
 *   importarDocumentoAdn : nota em que a empresa é PRESTADORA → nfs_nota (origem NACIONAL) + títulos.
 *   ignorarDocumentoAdn  : tira da lista de conferência.
 * Só servidor; sincronizar faz chamadas externas (não usar dentro de transação longa).
 */
import { certificadoAdn, type Consultavel } from './certificado';
import { consultarDistribuicao, type AmbienteAdn } from './cliente';
import { lerDocumentoNacional, papelNaNota, type NotaNacional } from './leitorXml';
import { gerarTitulosNfs, lancarNotaServico, NfsValidacaoError, type OpcoesCobranca } from '../notasServico';

export const MAX_LOTES_POR_BUSCA = 10;   // 10 × 50 = até 500 documentos por clique (~30 s; abaixo do tempo limite do proxy)

const so = (v: any) => String(v ?? '').replace(/\D/g, '');

export function ambienteAdn(): AmbienteAdn {
  return String(process.env.NFSE_ADN_AMBIENTE || 'PRODUCAO').toUpperCase() === 'RESTRITA' ? 'RESTRITA' : 'PRODUCAO';
}

/** CNPJ consultado: NFSE_ADN_CNPJ, senão (com certificado de teste) o CNPJ do próprio certificado, senão a 1ª empresa com certificado. */
export async function cnpjPadraoAdn(db: Consultavel, cnpjCertificadoTeste?: string | null): Promise<string> {
  if (process.env.NFSE_ADN_CNPJ) return so(process.env.NFSE_ADN_CNPJ);
  if (process.env.NFSE_TESTE_PFX && cnpjCertificadoTeste) return so(cnpjCertificadoTeste);
  const r = await db.query(`SELECT cgc FROM dadosempresa WHERE "certificadoKey" IS NOT NULL ORDER BY cgc LIMIT 1`);
  if (!r.rows[0]) throw new Error('Nenhuma empresa com certificado cadastrado (Admin > Dados Empresa).');
  return so(r.rows[0].cgc);
}

export async function sincronizarAdn(db: Consultavel, opts: { cnpj?: string | null; ambiente?: AmbienteAdn } = {}) {
  const ambiente = opts.ambiente || ambienteAdn();
  // certificado de teste: o CNPJ padrão é o do certificado
  const pre = process.env.NFSE_TESTE_PFX ? await certificadoAdn(db, opts.cnpj || '') : null;
  const cnpj = so(opts.cnpj) || await cnpjPadraoAdn(db, pre?.cnpjCertificado);
  const cert = pre || await certificadoAdn(db, cnpj);

  await db.query(
    `INSERT INTO nfs_adn_controle (cnpj, ambiente) VALUES ($1,$2) ON CONFLICT (cnpj, ambiente) DO NOTHING`, [cnpj, ambiente]);
  let nsu = Number((await db.query(
    `SELECT ultimo_nsu FROM nfs_adn_controle WHERE cnpj = $1 AND ambiente = $2`, [cnpj, ambiente])).rows[0].ultimo_nsu) || 0;
  const nsuInicial = nsu;

  let novos = 0, lotes = 0, situacao = 'SEM_NOVIDADES';
  for (; lotes < MAX_LOTES_POR_BUSCA; lotes++) {
    if (lotes > 0) await new Promise((ok) => setTimeout(ok, 700)); // não martelar o ADN entre lotes
    const r = await consultarDistribuicao(cert.agent, ambiente, nsu, cnpj);
    if (r.status === 'NENHUM_DOCUMENTO_LOCALIZADO' || r.http === 404) { situacao = 'EM_DIA'; break; }
    if (r.status !== 'DOCUMENTOS_LOCALIZADOS') {
      situacao = `${r.status}: ${r.mensagens.join('; ') || 'sem mensagem do ADN'}`;
      await db.query(`UPDATE nfs_adn_controle SET atualizado_em = now(), ultima_situacao = left($3, 250)
                       WHERE cnpj = $1 AND ambiente = $2`, [cnpj, ambiente, situacao]);
      throw new Error(`O ADN recusou a consulta — ${situacao}`);
    }
    for (const d of r.documentos) {
      let resumo: Record<string, any> = {};
      try {
        const lido = await lerDocumentoNacional(d.xml);
        if (lido?.tipo === 'NFSE') {
          resumo = {
            papel: papelNaNota(lido, cnpj), numero: lido.numero, dt_emissao: lido.dtEmissao, competencia: lido.competencia,
            cnpj_prestador: so(lido.prestador.doc).slice(0, 14) || null, nome_prestador: lido.prestador.nome?.slice(0, 150) || null,
            doc_tomador: so(lido.tomador.doc).slice(0, 14) || null, nome_tomador: lido.tomador.nome?.slice(0, 150) || null,
            cod_servico: lido.codServico, descricao: lido.descricao?.slice(0, 2000) || null,
            valor_servico: lido.valores.servico, valor_liquido: lido.valores.liquido,
          };
        } else if (lido?.tipo === 'EVENTO') {
          resumo = { chave_referida: lido.chaveReferida, descricao: [lido.descricao, lido.motivo].filter(Boolean).join(' — ').slice(0, 2000) || null };
        }
      } catch { /* XML fora do esperado: guarda mesmo assim, sem resumo */ }
      const ins = await db.query(
        `INSERT INTO nfs_adn_documento (cnpj, ambiente, nsu, chave_acesso, tipo_documento, tipo_evento, data_geracao, xml,
            papel, numero, dt_emissao, competencia, cnpj_prestador, nome_prestador, doc_tomador, nome_tomador,
            cod_servico, descricao, valor_servico, valor_liquido, chave_referida, situacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT (ambiente, cnpj, nsu) DO NOTHING`,
        [cnpj, ambiente, d.nsu, d.chave, d.tipoDocumento, d.tipoEvento, d.dataGeracao, d.xml,
         resumo.papel || null, resumo.numero || null, resumo.dt_emissao || null, resumo.competencia || null,
         resumo.cnpj_prestador || null, resumo.nome_prestador || null, resumo.doc_tomador || null, resumo.nome_tomador || null,
         resumo.cod_servico || null, resumo.descricao || null, resumo.valor_servico ?? null, resumo.valor_liquido ?? null,
         resumo.chave_referida || null,
         // só a nota PRESTADA vai para conferência; o resto fica registrado
         resumo.papel === 'PRESTADOR' ? 'NOVA' : 'REGISTRADO']);
      novos += ins.rowCount || 0;
      nsu = Math.max(nsu, d.nsu);
    }
    await db.query(`UPDATE nfs_adn_controle SET ultimo_nsu = $3, atualizado_em = now(), ultima_situacao = 'OK'
                     WHERE cnpj = $1 AND ambiente = $2`, [cnpj, ambiente, nsu]);
    if (r.documentos.length < 50) { situacao = 'EM_DIA'; break; }
    situacao = 'HA_MAIS';
  }
  await db.query(`UPDATE nfs_adn_controle SET atualizado_em = now(), ultima_situacao = $3 WHERE cnpj = $1 AND ambiente = $2`,
    [cnpj, ambiente, situacao]);

  // nota já lançada à mão com a mesma chave → liga e tira da conferência
  await db.query(
    `UPDATE nfs_adn_documento d SET situacao = 'IMPORTADA', codfat = n.codfat, tratado_em = now(), tratado_por = 'VINCULO_CHAVE'
       FROM nfs_nota n
      WHERE d.situacao = 'NOVA' AND d.chave_acesso IS NOT NULL AND n.chave_acesso = d.chave_acesso AND n.cancel = 'N'`);

  return { cnpj, ambiente, origemCertificado: cert.origem, nsuInicial, nsuFinal: nsu, novos, lotes: lotes + 1, situacao };
}

// ------------------------------------------------------------------ conferência / importação

/** Item do cadastro de serviços pelo código nacional (cTribNac "010701" → item "1.07"). */
export async function servicoPorCodigoNacional(db: Consultavel, cTribNac: string | null) {
  const c = so(cTribNac);
  if (c.length < 4) return [];
  const item = `${parseInt(c.slice(0, 2), 10)}.${c.slice(2, 4)}`;
  const r = await db.query(
    `SELECT sen_id, sen_codigo, sen_atividade, COALESCE(sen_issqn,0)::float AS sen_issqn FROM dbservico_nfs
      WHERE COALESCE(sen_excluido,0) = 0
        AND (ltrim(split_part(replace(sen_codigo,' ',''), '.', 1), '0') || '.' || lpad(split_part(replace(sen_codigo,' ',''), '.', 2), 2, '0')) = $1
      ORDER BY sen_id`, [item]);
  return r.rows;
}

/** Cliente pelo CNPJ/CPF do tomador (só dígitos). */
export async function clientePorDocumento(db: Consultavel, doc: string | null) {
  const d = so(doc);
  if (!d) return [];
  const r = await db.query(
    `SELECT codcli, nome FROM dbclien WHERE regexp_replace(COALESCE(cpfcgc,''), '\\D', '', 'g') = $1 ORDER BY codcli`, [d]);
  return r.rows;
}

export interface OpcoesImportacao {
  codcli?: string | null;       // se o tomador não for achado (ou houver mais de um)
  sen_id?: string | null;       // se o serviço não casar pelo código nacional
  cobranca?: OpcoesCobranca | null;
}

/** Importa uma NFS-e em que a empresa é PRESTADORA. Usar dentro de BEGIN…COMMIT. */
export async function importarDocumentoAdn(db: Consultavel, id: number, op: OpcoesImportacao, usuario?: string | null) {
  const doc = (await db.query(`SELECT * FROM nfs_adn_documento WHERE id = $1 FOR UPDATE`, [id])).rows[0];
  if (!doc) throw new NfsValidacaoError('Documento não encontrado.');
  if (doc.situacao !== 'NOVA') throw new NfsValidacaoError(`Documento já tratado (${doc.situacao}).`);
  if (doc.tipo_documento !== 'NFSE' || doc.papel !== 'PRESTADOR') {
    throw new NfsValidacaoError('Só se importa nota em que a empresa é a prestadora.');
  }
  const n = (await lerDocumentoNacional(doc.xml)) as NotaNacional | null;
  if (!n || n.tipo !== 'NFSE') throw new NfsValidacaoError('Não foi possível ler o XML da nota.');

  let codcli = op.codcli || null;
  if (!codcli) {
    const cli = await clientePorDocumento(db, n.tomador.doc);
    if (cli.length !== 1) {
      throw new NfsValidacaoError(cli.length === 0
        ? `Tomador ${n.tomador.doc || '(sem documento)'} não está no cadastro de clientes — escolha o cliente.`
        : `Há ${cli.length} clientes com o documento ${n.tomador.doc} — escolha o cliente.`);
    }
    codcli = cli[0].codcli;
  }
  let senId = op.sen_id || null;
  if (!senId) {
    const sv = await servicoPorCodigoNacional(db, n.codServico);
    if (!sv.length) throw new NfsValidacaoError(`O serviço ${n.codServico} não está no cadastro de serviços — escolha o serviço.`);
    senId = sv[0].sen_id;
  }
  const v = n.valores;
  const r = await lancarNotaServico(db, {
    codcli: String(codcli),
    nroform: n.numero || doc.numero,
    chave_acesso: n.chave || doc.chave_acesso,
    dtemissao: n.dtEmissao || doc.dt_emissao,
    competencia: n.competencia || doc.competencia,
    sen_id: String(senId),
    descr: n.descricao || '(sem descrição)',
    valor_servico: v.servico,
    valor_desconto: v.descontoIncond,
    valor_deducoes: v.deducoes,
    issqn_aliquota: v.issAliquota,
    issqn_retido: v.issRetido,
    informados: {
      issqn_valor: v.issValor,
      pis_valor: v.pisCofinsRetido ? v.pis : 0,
      cofins_valor: v.pisCofinsRetido ? v.cofins : 0,
      ir_valor: v.ir, inss_valor: v.inss, csll_valor: v.csll,
    },
    obs: `Importada do ADN (NSU ${doc.nsu})`,
  }, usuario, { origem: 'NACIONAL', xml: doc.xml });

  // o líquido calculado tem de bater com o vLiq da nota
  if (Math.abs(r.valores.valor_liquido - v.liquido) > 0.02) {
    throw new NfsValidacaoError(
      `O líquido calculado (${r.valores.valor_liquido.toFixed(2)}) difere do líquido da nota (${v.liquido.toFixed(2)}). Lance à mão e confira.`);
  }
  const titulos = op.cobranca ? await gerarTitulosNfs(db, r.codfat, op.cobranca) : null;
  await db.query(
    `UPDATE nfs_adn_documento SET situacao = 'IMPORTADA', codfat = $2, tratado_em = now(), tratado_por = $3 WHERE id = $1`,
    [id, r.codfat, usuario ? String(usuario).slice(0, 60) : null]);
  return { codfat: r.codfat, titulos };
}

export async function ignorarDocumentoAdn(db: Consultavel, id: number, usuario?: string | null) {
  const r = await db.query(
    `UPDATE nfs_adn_documento SET situacao = 'IGNORADA', tratado_em = now(), tratado_por = $2
      WHERE id = $1 AND situacao = 'NOVA'`, [id, usuario ? String(usuario).slice(0, 60) : null]);
  if (!r.rowCount) throw new NfsValidacaoError('Documento não está pendente.');
}
