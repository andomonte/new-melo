/**
 * Equivalentes COM estoque de um ou mais grupos de equivalência (dbprod.codgpe) — mesmo
 * critério do F9 "Equivalentes" da Nova Venda, mas com o disponível do ARMAZÉM do vendedor
 * (cad_armazem_produto), igual ao resto da Venda Externa. Só servidor.
 */
import type { PoolClient, Pool } from 'pg';

export interface Equivalente {
  codprod: string;
  ref: string;
  descr: string;
  marca: string;
  codgpe: string;
  disp: number;
  preco: number;
}

export async function buscarEquivalentes(
  db: Pool | PoolClient,
  grupos: string[],
  opts: { arm: number; prvenda: string; min?: number },
): Promise<Equivalente[]> {
  const gs = Array.from(new Set(grupos.map((g) => String(g || '').trim()).filter(Boolean))).slice(0, 50);
  if (gs.length === 0) return [];
  // dbprod não tem índice em codgpe: uma varredura só para todos os grupos (~0,2 s)
  const r = await db.query(
    `SELECT p.codprod, p.ref, COALESCE(NULLIF(btrim(p.aplic_extendida),''), p.descr) AS descr,
            m.descr AS marca, btrim(p.codgpe) AS codgpe, d.disp, COALESCE(fp."PRECOVENDA", 0) AS preco
       FROM dbprod p
       JOIN dbmarcas m ON m.codmarca = p.codmarca
       JOIN LATERAL (
         SELECT SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0)) AS disp
           FROM cad_armazem_produto
          WHERE arp_arm_id = $2 AND arp_codprod = p.codprod AND COALESCE(arp_bloqueado,'N') <> 'S'
       ) d ON d.disp >= $4
       LEFT JOIN dbformacaoprvenda fp ON fp."CODPROD" = p.codprod AND fp."TIPOPRECO"::text = $3::text
      WHERE btrim(p.codgpe) = ANY($1::text[])
        AND COALESCE(p.inf,'') <> 'D' AND COALESCE(p.excluido,0) <> 1
      ORDER BY btrim(p.codgpe), d.disp DESC, p.ref
      LIMIT 500`,
    [gs, opts.arm, String(opts.prvenda || '0'), Math.max(1, opts.min || 1)],
  );
  return r.rows.map((x: any) => ({
    codprod: String(x.codprod).trim(),
    ref: x.ref || '',
    descr: x.descr || '',
    marca: x.marca || '',
    codgpe: x.codgpe || '',
    disp: Number(x.disp) || 0,
    preco: Number(x.preco) || 0,
  }));
}
