import type { TituloAberto, ClienteResolvido } from './matcher';

/**
 * Camada de banco da conciliação (acoplada ao Postgres). As partes puras
 * (parseCsv, classificar, extrairPagador, matcher) NÃO dependem disto.
 */

/** Decodifica o arquivo detectando UTF-8 vs ISO-8859-1 (Santander costuma ser latin1). */
export function decodificarExtrato(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  // Se a decodificação UTF-8 produziu caractere de substituição, cai para latin1.
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}

/** Resolve o cliente por CPF/CNPJ (exato) e, na falta, por similaridade de nome (pg_trgm). */
export async function resolverCliente(
  client: any,
  documento: string | null,
  nomeNorm: string | null,
): Promise<ClienteResolvido | null> {
  if (documento) {
    const r = await client.query(
      `SELECT codcli FROM dbclien
        WHERE regexp_replace(COALESCE(cpfcgc,''), '\\D', '', 'g') = $1
        LIMIT 1`,
      [documento],
    );
    if (r.rows[0]) return { codcli: String(r.rows[0].codcli), via: 'cpfcgc' };
  }
  // Apelido memorizado: por documento (forte) e, na falta, por nome normalizado.
  if (documento) {
    const a = await client.query(
      `SELECT apl_codcli FROM conc_apelido WHERE apl_doc = $1 ORDER BY apl_data DESC LIMIT 1`,
      [documento],
    );
    if (a.rows[0]) return { codcli: String(a.rows[0].apl_codcli), via: 'apelido' };
  }
  if (nomeNorm && nomeNorm.length >= 4) {
    const a = await client.query(
      `SELECT apl_codcli FROM conc_apelido WHERE apl_nome_norm = $1 ORDER BY apl_data DESC LIMIT 1`,
      [nomeNorm],
    );
    if (a.rows[0]) return { codcli: String(a.rows[0].apl_codcli), via: 'apelido' };
  }
  if (nomeNorm && nomeNorm.length >= 4) {
    const r = await client.query(
      `SELECT codcli, similarity(UPPER(nome), $1) AS sim
         FROM dbclien
        WHERE UPPER(nome) % $1
        ORDER BY sim DESC
        LIMIT 1`,
      [nomeNorm],
    );
    if (r.rows[0] && Number(r.rows[0].sim) >= 0.45) {
      return { codcli: String(r.rows[0].codcli), via: 'nome', score: Number(r.rows[0].sim) };
    }
  }
  return null;
}

/** Memoriza o pagador → cliente (apelido). Por documento (upsert) ou por nome normalizado. */
export async function salvarApelido(
  client: any,
  args: { documento?: string | null; nomeNorm?: string | null; codcli: string; usuario?: string | null },
): Promise<void> {
  const doc = (args.documento || '').replace(/\D/g, '') || null;
  const nome = (args.nomeNorm || '').trim() || null;
  if (!args.codcli || (!doc && !nome)) return;
  if (doc) {
    await client.query(
      `INSERT INTO conc_apelido (apl_doc, apl_nome_norm, apl_codcli, apl_usuario)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (apl_doc) WHERE apl_doc IS NOT NULL AND apl_doc <> ''
       DO UPDATE SET apl_codcli = EXCLUDED.apl_codcli, apl_nome_norm = EXCLUDED.apl_nome_norm,
                     apl_usuario = EXCLUDED.apl_usuario, apl_data = now()`,
      [doc, nome, String(args.codcli), String(args.usuario ?? '').substring(0, 60)],
    );
  } else {
    // Sem documento: evita duplicar o mesmo nome→cliente.
    const ja = await client.query(
      `SELECT 1 FROM conc_apelido WHERE apl_nome_norm = $1 AND apl_codcli = $2 LIMIT 1`,
      [nome, String(args.codcli)],
    );
    if (!ja.rows[0]) {
      await client.query(
        `INSERT INTO conc_apelido (apl_nome_norm, apl_codcli, apl_usuario) VALUES ($1,$2,$3)`,
        [nome, String(args.codcli), String(args.usuario ?? '').substring(0, 60)],
      );
    }
  }
}

/** Títulos em aberto do cliente na janela mês±1 do pagamento (saldo em centavos). */
export async function buscarTitulosAbertos(
  client: any,
  codcli: string,
  dataPgto: string,
): Promise<TituloAberto[]> {
  const r = await client.query(
    `SELECT r.cod_receb, r.codcli, c.nome AS nome_cliente, r.nro_doc,
            ROUND((COALESCE(r.valor_pgto,0) - COALESCE(r.valor_rec,0)) * 100)::bigint AS saldo_cent,
            to_char(r.dt_venc,'YYYY-MM-DD') AS dt_venc,
            (SELECT COUNT(*) FROM dbreceb rn
              WHERE COALESCE(rn.cod_fat,'AV'||rn.cod_receb) = COALESCE(r.cod_fat,'AV'||r.cod_receb))::int AS parcela_n,
            (SELECT COUNT(*) FROM dbreceb rx
              WHERE COALESCE(rx.cod_fat,'AV'||rx.cod_receb) = COALESCE(r.cod_fat,'AV'||r.cod_receb)
                AND rx.cod_receb <= r.cod_receb)::int AS parcela_x
       FROM dbreceb r
       LEFT JOIN dbclien c ON c.codcli = r.codcli
      WHERE LTRIM(CAST(r.codcli AS TEXT),'0') = LTRIM($1,'0')
        AND r.rec IS DISTINCT FROM 'S'
        AND (r.cancel IS NULL OR r.cancel <> 'S')
        AND (COALESCE(r.valor_pgto,0) - COALESCE(r.valor_rec,0)) > 0
        AND r.dt_venc BETWEEN $2::date - INTERVAL '1 month' AND $2::date + INTERVAL '1 month'
      ORDER BY r.dt_venc
      LIMIT 200`,
    [codcli, dataPgto],
  );
  return r.rows.map((x: any) => ({
    cod_receb: String(x.cod_receb),
    codcli: String(x.codcli),
    nome_cliente: x.nome_cliente,
    saldoCentavos: Number(x.saldo_cent),
    dt_venc: x.dt_venc,
    nro_doc: x.nro_doc ?? null,
    parcelaX: x.parcela_x != null ? Number(x.parcela_x) : null,
    parcelaN: x.parcela_n != null ? Number(x.parcela_n) : null,
  }));
}
