/**
 * Banco local do aparelho (IndexedDB "melo-externo") da Venda Externa.
 *   produtos  (codprod)  — pacote: produtos com estoque (com preços) + sem estoque que têm
 *                          equivalente com estoque (disp 0, sem preço, só para a busca)
 *   clientes  (codcli)   — pacote: todos os clientes da filial ("carteira" = do vendedor)
 *   meta      (chave)    — data do pacote, tabelas auxiliares (formas, prazos, ...)
 *   pedidos   (uuid)     — fila de pedidos feitos no aparelho
 * Sem dependências: API nativa do navegador.
 */
const NOME = 'melo-externo';
const VERSAO = 1;
export type Store = 'produtos' | 'clientes' | 'meta' | 'pedidos';

let conexao: Promise<IDBDatabase> | null = null;

export function abrirBanco(): Promise<IDBDatabase> {
  if (conexao) return conexao;
  conexao = new Promise((ok, falha) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('produtos')) db.createObjectStore('produtos', { keyPath: 'codprod' });
      if (!db.objectStoreNames.contains('clientes')) db.createObjectStore('clientes', { keyPath: 'codcli' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'chave' });
      if (!db.objectStoreNames.contains('pedidos')) db.createObjectStore('pedidos', { keyPath: 'uuid' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => {
      conexao = null;
      falha(r.error);
    };
  });
  return conexao;
}

const req2p = <T>(r: IDBRequest<T>) =>
  new Promise<T>((ok, falha) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });

const tx2p = (t: IDBTransaction) =>
  new Promise<void>((ok, falha) => {
    t.oncomplete = () => ok();
    t.onerror = () => falha(t.error);
    t.onabort = () => falha(t.error);
  });

export async function todos<T = any>(store: Store): Promise<T[]> {
  const db = await abrirBanco();
  return req2p(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>;
}

export async function ler<T = any>(store: Store, chave: string): Promise<T | undefined> {
  const db = await abrirBanco();
  return req2p(db.transaction(store, 'readonly').objectStore(store).get(chave)) as Promise<T | undefined>;
}

export async function gravar(store: Store, valor: any): Promise<void> {
  const db = await abrirBanco();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).put(valor);
  await tx2p(t);
}

export async function apagar(store: Store, chave: string): Promise<void> {
  const db = await abrirBanco();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(chave);
  await tx2p(t);
}

/** Troca todo o conteúdo do store numa transação só (pacote novo). */
export async function substituirTudo(store: Store, valores: any[]): Promise<void> {
  const db = await abrirBanco();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  s.clear();
  for (const v of valores) s.put(v);
  await tx2p(t);
}

export const lerMeta = async <T = any>(chave: string): Promise<T | undefined> => (await ler<any>('meta', chave))?.valor;
export const gravarMeta = (chave: string, valor: any) => gravar('meta', { chave, valor });

/** Pede ao navegador para não apagar os dados do app (iPhone/Android). */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* */
  }
  return false;
}
