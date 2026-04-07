import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { formatTexto, notChar } from '@/utils/formatTexto';
import { 
  gerarNossoNumeroCompleto, 
  getConvenioBB, 
  CARTEIRAS_POR_BANCO,
  CODIGO_EMPRESA_POR_BANCO 
} from '@/utils/cnab/digitoVerificador';
import fs from 'fs';
import path from 'path';

const pool = getPgPool();

// Auxiliares de formatação
function padLeft(value: string | number, length: number, char: string = '0'): string {
  return String(value).padStart(length, char);
}

function padRight(value: string, length: number, char: string = ' '): string {
  return value.padEnd(length, char);
}

function formatValor(valor: number, length: number = 13): string {
  const valorCentavos = Math.round(valor * 100);
  return padLeft(valorCentavos, length);
}

function formatDataDDMMAA(data: Date): string {
  const dia = padLeft(data.getDate(), 2);
  const mes = padLeft(data.getMonth() + 1, 2);
  const ano = String(data.getFullYear()).slice(-2);
  return `${dia}${mes}${ano}`;
}

interface TituloRemessa {
  situacao: string;
  cod_receb: string;
  codcli: string;
  nro_doc: string;
  valor_pgto: number;
  dt_venc: Date;
  dt_emissao: Date;
  banco: string;
  nro_banco: string;
  nome_cliente: string;
  cpfcgc: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  agencia: string;
  num_conta: string;
  digito_conta: string;
  codigo_operacao: string; // 01=Remessa, 02=Baixa, 06=Prorrogação
}

/**
 * API: POST /api/remessa/bancaria/gerar
 * 
 * Gera arquivo de remessa CNAB 400
 * Implementa controle de flags bradesco e operações I/D/V
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  try {
    const { dtini, dtfim, banco, conta } = req.body;

    if (!dtini || !dtfim || !banco) {
      return res.status(400).json({
        erro: 'Parâmetros dtini, dtfim e banco são obrigatórios'
      });
    }

    console.log('📦 Gerando remessa bancária CNAB 400:', { dtini, dtfim, banco, conta });

    // 1. Buscar títulos usando a API de seleção
    const titulos: TituloRemessa[] = await buscarTitulosParaRemessa(dtini, dtfim, banco, conta);

    if (titulos.length === 0) {
      return res.status(404).json({
        erro: 'Nenhum título encontrado para gerar remessa'
      });
    }

    console.log(`✅ ${titulos.length} títulos selecionados`);

    // 2. Gerar arquivo CNAB
    const { conteudoCNAB, nomeArquivo, sequencial } = await gerarArquivoCNAB(banco, titulos);

    // 3. Salvar arquivo fisicamente
    const caminhoArquivo = salvarArquivo(nomeArquivo, conteudoCNAB);

    // 4. Registrar na base de dados
    const { codremessa, codbodero } = await registrarRemessa(
      banco,
      nomeArquivo,
      sequencial,
      titulos
    );

    // 5. Atualizar flags dos títulos
    await atualizarFlagsTitulos(titulos);

    console.log(`✅ Remessa gerada: ${nomeArquivo} (${titulos.length} títulos)`);

    // Retornar o conteúdo do arquivo para download direto
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    return res.status(200).send(conteudoCNAB);

  } catch (error: any) {
    console.error('❌ Erro ao gerar remessa:', error);
    return res.status(500).json({
      erro: 'Erro ao gerar arquivo de remessa',
      detalhes: error.message
    });
  }
}

/**
 * Busca títulos para remessa usando a nova API
 */
