// src/lib/financeiro/arquivosConfig.ts
//
// Configuração dos cadastros de "Financeiro > Arquivos". Cada bloco reproduz
// a tela equivalente do Delphi — mesmas colunas, mesmos limites de tamanho e
// mesmas validações. A referência de cada um está no comentário do bloco.

import {
  ConfigArquivo,
  ErroValidacao,
  decimal,
  exigirExistencia,
  simNao,
  texto,
  zeroEsquerda,
} from './arquivosCrud';

/** Financeiro > Arquivos > Compradores — Geral/uniCompradores.pas (DBCOMPRADORES). */
export const COMPRADORES: ConfigArquivo = {
  tabela: 'dbcompradores',
  pk: { prop: 'codcomprador', coluna: 'codcomprador' },
  pkGerada: { tamanho: 3 },
  colunas: [{ prop: 'nome', coluna: 'nome' }],
  colunasBusca: ['codcomprador', 'nome'],
  ordem: 'nome ASC',
  normalizar: (body) => ({
    // btnSalvarClick: "Digite nome do comprador válido" se length < 5.
    nome: texto(body.nome, { campo: 'o nome do comprador', min: 5, max: 40, obrigatorio: true }),
  }),
  antesDeSalvar: async (client, v, modo, id) => {
    // O Delphi bloqueia nome repetido (rxComprador.Locate por NOME).
    const { rows } = await client.query(
      `SELECT 1 FROM dbcompradores
       WHERE upper(trim(nome)) = upper(trim($1)) AND ($2::text IS NULL OR codcomprador <> $2)
       LIMIT 1`,
      [v.nome, modo === 'editar' ? id : null],
    );
    if (rows.length) throw new ErroValidacao('Este comprador já está cadastrado.');
  },
};

/** Financeiro > Arquivos > Centro de Custos — Geral/UniCCusto.pas (DBCCUSTO). */
export const CENTROS_CUSTO: ConfigArquivo = {
  tabela: 'dbccusto',
  pk: { prop: 'cod_ccusto', coluna: 'cod_ccusto' },
  pkGerada: { tamanho: 4 },
  colunas: [
    { prop: 'descr', coluna: 'descr' },
    { prop: 'tipo', coluna: 'tipo' },
  ],
  colunasBusca: ['cod_ccusto', 'descr'],
  ordem: 'cod_ccusto ASC',
  normalizar: (body) => {
    const tipo = String(body.tipo ?? '').trim().toUpperCase().charAt(0);
    // Combo do Delphi: 'Ativo' -> 'A', 'Passivo' -> 'P' (grava a 1ª letra).
    if (tipo !== 'A' && tipo !== 'P') {
      throw new ErroValidacao('Informe o tipo do centro de custo (Ativo ou Passivo).');
    }
    return {
      descr: texto(body.descr, { campo: 'a descrição do centro de custo', max: 20, obrigatorio: true }),
      tipo,
    };
  },
};

/** Financeiro > Arquivos > UF — Formularios/UF_N/UniUF_N.pas (DBUF_N). */
export const UF: ConfigArquivo = {
  tabela: 'dbuf_n',
  // No Postgres as colunas de dbuf_n ficaram em CAIXA ALTA e entre aspas.
  pk: { prop: 'uf', coluna: 'UF' },
  colunas: [
    { prop: 'st', coluna: 'ST' },
    { prop: 'zona_isentivada', coluna: 'ZONA_ISENTIVADA' },
    { prop: 'icms_antecipado', coluna: 'ICMS_ANTECIPADO' },
    { prop: 'icmsinterno', coluna: 'ICMSINTERNO' },
    { prop: 'icmsexterno', coluna: 'ICMSEXTERNO' },
    { prop: 'icmscorredor', coluna: 'ICMSCORREDOR' },
  ],
  colunasBusca: ['"UF"'],
  ordem: '"UF" ASC',
  permiteExcluir: true, // btnAlt_Excluir do Delphi
  // meCad_UF: EditMask 'AA', MaxLength 2.
  normalizarPk: (body) =>
    texto(body.uf, { campo: 'a UF', min: 2, max: 2, obrigatorio: true }),
  normalizar: (body) => ({
    st: simNao(body.st),
    zona_isentivada: simNao(body.zona_isentivada),
    icms_antecipado: simNao(body.icms_antecipado),
    icmsinterno: decimal(body.icmsinterno, { campo: 'a alíquota de ICMS interna', min: 0, max: 99.99 }) ?? 0,
    icmsexterno: decimal(body.icmsexterno, { campo: 'a alíquota de ICMS externa', min: 0, max: 99.99 }) ?? 0,
    icmscorredor: decimal(body.icmscorredor, { campo: 'a alíquota de ICMS corredor', min: 0, max: 99.99 }) ?? 0,
  }),
};

