/**
 * Emissão e cancelamento de NFS-e pela Sefin Nacional (etapa 4).
 *
 * emitirNotaServico (chamar dentro de BEGIN…COMMIT; ROLLBACK se lançar erro):
 *   1. valida tudo ANTES do envio (prestador com IM, tomador com endereço, serviço com cTribNac,
 *      valores) e grava a nota como "pendente de emissão" (mesmas regras do lançamento);
 *   2. reserva o nº da DPS (nfs_dps_controle, com trava);
 *   3. monta, assina (RSA-SHA256) e envia a DPS;
 *   4. rejeitada → NfsValidacaoError com as mensagens da Sefin (o ROLLBACK desfaz nota e número);
 *      aceita     → grava número, chave, XML da NFS-e e da DPS; títulos opcionais.
 *   Se a conexão cair depois do envio, consulta GET /dps/{id}: se a NFS-e foi gerada, recupera e
 *   segue; senão, recusa (nunca reenvia às cegas — evita nota em dobro).
 *
 * cancelarNfseNoPortal: evento 101101 na Sefin + cancelamento local (cancelarNotaServico).
 *
 * Ambiente: NFSE_SEFIN_AMBIENTE = RESTRITA (padrão, testes do governo, sem valor fiscal) | PRODUCAO.
 * Série da DPS: NFSE_DPS_SERIE (padrão "1"; o Emissor Web do portal usa "900").
 */
import { certificadoAdn, type Consultavel } from '../adn/certificado';
import { lerDocumentoNacional, type NotaNacional } from '../adn/leitorXml';
import { cnpjPadraoAdn } from '../adn/distribuicao';
import {
  cancelarNotaServico, gerarTitulosNfs, lancarNotaServico, NfsValidacaoError,
  type EntradaNota, type OpcoesCobranca,
} from '../notasServico';
import { assinarXmlNfse } from './assinatura';
import { chavePorDps, consultarNfse, enviarDps, enviarEvento, SefinConexaoError } from './cliente';
import { agoraBrasilia, montarDps, montarPedidoCancelamento, type AmbienteSefin } from './xml';

const so = (v: any) => String(v ?? '').replace(/\D/g, '');

export function ambienteSefin(): AmbienteSefin {
  return String(process.env.NFSE_SEFIN_AMBIENTE || 'RESTRITA').toUpperCase() === 'PRODUCAO' ? 'PRODUCAO' : 'RESTRITA';
}
const serieDps = () => so(process.env.NFSE_DPS_SERIE || '1').slice(0, 5) || '1';

/** Dados do prestador (empresa emitente) a partir de Dados Empresa. */
async function prestador(db: Consultavel, cnpj: string) {
  const e = (await db.query(
    `SELECT cgc, nomecontribuinte, inscricaomunicipal, crt, municipio, uf, telefone, email
       FROM dadosempresa WHERE regexp_replace(cgc, '\\D', '', 'g') = $1 LIMIT 1`, [cnpj])).rows[0];
  if (!e) throw new NfsValidacaoError(`Empresa ${cnpj} não está em Dados Empresa.`);
  const im = String(e.inscricaomunicipal || '').trim();
  if (!im) throw new NfsValidacaoError('Informe a Inscrição Municipal da empresa em Admin > Dados Empresa (obrigatória na NFS-e).');
  const mun = (await db.query(
    `SELECT codmunicipio FROM dbmunicipio
      WHERE uf = $1 AND translate(upper(descricao), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') = translate(upper($2), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC')
      LIMIT 1`,
    [e.uf, e.municipio]).catch(() => ({ rows: [] as any[] }))).rows[0];
  const cMun = so(process.env.NFSE_CMUN_EMISSOR) || so(mun?.codmunicipio)
    || (String(e.municipio || '').toUpperCase().includes('MANAUS') ? '1302603' : '');
  if (!cMun) throw new NfsValidacaoError('Não foi possível achar o código IBGE do município da empresa (NFSE_CMUN_EMISSOR).');
  // CRT 1/2 = Simples Nacional (ME/EPP) → opSimpNac 3; CRT 3 = regime normal → 1 (não optante)
  const simples = ['1', '2'].includes(String(e.crt || '').trim());
  return {
    doc: cnpj, im, nome: e.nomecontribuinte, cMun,
    opSimpNac: (simples ? '3' : '1') as '1' | '3', regApTribSN: simples ? ('1' as const) : null, regEspTrib: '0',
    fone: e.telefone, email: e.email,
  };
}