async function buscarTitulosParaRemessa(
  dtini: string,
  dtfim: string,
  banco: string,
  conta?: string
): Promise<TituloRemessa[]> {
  let query = `
    -- PARTE 1: NOVOS TÍTULOS (REMESSA)
    SELECT
      'REMESSA' as situacao,
      '01' as codigo_operacao,
      r.cod_receb,
      r.codcli,
      r.nro_doc,
      r.valor_pgto,
      r.dt_venc,
      r.dt_emissao,
      r.banco,
      r.nro_banco,
      c.nome as nome_cliente,
      c.cpfcgc,
      c.ender as endereco,
      COALESCE(c.numero, '') as numero,
      COALESCE(c.bairro, '') as bairro,
      c.cidade,
      c.uf,
      c.cep,
      cb.n_agencia as agencia,
      ct.nro_conta as num_conta,
      ct.digito as digito_conta
    FROM db_manaus.dbreceb r
    LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
    LEFT JOIN db_manaus.dbconta ct ON ct.cod_conta = r.cod_conta
    LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
    WHERE r.dt_venc BETWEEN $1 AND $2
      AND cb.cod_bc = $3
      AND COALESCE(r.bradesco, 'N') = 'N'
      AND COALESCE(r.cancel, 'N') = 'N'
      AND COALESCE(r.rec, 'N') = 'N'
      AND COALESCE(r.forma_fat, '') = 'B'
      AND r.valor_pgto > 0
      AND (r.venc_ant IS NULL OR r.dt_venc = r.venc_ant)
      ${conta ? `AND r.cod_conta = $4` : ''}

    UNION ALL

    -- PARTE 2: TÍTULOS PARA BAIXA
    SELECT
      'BAIXAR TITULO' as situacao,
      '02' as codigo_operacao,
      r.cod_receb,
      r.codcli,
      r.nro_doc,
      r.valor_pgto,
      r.dt_venc,
      r.dt_emissao,
      r.banco,
      r.nro_banco,
      c.nome as nome_cliente,
      c.cpfcgc,
      c.ender as endereco,
      COALESCE(c.numero, '') as numero,
      COALESCE(c.bairro, '') as bairro,
      c.cidade,
      c.uf,
      c.cep,
      cb.n_agencia as agencia,
      ct.nro_conta as num_conta,
      ct.digito as digito_conta
    FROM db_manaus.dbdocbodero_baixa_banco db
    INNER JOIN db_manaus.dbreceb r ON r.cod_receb = db.cod_receb
    LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
    LEFT JOIN db_manaus.dbconta ct ON ct.cod_conta = r.cod_conta
    LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
    WHERE r.dt_venc BETWEEN $1 AND $2
      AND cb.cod_bc = $3
      AND COALESCE(db.export, 0) = 0
      ${conta ? `AND r.cod_conta = $4` : ''}

    UNION ALL

    -- PARTE 3: TÍTULOS PRORROGADOS
    SELECT
      'PRORROGAR TITULO' as situacao,
      '06' as codigo_operacao,
      r.cod_receb,
      r.codcli,
      r.nro_doc,
      r.valor_pgto,
      r.dt_venc,
      r.dt_emissao,
      r.banco,
      r.nro_banco,
      c.nome as nome_cliente,
      c.cpfcgc,
      c.ender as endereco,
      COALESCE(c.numero, '') as numero,
      COALESCE(c.bairro, '') as bairro,
      c.cidade,
      c.uf,
      c.cep,
      cb.n_agencia as agencia,
      ct.nro_conta as num_conta,
      ct.digito as digito_conta
    FROM db_manaus.dbreceb r
    LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
    LEFT JOIN db_manaus.dbconta ct ON ct.cod_conta = r.cod_conta
    LEFT JOIN db_manaus.dbbanco cb ON cb.cod_banco = LPAD(COALESCE(r.banco, '0'), 4, '0')
    WHERE r.dt_venc BETWEEN $1 AND $2
      AND cb.cod_bc = $3
      AND r.venc_ant IS NOT NULL
      AND r.dt_venc <> r.venc_ant
      AND COALESCE(r.bradesco, 'N') = 'S'
      AND COALESCE(r.cancel, 'N') = 'N'
      ${conta ? `AND r.cod_conta = $4` : ''}

    ORDER BY situacao, dt_venc, cod_receb
  `;

  const params = conta ? [dtini, dtfim, banco, conta] : [dtini, dtfim, banco];
  const result = await pool.query(query, params);

  return result.rows;
}

/**
 * Gera conteúdo do arquivo CNAB 400
 */
