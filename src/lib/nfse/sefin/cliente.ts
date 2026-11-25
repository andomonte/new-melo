/**
 * Cliente da Sefin Nacional (Swagger "API NFS-e - Sefin Nacional v1", basePath /SefinNacional):
 *   POST /nfse                       { dpsXmlGZipB64 }  → 201 { chaveAcesso, idDps, nfseXmlGZipB64, alertas } | 400 { erros[] }
 *   GET  /nfse/{chave}                                  → 200 { nfseXmlGZipB64 }
 *   GET  /dps/{idDps}                                   → 200 { chaveAcesso }   (recupera a nota de uma DPS já enviada)
 *   POST /nfse/{chave}/eventos       { pedidoRegistroEventoXmlGZipB64 } → 201 { eventoXmlGZipB64 } | 400 { erro }
 * mTLS com o certificado da empresa (mesmo de ADN, ver ../adn/certificado.ts). Só servidor.
 */
import https from 'https';
import zlib from 'zlib';
import type { AmbienteSefin } from './xml';

const HOST: Record<AmbienteSefin, string> = {
  PRODUCAO: 'sefin.nfse.gov.br',
  RESTRITA: 'sefin.producaorestrita.nfse.gov.br',
};
const BASE = '/SefinNacional';

const gzipB64 = (xml: string) => zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
const deGzipB64 = (b64?: string | null) => {
  if (!b64) return '';
  const buf = Buffer.from(b64, 'base64');
  try { return zlib.gunzipSync(buf).toString('utf8'); } catch { return buf.toString('utf8'); }
};

export class SefinConexaoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'SefinConexaoError'; }
}

function chamar(agent: https.Agent, ambiente: AmbienteSefin, metodo: 'GET' | 'POST', caminho: string, corpo?: any) {
  const body = corpo ? JSON.stringify(corpo) : undefined;
  return new Promise<{ http: number; json: any; texto: string }>((resolve, reject) => {
    const req = https.request({
      host: HOST[ambiente], path: `${BASE}${caminho}`, method: metodo, agent, timeout: 90000,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) },
    }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let json: any = null;
        try { json = JSON.parse(texto); } catch { /* corpo não-JSON */ }
        resolve({ http: res.statusCode || 0, json, texto });
      });
    });
    req.on('error', (e: any) => reject(new SefinConexaoError(`Falha na conexão com a Sefin Nacional (${e?.code || e?.message}).`)));
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    if (body) req.write(body);
    req.end();
  });
}

const mensagens = (j: any): string[] => {
  const lista = [...(j?.erros || j?.Erros || []), ...(j?.erro ? [j.erro] : [])];
  return lista.map((m: any) => [m.Codigo || m.codigo, m.Descricao || m.descricao].filter(Boolean).join(' - ')
    + ((m.Complemento || m.complemento) ? ` (${m.Complemento || m.complemento})` : ''));
};

export interface ResultadoEmissao {
  ok: boolean;
  chave?: string;
  idDps?: string;
  nfseXml?: string;
  alertas?: string[];
  erros?: string[];
  http: number;
}

/** Envia a DPS assinada. */
export async function enviarDps(agent: https.Agent, ambiente: AmbienteSefin, dpsAssinada: string): Promise<ResultadoEmissao> {
  const r = await chamar(agent, ambiente, 'POST', '/nfse', { dpsXmlGZipB64: gzipB64(dpsAssinada) });
  if (r.http === 201 || r.http === 200) {
    return {
      ok: true, http: r.http, chave: r.json?.chaveAcesso, idDps: r.json?.idDps,
      nfseXml: deGzipB64(r.json?.nfseXmlGZipB64), alertas: mensagens({ erros: r.json?.alertas || [] }),
    };
  }
  return { ok: false, http: r.http, idDps: r.json?.idDPS || r.json?.idDps, erros: r.json ? mensagens(r.json) : [r.texto.slice(0, 300)] };
}

/** Chave da NFS-e gerada a partir de uma DPS (para recuperar um envio cuja resposta se perdeu). */
export async function chavePorDps(agent: https.Agent, ambiente: AmbienteSefin, idDps: string): Promise<string | null> {
  const r = await chamar(agent, ambiente, 'GET', `/dps/${encodeURIComponent(idDps)}`);
  return r.http === 200 ? (r.json?.chaveAcesso || null) : null;
}

export async function consultarNfse(agent: https.Agent, ambiente: AmbienteSefin, chave: string): Promise<string | null> {
  const r = await chamar(agent, ambiente, 'GET', `/nfse/${encodeURIComponent(chave)}`);
  return r.http === 200 ? deGzipB64(r.json?.nfseXmlGZipB64) : null;
}

/** Registra um evento (ex.: cancelamento) — pedido já assinado. */
export async function enviarEvento(agent: https.Agent, ambiente: AmbienteSefin, chave: string, pedidoAssinado: string) {
  const r = await chamar(agent, ambiente, 'POST', `/nfse/${encodeURIComponent(chave)}/eventos`,
    { pedidoRegistroEventoXmlGZipB64: gzipB64(pedidoAssinado) });
  if (r.http === 201 || r.http === 200) return { ok: true, http: r.http, eventoXml: deGzipB64(r.json?.eventoXmlGZipB64) };
  return { ok: false, http: r.http, erros: r.json ? mensagens(r.json) : [r.texto.slice(0, 300)] };
}
