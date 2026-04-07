import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { formatTexto, formatDateDDMMYYYY, notChar } from '@/utils/formatTexto';
import fs from 'fs';
import path from 'path';

const pool = getPgPool();

// Função de validação dos dados da remessa
function validarDadosRemessa(rows: any[]): string[] {
  const erros: string[] = [];

  if (rows.length === 0) {
    erros.push('Nenhum registro encontrado para o período');
    return erros;
  }

  rows.forEach((row, index) => {
    const linha = index + 1;

    // Validar campos obrigatórios
    if (!row.cpfcgc || row.cpfcgc.trim() === '') {
      erros.push(`Linha ${linha}: CPF/CGC está vazio`);
    }

    if (!row.nome || row.nome.trim() === '') {
      erros.push(`Linha ${linha}: Nome está vazio`);
    }

    if (!row.endereco || row.endereco.trim() === '') {
      erros.push(`Linha ${linha}: Endereço está vazio`);
    }

    if (!row.cidade || row.cidade.trim() === '') {
      erros.push(`Linha ${linha}: Cidade está vazia`);
    }

    if (!row.uf || row.uf.trim() === '') {
      erros.push(`Linha ${linha}: UF está vazia`);
    }

    if (!row.cep || row.cep.trim() === '') {
      erros.push(`Linha ${linha}: CEP está vazio`);
    }

    // Validar formato do CPF/CGC (deve ter pelo menos 11 dígitos para CPF ou 14 para CNPJ)
    if (row.cpfcgc && row.cpfcgc.replace(/\D/g, '').length < 11) {
      erros.push(`Linha ${linha}: CPF/CGC inválido (menos de 11 dígitos)`);
    }

    // Validar UF (deve ter exatamente 2 caracteres)
    if (row.uf && row.uf.length !== 2) {
      erros.push(`Linha ${linha}: UF deve ter exatamente 2 caracteres`);
    }

    // Validar CEP (deve ter exatamente 8 dígitos após formatação)
    if (row.cep && notChar(row.cep).length !== 8) {
      erros.push(`Linha ${linha}: CEP deve ter exatamente 8 dígitos`);
    }

    // Validar valor do pagamento (deve ser maior que zero)
    if (!row.valor_pgto || parseFloat(row.valor_pgto) <= 0) {
      erros.push(`Linha ${linha}: Valor do pagamento deve ser maior que zero`);
    }

    // Validar datas
    if (!row.dt_emissao) {
      erros.push(`Linha ${linha}: Data de emissão está vazia`);
    }

    if (!row.dt_venc) {
      erros.push(`Linha ${linha}: Data de vencimento está vazia`);
    }

    if (!row.dt_pgto) {
      erros.push(`Linha ${linha}: Data de pagamento está vazia`);
    }
  });

  return erros;
}

// Função para determinar o banco baseado nos títulos selecionados
async function determinarBancoRemessa(detalhes: any[]): Promise<string> {
  if (!detalhes || detalhes.length === 0) {
    return 'BANCO ITAU'; // Fallback
  }

  // Verificar se todos os títulos têm o mesmo banco
  const bancosDistintos = [...new Set(detalhes.map(d => d.banco).filter(b => b))];

  if (bancosDistintos.length === 1) {
    // Todos os títulos têm o mesmo banco - buscar nome na tabela dbbanco
    const codBanco = bancosDistintos[0];
    try {
      const bancoResult = await pool.query(`
        SELECT nome FROM db_manaus.dbbanco
        WHERE cod_banco = $1
        LIMIT 1
      `, [codBanco]);

      if (bancoResult.rows.length > 0) {
        return bancoResult.rows[0].nome;
      }
    } catch (error) {
      console.warn('Erro ao buscar nome do banco:', error);
    }
  }

  // Fallback para o banco mais comum nas remessas existentes
  return 'BANCO ITAU';
}