async function gerarArquivoCNAB(banco: string, titulos: TituloRemessa[]) {
  const dataGeracao = new Date();
  const linhas: string[] = [];

  // Buscar próximo sequencial usando codremessa
  const seqResult = await pool.query(`
    SELECT COALESCE(MAX(CAST(codremessa AS INTEGER)), 0) + 1 as proximo_seq
    FROM db_manaus.dbremessa_arquivo
  `);

  const sequencial = seqResult.rows[0].proximo_seq;

  // Código da empresa (cedente)
  const codigoEmpresa = CODIGO_EMPRESA_POR_BANCO[banco] || '18053139000169';
  const carteira = CARTEIRAS_POR_BANCO[banco] || '09';

  // Header
  linhas.push(gerarHeaderCNAB400(banco, sequencial, dataGeracao, codigoEmpresa));

  // Detalhes
  titulos.forEach((titulo, index) => {
    const nossoNumero = gerarNossoNumeroCompleto(
      banco,
      titulo.nro_banco || titulo.cod_receb,
      titulo.agencia,
      titulo.num_conta,
      carteira
    );

    linhas.push(gerarDetalheCNAB400(titulo, index + 2, nossoNumero, carteira, banco));
  });

  // Trailer
  linhas.push(gerarTrailerCNAB400(titulos.length + 2));

  const conteudoCNAB = linhas.join('\r\n');
  const nomeArquivo = `REM_${banco}_${sequencial.toString().padStart(6, '0')}.REM`;

  return { conteudoCNAB, nomeArquivo, sequencial };
}

/**
 * Gera registro header CNAB 400
 */
function gerarHeaderCNAB400(
  banco: string,
  sequencial: number,
  dataGeracao: Date,
  codigoEmpresa: string
): string {
  let linha = '0'; // Tipo registro
  linha += '1'; // Tipo arquivo (remessa)
  linha += 'REMESSA';
  linha += '01'; // Serviço cobrança
  linha += padRight('COBRANCA', 15);
  linha += padLeft(codigoEmpresa, 20);
  linha += padRight('MELO COMERCIO', 30);
  linha += padLeft(banco, 3);
  linha += padRight('BANCO', 15);
  linha += formatDataDDMMAA(dataGeracao);
  linha += padRight('', 8);
  linha += 'MX';
  linha += padLeft(sequencial, 7);
  linha += padRight('', 277);
  linha += '000001';

  return linha;
}

/**
 * Gera registro detalhe CNAB 400
 */
function gerarDetalheCNAB400(
  titulo: TituloRemessa,
  sequencial: number,
  nossoNumero: string,
  carteira: string,
  banco: string
): string {
  let linha = '1'; // Tipo registro
  linha += '02'; // Tipo inscrição (CNPJ)
  linha += padLeft('18053139000169', 14);
  linha += padLeft(titulo.agencia || '0', 5);
  linha += padLeft(titulo.num_conta || '0', 12);
  linha += titulo.digito_conta || '0';
  linha += padLeft(titulo.cod_receb, 25);
  linha += padLeft(nossoNumero, 13);
  linha += padRight('', 37);
  linha += titulo.codigo_operacao; // 01=Remessa, 02=Baixa, 06=Prorrogação
  linha += padLeft(titulo.nro_doc || titulo.cod_receb, 10);
  linha += formatDataDDMMAA(new Date(titulo.dt_venc));
  linha += formatValor(titulo.valor_pgto);
  linha += '000'; // Banco cobrador
  linha += '00000'; // Agência cobradora
  linha += '01'; // Espécie (DM)
  linha += 'N'; // Aceite
  linha += formatDataDDMMAA(new Date(titulo.dt_emissao));
  linha += '00'; // Instrução 1
  linha += '00'; // Instrução 2
  linha += formatValor(0); // Juros
  linha += '000000'; // Data desconto
  linha += formatValor(0); // Valor desconto
  linha += formatValor(0); // IOF
  linha += formatValor(0); // Abatimento
  
  const tipoPagador = (titulo.cpfcgc || '').replace(/\D/g, '').length === 11 ? '01' : '02';
  linha += tipoPagador;
  linha += padLeft((titulo.cpfcgc || '').replace(/\D/g, ''), 14);
  linha += padRight(formatTexto(titulo.nome_cliente, 40, 'T'), 40);
  
  const endereco = `${titulo.endereco} ${titulo.numero} ${titulo.bairro}`.trim();
  linha += padRight(formatTexto(endereco, 40, 'T'), 40);
  linha += padRight('', 12);
  linha += padLeft(notChar(titulo.cep || ''), 8);
  linha += padRight('', 60);
  linha += padLeft(sequencial, 6);

  return linha;
}

