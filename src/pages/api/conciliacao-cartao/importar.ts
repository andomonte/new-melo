import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

interface RegistroImportado {
  loja: string;
  filial: string;
  nsu: string;
  dt_transacao: string;
  hora_transacao: string;
  bandeira: string;
  tipo_transacao: string;
  parcela: string;
  valor_bruto: number;
  taxa: number;
  valor_liquido: number;
  autorizacao: string;
  tid: string;
  codigo_operacao: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { arquivo, nomeArquivo, filtroFilial } = req.body;

  if (!arquivo) {
    return res.status(400).json({ error: 'Arquivo é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar se tabela existe, caso contrário criar
    const tabelaExiste = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'db_manaus' 
        AND table_name = 'fin_cartao_receb_import'
      )
    `);

    if (!tabelaExiste.rows[0].exists) {
      // Criar tabela se não existir
      await client.query(`
        CREATE TABLE db_manaus.fin_cartao_receb_import (
          id SERIAL PRIMARY KEY,
          loja VARCHAR(10),
          filial VARCHAR(20),
          nsu VARCHAR(50),
          dt_transacao DATE,
          hora_transacao TIME,
          bandeira VARCHAR(30),
          tipo_transacao VARCHAR(20),
          parcela VARCHAR(10),
          valor_bruto DECIMAL(15,2),
          taxa DECIMAL(15,2),
          valor_liquido DECIMAL(15,2),
          autorizacao VARCHAR(50),
          tid VARCHAR(100),
          codigo_operacao VARCHAR(20),
          dt_importacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          arquivo_nome VARCHAR(255),
          linha_arquivo INTEGER,
          status VARCHAR(20) DEFAULT 'PENDENTE',
          cod_receb VARCHAR(20),
          cod_freceb VARCHAR(20),
          dt_conciliacao TIMESTAMP,
          observacao TEXT
        )
      `);
    }

    // Parse do arquivo (CSV ou TXT com delimitador)
    const linhas = arquivo.trim().split('\n');
    const registros: RegistroImportado[] = [];
    const erros: string[] = [];

    // Detectar delimitador (ponto-vírgula ou vírgula)
    const primeiraLinha = linhas[0];
    const delimitador = primeiraLinha.includes(';') ? ';' : ',';

    // Processar linhas (pular cabeçalho se existir)
    const inicioLinhas = linhas[0].toLowerCase().includes('loja') ||
      linhas[0].toLowerCase().includes('nsu') ? 1 : 0;

    for (let i = inicioLinhas; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue; // Pular linhas vazias

      try {
        // Tratar colunas vazias (;;) substituindo por ;null;
        const linhaLimpa = linha.replace(new RegExp(`\\${delimitador}\\${delimitador}`, 'g'), `${delimitador}null${delimitador}`);
        const campos = linhaLimpa.split(delimitador);

        // Mapear campos (assumindo estrutura padrão das operadoras)
        const lojaId = (campos[0] || '').trim();
        const nsu = (campos[1] || '').trim();
        const data = (campos[2] || '').trim();
        const hora = (campos[3] || '').trim();
        const bandeira = (campos[4] || '').trim().toUpperCase();
        const parcela = (campos[5] || '').trim();
        const valorBruto = parseFloat((campos[6] || '0').replace(',', '.'));
        const taxa = parseFloat((campos[7] || '0').replace(',', '.'));
        const valorLiquido = parseFloat((campos[8] || '0').replace(',', '.'));
        const autorizacao = (campos[9] || '').trim();
        const tid = (campos[10] || '').trim();

        // Identificar filial pela loja
        let filialIdentificada = 'Desconhecida';
        if (lojaId === '0001' || lojaId === '001' || lojaId === '1') {
          filialIdentificada = 'Manaus';
        } else if (lojaId === '0002' || lojaId === '002' || lojaId === '2') {
          filialIdentificada = 'Porto Velho';
        }

        // Filtrar por filial se especificado
        if (filtroFilial && filialIdentificada !== filtroFilial) {
          continue;
        }

        // Validações básicas
        if (!nsu || !autorizacao) {
          erros.push(`Linha ${i + 1}: NSU ou Autorização ausente`);
          continue;
        }

        // Converter data (formatos: DD/MM/YYYY, YYYY-MM-DD, etc)
        let dtTransacao = '';
        if (data) {
          // Remover caracteres estranhos
          const dataLimpa = data.trim();

          if (dataLimpa.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            // XX/XX/XXXX
            const [d, m, y] = dataLimpa.split('/');
            dtTransacao = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else if (dataLimpa.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // XXXX-XX-XX (já está no formato ISO)
            dtTransacao = dataLimpa;
          } else if (dataLimpa.match(/^\d{8}$/)) {
            // XXXXXXXX (ex: 20260115 ou 15012026) - Tentar adivinhar ou assumir DDMMAAAA
            // Assumindo DDMMAAAA por operadoras brasileiras
            const d = dataLimpa.substring(0, 2);
            const m = dataLimpa.substring(2, 4);
            const y = dataLimpa.substring(4, 8);
            dtTransacao = `${y}-${m}-${d}`;
          } else {
            // Logar falha de parse mas nao parar, usar uma data default ou null (se permitido)
            // Aqui vamos logar e usar data atual para não quebrar o INSERT, mas marcar flag de erro na obs?
            // Melhor: Deixar null e deixar o banco reclamar SE for not null, ou usar fallback
            // O banco é DATE, aceita 'YYYY-MM-DD'.

            // Tentativa desesperada de limpar "undefined-..."
            if (dataLimpa.length > 10 && (dataLimpa.includes('/') || dataLimpa.includes('-'))) {
              // CNPJ ou texto longo no campo data -> Provável rodapé
              erros.push(`Linha ${i + 1}: Ignorada (CNPJ/Rodapé no campo data): ${dataLimpa}`);
              continue;
            }

            console.warn(`Data inválida detectada: ${dataLimpa} na linha ${i + 1}`);
            dtTransacao = new Date().toISOString().split('T')[0]; // Fallback para hoje
          }
        }

        // Identificar tipo de transação
        let tipoTransacao = 'CRÉDITO';
        if (bandeira.includes('DÉBITO') || bandeira.includes('ELECTRON') || bandeira.includes('MAESTRO')) {
          tipoTransacao = 'DÉBITO';
        }

        // Validar hora
        let horaTransacao = '00:00:00';
        if (hora && hora.includes(':') && !hora.includes('/')) {
          horaTransacao = hora;
        }

        // Função de correcao de valor
        const parseValor = (val: string) => {
          if (!val) return 0;
          // Se tiver 2 ou mais pontos/virgulas e o ultimo for virgula, é BR (1.000,00)
          // Se tiver 2 ou mais pontos/virgulas e o ultimo for ponto, é US (1,000.00)
          // Simples: remover tudo que nao for numero ou o ultimo separador decimal

          // Tenta padrao BR primeiro (virgula como decimal)
          if (val.includes(',') && val.indexOf(',') > val.indexOf('.')) {
            return parseFloat(val.replace(/\./g, '').replace(',', '.'));
          }
          // Padrao US
          return parseFloat(val.replace(/,/g, ''));
        }



        registros.push({
          loja: lojaId,
          filial: filialIdentificada,
          nsu,
          dt_transacao: dtTransacao || new Date().toISOString().split('T')[0],
          hora_transacao: horaTransacao,
          bandeira: bandeira.replace('DÉBITO', '').replace('CRÉDITO', '').trim(),
          tipo_transacao: tipoTransacao,
          parcela: parcela || '01-01',
          valor_bruto: valorBruto,
          taxa,
          valor_liquido: valorLiquido,
          autorizacao,
          tid: tid || nsu,
          codigo_operacao: lojaId
        });

      } catch (error: any) {
        erros.push(`Linha ${i + 1}: Erro ao processar - ${error.message}`);
        console.error(`Erro na linha ${i + 1}:`, error);
      }
    }

    // Inserir registros no banco
    let inseridos = 0;
    let duplicados = 0;

    for (const reg of registros) {
      try {
        // Iniciar savepoint para este registro
        await client.query('SAVEPOINT sp_registro');

        // Truncar campos de texto para evitar erros de valor muito longo (baseado no schema)
        // parcela(10), loja(10), tipo_transacao(20), filial(20), cod_oper(20), status(20), cod_receb(20), bandeira(30), nsu(50), auto(50), tid(100)
        const valParcela = String(reg.parcela || '').substring(0, 10);
        const valLoja = String(reg.loja || '').substring(0, 10);
        const valFilial = String(reg.filial || '').substring(0, 20);
        const valNsu = String(reg.nsu || '').substring(0, 50);
        const valBandeira = String(reg.bandeira || '').substring(0, 30);
        const valTipo = String(reg.tipo_transacao || '').substring(0, 20);
        const valAuto = String(reg.autorizacao || '').substring(0, 50);
        const valTid = String(reg.tid || '').substring(0, 100);
        const valCodOper = String(reg.codigo_operacao || '').substring(0, 20);

        // Verificar duplicidade da linha exata no arquivo para evitar processar 2x se reimportar
        // Mas a chave unica do banco é (nsu, autorizacao, parcela) geralmente.
        // O erro diz constraint "idx_import_nsu".
        // Vamos checar usando os valores TRUNCADOS que serão inseridos.

        // Tratamento especial para autorizacao que pode ser nula no indice unique se o banco permitir
        // Mas aqui estamos inserindo string vazia ou string truncada.
        // Se o banco converte '' para NULL ou se ja tem NULL la, precisamos cuidar.
        // Vamos checar por string vazia E null.

        let checkDuplicado = null;
        if (!valAuto) {
          // Se autorizacao for vazia, verifica se tem com NULL ou VAZIO
          checkDuplicado = await client.query(`
              SELECT id FROM db_manaus.fin_cartao_receb_import
              WHERE nsu = $1 AND (autorizacao = '' OR autorizacao IS NULL) AND parcela = $2
            `, [valNsu, valParcela]);
        } else {
          checkDuplicado = await client.query(`
              SELECT id FROM db_manaus.fin_cartao_receb_import
              WHERE nsu = $1 AND autorizacao = $2 AND parcela = $3
            `, [valNsu, valAuto, valParcela]);
        }

        if (checkDuplicado.rows.length > 0) {
          duplicados++;
          await client.query('RELEASE SAVEPOINT sp_registro'); // Release antes de continue
          continue;
        }

        // Inserir registro
        const insertQuery = `
          INSERT INTO db_manaus.fin_cartao_receb_import (
            loja, filial, nsu, dt_transacao, hora_transacao,
            bandeira, tipo_transacao, parcela,
            valor_bruto, taxa, valor_liquido,
            autorizacao, tid, codigo_operacao,
            arquivo_nome, linha_arquivo, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `;

        const values = [
          valLoja, // loja (10)
          valFilial, // filial (20)
          valNsu, // nsu (50)
          reg.dt_transacao,
          reg.hora_transacao,
          valBandeira, // bandeira (30)
          valTipo, // tipo_transacao (20)
          valParcela, // parcela (10)
          reg.valor_bruto,
          reg.taxa,
          reg.valor_liquido,
          valAuto, // autorizacao (50)
          valTid, // tid (100)
          valCodOper, // codigo_operacao (20)
          nomeArquivo || 'arquivo_importado.csv',
          0, // linha_arquivo
          'PENDENTE'
        ];

        /* console.log('Tentando inserir:', values); */

        await client.query(insertQuery, values);

        inseridos++;
        await client.query('RELEASE SAVEPOINT sp_registro');

      } catch (error: any) {
        await client.query('ROLLBACK TO SAVEPOINT sp_registro');
        // Importante: liberar o savepoint após rollback para evitar vazamento se o driver/banco nao limpar
        await client.query('RELEASE SAVEPOINT sp_registro');

        erros.push(`Erro ao inserir registro NSU ${reg.nsu}: ${error.message}`);
        console.error('Erro ao inserir:', error);
      }
    }

    // Logging para debug em arquivo
    const resumo = {
      totalLinhas: linhas.length - inicioLinhas,
      registrosProcessados: registros.length,
      inseridos,
      duplicados,
      erros: erros.length,
      filial: filtroFilial || 'Todas'
    };

    try {
      if (erros.length > 0) {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(process.cwd(), 'import_errors.log');
        const logContent = `
--- ${new Date().toISOString()} ---
Resumo: ${JSON.stringify(resumo, null, 2)}
Erros (${erros.length}):
${erros.join('\n')}
-----------------------------------
`;
        fs.appendFileSync(logPath, logContent);
        console.log(`Erros salvos em: ${logPath}`);
      }
    } catch (logError) {
      console.error('Erro ao escrever log:', logError);
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      mensagem: `Importação concluída com sucesso`,
      resumo: resumo,
      detalhesErros: erros.length > 0 ? erros.slice(0, 10) : [] // Limitar a 10 erros
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao importar arquivo:', error);

    // Log fatal error
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(process.cwd(), 'import_errors.log');
      const logContent = `
--- ${new Date().toISOString()} ---
ERRO FATAL: ${error.message}
Stack: ${error.stack}
-----------------------------------
`;
      fs.appendFileSync(logPath, logContent);
    } catch (e) { }

    return res.status(500).json({
      error: 'Erro ao importar arquivo',
      details: error.message
    });
  } finally {
    client.release();
  }
}