/** Financeiro > Arquivos > Bancos Centrais — BANCO CENTRAL/uniBancoCentrais.pas (DBBANCOCENTRAL). */
export const BANCOS_CENTRAIS: ConfigArquivo = {
  tabela: 'dbbancocentral',
  pk: { prop: 'codbc', coluna: 'codbc' },
  colunas: [{ prop: 'descr', coluna: 'descr' }],
  colunasBusca: ['codbc', 'descr'],
  ordem: 'codbc ASC',
  // meCad_NroBanco: EditMask '999', MaxLength 3 e length < 3 é recusado.
  normalizarPk: (body) =>
    zeroEsquerda(
      texto(body.codbc, { campo: 'o nº do banco central', min: 1, max: 4, obrigatorio: true }),
      3,
    ),
  normalizar: (body) => ({
    // btnCad_SalvarClick exige nome com 3+ caracteres.
    descr: texto(body.descr, { campo: 'o nome do banco central', min: 3, max: 60, obrigatorio: true }),
  }),
};

/** Financeiro > Arquivos > Agências — Geral/UniBanco.pas (DBBANCO). */
export const AGENCIAS: ConfigArquivo = {
  tabela: 'dbbanco',
  pk: { prop: 'cod_banco', coluna: 'cod_banco' },
  pkGerada: { tamanho: 4 },
  colunas: [
    { prop: 'cod_bc', coluna: 'cod_bc' },
    // dbbanco tem cod_bc e codbc com o mesmo conteúdo (herança da migração
    // Oracle->PG). Gravamos as duas para não quebrar quem lê a outra.
    { prop: 'codbc', coluna: 'codbc' },
    { prop: 'nome', coluna: 'nome' },
    { prop: 'n_agencia', coluna: 'n_agencia' },
    { prop: 'endereco', coluna: 'endereco' },
    { prop: 'cidade', coluna: 'cidade' },
    { prop: 'uf', coluna: 'uf' },
    { prop: 'cep', coluna: 'cep' },
    { prop: 'contatos', coluna: 'contatos' },
  ],
  colunasBusca: ['b.cod_banco', 'b.nome', 'b.n_agencia', 'b.cod_bc'],
  ordem: 'b.nome ASC',
  aliasTabela: 'b',
  fromLista: 'dbbanco b LEFT JOIN dbbancocentral bc ON bc.codbc = lpad(trim(b.cod_bc), 3, \'0\')',
  selectLista: `b.cod_banco AS cod_banco, b.cod_bc AS cod_bc, b.codbc AS codbc,
                bc.descr AS banco_central, b.nome AS nome, b.n_agencia AS n_agencia,
                b.endereco AS endereco, b.cidade AS cidade, b.uf AS uf,
                b.cep AS cep, b.contatos AS contatos`,
  normalizar: (body) => {
    // Btn4Click/btnCad_SalvarClick: nº da agência e banco com 3+ caracteres.
    const codBc = zeroEsquerda(
      texto(body.cod_bc, { campo: 'o banco', min: 3, max: 4, obrigatorio: true }),
      3,
    );
    return {
      cod_bc: codBc,
      codbc: codBc,
      nome: texto(body.nome, { campo: 'o nome da agência', max: 45 }),
      n_agencia: texto(body.n_agencia, { campo: 'o número da agência', min: 3, max: 10, obrigatorio: true }),
      endereco: texto(body.endereco, { campo: 'o endereço', max: 50 }),
      cidade: texto(body.cidade, { campo: 'a cidade', max: 20 }),
      uf: texto(body.uf, { campo: 'a UF', max: 2 }),
      cep: texto(body.cep, { campo: 'o CEP', max: 9 }),
      contatos: texto(body.contatos, { campo: 'os contatos', max: 25 }),
    };
  },
  antesDeSalvar: async (client, v) => {
    await exigirExistencia(client, 'dbbancocentral', 'codbc', v.cod_bc, 'Banco central');
  },
};