/**
 * Gera registro trailer CNAB 400
 */
function gerarTrailerCNAB400(sequencial: number): string {
  let linha = '9';
  linha += padRight('', 393);
  linha += padLeft(sequencial, 6);
  return linha;
}

/**
 * Salva arquivo no disco
 */
function salvarArquivo(nomeArquivo: string, conteudo: string): string {
  const dirRemessa = path.join(process.cwd(), 'public', 'remessas', 'bancaria');
  if (!fs.existsSync(dirRemessa)) {
    fs.mkdirSync(dirRemessa, { recursive: true });
  }
  
  const caminhoArquivo = path.join(dirRemessa, nomeArquivo);
  fs.writeFileSync(caminhoArquivo, conteudo, 'utf-8');
  
  return caminhoArquivo;
}

/**
 * Registra remessa nas tabelas dbremessa_arquivo e dbremessa_detalhe
 */
async function registrarRemessa(
  banco: string,
  nomeArquivo: string,
  sequencial: number,
  titulos: TituloRemessa[]
) {
  await pool.query('BEGIN');

  try {
    // Converter código do banco para nome
    const nomeBanco = banco === '237' ? 'BRADESCO' : banco === '033' ? 'SANTANDER' : 'BANCO ITAU';
    
    // Gerar código do borderô
    const codBoderoResult = await pool.query(`
      SELECT COALESCE(MAX(CAST(codbodero AS INTEGER)), 0) + 1 as proximo
      FROM db_manaus.dbremessa_arquivo
    `);
    const codbodero = String(codBoderoResult.rows[0].proximo).padStart(9, '0');

    // Inserir arquivo
    const arquivoResult = await pool.query(`
      INSERT INTO db_manaus.dbremessa_arquivo
      (banco, data_gerado, nome_arquivo, usuario_importacao, codbodero)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING codremessa
    `, [nomeBanco, new Date(), nomeArquivo, 'SISTEMA', codbodero]);

    const codremessa = arquivoResult.rows[0].codremessa;

    // Inserir detalhes
    for (let i = 0; i < titulos.length; i++) {
      const titulo = titulos[i];
      await pool.query(`
        INSERT INTO db_manaus.dbremessa_detalhe
        ("CODREMESSA_DETALHE", "CODREMESSA", "CODCLI", "CODRECEB", "DOCUMENTO", "VALOR", "NROBANCO")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        codremessa * 1000 + i + 1,
        codremessa,
        titulo.codcli,
        titulo.cod_receb,
        titulo.nro_doc,
        titulo.valor_pgto,
        titulo.nro_banco
      ]);
    }

    await pool.query('COMMIT');

    return { codremessa, codbodero };

  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

/**
 * Atualiza flags dos títulos após geração da remessa
 * - REMESSA: bradesco='S'
 * - BAIXA: export=1
 * - PRORROGAÇÃO: bradesco='S', atualiza venc_ant
 */
async function atualizarFlagsTitulos(titulos: TituloRemessa[]) {
  for (const titulo of titulos) {
    if (titulo.situacao === 'REMESSA' || titulo.situacao === 'PRORROGAR TITULO') {
      // Marcar como enviado
      await pool.query(`
        UPDATE db_manaus.dbreceb
        SET bradesco = 'S',
            venc_ant = dt_venc
        WHERE cod_receb = $1
      `, [titulo.cod_receb]);

    } else if (titulo.situacao === 'BAIXAR TITULO') {
      // Marcar como exportado
      await pool.query(`
        UPDATE db_manaus.dbdocbodero_baixa_banco
        SET export = 1
        WHERE cod_receb = $1
      `, [titulo.cod_receb]);
    }
  }
}
