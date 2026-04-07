import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import { parseCNAB400Retorno, validarRetornoCNAB400, RetornoDetalhe } from '@/utils/cnab/parseRetorno400';
import os from 'os';
import formidable from 'formidable';
import dotenv from 'dotenv';
dotenv.config();
// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000, // Timeout de 30 segundos para conexão
  query_timeout: 30000, // Timeout de 30 segundos para queries
});

interface RespostaProcessamento {
  success: boolean;
  message: string;
  data?: {
    codretorno: number;
    banco: string;
    nomeArquivo: string;
    totalTitulos: number;
    valorTotal: number;
    estatisticas: {
      totalProcessados: number;
      liquidados: number;
      baixados: number;
      rejeitados: number;
      outros: number;
      porFilial: {
        mao: number;
        pvh: number;
        rec: number;
        flz: number;
        bmo: number;
        csac: number;
        jps: number;
      };
    };
    titulosParaBaixaAutomatica: Array<{
      nossoNumero: string;
      numeroDocumento: string;
      nomeSacado: string;
      valorPago: number;
      dataOcorrencia: string;
      ocorrencia: string;
    }>;
    titulosParaBaixaManual: Array<{
      nossoNumero: string;
      numeroDocumento: string;
      nomeSacado: string;
      valorTitulo: number;
      valorPago: number;
      desconto: number;
      jurosMulta: number;
      dataVencimento: string;
      dataOcorrencia: string;
      codigoOcorrencia: string;
      ocorrencia: string;
      motivo: string;
      motivoOcorrencia: string;
    }>;
  };
  error?: string;
}

/**
 * Valida se arquivo já foi importado (baseado em VALIDA_ARQUIVO do Oracle)
 */
