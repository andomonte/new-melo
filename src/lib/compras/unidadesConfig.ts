// src/lib/compras/unidadesConfig.ts
//
// Compras > Unidades Melo (cad_unidade_melo): os estabelecimentos da Melo (cada
// um com seu CNPJ) usados em "Entrega em" e "Destinado para" da Requisição e da
// Ordem de Compra. Não é a mesma coisa que a filial do sistema (tb_filial): são
// 8 unidades para 3 bases. A ligação com a filial é opcional e define a unidade
// padrão de quem está logado naquela filial.
//
// Sem exclusão: requisições e ordens antigas apontam para a unidade (FK). Para
// tirar das listas, inativa (unm_ativo = 'N').

import {
  ConfigArquivo,
  ErroValidacao,
  exigirExistencia,
  simNao,
  texto,
} from '@/lib/financeiro/arquivosCrud';

export const UNIDADES_MELO: ConfigArquivo = {
  tabela: 'cad_unidade_melo',
  pk: { prop: 'unm_id', coluna: 'unm_id' },
  pkGerada: { tamanho: 1 },
  colunas: [
    { prop: 'unm_nome', coluna: 'unm_nome' },
    { prop: 'unm_sigla', coluna: 'unm_sigla' },
    { prop: 'unm_cnpj', coluna: 'unm_cnpj' },
    { prop: 'unm_ativo', coluna: 'unm_ativo' },
    { prop: 'unm_codigo_filial', coluna: 'unm_codigo_filial' },
  ],
  colunasBusca: ['u.unm_nome', 'u.unm_sigla', 'u.unm_cnpj', 'f.nome_filial'],
  ordem: 'u.unm_nome ASC',
  aliasTabela: 'u',
  fromLista:
    'cad_unidade_melo u LEFT JOIN tb_filial f ON f.codigo_filial = u.unm_codigo_filial',
  selectLista: `u.unm_id AS unm_id, u.unm_nome AS unm_nome, u.unm_sigla AS unm_sigla,
                u.unm_cnpj AS unm_cnpj, u.unm_ativo AS unm_ativo,
                u.unm_codigo_filial AS unm_codigo_filial, f.nome_filial AS nome_filial`,
  normalizar: (body) => {
    const cnpj = String(body.unm_cnpj ?? '').replace(/\D/g, '');
    if (cnpj.length !== 14) throw new ErroValidacao('Informe o CNPJ com 14 dígitos.');
    const filialBruta = String(body.unm_codigo_filial ?? '').trim();
    const filial = filialBruta ? Number(filialBruta) : null;
    if (filial !== null && !Number.isInteger(filial)) {
      throw new ErroValidacao('Filial inválida.');
    }
    return {
      unm_nome: texto(body.unm_nome, { campo: 'o nome da unidade', max: 30, obrigatorio: true }),
      unm_sigla: texto(body.unm_sigla, { campo: 'a sigla da unidade', max: 5, obrigatorio: true }),
      unm_cnpj: cnpj,
      unm_ativo: simNao(body.unm_ativo, 'S'),
      unm_codigo_filial: filial,
    };
  },
  antesDeSalvar: async (client, v, _modo, id) => {
    if (v.unm_codigo_filial !== null) {
      await exigirExistencia(client, 'tb_filial', 'codigo_filial', v.unm_codigo_filial, 'Filial');
    }
    // Nome e sigla aparecem nas listas da requisição: não podem repetir.
    const { rows } = await client.query(
      `SELECT unm_nome, unm_sigla FROM cad_unidade_melo
        WHERE (upper(unm_nome) = upper($1) OR upper(unm_sigla) = upper($2))
          AND ($3::text IS NULL OR unm_id::text <> $3)
        LIMIT 1`,
      [v.unm_nome, v.unm_sigla, id ?? null],
    );
    if (rows.length) {
      throw new ErroValidacao(
        rows[0].unm_nome?.toUpperCase() === String(v.unm_nome).toUpperCase()
          ? 'Já existe uma unidade com esse nome.'
          : 'Já existe uma unidade com essa sigla.',
      );
    }
  },
};