/** Financeiro > Arquivos > Contas Bancárias — Formularios/CONTA/UniConta.pas (DBCONTA). */
export const CONTAS_BANCARIAS: ConfigArquivo = {
  tabela: 'dbconta',
  pk: { prop: 'cod_conta', coluna: 'cod_conta' },
  pkGerada: { tamanho: 4 },
  colunas: [
    { prop: 'cod_banco', coluna: 'cod_banco' },
    { prop: 'nro_conta', coluna: 'nro_conta' },
    { prop: 'digito', coluna: 'digito' },
    { prop: 'oficial', coluna: 'oficial' },
  ],
  colunasBusca: ['c.cod_conta', 'c.nro_conta', 'b.nome'],
  ordem: 'c.nro_conta ASC',
  aliasTabela: 'c',
  fromLista: 'dbconta c LEFT JOIN dbbanco b ON b.cod_banco = c.cod_banco',
  selectLista: `c.cod_conta AS cod_conta, c.cod_banco AS cod_banco,
                b.n_agencia AS n_agencia, b.nome AS agencia,
                c.nro_conta AS nro_conta, c.digito AS digito, c.oficial AS oficial`,
  normalizar: (body) => ({
    cod_banco: zeroEsquerda(
      texto(body.cod_banco, { campo: 'a agência', min: 1, max: 4, obrigatorio: true }),
      4,
    ),
    nro_conta: texto(body.nro_conta, { campo: 'o nº da conta', min: 3, max: 15, obrigatorio: true }),
    digito: texto(body.digito, { campo: 'o dígito da conta', min: 1, max: 1, obrigatorio: true }),
    // rgConta: 'Oficial' -> 'S', 'Não Oficial' -> 'N'.
    oficial: simNao(body.oficial, 'S'),
  }),
  antesDeSalvar: async (client, v) => {
    // PageControl1Change: "Cadastro de Conta somente na Matriz" (UF = 'AM').
    const { rows } = await client.query(
      `SELECT uf FROM dadosempresa WHERE uf IS NOT NULL LIMIT 1`,
    );
    if (rows.length && String(rows[0].uf).toUpperCase() !== 'AM') {
      throw new ErroValidacao('Cadastro e alteração de conta somente na Matriz.');
    }
    await exigirExistencia(client, 'dbbanco', 'cod_banco', v.cod_banco, 'Agência');
  },
};

/** Financeiro > Arquivos > Serviços — SERVIÇO/UnitFormServico.pas (SEN_* / dbservico_nfs). */
export const SERVICOS: ConfigArquivo = {
  tabela: 'dbservico_nfs',
  pk: { prop: 'sen_id', coluna: 'sen_id' },
  pkGerada: { tamanho: 9 },
  colunas: [
    { prop: 'sen_codigo', coluna: 'sen_codigo' },
    { prop: 'sen_cnae', coluna: 'sen_cnae' },
    { prop: 'sen_codunico', coluna: 'sen_codunico' },
    { prop: 'sen_atividade', coluna: 'sen_atividade' },
    { prop: 'sen_issqn', coluna: 'sen_issqn' },
    { prop: 'sen_codgpc', coluna: 'sen_codgpc' },
    { prop: 'sen_excluido', coluna: 'sen_excluido' },
  ],
  colunasBusca: ['s.sen_codigo', 's.sen_cnae', 's.sen_atividade'],
  ordem: 's.sen_codigo ASC',
  aliasTabela: 's',
  fromLista: 'dbservico_nfs s LEFT JOIN dbgpprod_contabil g ON g.codgpc = s.sen_codgpc',
  selectLista: `s.sen_id AS sen_id, s.sen_codigo AS sen_codigo, s.sen_cnae AS sen_cnae,
                s.sen_codunico AS sen_codunico, s.sen_atividade AS sen_atividade,
                s.sen_issqn AS sen_issqn, s.sen_codgpc AS sen_codgpc,
                g.descr AS gpcontabil, s.sen_excluido AS sen_excluido`,
  normalizar: (body) => {
    const codigo = texto(body.sen_codigo, { campo: 'o código do serviço', max: 5, obrigatorio: true });
    const cnae = texto(body.sen_cnae, { campo: 'o CNAE do serviço', max: 9, obrigatorio: true });
    return {
      sen_codigo: codigo,
      sen_cnae: cnae,
      // BitBtn4Click: vsen_codunico = TiraSinais(codigo + cnae).
      sen_codunico: `${codigo}${cnae}`.replace(/\D/g, ''),
      sen_atividade: texto(body.sen_atividade, { campo: 'a atividade do serviço', max: 150, obrigatorio: true }),
      sen_issqn: decimal(body.sen_issqn, { campo: 'a alíquota de ISSQN', min: 0, max: 99.99 }) ?? 0,
      sen_codgpc: texto(body.sen_codgpc, { campo: 'o grupo contábil do serviço', max: 4, obrigatorio: true }),
      sen_excluido: Number(body.sen_excluido ?? 0) || 0,
    };
  },
  antesDeSalvar: async (client, v) => {
    await exigirExistencia(client, 'dbgpprod_contabil', 'codgpc', v.sen_codgpc, 'Grupo contábil');
  },
};