// Função para salvar remessa automaticamente nas tabelas do banco (seguindo padrão do legado)
async function salvarRemessaAutomaticamente(
  banco: string,
  nomeArquivo: string,
  usuario: string,
  detalhes: any[]
): Promise<{ sucesso: boolean; erro?: string; codremessa?: number; codbodero?: string }> {
  try {
    // Iniciar transação
    await pool.query('BEGIN');

    // 1. Obter próximo código de remessa
    const proximoCodQuery = `
      SELECT COALESCE(MAX(codremessa), 0) + 1 as proximo_cod
      FROM db_manaus.dbremessa_arquivo
    `;
    const proximoCodResult = await pool.query(proximoCodQuery);
    const codremessa = proximoCodResult.rows[0].proximo_cod;

    // 2. Obter próximo codbodero
    const proximoBodeQuery = `
      SELECT COALESCE(MAX(CAST(codbodero AS INTEGER)), 0) + 1 as proximo_bode
      FROM db_manaus.dbremessa_arquivo
    `;
    const proximoBodeResult = await pool.query(proximoBodeQuery);
    const codbodero = String(proximoBodeResult.rows[0].proximo_bode).padStart(9, '0');

    // 3. Inserir na tabela dbremessa_arquivo
    const arquivoQuery = `
      INSERT INTO db_manaus.dbremessa_arquivo
      (codremessa, banco, data_gerado, nome_arquivo, usuario_importacao, codbodero)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING codremessa
    `;

    await pool.query(arquivoQuery, [
      codremessa,
      banco,
      new Date(),
      nomeArquivo, // Salva apenas o nome do arquivo (caminho relativo)
      usuario,
      codbodero
    ]);

    console.log(`✅ Arquivo de remessa inserido: codremessa=${codremessa}, codbodero=${codbodero}`);

    // 4. Inserir detalhes na tabela dbremessa_detalhe
    if (detalhes && detalhes.length > 0) {
      for (let i = 0; i < detalhes.length; i++) {
        const detalhe = detalhes[i];

        const detalheQuery = `
          INSERT INTO db_manaus.dbremessa_detalhe
          ("CODREMESSA_DETALHE", "CODREMESSA", "CODCLI", "DOCUMENTO", "VALOR", "NROBANCO")
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await pool.query(detalheQuery, [
          codremessa * 1000 + i + 1, // CODREMESSA_DETALHE único
          codremessa, // CODREMESSA (ligação com arquivo)
          detalhe.codcli || '',
          detalhe.nro_doc || '',
          detalhe.valor_pgto || 0,
          detalhe.nro_banco || ''
        ]);
      }

      console.log(`✅ ${detalhes.length} detalhes inseridos`);
    }

    // Confirmar transação
    await pool.query('COMMIT');

    return {
      sucesso: true,
      codremessa: codremessa,
      codbodero: codbodero
    };

  } catch (error: any) {
    // Reverter transação em caso de erro
    await pool.query('ROLLBACK');
    console.error('❌ Erro ao salvar remessa automaticamente:', error);
    return {
      sucesso: false,
      erro: error.message
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  try {
    const { dtini, dtfim, usuario } = req.body;

    if (!dtini || !dtfim) {
      return res.status(400).json({
        erro: 'Datas inicial e final são obrigatórias'
      });
    }

    // Validar datas
    const dataIni = new Date(dtini);
    const dataFim = new Date(dtfim);

    if (dataIni > dataFim) {
      return res.status(400).json({
        erro: 'Data inicial não pode ser maior que data final'
      });
    }

    console.log('📄 Gerando remessa Equifax:', {
      dtini: dataIni.toISOString(),
      dtfim: dataFim.toISOString(),
      tabela: 'dbreceb (correção: não existe tabela titulos)'
    });

    // Query para obter dados de remessa
    // Baseado na análise do código legado UniRemessaEquifax.pas
    // A tabela correta é DBRECEB (recebimentos), não "titulos"
    const query = `
      SELECT
        '1' as tipo, -- Tipo fixo baseado no legado
        COALESCE(c.cpfcgc, '') as cpfcgc,
        COALESCE(c.nome, '') as nome,
        COALESCE(c.nomefant, '') as nomefant,
        'R' as naturezaend, -- Rua (exemplo)
        COALESCE(c.ender, '') as endereco,
        COALESCE(c.cidade, '') as cidade,
        COALESCE(c.uf, '') as uf,
        COALESCE(c.cep, '') as cep,
        TO_CHAR(c.datacad, 'DDMMYY') as datacad,
        COALESCE(r.nro_doc, '') as nro_doc,
        '1' as tipotrans, -- Tipo transação
        'REA' as moeda, -- Real
        LPAD(FLOOR(r.valor_pgto)::text, 11, '0') as intpagto,
        LPAD(((r.valor_pgto - FLOOR(r.valor_pgto)) * 100)::int::text, 2, '0') as centpagto,
        LPAD(FLOOR(r.valor_pgto)::text, 11, '0') as intreceb,
        LPAD(((r.valor_pgto - FLOOR(r.valor_pgto)) * 100)::int::text, 2, '0') as centreceb,
        r.dt_emissao as dt_emissao,
        r.dt_venc as dt_venc,
        r.dt_pgto as dt_pgto,
        r.valor_pgto as valor_pgto,
        r.cod_receb as cod_receb,
        r.codcli as codcli,
        r.banco as banco,
        r.nro_banco as nro_banco
      FROM db_manaus.dbreceb r
      LEFT JOIN db_manaus.dbclien c ON c.codcli = r.codcli
      WHERE r.dt_pgto BETWEEN $1 AND $2
        AND r.cancel = 'N'
        AND r.rec = 'S'
        AND r.valor_pgto > 0
        AND c.cpfcgc IS NOT NULL AND c.cpfcgc != ''
      ORDER BY r.dt_pgto, r.nro_doc
    `;

    const result = await pool.query(query, [dataIni, dataFim]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Nenhum dado encontrado para o período informado'
      });
    }

    console.log(`📊 ${result.rows.length} registros encontrados`);

    // Validar dados antes de gerar arquivo
    const errosValidacao = validarDadosRemessa(result.rows);
    if (errosValidacao.length > 0) {
      return res.status(400).json({
        erro: 'Dados inválidos encontrados na remessa',
        detalhes: errosValidacao
      });
    }

    // Gerar arquivo TXT
    const linhas: string[] = [];

    for (const row of result.rows) {
      const linha =
        row.tipo +
        (row.cpfcgc || '') +
        formatTexto(row.nome.substring(0, 55), 55, 'A') +
        formatTexto(row.nomefant.substring(0, 55), 55, 'A') +
        row.naturezaend +
        formatTexto(row.endereco.substring(0, 70), 70, 'A') +
        formatTexto(row.cidade.substring(0, 30), 30, 'A') +
        formatTexto(row.uf, 2, 'A') +
        formatTexto(notChar(row.cep), 8, 'N') +
        formatTexto('', 4, 'A') + // Campo vazio
        formatTexto('', 10, 'A') + // Campo vazio
        formatTexto('', 4, 'A') + // Campo vazio
        formatTexto('', 10, 'A') + // Campo vazio
        formatTexto('', 50, 'A') + // Campo vazio
        formatTexto(row.datacad, 6, 'A') +
        formatTexto(row.nro_doc, 12, 'A') +
        formatTexto(row.tipotrans, 1, 'A') +
        formatTexto(row.moeda, 4, 'A') +
        formatTexto(row.intpagto, 11, 'A') +
        formatTexto(row.centpagto, 2, 'A') +
        formatTexto(row.intreceb, 11, 'A') +
        formatTexto(row.centreceb, 2, 'A') +
        formatTexto(formatDateDDMMYYYY(new Date(row.dt_emissao)), 8, 'A') +
        formatTexto(formatDateDDMMYYYY(new Date(row.dt_venc)), 8, 'A') +
        formatTexto(row.dt_pgto ? formatDateDDMMYYYY(new Date(row.dt_pgto)) : '', 8, 'D');

      linhas.push(linha);
    }

    // Juntar todas as linhas
    const conteudoArquivo = linhas.join('\r\n');

    // Nome do arquivo
    const nomeArquivo = `RemessaEquifax${formatDateDDMMYYYY(new Date())}.txt`;

    // Determinar banco baseado nos títulos
    const bancoRemessa = await determinarBancoRemessa(result.rows);

    // Caminho onde o arquivo será salvo fisicamente
    const caminhoArquivo = path.join(process.cwd(), 'remessas', nomeArquivo);

    // Salvar arquivo fisicamente
    try {
      // Criar diretório se não existir
      const diretorio = path.dirname(caminhoArquivo);
      if (!fs.existsSync(diretorio)) {
        fs.mkdirSync(diretorio, { recursive: true });
      }

      // Salvar arquivo
      fs.writeFileSync(caminhoArquivo, conteudoArquivo, 'latin1');
      console.log(`✅ Arquivo salvo fisicamente em: ${caminhoArquivo}`);
    } catch (error) {
      console.warn('⚠️ Erro ao salvar arquivo fisicamente:', error);
      // Continua mesmo se não conseguir salvar fisicamente
    }

    // Salvar remessa automaticamente no banco
    const resultadoSalvamento = await salvarRemessaAutomaticamente(
      bancoRemessa, // Banco determinado dinamicamente
      caminhoArquivo, // Caminho absoluto onde o arquivo foi salvo
      usuario || 'SYSTEM', // Usuário da request ou SYSTEM como fallback
      result.rows // Detalhes da remessa
    );

    if (!resultadoSalvamento.sucesso) {
      console.warn('⚠️ Aviso: Remessa gerada mas não foi salva no banco:', resultadoSalvamento.erro);
      // Continua a execução mesmo se o salvamento falhar
    } else {
      console.log(`✅ Remessa salva automaticamente: codremessa=${resultadoSalvamento.codremessa}, codbodero=${resultadoSalvamento.codbodero}, banco=${bancoRemessa}`);
    }

    // Remover registro do histórico antigo (se existir) - não mais necessário pois usamos dbremessa_detalhe
    console.log(`✅ Remessa processada com sucesso: ${result.rows.length} registros, codremessa=${resultadoSalvamento.codremessa}`);

    // Retornar arquivo para download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.status(200).send(conteudoArquivo);

  } catch (error: any) {
    console.error('❌ Erro ao gerar remessa Equifax:', error);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error.message
    });
  }
}