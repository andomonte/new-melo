import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { formatTexto, notChar } from '@/utils/formatTexto';
import fs from 'fs';
import path from 'path';

const pool = getPgPool();

// Função auxiliar para formatar número com zeros à esquerda
// Função auxiliar para formatar número com zeros à esquerda
function padLeft(value: string | number, length: number, char: string = '0'): string {
  const str = String(value !== null && value !== undefined ? value : '');
  return str.slice(0, length).padStart(length, char);
}

// Função auxiliar para formatar número com espaços à direita
function padRight(value: string, length: number, char: string = ' '): string {
  const str = String(value !== null && value !== undefined ? value : '');
  return str.slice(0, length).padEnd(length, char);
}

// Função auxiliar para formatar valores monetários (sem vírgula, com centavos)
function formatValor(valor: number, length: number = 13): string {
  const valorCentavos = Math.round(valor * 100);
  return padLeft(valorCentavos, length);
}

// Função auxiliar para formatar data no formato DDMMAA
function formatDataDDMMAA(data: Date): string {
  const dia = padLeft(data.getDate(), 2);
  const mes = padLeft(data.getMonth() + 1, 2);
  const ano = String(data.getFullYear()).slice(-2);
  return `${dia}${mes}${ano}`;
}

// Função auxiliar para formatar data no formato DDMMAAAA
function formatDataDDMMAAAA(data: Date): string {
  const dia = padLeft(data.getDate(), 2);
  const mes = padLeft(data.getMonth() + 1, 2);
  const ano = String(data.getFullYear());
  return `${dia}${mes}${ano}`;
}

// Interface para os dados de título
interface TituloCNAB {
  nosso_numero: string;
  numero_documento: string;
  data_vencimento: Date;
  valor_titulo: number;
  nome_pagador: string;
  cpf_cnpj_pagador: string;
  endereco_pagador: string;
  cep_pagador: string;
  cidade_pagador: string;
  uf_pagador: string;
  cod_receb: number;
  codcli: string;  // Código do cliente (Oracle)
  cod_conta: string;  // Código da conta bancária (Oracle)
  nroseq?: number;  // Número sequencial no arquivo (Oracle)
  linha_cnab?: string;  // Linha CNAB completa - campo REGISTRO (Oracle)
}

// Gerar registro HEADER (tipo 0) - BRADESCO
function gerarHeaderBradesco(
  sequencial: number,
  dataGeracao: Date,
  convenio: string
): string {
  let linha = '';

  // 001-001: Identificação do Registro (0)
  linha += '0';

  // 002-002: Identificação do Arquivo Remessa (1)
  linha += '1';

  // 003-009: Literal "REMESSA"
  linha += 'REMESSA';

  // 010-011: Código do Serviço (01 = Cobrança)
  linha += '01';

  // 012-026: Literal "COBRANCA"
  linha += padRight('COBRANCA', 15);

  // 027-046: Código da Empresa (20 posições)
  linha += padLeft(convenio, 20, '0');

  // 047-076: Nome da Empresa (30 posições)
  linha += padRight('MELO COMERCIO', 30);

  // 077-079: Código do Banco (237)
  linha += '237';

  // 080-094: Nome do Banco (15 posições)
  linha += padRight('BRADESCO', 15);

  // 095-100: Data de Geração (DDMMAA)
  linha += formatDataDDMMAA(dataGeracao);

  // 101-108: Brancos (8 posições)
  linha += padRight('', 8);

  // 109-110: Identificação do Sistema (MX)
  linha += 'MX';

  // 111-117: Nº Sequencial do Arquivo (7 posições)
  linha += padLeft(sequencial, 7);

  // 118-394: Brancos (277 posições)
  linha += padRight('', 277);

  // 395-400: Nº Sequencial do Registro (000001)
  linha += '000001';

  return linha;
}

