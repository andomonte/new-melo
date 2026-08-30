import crypto from 'crypto';

export interface ItemComprovante {
  cod_fprereceb?: string | null;
  cod_receb: string;
  valor: number;
  nro_doc?: string | null;
  valor_areceber?: number;
  valor_juros?: number;
  valor_total?: number;
}

export interface GerarComprovanteParams {
  codusr?: string | null; // aut_codusr
  cod_conta?: string | null; // aut_codconta
  itens: ItemComprovante[];
  filial?: string; // dígito de filial do aut_id (Manaus = '1')
}

/**
 * Gera um Comprovante de Pagamento (autenticação) fiel ao Delphi:
 *  - fin_autenticacao (cabeçalho: aut_id, usuário, data, conta, hash, cancel=0)
 *  - fin_item_autenticacao (itens: ita_id = aut_id, um por título recebido)
 *
 * aut_id = <filial 1díg> + <YYYYMM> + <seq 7díg>, sequência por filial+mês (padrão do Oracle).
 * Deve rodar DENTRO da transação do recebimento (recebe o mesmo client).
 * Retorna { aut_id, autenticacao }.
 */
export async function gerarComprovante(
  client: any,
  { codusr, cod_conta, itens, filial = '1' }: GerarComprovanteParams,
): Promise<{ aut_id: string; autenticacao: string } | null> {
  if (!itens || itens.length === 0) return null;

  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  // base = <filial><YYYYMM>0000000 (bigint). O seq ocupa os 7 últimos dígitos.
  const base = BigInt(`${filial}${yyyymm}0000000`);
  const limite = base + BigInt(10000000);

  // Próximo aut_id: MAX no intervalo do mês + 1 (ou base+1 se for o 1º do mês).
  const mx = await client.query(
    `SELECT COALESCE(MAX(aut_id), $1::numeric) AS mx
       FROM fin_autenticacao
      WHERE aut_id >= $1::numeric AND aut_id < $2::numeric`,
    [base.toString(), limite.toString()],
  );
  const maxAtual = BigInt(String(mx.rows[0].mx));
  const autId = (maxAtual >= base ? maxAtual + BigInt(1) : base + BigInt(1)).toString();

  // Hash de autenticação (32 hex maiúsculo), como o Delphi.
  const autenticacao = crypto
    .createHash('md5')
    .update(`${autId}|${now.toISOString()}|${itens.map((i) => i.cod_receb).join(',')}`)
    .digest('hex')
    .toUpperCase();

  await client.query(
    `INSERT INTO fin_autenticacao (aut_id, aut_codusr, aut_data, aut_codconta, aut_autenticacao, aut_cancel)
     VALUES ($1::numeric, $2, now(), $3, $4, 0)`,
    [autId, codusr ? String(codusr) : null, cod_conta ? String(cod_conta) : null, autenticacao],
  );

  for (const it of itens) {
    const areceber = it.valor_areceber ?? it.valor;
    const juros = it.valor_juros ?? 0;
    const total = it.valor_total ?? Number(areceber) + Number(juros);
    await client.query(
      `INSERT INTO fin_item_autenticacao
         (ita_id, ita_cod_fprereceb, ita_cod_receb, ita_valor, ita_nro_doc, ita_valo_areceber, ita_valor_juros, ita_valor_total)
       VALUES ($1::numeric, $2, $3, $4, $5, $6, $7, $8)`,
      [
        autId,
        it.cod_fprereceb ?? '0', // NOT NULL na tabela
        String(it.cod_receb),
        it.valor,
        it.nro_doc ?? null,
        areceber,
        juros,
        total,
      ],
    );
  }

  return { aut_id: autId, autenticacao };
}
