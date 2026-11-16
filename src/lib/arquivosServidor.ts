// src/lib/arquivosServidor.ts
//
// Pasta gravável para arquivos que o servidor gera (remessas, PDFs, XML de
// diagnóstico).
//
// No container (Dockerfile) o app roda como usuário `nextjs` e /app é do root:
// gravar em process.cwd() (/app, /app/public, /app/tmp...) falha com EACCES.
// Por isso tudo vai para ARQUIVOS_DIR ou, sem ela, para a pasta temporária do
// sistema (/tmp no Linux; o docker-compose já monta /tmp do host).
//
// Para guardar de forma permanente (ex.: remessas bancárias), defina no .env do
// servidor ARQUIVOS_DIR=/caminho/montado e monte esse caminho como volume.

import fs from 'fs';
import os from 'os';
import path from 'path';

export const DIR_ARQUIVOS = process.env.ARQUIVOS_DIR || path.join(os.tmpdir(), 'melo-arquivos');

/** Devolve (e cria, se preciso) uma subpasta gravável: dirArquivos('remessas', 'bancaria'). */
export function dirArquivos(...sub: string[]): string {
  const dir = path.join(DIR_ARQUIVOS, ...sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Remessas bancárias (CNAB). */
export const SUB_REMESSA_BANCARIA = ['remessas', 'bancaria'] as const;

/** Onde as versões antigas gravavam a remessa bancária (ainda lido no download). */
export const DIR_REMESSA_BANCARIA_LEGADO = path.join(process.cwd(), 'public', 'remessas', 'bancaria');

/** Aceita só nome de arquivo simples (sem pasta, sem "..") para downloads. */
export function nomeArquivoSeguro(nome: string): string | null {
  const base = path.basename(String(nome || ''));
  return /^[A-Za-z0-9._-]+$/.test(base) && !base.startsWith('.') ? base : null;
}