async function validarArquivoDuplicado(
  dataGeracao: string,
  numeroSequencial: string,
  nomeBanco: string,
  codigoBanco: string
): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as total
    FROM db_manaus.dbretorno_arquivo
    WHERE datageracaoarquivo = $1
      AND numerosequencialarquivo = $2
      AND nomebanco = $3
      AND numerobancocamaracompensacao = $4
  `;
  
  const result = await pool.query(query, [dataGeracao, numeroSequencial, nomeBanco, codigoBanco]);
  return parseInt(result.rows[0].total) > 0;
}

/**
 * Determina a filial baseado no código/número de controle
 * (Adaptar conforme lógica específica da empresa)
 */
function determinarFilial(numeroControle: string, codigoEmpresa: string): string {
  // Lógica simplificada - adaptar conforme necessário
  const codigo = numeroControle.substring(0, 3).toUpperCase();
  
  if (codigo.includes('MAO') || codigo.includes('MAN')) return 'MAO';
  if (codigo.includes('PVH')) return 'PVH';
  if (codigo.includes('REC')) return 'REC';
  if (codigo.includes('FLZ') || codigo.includes('FOR')) return 'FLZ';
  if (codigo.includes('BMO') || codigo.includes('BM')) return 'BMO';
  if (codigo.includes('CSA')) return 'CSAC';
  if (codigo.includes('JPS')) return 'JPS';
  
  return 'MAO'; // Default
}

/**
 * Analisa título para determinar se permite baixa automática
 * Baseado em ANALISA_TITULO do Oracle
 */
function analisarTitulo(detalhe: RetornoDetalhe, descricaoOcorrencia: string): {
  situacao: string;
  permiteБaixaAutomatica: boolean;
  motivo: string;
} {
  const ocorrencia = detalhe.codigoOcorrencia;
  
  // Ocorrências que permitem baixa automática
  const ocorrenciasBaixaAutomatica = ['06', '09', '15', '17']; // Liquidação normal, Baixa automática, Liquidação cartório, Liquidação após baixa
  
  // Ocorrências de rejeição
  const ocorrenciasRejeicao = ['03', '24', '32'];
  
  // Verificar se foi liquidado/pago
  if (ocorrenciasBaixaAutomatica.includes(ocorrencia)) {
    // Verificar se valor pago está correto
    const diferenca = Math.abs(detalhe.valorPago - detalhe.valorTitulo);
    const tolerancia = 0.01; // Tolerância de R$ 0,01
    
    if (diferenca <= tolerancia) {
      return {
        situacao: 'P', // Pago
        permiteБaixaAutomatica: true,
        motivo: 'OK'
      };
    } else if (detalhe.valorPago > detalhe.valorTitulo) {
      return {
        situacao: '3', // Pago atraso juros menor
        permiteБaixaAutomatica: false,
        motivo: `Valor pago maior que título: R$ ${detalhe.valorPago.toFixed(2)} > R$ ${detalhe.valorTitulo.toFixed(2)}`
      };
    } else {
      return {
        situacao: '1', // Não pago totalmente
        permiteБaixaAutomatica: false,
        motivo: `Valor pago menor que título: R$ ${detalhe.valorPago.toFixed(2)} < R$ ${detalhe.valorTitulo.toFixed(2)}`
      };
    }
  }
  
  // Ocorrências de rejeição
  if (ocorrenciasRejeicao.includes(ocorrencia)) {
    return {
      situacao: '4', // Título não localizado/rejeitado
      permiteБaixaAutomatica: false,
      motivo: `Título rejeitado (${descricaoOcorrencia}): ${detalhe.motivoOcorrencia || 'Sem motivo especificado'}`
    };
  }
  
  // Outras ocorrências - análise manual
  return {
    situacao: '1', // Não pago totalmente
    permiteБaixaAutomatica: false,
    motivo: `${descricaoOcorrencia} - Requer análise manual`
  };
}

/**
 * Mapeamento de códigos de ocorrência CNAB 400 (Bradesco/Santander)
 * Baseado no padrão FEBRABAN
 */
const OCORRENCIAS_CNAB: Record<string, string> = {
  '02': 'Entrada Confirmada',
  '03': 'Entrada Rejeitada',
  '04': 'Transferência de Carteira/Entrada',
  '05': 'Transferência de Carteira/Baixa',
  '06': 'Liquidação Normal',
  '07': 'Liquidação por Conta',
  '08': 'Liquidação em Cartório',
  '09': 'Baixa Automática',
  '10': 'Baixa Conforme Instruções',
  '11': 'Títulos em Ser (Arquivo Mensal)',
  '12': 'Abatimento Concedido',
  '13': 'Abatimento Cancelado',
  '14': 'Vencimento Alterado',
  '15': 'Liquidação em Cartório',
  '16': 'Título Pago em Cheque - Aguardando Compensação',
  '17': 'Liquidação Após Baixa',
  '18': 'Acerto de Depositária',
  '19': 'Confirmação de Instrução de Protesto',
  '20': 'Confirmação de Sustação de Protesto',
  '21': 'Acerto de Controle do Participante',
  '22': 'Título com Pagamento Cancelado',
  '23': 'Entrada de Título em Cartório',
  '24': 'Entrada Rejeitada por CEP Irregular',
  '25': 'Confirmação de Pedido de Baixa',
  '26': 'Instrução Rejeitada',
  '27': 'Confirmação do Pedido de Alteração de Outros Dados',
  '28': 'Débito de Tarifas/Custas',
  '29': 'Ocorrências do Sacado',
  '30': 'Alteração de Outros Dados Rejeitada',
  '31': 'Instrução para Cancelamento de Juros',
  '32': 'Instrução Rejeitada',
  '33': 'Confirmação de Pedido de Alteração de Outros Dados',
  '34': 'Retirado de Cartório e Manutenção em Carteira',
  '35': 'Aceite do Sacado',
  '36': 'Confirmação de Alteração de Juros de Mora',
  '37': 'Confirmação de Cancelamento de Juros de Mora',
  '38': 'Confirmação de Alteração de Desconto',
  '39': 'Confirmação de Cancelamento de Desconto',
  '40': 'Baixa de Título Protestado',
  '41': 'Liquidação de Título Baixado',
  '42': 'Confirmação de Alteração de Valor Nominal do Título',
  '43': 'Confirmação de Alteração de Número de Controle do Participante',
  '44': 'Título Pago com Cheque Devolvido',
  '45': 'Título Pago com Cheque Compensado',
  '46': 'Instrução para Cancelamento de Protesto Confirmada',
  '47': 'Instrução para Protesto para Fins Falimentares',
  '48': 'Confirmação de Instrução de Transferência de Carteira/Modalidade de Cobrança',
  '49': 'Alteração de Contrato de Cobrança',
  '50': 'Título com Pagamento Cancelado',
  '51': 'Título DDA Reconhecido pelo Sacado',
  '52': 'Título DDA não Reconhecido pelo Sacado',
  '53': 'Título DDA Recusado pela CIP',
  '54': 'Confirmação de Entrada de Título via Bloqueto',
  '68': 'Acerto de Dados do Rateio de Crédito',
  '69': 'Cancelamento de Rateio de Crédito',
};

/**
 * Obtém descrição da ocorrência do banco de dados ou mapeamento local
 */
async function obterDescricaoOcorrencia(codigoOcorrencia: string, banco: string): Promise<string> {
  try {
    const query = `
      SELECT descricao
      FROM db_manaus.dbretorno_ocorrencias
      WHERE codocorrencia = $1
        AND (banco = $2 OR banco = 'TODOS')
      LIMIT 1
    `;
    
    const result = await pool.query(query, [codigoOcorrencia, banco]);
    
    if (result.rows.length > 0 && result.rows[0].descricao) {
      return result.rows[0].descricao;
    }
  } catch (error) {
    console.warn(`Erro ao buscar ocorrência no banco: ${error}`);
  }
  
  // Fallback: usar mapeamento local
  const descricaoLocal = OCORRENCIAS_CNAB[codigoOcorrencia];
  if (descricaoLocal) {
    return descricaoLocal;
  }
  
  // Último recurso: descrição genérica
  return `Ocorrência ${codigoOcorrencia} (Não Catalogada)`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RespostaProcessamento>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'Apenas POST é permitido'
    });
  }

  // Diagnostic: log content-type to help debug missing file issues in production
  const contentType = (req.headers['content-type'] || '').toString();
  console.log('[processar] content-type:', contentType);
  const _startTime = Date.now();
  console.log('[processar] start:', new Date(_startTime).toISOString());
  console.log('[processar] DATABASE_URL definido:', !!process.env.DATABASE_URL);

  let client;
  try {
    console.log('[processar] tentando conectar ao DB...');
    client = await pool.connect();
    console.log('[processar] DB client connected successfully');
  } catch (dbError) {
    console.error('[processar] Failed to connect to database:', dbError);
    return res.status(500).json({
      success: false,
      message: 'Erro de conexão com o banco de dados',
      error: dbError instanceof Error ? dbError.message : 'Erro desconhecido na conexão'
    });
  }

  // Arquivo temporário criado ao processar multipart (se houver) — mantemos referência para limpeza em caso de sucesso/erro
  let arquivoTempParaDeletar: string | null = null;

  try {
    // Suporte a duas formas de envio:
    // 1) multipart/form-data com 'file' (recomendado) — evita problemas entre instâncias
    // 2) JSON com { filePath } (mantido para compatibilidade local)

    let conteudo: string;
    let usuario: string | undefined = undefined;
    let origemFilePath: string | undefined = undefined; // caminho usado para extrair nome do arquivo no header

    if (contentType.includes('multipart/form-data')) {
      const uploadDir = process.env.UPLOAD_DIR || os.tmpdir();
      
      // Garantir que o diretório de upload existe
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (dirError) {
        console.error('[processar] erro ao criar diretório de upload:', uploadDir, dirError);
        return res.status(500).json({
          success: false,
          message: 'Erro interno do servidor',
          error: `Não foi possível criar diretório de upload: ${uploadDir}`
        });
      }

      const form = formidable({
        uploadDir: uploadDir,
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(req as any);
      console.log('[processar] formidable parsed - fields:', Object.keys(fields || {}), 'files:', Object.keys(files || {}));
      
      const usuarioField = fields?.usuario;
      usuario = Array.isArray(usuarioField) ? usuarioField[0] : (usuarioField as string | undefined);

      const file = (files?.file && Array.isArray(files.file)) ? files.file[0] : (files?.file as any);
      console.log('[processar] file object:', file ? { filepath: file.filepath, originalFilename: file.originalFilename, size: file.size } : 'null');
      if (!file) {
        console.error('[processar] multipart sem campo file');
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo enviado',
          error: "Envie o arquivo em multipart/form-data no campo 'file'."
        });
      }

      const filePathLocal = file.filepath || file.filePath || file.path;
      if (!filePathLocal || !fs.existsSync(filePathLocal)) {
        console.error('[processar] arquivo temporário não encontrado:', filePathLocal);
        return res.status(400).json({
          success: false,
          message: 'Arquivo temporário não encontrado',
          error: `Arquivo temporário ${filePathLocal} não existe`
        });
      }

      const tBeforeRead = Date.now();
      arquivoTempParaDeletar = filePathLocal;
      origemFilePath = filePathLocal;
      console.log('[processar] tentando ler arquivo:', filePathLocal, 'existe?', fs.existsSync(filePathLocal));
      conteudo = await fs.promises.readFile(filePathLocal, 'utf-8');
      const tAfterRead = Date.now();
      console.log('[processar] arquivo lido do multipart:', filePathLocal, `leitura ${tAfterRead - tBeforeRead}ms`);

    } else {
      // Body parser está desabilitado para permitir multipart; ler JSON manualmente quando necessário
      let body: any = req.body as any;

      if (!body) {
        try {
          const chunks: Uint8Array[] = [];
          await new Promise<void>((resolve, reject) => {
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolve());
            req.on('error', (err) => reject(err));
          });
          const raw = Buffer.concat(chunks).toString('utf8');
          body = raw ? JSON.parse(raw) : {};
        } catch (err) {
          console.error('[processar] erro ao parsear corpo JSON:', err);
          return res.status(400).json({
            success: false,
            message: 'Falha ao ler corpo da requisição',
            error: 'Corpo inválido ou mal formado'
          });
        }
      }

      usuario = body.usuario;
      const filePathFromBody = body.filePath;

      if (!filePathFromBody) {
        console.error('[processar] nenhum filePath no corpo. body keys:', Object.keys(body || {}));
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo fornecido',
          error: "filePath não fornecido. Use multipart/form-data com campo 'file' ou envie JSON com 'filePath' (apenas válido em ambiente local)."
        });
      }

      if (!fs.existsSync(filePathFromBody)) {
        console.error('[processar] filePath informado não existe:', filePathFromBody);
        return res.status(400).json({
          success: false,
          message: 'Arquivo não encontrado',
          error: `Arquivo ${filePathFromBody} não existe`
        });
      }

      const tBeforeRead = Date.now();
      origemFilePath = filePathFromBody;
      conteudo = await fs.promises.readFile(filePathFromBody, 'utf-8');
      const tAfterRead = Date.now();
      console.log('[processar] arquivo lido do path fornecido:', filePathFromBody, `leitura ${tAfterRead - tBeforeRead}ms`);
    }

    // Validar formato CNAB 400
    const tValidationStart = Date.now();
    console.log('[processar] iniciando validação CNAB');
    const validacao = validarRetornoCNAB400(conteudo);
    const tValidationEnd = Date.now();
    console.log('[processar] validação CNAB concluída:', `${tValidationEnd - tValidationStart}ms`, 'válido:', validacao.valido);
    if (!validacao.valido) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo de retorno inválido',
        error: validacao.erro
      });
    }

    // Parsear arquivo
    const tParseStart = Date.now();
    console.log('[processar] iniciando parse CNAB');
    const retorno = parseCNAB400Retorno(conteudo);
    const tParseEnd = Date.now();
    console.log('[processar] parse CNAB concluído:', `${tParseEnd - tParseStart}ms`, 'total detalhes:', retorno.detalhes.length);

    // ⚠️ MODO TESTE - Validação de duplicata DESABILITADA
    // TODO: Remover comentário quando terminar testes
    /*
    // Verificar duplicação
    const arquivoDuplicado = await validarArquivoDuplicado(
      retorno.header.dataGeracao,
      retorno.header.numeroSequencialArquivo,
      retorno.header.nomeBanco,
      retorno.header.codigoBanco
    );

    if (arquivoDuplicado) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo já foi importado anteriormente',
        error: 'Arquivo duplicado'
      });
    }
    */

    console.log('[processar] iniciando transação DB');
    const tDBStart = Date.now();
    await client.query('BEGIN');
    console.log('[processar] transação iniciada');

    // Contadores por filial
    const contadores = {
      mao: 0,
      pvh: 0,
      rec: 0,
      flz: 0,
      bmo: 0,
      csac: 0,
      jps: 0,
    };

    // Estatísticas
    const estatisticas = {
      totalProcessados: 0,
      liquidados: 0,
      baixados: 0,
      rejeitados: 0,
      outros: 0,
    };

    const titulosParaBaixaAutomatica: any[] = [];
    const titulosParaBaixaManual: any[] = [];

    // Contar títulos por filial
    for (const detalhe of retorno.detalhes) {
      const filial = determinarFilial(detalhe.numeroControle, detalhe.codigoEmpresa);
      
      switch (filial) {
        case 'MAO': contadores.mao++; break;
        case 'PVH': contadores.pvh++; break;
        case 'REC': contadores.rec++; break;
        case 'FLZ': contadores.flz++; break;
        case 'BMO': contadores.bmo++; break;
        case 'CSAC': contadores.csac++; break;
        case 'JPS': contadores.jps++; break;
      }
    }

    // Inserir header do arquivo (ARQUIVO_INC)
    const insertHeaderQuery = `
      INSERT INTO db_manaus.dbretorno_arquivo (
        banco, data_importacao, nome_arquivo, usuario_importacao,
        qtd_mao, qtd_pvh, qtd_rec, qtd_flz, qtd_cccc, qtd_csac, qtd_jps,
        datageracaoarquivo, numerosequencialarquivo, nomebanco, numerobancocamaracompensacao
      ) VALUES (
        $1, CURRENT_TIMESTAMP, $2, $3,
        $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14
      )
      RETURNING codretorno
    `;

    // Extrair nome do arquivo do caminho (funciona para Windows e Unix)
    const caminhoOrigem = origemFilePath || 'arquivo_retorno.ret';
    const partesPorBarra = caminhoOrigem.split('/');
    const partesPorBackslash = caminhoOrigem.split('\\');
    const nomeArquivoCompleto = partesPorBackslash.length > partesPorBarra.length
      ? partesPorBackslash.pop() || 'arquivo_retorno.ret'
      : partesPorBarra.pop() || 'arquivo_retorno.ret';
    const nomeArquivo = nomeArquivoCompleto.substring(0, 50); // Limitar a 50 caracteres

    console.log('[processar] inserindo header com valores:', [
      retorno.banco,
      nomeArquivo,
      usuario || 'SYSTEM',
      contadores.mao,
      contadores.pvh,
      contadores.rec,
      contadores.flz,
      contadores.bmo,
      contadores.csac,
      contadores.jps,
      retorno.header.dataGeracao,
      retorno.header.numeroSequencialArquivo,
      retorno.header.nomeBanco,
      retorno.header.codigoBanco,
    ]);

    const headerResult = await client.query(insertHeaderQuery, [
      retorno.banco,
      nomeArquivo,
      usuario || 'SYSTEM',
      contadores.mao,
      contadores.pvh,
      contadores.rec,
      contadores.flz,
      contadores.bmo,
      contadores.csac,
      contadores.jps,
      retorno.header.dataGeracao,
      retorno.header.numeroSequencialArquivo,
      retorno.header.nomeBanco,
      retorno.header.codigoBanco,
    ]);

    console.log('[processar] headerResult:', headerResult);
    console.log('[processar] headerResult.rows:', headerResult.rows);
    
    let codretorno = headerResult.rows[0]?.codretorno;
    
    if (!codretorno) {
      console.log('[processar] codretorno não retornado, tentando buscar último registro inserido');
      // Tentar buscar o último registro inserido baseado nos dados únicos
      const buscaQuery = `
        SELECT codretorno 
        FROM db_manaus.dbretorno_arquivo 
        WHERE nome_arquivo = $1 
          AND numerosequencialarquivo = $2 
          AND nomebanco = $3 
          AND numerobancocamaracompensacao = $4 
        ORDER BY codretorno DESC 
        LIMIT 1
      `;
      const buscaResult = await client.query(buscaQuery, [
        nomeArquivo,
        retorno.header.numeroSequencialArquivo,
        retorno.header.nomeBanco,
        retorno.header.codigoBanco,
      ]);
      
      if (buscaResult.rows.length > 0) {
        codretorno = buscaResult.rows[0].codretorno;
        console.log('[processar] codretorno encontrado via busca:', codretorno);
      } else {
        throw new Error('Não foi possível obter codretorno - inserção pode ter falhado');
      }
    }
    
    console.log('[processar] header inserido, codretorno:', codretorno);

    // Inserir detalhes (DETALHE_INC)
    const insertDetalheQuery = `
      INSERT INTO db_manaus.dbretorno_detalhe (
        codretorno, codreceb, codcli, nomecli, tipo_empresa, cnpj,
        nro_docbanco, codocorrencia, ocorrencia, nro_doc, dt_ocorrencia,
        dt_venc, valor_titulo, banco_cobrador, agencia_cobradora,
        valor_pago, valor_desconto, valor_juros, carteira, protesto, motivo, situacao
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
    `;

    console.log('[processar] iniciando processamento de', retorno.detalhes.length, 'detalhes');
    for (const detalhe of retorno.detalhes) {
      // Obter descrição da ocorrência primeiro
      const descricaoOcorrencia = await obterDescricaoOcorrencia(detalhe.codigoOcorrencia, retorno.banco);
      
      // Analisar título (agora recebe a descrição)
      const analise = analisarTitulo(detalhe, descricaoOcorrencia);

      // Determinar tipo de empresa (simplificado)
      const tipoEmpresa = detalhe.codigoInscricao === '01' ? 'F' : 'F'; // F=Fornecedor, T=Transportadora

      await client.query(insertDetalheQuery, [
        codretorno,
        detalhe.nossoNumero,
        detalhe.numeroInscricao.substring(0, 5), // codcli - Limitar a 5 caracteres
        detalhe.nomeSacado,
        tipoEmpresa,
        detalhe.numeroInscricao,
        detalhe.nossoNumero,
        detalhe.codigoOcorrencia,
        descricaoOcorrencia,
        detalhe.numeroDocumento,
        detalhe.dataOcorrencia || null,
        detalhe.dataVencimento || null,
        Math.round(detalhe.valorTitulo * 100), // Converter para centavos (bigint)
        detalhe.codigoBanco,
        (detalhe.agenciaCobradora || '').substring(0, 5), // Limitar a 5 caracteres
        Math.round(detalhe.valorPago * 100), // Converter para centavos (bigint)
        Math.round(detalhe.desconto * 100), // Converter para centavos (bigint)
        Math.round(detalhe.jurosMulta * 100), // Converter para centavos (bigint)
        detalhe.carteira,
        '',
        detalhe.motivoOcorrencia,
        analise.situacao,
      ]);

      // Estatísticas
      estatisticas.totalProcessados++;
      
      if (['06', '15', '17'].includes(detalhe.codigoOcorrencia)) {
        estatisticas.liquidados++;
        // Atualizar status do título para 'B' (Baixado) - compatibilidade Oracle
        try {
          await client.query(`
            UPDATE db_manaus.dbreceb
            SET bradesco = 'B'
            WHERE cod_receb = $1
          `, [detalhe.nossoNumero]);
        } catch (updateError) {
          console.error(`Erro ao atualizar status do título ${detalhe.nossoNumero}:`, updateError);
        }
      } else if (['09', '10'].includes(detalhe.codigoOcorrencia)) {
        estatisticas.baixados++;
        // Baixa manual - também marcar como 'B'
        try {
          await client.query(`
            UPDATE db_manaus.dbreceb
            SET bradesco = 'B'
            WHERE cod_receb = $1
          `, [detalhe.nossoNumero]);
        } catch (updateError) {
          console.error(`Erro ao atualizar status do título ${detalhe.nossoNumero}:`, updateError);
        }
      } else if (['03', '24', '32'].includes(detalhe.codigoOcorrencia)) {
        estatisticas.rejeitados++;
        // Título rejeitado - voltar para 'N' (Não enviado) para permitir reenvio
        try {
          await client.query(`
            UPDATE db_manaus.dbreceb
            SET bradesco = 'N'
            WHERE cod_receb = $1
          `, [detalhe.nossoNumero]);
        } catch (updateError) {
          console.error(`Erro ao atualizar status do título ${detalhe.nossoNumero}:`, updateError);
        }
      } else {
        estatisticas.outros++;
      }

      // Classificar para baixa automática ou manual
      if (analise.permiteБaixaAutomatica) {
        titulosParaBaixaAutomatica.push({
          nossoNumero: detalhe.nossoNumero,
          numeroDocumento: detalhe.numeroDocumento,
          nomeSacado: detalhe.nomeSacado,
          valorPago: detalhe.valorPago,
          dataOcorrencia: detalhe.dataOcorrencia,
          codigoOcorrencia: detalhe.codigoOcorrencia,
          ocorrencia: descricaoOcorrencia,
        });
      } else {
        titulosParaBaixaManual.push({
          nossoNumero: detalhe.nossoNumero,
          numeroDocumento: detalhe.numeroDocumento,
          nomeSacado: detalhe.nomeSacado,
          valorTitulo: detalhe.valorTitulo,
          valorPago: detalhe.valorPago,
          desconto: detalhe.desconto,
          jurosMulta: detalhe.jurosMulta,
          dataVencimento: detalhe.dataVencimento,
          dataOcorrencia: detalhe.dataOcorrencia,
          codigoOcorrencia: detalhe.codigoOcorrencia,
          ocorrencia: descricaoOcorrencia,
          motivo: analise.motivo,
          motivoOcorrencia: detalhe.motivoOcorrencia,
        });
      }
    }

    console.log('[processar] finalizando loop de detalhes, total processados:', estatisticas.totalProcessados);
    await client.query('COMMIT');
    const tDBEnd = Date.now();
    console.log('[processar] transação commitada', `DB time ${tDBEnd - tDBStart}ms`);

    // Limpar arquivo temporário (apenas se foi criado pelo multipart)
    try {
      if (arquivoTempParaDeletar) {
        fs.unlinkSync(arquivoTempParaDeletar);
      }
    } catch (err) {
      console.error('Erro ao deletar arquivo temporário:', err);
    }

    res.status(200).json({
      success: true,
      message: 'Arquivo de retorno processado com sucesso',
      data: {
        codretorno,
        banco: retorno.banco,
        nomeArquivo,
        totalTitulos: retorno.totalTitulos,
        valorTotal: retorno.totalValor,
        estatisticas: {
          ...estatisticas,
          porFilial: contadores,
        },
        titulosParaBaixaAutomatica,
        titulosParaBaixaManual,
      },
    });

    const _endTime = Date.now();
    console.log('[processar] total tempo:', `${_endTime - _startTime}ms`);

  } catch (error) {
    await client.query('ROLLBACK');
    
    console.error('Erro ao processar retorno:', error);
    
    // Tentar deletar arquivo temporário em caso de erro
    try {
      if (arquivoTempParaDeletar) fs.unlinkSync(arquivoTempParaDeletar);
    } catch (err) {
      console.error('Erro ao deletar arquivo temporário após falha:', err);
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao processar arquivo de retorno',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}

export const config = {
  api: {
    bodyParser: false, // Desabilitar body parser para permitir multipart/form-data
  },
};