/** Tomador (cliente) com endereço completo para a DPS. */
async function tomador(db: Consultavel, codcli: string) {
  const c = (await db.query(
    `SELECT codcli, nome, cpfcgc, imun, ender, numero, complemento, bairro, cep, codmunicipio, email, emailnfe
       FROM dbclien WHERE codcli = $1`, [codcli])).rows[0];
  if (!c) throw new NfsValidacaoError('Cliente não encontrado.');
  const doc = so(c.cpfcgc);
  if (![11, 14].includes(doc.length)) throw new NfsValidacaoError('O cliente precisa de CPF ou CNPJ válido no cadastro.');
  const falta = [!c.ender && 'endereço', !c.bairro && 'bairro', so(c.cep).length !== 8 && 'CEP', so(c.codmunicipio).length !== 7 && 'município (IBGE)']
    .filter(Boolean);
  if (falta.length) throw new NfsValidacaoError(`Complete o cadastro do cliente para emitir: ${falta.join(', ')}.`);
  return {
    doc, nome: c.nome, im: c.imun ? String(c.imun).trim() || null : null,
    endereco: { cMun: so(c.codmunicipio), cep: so(c.cep), logradouro: c.ender, numero: String(c.numero || 'S/N'), complemento: c.complemento, bairro: c.bairro },
    email: (c.emailnfe || c.email || '').split(/[;, ]/)[0] || null,
  };
}

export type EntradaEmissao = Omit<EntradaNota, 'nroform' | 'verificacao' | 'chave_acesso'>;

