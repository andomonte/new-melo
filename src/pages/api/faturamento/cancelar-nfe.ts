import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import https from 'https';
import { getPgPool } from '@/lib/pg';
import { parseStringPromise } from 'xml2js';

import { assinarXML } from '@/components/services/sefazNfe/assinarXml';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { codfat, motivo = 'Cancelamento solicitado pelo emitente' } = req.body;
  if (!codfat) {
    return res.status(400).json({ erro: 'codfat é obrigatório' });
  }

  console.log(
    '🔍 Cancelamento - codfat recebido:',
    codfat,
    'tipo:',
    typeof codfat,
  );

  try {
    // 1. Buscar dados da nota na base
    const client = await getPgPool().connect();
    let nota;
    try {
      // Primeiro tentativa: buscar como string
      console.log('🔍 Tentando buscar codfat como string:', codfat);
      let result = await client.query(
        'SELECT * FROM dbfat_nfe WHERE codfat = $1',
        [String(codfat)],
      );

      if (result.rowCount === 0) {
        // Segunda tentativa: buscar como number
        console.log('🔍 Tentando buscar codfat como number:', Number(codfat));
        result = await client.query(
          'SELECT * FROM dbfat_nfe WHERE codfat = $1',
          [Number(codfat)],
        );
      }

      if (result.rowCount === 0) {
        // Terceira tentativa: buscar sem zero à esquerda (caso seja '0234504' -> '234504')
        const codfatSemZero = String(codfat).replace(/^0+/, '');
        console.log(
          '🔍 Tentando buscar codfat sem zeros à esquerda:',
          codfatSemZero,
        );
        result = await client.query(
          'SELECT * FROM dbfat_nfe WHERE codfat = $1',
          [codfatSemZero],
        );
      }

      if (result.rowCount === 0) {
        // Debug: ver alguns registros para comparar
        const debugResult = await client.query(
          'SELECT codfat FROM dbfat_nfe LIMIT 10',
        );
        console.log(
          '🔍 Exemplos de codfat na base:',
          debugResult.rows.map(
            (r) => `"${r.codfat}" (tipo: ${typeof r.codfat})`,
          ),
        );

        return res.status(404).json({
          erro: 'Nota não encontrada',
          codfatProcurado: codfat,
          tipoRecebido: typeof codfat,
          exemplosDaBase: debugResult.rows.map((r) => ({
            codfat: r.codfat,
            tipo: typeof r.codfat,
          })),
        });
      }

      nota = result.rows[0];
      console.log(
        '✅ Nota encontrada - codfat na base:',
        nota.codfat,
        'tipo:',
        typeof nota.codfat,
      );

      // Debug: mostrar todas as colunas disponíveis
      console.log('Colunas disponíveis na tabela:', Object.keys(nota));
    } finally {
      client.release();
    }

    // 2. Validar se a nota pode ser cancelada
    // Considera cancelada se status === 'C' ou dthrcancelamento está preenchido
    if (nota.status === 'C' || nota.dthrcancelamento) {
      return res.status(400).json({ erro: 'Nota já foi cancelada' });
    }

    if (!nota.chave || !nota.numprotocolo) {
      return res
        .status(400)
        .json({ erro: 'Nota não possui chave ou protocolo válido' });
    }

    // Usar dthrprotocolo como data de autorização da NFe
    const dataAutorizacaoRaw = nota.dthrprotocolo;
    if (!dataAutorizacaoRaw) {
      return res.status(400).json({
        erro: 'Data de autorização da NFe não encontrada (dthrprotocolo está vazio)',
        colunasDisponiveis: Object.keys(nota),
        sugestao:
          'Verifique se o campo dthrprotocolo está sendo preenchido na autorização da NFe',
      });
    }

    // 3. Gerar XML de cancelamento com estrutura correta
    const chave = nota.chave;
    const nProt = nota.numprotocolo;
    const cnpj = '18053139000169'.replace(/\D/g, '');

    // CORREÇÃO: Usar a data de autorização da NFe como base para evitar erros 578/579
    const dataAutorizacao = new Date(dataAutorizacaoRaw);
    const agora = new Date();

    // A data do evento deve ser:
    // - Maior ou igual à data de autorização da NFe (erro 579)
    // - Menor ou igual à data atual do servidor da SEFAZ (erro 578)

    let dataEvento;

    // Se a data de autorização é muito antiga (mais de 1 hora), usar data atual menos alguns minutos
    const umHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);

    if (dataAutorizacao < umHoraAtras) {
      // NFe antiga: usar data atual menos 10 minutos para dar margem
      dataEvento = new Date(agora.getTime() - 10 * 60 * 1000);
    } else {
      // NFe recente: usar data de autorização mais 1 minuto
      dataEvento = new Date(dataAutorizacao.getTime() + 1 * 60 * 5000);

      // Mas não pode ser maior que agora menos 5 minutos
      const cincoMinutosAtras = new Date(agora.getTime() - 5 * 60 * 10000);
      if (dataEvento > cincoMinutosAtras) {
        dataEvento = cincoMinutosAtras;
      }
    }

    // Formatar data/hora no padrão correto para o Amazonas (UTC-4)
    const year = dataEvento.getFullYear();
    const month = String(dataEvento.getMonth() + 1).padStart(2, '0');
    const day = String(dataEvento.getDate()).padStart(2, '0');
    const hours = String(dataEvento.getHours()).padStart(2, '0');
    const minutes = String(dataEvento.getMinutes()).padStart(2, '0');
    const seconds = String(dataEvento.getSeconds()).padStart(2, '0');

    const dhEvento = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-04:00`;

    // Validar tamanho da justificativa (mínimo 15 caracteres)
    if (motivo.length < 15) {
      return res
        .status(400)
        .json({
          erro: 'Motivo do cancelamento deve ter no mínimo 15 caracteres',
        });
    }

    // XML de cancelamento SEM declaração XML (será adicionada pela função assinarXML)
    const xmlCancelamento = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110111${chave}01">
      <cOrgao>13</cOrgao>
      <tpAmb>2</tpAmb>
      <CNPJ>${cnpj}</CNPJ>
      <chNFe>${chave}</chNFe>
      <dhEvento>${dhEvento}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>${nProt}</nProt>
        <xJust>${motivo}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;

    // 4. Assinar XML de cancelamento
    const xmlAssinado = await assinarXML(
      xmlCancelamento,
      'infEvento',
      'src/nfe-sefaz-node/certificado/certificado.key',
      'src/nfe-sefaz-node/certificado/certificado.crt',
    );

    // 5. Remover declaração XML do xmlAssinado se existir (para evitar duplicação)
    const xmlLimpo = xmlAssinado.replace(/<\?xml[^>]*\?>\s*/, '');

    // 6. Montar envelope SOAP correto
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeDadosMsg>
      ${xmlLimpo}
    </nfe:nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;

    // Log para debug das datas
    console.log('Data de autorização da NFe:', dataAutorizacao.toISOString());
    console.log('Data atual:', agora.toISOString());
    console.log('Data/hora do evento gerada:', dhEvento);

    // 7. Enviar para Sefaz
    const agent = new https.Agent({
      key: fs.readFileSync('src/nfe-sefaz-node/certificado/certificado.key'),
      cert: fs.readFileSync('src/nfe-sefaz-node/certificado/certificado.crt'),
      ca: fs.existsSync('src/nfe-sefaz-node/certificado/cadeia.pem')
        ? fs.readFileSync('src/nfe-sefaz-node/certificado/cadeia.pem')
        : undefined,
      rejectUnauthorized: false,
    });

    const urlSefaz =
      'https://homnfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4';

    const sefazResponse = await axios.post(urlSefaz, envelope, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction:
          'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento',
      },
      timeout: 30000, // 30 segundos de timeout
    });

    const xmlResposta = sefazResponse.data;

    // 8. Parsear resposta
    const json = await parseStringPromise(xmlResposta, {
      explicitArray: false,
      tagNameProcessors: [(name: string) => name.split(':').pop() || name],
    });

    const retEnvEvento = json?.Envelope?.Body?.nfeResultMsg?.retEnvEvento;
    if (!retEnvEvento) {
      console.error(
        'Resposta completa da SEFAZ:',
        JSON.stringify(json, null, 2),
      );
      throw new Error(
        'Estrutura de resposta da Sefaz inesperada: retEnvEvento não encontrado.',
      );
    }

    const retEvento = retEnvEvento.retEvento;
    const status = retEvento?.infEvento?.cStat;
    const motivoRet = retEvento?.infEvento?.xMotivo;
    const protocolo = retEvento?.infEvento?.nProt;

    // 9. Verificar se o cancelamento foi aceito
    if (status === '135') {
      // 135 = Cancelamento homologado
      const clientDb = await getPgPool().connect();
      try {
        // Inicia a transação para garantir que ambas as tabelas sejam atualizadas
        await clientDb.query('BEGIN');
        console.log(
          '🔄 Iniciando atualização do banco após cancelamento aprovado...',
        );

        // 1. Atualiza a tabela de controle da NFe (dbfat_nfe)
        console.log('🔄 Atualizando dbfat_nfe com:', {
          status: 'C',
          motivo,
          protocolo,
          codfat: nota.codfat, // Usar o codfat como foi encontrado na busca
        });

        const updateResult = await clientDb.query(
          `UPDATE dbfat_nfe SET 
            status = $1, 
            dthrcancelamento = $2, 
            motivocancelamento = $3, 
            numcancelamento = $4,
            usuariocancelamento = $5
          WHERE codfat = $6`,
          ['C', new Date(), motivo, protocolo, 'API', nota.codfat],
        );

        console.log(
          '✅ dbfat_nfe atualizada - linhas afetadas:',
          updateResult.rowCount,
        );

        // 2. ATUALIZAÇÃO SOLICITADA: Atualiza a tabela principal da fatura (dbfatura)
        console.log('🔄 Atualizando dbfatura...');
        const updateFaturaResult = await clientDb.query(
          "UPDATE dbfatura SET cancel = 'S' WHERE codfat = $1",
          [nota.codfat],
        );

        console.log(
          '✅ dbfatura atualizada - linhas afetadas:',
          updateFaturaResult.rowCount,
        );

        // Confirma a transação, aplicando as duas atualizações no banco
        await clientDb.query('COMMIT');
        console.log('✅ Transação commitada com sucesso!');

        // Retorna a resposta de sucesso para o cliente
        return res.status(200).json({
          sucesso: true,
          status,
          motivo: motivoRet,
          protocolo,
          xmlResposta: xmlResposta,
        });
      } catch (dbError: any) {
        // Se ocorrer qualquer erro durante as atualizações, desfaz a transação
        await clientDb.query('ROLLBACK');
        console.error(
          'ERRO DE BANCO DE DADOS APÓS CANCELAMENTO NA SEFAZ:',
          dbError,
        );

        // Retorna um erro 500, pois a nota foi cancelada na SEFAZ, mas o banco local falhou.
        // Isso requer atenção manual para sincronizar os dados.
        return res.status(500).json({
          sucesso: false,
          erro: 'Cancelamento homologado na SEFAZ, mas ocorreu um erro ao atualizar o banco de dados local.',
          detalhes: dbError.message,
          statusSefaz: '135', // Informa que na SEFAZ deu certo
        });
      } finally {
        // Libera a conexão com o banco de dados de volta para o pool
        clientDb.release();
      }
    } else {
      // Log do erro para debug
      console.error('Erro no cancelamento:', {
        status,
        motivo: motivoRet,
        dhEvento, // Data do evento enviada
        dataAutorizacao: dataAutorizacao.toISOString(), // Data de autorização da NFe
        dataAtual: agora.toISOString(), // Data atual no momento do processamento
        xmlEnviado: xmlAssinado,
        xmlResposta: xmlResposta,
      });

      // Mensagem amigável para duplicidade de evento
      if (status === '573') {
        return res.status(400).json({
          sucesso: false,
          status,
          motivo:
            'A NFe já está cancelada ou o evento de cancelamento já foi processado pela Sefaz.',
          detalhes: retEnvEvento,
        });
      }

      return res.status(400).json({
        sucesso: false,
        status,
        motivo: motivoRet,
        detalhes: retEnvEvento,
      });
    }
  } catch (error: any) {
    console.error('Erro no cancelamento NFe:', error);

    const detalhe = error?.response?.data || error.message || error;
    return res.status(500).json({
      sucesso: false,
      erro: detalhe.toString(),
      stack: error?.stack,
    });
  }
}