// Gerar registro HEADER (tipo 0) - SANTANDER
function gerarHeaderSantander(
  sequencial: number,
  dataGeracao: Date,
  convenio: string
): string {
  let linha = '';

  // 001-001: Identificação do Registro (0)
  linha += '0';

  // 002-002: Identificação do Arquivo Remessa (1)
  linha += '1';

  // 003-009: Literal "REMESSA"
  linha += 'REMESSA';

  // 010-011: Código do Serviço (01 = Cobrança)
  linha += '01';

  // 012-026: Literal "COBRANCA"
  linha += padRight('COBRANCA', 15);

  // 027-046: Código da Transmissão (20 posições) - Convênio Santander
  linha += padLeft(convenio, 20, '0');

  // 047-076: Nome da Empresa (30 posições)
  linha += padRight('MELO COMERCIO', 30);

  // 077-079: Código do Banco (033)
  linha += '033';

  // 080-094: Nome do Banco (15 posições)
  linha += padRight('SANTANDER', 15);

  // 095-100: Data de Geração (DDMMAA)
  linha += formatDataDDMMAA(dataGeracao);

  // 101-394: Brancos (294 posições)
  linha += padRight('', 294);

  // 395-400: Nº Sequencial do Registro (000001)
  linha += '000001';

  return linha;
}

// Gerar registro DETALHE (tipo 1) - BRADESCO
function gerarDetalheBradesco(
  titulo: TituloCNAB,
  sequencial: number,
  convenio: string
): string {
  let linha = '';

  // 001-001: Identificação do Registro (1)
  linha += '1';

  // 002-003: Tipo de Inscrição Empresa (01=CPF, 02=CNPJ)
  linha += '02';

  // 004-017: Número de Inscrição da Empresa (14 posições) - CNPJ
  linha += padLeft('18053139000169', 14, '0');

  // 018-020: Prefixo da Agência (3 posições)
  linha += '000';

  // 021-021: Dígito Verificador da Agência (1 posição)
  linha += '0';

  // 022-026: Conta Corrente (5 posições)
  linha += padLeft('00000', 5);

  // 027-027: Dígito Verificador da Conta (1 posição)
  linha += '0';

  // 028-028: Zero fixo
  linha += '0';

  // 029-037: Código Controle da Empresa (Uso da Empresa) - 9 posições
  linha += padLeft(titulo.cod_receb, 9);

  // 038-062: Nosso Número (25 posições) - Carteira + Nosso Número
  // Bradesco: Carteira (2) + Nosso Número (11) + zeros (12)
  const nossoNumero = padLeft(titulo.nosso_numero, 11, '0');
  linha += '09' + nossoNumero + padLeft('', 12, '0');

  // 063-072: Brancos (10 posições)
  linha += padRight('', 10);

  // 073-073: Segunda Mensagem
  linha += ' ';

  // 074-075: Brancos (2 posições)
  linha += '  ';

  // 076-076: Multa
  linha += '0';

  // 077-078: Percentual Multa (2 posições decimais)
  linha += '00';

  // 079-080: Unidade Moeda (00)
  linha += '00';

  // 081-093: Valor do Título na Moeda Corrente (13 posições)
  linha += formatValor(titulo.valor_titulo, 13);

  // 094-101: Brancos (8 posições)
  linha += padRight('', 8);

  // 102-103: Tipo de Valor/Débito
  linha += '  ';

  // 104-104: Identificador de Dívida
  linha += ' ';

  // 105-105: Brancos
  linha += ' ';

  // 106-106: Moeda (9 = Real)
  linha += '9';

  // 107-108: Brancos (2 posições)
  linha += '  ';

  // 109-110: Comando/Movimento (01 = Entrada de Título)
  linha += '01';

  // 111-120: Número do Documento (10 posições)
  linha += padLeft(titulo.numero_documento, 10);

  // 121-126: Data de Vencimento (DDMMAA)
  linha += formatDataDDMMAA(titulo.data_vencimento);

  // 127-139: Valor do Título (13 posições)
  linha += formatValor(titulo.valor_titulo, 13);

  // 140-142: Banco Encarregado da Cobrança (000)
  linha += '000';

  // 143-147: Agência Depositária (00000)
  linha += '00000';

  // 148-149: Espécie de Título (01 = Duplicata Mercantil)
  linha += '01';

  // 150-150: Identificação (A = Aceite, N = Não Aceite)
  linha += 'N';

  // 151-156: Data de Emissão do Título (DDMMAA)
  const dataEmissao = new Date();
  linha += formatDataDDMMAA(dataEmissao);

  // 157-158: Primeira Instrução (00 = Não há instrução)
  linha += '00';

  // 159-160: Segunda Instrução (00)
  linha += '00';

  // 161-173: Juros de 1 dia (13 posições) - 0 = Isento
  linha += padLeft('0', 13);

  // 174-179: Data Limite Desconto (DDMMAA) - 000000 = Sem desconto
  linha += '000000';

  // 180-192: Valor do Desconto (13 posições)
  linha += padLeft('0', 13);

  // 193-205: Valor do IOF (13 posições)
  linha += padLeft('0', 13);

  // 206-218: Valor Abatimento (13 posições)
  linha += padLeft('0', 13);

  // 219-220: Tipo de Inscrição do Pagador (01=CPF, 02=CNPJ)
  const tipoPagador = titulo.cpf_cnpj_pagador.replace(/\D/g, '').length === 11 ? '01' : '02';
  linha += tipoPagador;

  // 221-234: CPF/CNPJ do Pagador (14 posições)
  linha += padLeft(titulo.cpf_cnpj_pagador.replace(/\D/g, ''), 14, '0');

  // 235-274: Nome do Pagador (40 posições)
  linha += padRight(formatTexto(titulo.nome_pagador, 40, 'T'), 40);

  // 275-314: Endereço do Pagador (40 posições)
  linha += padRight(formatTexto(titulo.endereco_pagador, 40, 'T'), 40);

  // 315-326: Primeira Mensagem (12 posições) - Brancos
  linha += padRight('', 12);

  // 327-334: CEP do Pagador (8 posições)
  linha += padLeft(notChar(titulo.cep_pagador), 8, '0');

  // 335-349: Sacador/Avalista (15 posições) - Brancos
  linha += padRight('', 15);

  // 350-350: Brancos
  linha += ' ';

  // 351-394: Brancos (44 posições)
  linha += padRight('', 44);

  // 395-400: Nº Sequencial do Registro (6 posições)
  linha += padLeft(sequencial, 6);

  return linha;
}

