/**
 * Cliente da API de distribuição do ADN para contribuintes (Swagger "API NFS-e - ADN Contribuinte v1").
 *   GET /contribuintes/DFe/{NSU}?cnpjConsulta=<14 díg.>&lote=true
 *     - devolve até 50 documentos com NSU MAIOR que o informado (exclusive);
 *     - 200 DOCUMENTOS_LOCALIZADOS (LoteDFe) · 404 NENHUM_DOCUMENTO_LOCALIZADO (E2220) · 400 REJEICAO;
 *     - SEM cnpjConsulta o ADN responde 400 REJEICAO sem mensagem (conferido em 25/11/2026);
 *     - LoteDFe[]: NSU, ChaveAcesso, TipoDocumento (NFSE | EVENTO | ...), TipoEvento, ArquivoXml
 *       (GZip + Base64), DataHoraGeracao.
 *   GET /contribuintes/NFSe/{ChaveAcesso}/Eventos — eventos de uma nota.
 * Só servidor.
 */
import https from 'https';
import zlib from 'zlib';

export type AmbienteAdn = 'PRODUCAO' | 'RESTRITA';
const HOST: Record<AmbienteAdn, string> = {
  PRODUCAO: 'adn.nfse.gov.br',
  RESTRITA: 'adn.producaorestrita.nfse.gov.br',
};

export interface DocumentoAdn {
  nsu: number;
  chave: string | null;
  tipoDocumento: string | null;
  tipoEvento: string | null;
  dataGeracao: string | null;
  xml: string;
}

export interface RespostaAdn {
  http: number;
  status: string;                 // DOCUMENTOS_LOCALIZADOS | NENHUM_DOCUMENTO_LOCALIZADO | REJEICAO | ...
  documentos: DocumentoAdn[];
  mensagens: string[];            // erros e alertas "Codigo - Descricao (Complemento)"
}

/** ArquivoXml: GZip + Base64 (se não for GZip, tenta Base64 puro). */
export function decodificarXml(b64: string | null | undefined): string {
  if (!b64) return '';
  const buf = Buffer.from(String(b64), 'base64');
  try { return zlib.gunzipSync(buf).toString('utf8'); } catch { return buf.toString('utf8'); }
}

const pegar = (o: any, ...ks: string[]) => { for (const k of ks) if (o && o[k] !== undefined) return o[k]; return undefined; };

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const QUEDA = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', 'EAI_AGAIN']);

/** GET com até 3 tentativas quando a conexão cai (o ADN às vezes encerra conexões seguidas). */
async function requisitar(agent: https.Agent, host: string, caminho: string): Promise<{ http: number; corpo: string }> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await requisitarUmaVez(agent, host, caminho);
    } catch (e: any) {
      const queda = QUEDA.has(e?.code) || /socket hang up|Tempo esgotado/i.test(String(e?.message));
      if (!queda || tentativa >= 3) {
        throw new Error(`Falha na conexão com o ADN (${e?.code || e?.message}). Tente de novo em instantes.`);
      }
      await pausa(2000 * tentativa);
    }
  }
}

function requisitarUmaVez(agent: https.Agent, host: string, caminho: string): Promise<{ http: number; corpo: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host, path: caminho, method: 'GET', agent, headers: { Accept: 'application/json' }, timeout: 60000 },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c) => partes.push(c));
        res.on('end', () => resolve({ http: res.statusCode || 0, corpo: Buffer.concat(partes).toString('utf8') }));
      });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado na conexão com o ADN.')));
    req.end();
  });
}

function interpretar(http: number, corpo: string): RespostaAdn {
  let j: any = null;
  try { j = JSON.parse(corpo); } catch { /* corpo não-JSON (ex.: erro do proxy) */ }
  if (!j) return { http, status: `HTTP_${http}`, documentos: [], mensagens: [corpo.slice(0, 300)] };
  const lote: any[] = pegar(j, 'LoteDFe', 'loteDFe') || [];
  const msgs = [...(pegar(j, 'Erros', 'erros') || []), ...(pegar(j, 'Alertas', 'alertas') || [])]
    .map((m: any) => [pegar(m, 'Codigo', 'codigo'), pegar(m, 'Descricao', 'descricao')].filter(Boolean).join(' - ')
      + (pegar(m, 'Complemento', 'complemento') ? ` (${pegar(m, 'Complemento', 'complemento')})` : ''));
  return {
    http,
    status: String(pegar(j, 'StatusProcessamento', 'statusProcessamento') || `HTTP_${http}`),
    documentos: lote.map((d) => ({
      nsu: Number(pegar(d, 'NSU', 'nsu')),
      chave: pegar(d, 'ChaveAcesso', 'chaveAcesso') || null,
      tipoDocumento: pegar(d, 'TipoDocumento', 'tipoDocumento') || null,
      tipoEvento: pegar(d, 'TipoEvento', 'tipoEvento') || null,
      dataGeracao: pegar(d, 'DataHoraGeracao', 'dataHoraGeracao') || null,
      xml: decodificarXml(pegar(d, 'ArquivoXml', 'arquivoXml')),
    })),
    mensagens: msgs,
  };
}

/** Documentos com NSU maior que `nsu` (até 50). */
export async function consultarDistribuicao(agent: https.Agent, ambiente: AmbienteAdn, nsu: number, cnpjConsulta: string) {
  const cnpj = String(cnpjConsulta).replace(/\D/g, '');
  const q = `cnpjConsulta=${cnpj}&lote=true`;
  const { http, corpo } = await requisitar(agent, HOST[ambiente], `/contribuintes/DFe/${Math.max(0, Math.floor(nsu))}?${q}`);
  return interpretar(http, corpo);
}

/** Eventos vinculados a uma nota (cancelamento etc.). */
export async function consultarEventos(agent: https.Agent, ambiente: AmbienteAdn, chave: string) {
  const { http, corpo } = await requisitar(agent, HOST[ambiente], `/contribuintes/NFSe/${encodeURIComponent(chave)}/Eventos`);
  return interpretar(http, corpo);
}