export async function emitirNotaServico(
  db: Consultavel, e: EntradaEmissao, opcoes: { cobranca?: OpcoesCobranca | null; usuario?: string | null } = {},
) {
  const ambiente = ambienteSefin();
  const cert0 = process.env.NFSE_TESTE_PFX ? await certificadoAdn(db, '') : null;
  const cnpj = await cnpjPadraoAdn(db, cert0?.cnpjCertificado);
  const cert = cert0 || await certificadoAdn(db, cnpj);

  const prest = await prestador(db, cnpj);
  const toma = await tomador(db, e.codcli);
  const serv = (await db.query(
    `SELECT sen_id, sen_ctribnac, sen_ctribmun, sen_cnbs, COALESCE(sen_excluido,0) AS excl FROM dbservico_nfs WHERE sen_id = $1`,
    [e.sen_id])).rows[0];
  if (!serv) throw new NfsValidacaoError('Serviço não encontrado no cadastro.');
  if (so(serv.sen_ctribnac).length !== 6) {
    throw new NfsValidacaoError('O serviço escolhido não tem o código de tributação nacional (6 dígitos) — ajuste em Financeiro > Arquivos > Serviços.');
  }

  // 1. grava a nota como pendente (valida valores, cliente, serviço — mesmas regras do lançamento)
  const lanc = await lancarNotaServico(db, { ...e, nroform: '', verificacao: null, chave_acesso: null },
    opcoes.usuario, { origem: 'EMITIDA', pendenteEmissao: true });
  const v = lanc.valores;

  // 2. nº da DPS (trava a linha até o COMMIT/ROLLBACK)
  const serie = serieDps();
  await db.query(
    `INSERT INTO nfs_dps_controle (cnpj, ambiente, serie) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [cnpj, ambiente, serie]);
  const numero = Number((await db.query(
    `SELECT ultimo_numero FROM nfs_dps_controle WHERE cnpj = $1 AND ambiente = $2 AND serie = $3 FOR UPDATE`,
    [cnpj, ambiente, serie])).rows[0].ultimo_numero) + 1;

  // 3. DPS
  const dCompet = /^(\d{2})\/(\d{4})$/.test(e.competencia)
    ? `${e.competencia.slice(3)}-${e.competencia.slice(0, 2)}-${e.dtemissao.slice(8, 10)}` : e.dtemissao;
  const dps = montarDps({
    ambiente, cMunEmissor: prest.cMun, serie, numero, dhEmi: agoraBrasilia(),
    dCompet: dCompet.slice(0, 10),
    prestador: prest, tomador: toma,
    servico: { cLocPrestacao: prest.cMun, cTribNac: serv.sen_ctribnac, cTribMun: serv.sen_ctribmun, descricao: e.descr, cNBS: serv.sen_cnbs },
    valores: {
      servico: v.valor_servico, descontoIncond: v.valor_desconto,
      issRetido: v.issqn_retido === 'S', issAliquota: v.issqn_retido === 'S' ? v.issqn_aliquota : null,
      pis: v.pis_valor, cofins: v.cofins_valor, inss: v.inss_valor, ir: v.ir_valor, csll: v.csll_valor,
    },
  });
  const assinada = assinarXmlNfse(dps.xml, 'infDPS', cert.keyPem, cert.certPem);

  // 4. envio (com recuperação se a resposta se perder)
  let chave: string | undefined;
  let nfseXml: string | undefined;
  let alertas: string[] = [];
  try {
    const r = await enviarDps(cert.agent, ambiente, assinada);
    if (!r.ok) {
      throw new NfsValidacaoError(`A Sefin Nacional rejeitou a nota: ${(r.erros || []).join(' | ') || `HTTP ${r.http}`}`);
    }
    chave = r.chave; nfseXml = r.nfseXml; alertas = r.alertas || [];
  } catch (err) {
    if (!(err instanceof SefinConexaoError)) throw err;
    const recuperada = await chavePorDps(cert.agent, ambiente, dps.id).catch(() => null);
    if (!recuperada) {
      throw new NfsValidacaoError(`Sem resposta da Sefin Nacional e a DPS ${dps.id} não aparece como emitida. Tente de novo em instantes.`);
    }
    chave = recuperada;
    nfseXml = (await consultarNfse(cert.agent, ambiente, recuperada).catch(() => null)) || undefined;
  }
  const lida = nfseXml ? ((await lerDocumentoNacional(nfseXml)) as NotaNacional | null) : null;
  const numeroNfse = lida?.numero || null;

  await db.query(
    `UPDATE nfs_nota SET nroform = $2, chave_acesso = $3, xml = $4, dps_id = $5, dps_xml = $6, ambiente_nfse = $7,
            dtemissao = COALESCE($8::date, dtemissao), atualizado_em = now()
      WHERE codfat = $1`,
    [lanc.codfat, numeroNfse || String(numero), chave, nfseXml || null, dps.id, assinada, ambiente, lida?.dtEmissao || null]);
  await db.query(
    `UPDATE nfs_dps_controle SET ultimo_numero = $4, atualizado_em = now() WHERE cnpj = $1 AND ambiente = $2 AND serie = $3`,
    [cnpj, ambiente, serie, numero]);

  // o líquido da nota gerada tem de bater com o nosso
  if (lida && Math.abs(lida.valores.liquido - v.valor_liquido) > 0.02) {
    alertas.push(`Líquido da NFS-e (${lida.valores.liquido.toFixed(2)}) difere do calculado (${v.valor_liquido.toFixed(2)}) — confira.`);
  }
  const titulos = opcoes.cobranca ? await gerarTitulosNfs(db, lanc.codfat, opcoes.cobranca) : null;
  return { codfat: lanc.codfat, chave, numero: numeroNfse, idDps: dps.id, ambiente, alertas, titulos };
}

/** Cancela no portal (evento 101101) e depois localmente. cMotivo: 1 erro na emissão · 2 serviço não prestado · 9 outros. */
export async function cancelarNfseNoPortal(
  db: Consultavel, codfat: string, cMotivo: '1' | '2' | '9', motivo: string, usuario: string,
) {
  const n = (await db.query(
    `SELECT codfat, chave_acesso, cancel, origem, ambiente_nfse FROM nfs_nota WHERE codfat = $1 FOR UPDATE`, [codfat])).rows[0];
  if (!n) throw new NfsValidacaoError('Nota não encontrada.');
  if (n.cancel === 'S') throw new NfsValidacaoError('A nota já está cancelada.');
  if (so(n.chave_acesso).length !== 50) throw new NfsValidacaoError('A nota não tem chave de acesso nacional.');
  const texto = String(motivo || '').trim();
  if (texto.length < 15) throw new NfsValidacaoError('Descreva o motivo do cancelamento (mínimo 15 caracteres).');

  const ambiente: AmbienteSefin = n.ambiente_nfse === 'PRODUCAO' || n.ambiente_nfse === 'RESTRITA' ? n.ambiente_nfse : ambienteSefin();
  const cert0 = process.env.NFSE_TESTE_PFX ? await certificadoAdn(db, '') : null;
  const cnpj = await cnpjPadraoAdn(db, cert0?.cnpjCertificado);
  const cert = cert0 || await certificadoAdn(db, cnpj);

  // primeiro as regras locais (título recebido bloqueia) — sem mexer em nada ainda
  const recebidos = (await db.query(
    `SELECT count(*)::int n FROM dbreceb WHERE tipo = 'S' AND cod_fat = $1 AND COALESCE(cancel,'N') <> 'S'
        AND (rec = 'S' OR COALESCE(valor_rec,0) > 0)`, [codfat])).rows[0].n;
  if (recebidos > 0) throw new NfsValidacaoError(`A nota tem ${recebidos} título(s) com recebimento. Estorne no Contas a Receber antes de cancelar.`);

  const ped = montarPedidoCancelamento({ ambiente, chave: n.chave_acesso, cnpjAutor: cnpj, dhEvento: agoraBrasilia(), cMotivo, motivo: texto });
  const assinado = assinarXmlNfse(ped.xml, 'infPedReg', cert.keyPem, cert.certPem);
  const r = await enviarEvento(cert.agent, ambiente, n.chave_acesso, assinado);
  if (!r.ok) throw new NfsValidacaoError(`A Sefin Nacional recusou o cancelamento: ${(r.erros || []).join(' | ') || `HTTP ${r.http}`}`);

  await db.query(`UPDATE nfs_nota SET cancel_evento_xml = $2, cancel_motivo = left($3, 255) WHERE codfat = $1`,
    [codfat, r.eventoXml || assinado, texto]);
  const local = await cancelarNotaServico(db, codfat, usuario, texto);
  return { ...local, ambiente };
}