// Gerar registro DETALHE (tipo 1) - SANTANDER
function gerarDetalheSantander(
  titulo: TituloCNAB,
  sequencial: number,
  convenio: string
): string {
  let linha = '';

  // 001-001: Identificação do Registro (1)
  linha += '1';

  // 002-003: Tipo de Inscrição Empresa (01=CPF, 02=CNPJ)
  linha += '02';

  // 004-017: Número de Inscrição da Empresa (14 posições)
  linha += padLeft('18053139000169', 14, '0');

  // 018-021: Código Transmissão (4 posições)
  linha += padLeft(convenio.slice(-4), 4, '0');

  // 022-046: Uso da Empresa (25 posições) - Número de Controle
  linha += padRight(padLeft(titulo.cod_receb, 10), 25);

  // 047-054: Nosso Número (8 posições)
  linha += padLeft(titulo.nosso_numero, 8, '0');

  // 055-062: Data do Segundo Desconto (DDMMAAAA) - Zeros
  linha += '00000000';

  // 063-063: Brancos
  linha += ' ';

  // 064-064: Multa (Info)
  linha += '0';

  // 065-068: Percentual Multa (4 posições)
  linha += '0000';

  // 069-070: Unidade de Valor Moeda Corrente (00)
  linha += '00';

  // 071-081: Valor do Título em Outra Unidade (11 posições) - Zeros
  linha += padLeft('0', 11);

  // 082-085: Brancos (4 posições)
  linha += '    ';

  // 086-091: Data para Cobrança de Multa (DDMMAA) - Zeros
  linha += '000000';

  // 092-093: Código Carteira (05 = Cobrança Simples)
  linha += '05';

  // 094-095: Código de Ocorrência (01 = Remessa)
  linha += '01';

  // 096-105: Número do Documento (10 posições)
  linha += padLeft(titulo.numero_documento, 10);

  // 106-111: Data de Vencimento (DDMMAA)
  linha += formatDataDDMMAA(titulo.data_vencimento);

  // 112-124: Valor do Título (13 posições)
  linha += formatValor(titulo.valor_titulo, 13);

  // 125-127: Banco Cobrador (000)
  linha += '000';

  // 128-132: Agência Cobradora (00000)
  linha += '00000';

  // 133-134: Espécie do Título (01 = Duplicata Mercantil)
  linha += '01';

  // 135-135: Identificação (N = Não Aceite)
  linha += 'N';

  // 136-141: Data de Emissão (DDMMAA)
  const dataEmissao = new Date();
  linha += formatDataDDMMAA(dataEmissao);

  // 142-143: Instrução 1 (00 = Não há)
  linha += '00';

  // 144-145: Instrução 2 (00 = Não há)
  linha += '00';

  // 146-158: Juros de Mora por Dia (13 posições) - Zeros
  linha += padLeft('0', 13);

  // 159-164: Data Limite para Desconto (DDMMAA) - Zeros
  linha += '000000';

  // 165-177: Valor do Desconto (13 posições) - Zeros
  linha += padLeft('0', 13);

  // 178-190: Valor do IOF (13 posições) - Zeros
  linha += padLeft('0', 13);

  // 191-203: Valor do Abatimento (13 posições) - Zeros
  linha += padLeft('0', 13);

  // 204-205: Tipo de Inscrição do Pagador (01=CPF, 02=CNPJ)
  const tipoPagador = titulo.cpf_cnpj_pagador.replace(/\D/g, '').length === 11 ? '01' : '02';
  linha += tipoPagador;

  // 206-219: CPF/CNPJ do Pagador (14 posições)
  linha += padLeft(titulo.cpf_cnpj_pagador.replace(/\D/g, ''), 14, '0');

  // 220-259: Nome do Pagador (40 posições)
  linha += padRight(formatTexto(titulo.nome_pagador, 40, 'T'), 40);

  // 260-299: Endereço do Pagador (40 posições)
  linha += padRight(formatTexto(titulo.endereco_pagador, 40, 'T'), 40);

  // 300-311: Mensagem 1 (12 posições) - Brancos
  linha += padRight('', 12);

  // 312-319: CEP do Pagador (8 posições)
  linha += padLeft(notChar(titulo.cep_pagador), 8, '0');

  // 320-334: Mensagem 2 (15 posições) - Brancos ou Cidade
  linha += padRight(formatTexto(titulo.cidade_pagador, 15, 'T'), 15);

  // 335-394: Brancos (60 posições)
  linha += padRight('', 60);

  // 395-400: Nº Sequencial do Registro (6 posições)
  linha += padLeft(sequencial, 6);

  return linha;
}

