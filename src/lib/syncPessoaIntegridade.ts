import { getPgPool } from '@/lib/pgClient';
import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

/**
 * Integridade de pessoa (igual ao Delphi PESSOA_INTEGRIDADE_ATUALIZA).
 *
 * Quando um mesmo CPF/CNPJ existe em mais de um cadastro (cliente / fornecedor /
 * transportadora), ao salvar em um deles os campos comuns são replicados nos
 * demais: nome, iest (Inscr. Estadual), isuframa, imun (Inscr. Municipal) e tipo.
 *
 * Não sincroniza endereço/telefone/dados financeiros — apenas identidade + inscrições,
 * exatamente como o sistema legado.
 */
export type OrigemPessoa = 'CLIENTE' | 'FORNECEDOR' | 'TRANSPORTADORA';

interface PessoaComum {
  doc?: string | null;
  nome?: string | null;
  iest?: string | null;
  isuframa?: string | null;
  imun?: string | null;
  tipo?: string | null;
}

const TABELAS: Record<OrigemPessoa, { tabela: string; docCol: string }> = {
  CLIENTE: { tabela: 'dbclien', docCol: 'cpfcgc' },
  FORNECEDOR: { tabela: 'dbcredor', docCol: 'cpf_cgc' },
  TRANSPORTADORA: { tabela: 'dbtransp', docCol: 'cpfcgc' },
};

export async function syncPessoaIntegridade(
  filial: string,
  origem: OrigemPessoa,
  dados: PessoaComum,
): Promise<void> {
  try {
    // Mantém letras (CNPJ alfanumérico). Só sincroniza CPF (11) ou CNPJ (14).
    const digits = limparDocumentoAlfa(dados.doc || '');
    if (digits.length !== 11 && digits.length !== 14) return;

    const campos: Array<[string, any]> = [];
    if (dados.nome != null && dados.nome !== '') campos.push(['nome', dados.nome]);
    if (dados.iest != null && dados.iest !== '') campos.push(['iest', dados.iest]);
    if (dados.isuframa != null && dados.isuframa !== '')
      campos.push(['isuframa', dados.isuframa]);
    if (dados.imun != null && dados.imun !== '') campos.push(['imun', dados.imun]);
    if (dados.tipo != null && dados.tipo !== '') campos.push(['tipo', dados.tipo]);
    if (campos.length === 0) return;

    const pool = getPgPool(filial);
    const alvos = (Object.keys(TABELAS) as OrigemPessoa[]).filter(
      (o) => o !== origem,
    );

    for (const alvo of alvos) {
      const { tabela, docCol } = TABELAS[alvo];
      const setClause = campos.map(([c], i) => `"${c}" = $${i + 1}`).join(', ');
      const values = campos.map(([, v]) => v);
      values.push(digits);
      const sql = `UPDATE ${tabela} SET ${setClause}
                   WHERE regexp_replace(upper("${docCol}"), '[^0-9A-Z]', '', 'g') = $${values.length}`;
      await pool.query(sql, values);
    }
  } catch (e: any) {
    // Falha na sincronização nunca deve quebrar o salvamento principal
    console.error('[syncPessoaIntegridade] falha (ignorada):', e?.message);
  }
}