// Gerar registro TRAILER (tipo 9)
function gerarTrailer(sequencial: number): string {
  let linha = '';

  // 001-001: Identificação do Registro (9)
  linha += '9';

  // 002-394: Brancos (393 posições)
  linha += padRight('', 393);

  // 395-400: Nº Sequencial do Registro (6 posições)
  linha += padLeft(sequencial, 6);

  return linha;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { dtini, dtfim, banco } = req.body;

    if (!dtini || !dtfim || !banco) {
      return res.status(400).json({
        erro: 'Parâmetros obrigatórios: dtini, dtfim e banco'
      });
    }

    if (banco !== '237' && banco !== '033') {
      return res.status(400).json({
        erro: 'Banco inválido. Use 237 (Bradesco) ou 033 (Santander)'
      });
    }

    const nomeBanco = banco === '237' ? 'BRADESCO' : 'SANTANDER';

    // Buscar títulos a receber que ainda não foram enviados em remessa bancária
    // Filtro Oracle: bradesco = 'N' (não enviados), forma_fat = '2' (boleto)
    // IMPORTANTE: r.banco é código interno, precisa JOIN com dbbanco para obter cod_bc (237, 033)
    const query = `
      SELECT
        r.cod_receb,
        r.nro_doc as numero_documento,
        r.nro_docbanco,
        r.dt_venc as data_vencimento,
        r.dt_emissao,
        r.venc_ant,
        r.valor_pgto as valor_titulo,
        r.forma_fat,
        c.codcli,
        c.nome as nome_pagador,
        c.cpfcgc as cpf_cnpj_pagador,
        c.tipo as tipo_cliente,
        c.endercobr as endereco_pagador,
        COALESCE(c.numerocobr, c.numero, '') as numero_endereco,
        c.cepcobr as cep_pagador,
        ba.cidade as cidade_pagador,
        ba.uf as uf_pagador,
        ba.descr as bairro_pagador,
        r.banco,
        r.cod_conta,
        cb.cod_bc as codigo_banco_real
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      LEFT JOIN db_manaus.dbbairro ba ON ba.codbairro = c.codbairrocobr
      LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
      WHERE r.dt_venc BETWEEN $1 AND $2
        AND r.cancel = 'N'
        AND r.rec = 'N'
        AND r.valor_rec = 0
        AND r.forma_fat = '2'
        AND COALESCE(r.bradesco, 'N') = 'N'
        AND cb.cod_bc = $3
        AND r.valor_pgto > 0
        AND c.cpfcgc IS NOT NULL AND c.cpfcgc != ''
      ORDER BY r.dt_venc, r.cod_receb
    `;

    const result = await pool.query(query, [dtini, dtfim, banco]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: `Nenhum título encontrado para o banco ${nomeBanco} no período especificado`
      });
    }

    // Preparar dados dos títulos
    const titulos: TituloCNAB[] = result.rows.map((row, index) => ({
      nosso_numero: String(row.cod_receb),
      numero_documento: String(row.numero_documento || row.cod_receb),
      data_vencimento: new Date(row.data_vencimento),
      valor_titulo: parseFloat(row.valor_titulo),
      nome_pagador: row.nome_pagador,
      cpf_cnpj_pagador: row.cpf_cnpj_pagador,
      endereco_pagador: row.endereco_pagador,
      cep_pagador: row.cep_pagador || '00000000',
      cidade_pagador: row.cidade_pagador || '',
      uf_pagador: row.uf_pagador || 'AM',
      cod_receb: row.cod_receb,
      codcli: row.codcli || '',  // Código do cliente (Oracle)
      cod_conta: row.cod_conta || ''  // Código da conta bancária (Oracle)
    }));

    // Gerar conteúdo do arquivo CNAB 400
    const linhas: string[] = [];
    const dataGeracao = new Date();

    // Buscar último número sequencial de arquivo para o banco
    // NOTA: A tabela dbremessa_arquivo usa codremessa como identificador
    const seqResult = await pool.query(`
      SELECT COALESCE(MAX(codremessa), 0) + 1 as proximo_seq
      FROM db_manaus.dbremessa_arquivo
      WHERE banco = $1
    `, [banco]);

    let sequencialArquivo = parseInt(seqResult.rows[0].proximo_seq);
    if (isNaN(sequencialArquivo)) sequencialArquivo = 1;

    // Convênios (obtidos dos arquivos de exemplo)
    const convenio = banco === '237'
      ? '00000000000000197033'  // Bradesco
      : '14030000956001300233';  // Santander

    // HEADER
    if (banco === '237') {
      linhas.push(gerarHeaderBradesco(sequencialArquivo, dataGeracao, convenio));
    } else {
      linhas.push(gerarHeaderSantander(sequencialArquivo, dataGeracao, convenio));
    }

    // DETALHES - guardar linha CNAB e sequencial para inserir no banco
    titulos.forEach((titulo, index) => {
      const sequencialRegistro = index + 2; // +2 porque o header é 1
      let linhaCnab: string;
      if (banco === '237') {
        linhaCnab = gerarDetalheBradesco(titulo, sequencialRegistro, convenio);
      } else {
        linhaCnab = gerarDetalheSantander(titulo, sequencialRegistro, convenio);
      }
      linhas.push(linhaCnab);
      // Guardar dados para inserção no banco (Oracle)
      titulo.nroseq = sequencialRegistro;
      titulo.linha_cnab = linhaCnab;
    });

    // TRAILER
    linhas.push(gerarTrailer(titulos.length + 2)); // +2 (header + trailer)

    // Validar que todas as linhas têm exatamente 400 caracteres
    const linhasInvalidas = linhas.filter(linha => linha.length !== 400);
    if (linhasInvalidas.length > 0) {
      console.error('Linhas com tamanho incorreto:', linhasInvalidas.map((l, i) => ({
        linha: i + 1,
        tamanho: l.length
      })));
      return res.status(500).json({
        erro: 'Erro na geração do arquivo: linhas com tamanho incorreto',
        detalhes: linhasInvalidas.map((l, i) => `Linha ${i + 1}: ${l.length} caracteres`)
      });
    }

    // Gerar nome do arquivo
    const dataArquivo = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const nomeArquivo = `RM${banco}${dataArquivo}${padLeft(sequencialArquivo, 4)}.rem`;

    // Salvar arquivo
    const dirRemessa = path.join(process.cwd(), 'public', 'remessas', 'bancaria');
    if (!fs.existsSync(dirRemessa)) {
      fs.mkdirSync(dirRemessa, { recursive: true });
    }

    const caminhoArquivo = path.join(dirRemessa, nomeArquivo);
    const conteudoArquivo = linhas.join('\r\n') + '\r\n';
    fs.writeFileSync(caminhoArquivo, conteudoArquivo, 'latin1');

    // Registrar na tabela dbremessa_arquivo
    // Colunas reais: codremessa, banco, data_gerado, nome_arquivo, usuario_importacao, codbodero
    const insertArquivo = await pool.query(`
      INSERT INTO db_manaus.dbremessa_arquivo
      (codremessa, banco, data_gerado, nome_arquivo, usuario_importacao)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING codremessa
    `, [
      sequencialArquivo,
      banco,
      dataGeracao,
      nomeArquivo,
      'SISTEMA'
    ]);

    const codArquivo = insertArquivo.rows[0].codremessa;

    // Criar borderô no estilo Oracle (dbboderobb)
    // Buscar próximo código de borderô
    const boderoResult = await pool.query(`
      SELECT COALESCE(MAX(CAST(cod_bodero AS INTEGER)), 0) + 1 as proximo_cod
      FROM db_manaus.dbboderobb
      WHERE cod_bodero ~ '^[0-9]+$'
    `);
    
    const codBodero = String(boderoResult.rows[0].proximo_cod).padStart(9, '0');
    const codConta = result.rows[0].cod_conta || '1';

    // Inserir registro no dbboderobb (tabela Oracle de borderô)
    await pool.query(`
      INSERT INTO db_manaus.dbboderobb
      (cod_bodero, cod_conta, dtinicial, dtfinal, dtemissao, cancel)
      VALUES ($1, $2, $3, $4, $5, 'N')
    `, [codBodero, codConta, dtini, dtfim, dataGeracao]);

    // Buscar o último ID de detalhe para incrementar
    const maxDetalheResult = await pool.query(`
      SELECT COALESCE(MAX("CODREMESSA_DETALHE"), 0) as max_id
      FROM db_manaus.dbremessa_detalhe
    `);
    let nextDetalheId = Number(maxDetalheResult.rows[0].max_id);

    // Registrar detalhes na tabela dbremessa_detalhe E dbdocboderobb (Oracle)
    for (const titulo of titulos) {
      nextDetalheId++; // Incrementa ID

      // Inserir em dbremessa_detalhe (estrutura Oracle completa)
      // Campos: CODREMESSA_DETALHE, CODREMESSA, NROSEQ, CODCLI, CODRECEB, NROBANCO, DOCUMENTO, REGISTRO, CONTA, VALOR, ABATIMENTO
      await pool.query(`
        INSERT INTO db_manaus.dbremessa_detalhe
        ("CODREMESSA_DETALHE", "CODREMESSA", "NROSEQ", "CODCLI", "CODRECEB", "NROBANCO", "DOCUMENTO", "REGISTRO", "CONTA", "VALOR", "ABATIMENTO")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        nextDetalheId,                     // CODREMESSA_DETALHE (gerado manualmente)
        codArquivo,                        // CODREMESSA (código do arquivo de remessa)
        titulo.nroseq,                     // NROSEQ (número sequencial no arquivo)
        titulo.codcli,                     // CODCLI (código do cliente)
        titulo.cod_receb,                  // CODRECEB (código do título)
        titulo.nosso_numero,               // NROBANCO (nosso número)
        titulo.numero_documento,           // DOCUMENTO (número do documento)
        titulo.linha_cnab || '',           // REGISTRO (linha CNAB completa)
        titulo.cod_conta,                  // CONTA (código da conta bancária)
        titulo.valor_titulo,               // VALOR
        0                                  // ABATIMENTO (zero por padrão)
      ]);

      // Inserir em dbdocboderobb (estrutura Oracle)
      await pool.query(`
        INSERT INTO db_manaus.dbdocboderobb
        (cod_bodero, cod_receb, digito, operacao, valor, dt_venc)
        VALUES ($1, $2, '', 'I', $3, $4)
      `, [codBodero, titulo.cod_receb, titulo.valor_titulo, titulo.data_vencimento]);

      // Marcar título como enviado (bradesco = 'S')
      await pool.query(`
        UPDATE db_manaus.dbreceb
        SET bradesco = 'S'
        WHERE cod_receb = $1
      `, [titulo.cod_receb]);
    }

    res.status(200).json({
      sucesso: true,
      mensagem: `Arquivo de remessa ${nomeBanco} gerado com sucesso`,
      arquivo: {
        nome: nomeArquivo,
        caminho: `/remessas/bancaria/${nomeArquivo}`,
        sequencial: sequencialArquivo,
        banco: nomeBanco,
        cod_banco: banco,
        qtd_titulos: titulos.length,
        valor_total: titulos.reduce((sum, t) => sum + t.valor_titulo, 0),
        dt_geracao: dataGeracao.toISOString(),
        cod_arquivo: codArquivo,
        cod_bodero: codBodero,
        conteudo: conteudoArquivo // Conteúdo para download no frontend
      },
      titulos: titulos.map(t => ({
        cod_receb: t.cod_receb,
        nosso_numero: t.nosso_numero,
        numero_documento: t.numero_documento,
        valor: t.valor_titulo,
        vencimento: t.data_vencimento.toISOString().split('T')[0],
        pagador: t.nome_pagador,
        status: 'Enviado' // Marcado como enviado (bradesco='S')
      }))
    });

  } catch (error: any) {
    console.error('Erro ao gerar remessa bancária CNAB 400:', error);
    res.status(500).json({
      erro: 'Erro ao gerar remessa bancária',
      detalhes: error.message
    });
  }
}
