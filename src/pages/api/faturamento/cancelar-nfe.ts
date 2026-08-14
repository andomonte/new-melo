import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import https from 'https';
import { getPgPool } from '@/lib/pg';
import { parseStringPromise } from 'xml2js';

import { assinarXMLComCertificados } from '@/components/services/sefazNfe/assinarXml';
import { decrypt } from '@/utils/crypto';

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
        "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
        [String(codfat)],
      );

      if (result.rowCount === 0) {
        // Segunda tentativa: buscar como number
        console.log('🔍 Tentando buscar codfat como number:', Number(codfat));
        result = await client.query(
          "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
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
          "SELECT * FROM dbfat_nfe WHERE codfat = $1 ORDER BY (status = '100') DESC, dthrprotocolo DESC NULLS LAST",
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

    // 2.05 REGRA DE PRAZO DE CANCELAMENTO DA SEFAZ — validada ANTES de enviar, para já
    // informar ao usuário que a nota não pode mais ser cancelada:
    //   NF-e (mod.55): até 24 horas após a autorização.
    //   NFC-e (mod.65): até 30 minutos após a autorização.
    {
      const ehNfce = String(nota.modelo || '55') === '65';
      const limiteMin = ehNfce ? 30 : 24 * 60;
      const decorridoMin = (Date.now() - new Date(dataAutorizacaoRaw).getTime()) / 60000;
      if (Number.isFinite(decorridoMin) && decorridoMin > limiteMin) {
        return res.status(400).json({
          erro:
            `Esta ${ehNfce ? 'NFC-e' : 'NF-e'} não pode mais ser cancelada. ` +
            `O prazo de cancelamento é de ${ehNfce ? '30 minutos' : '24 horas'} após a autorização e já expirou ` +
            `(autorizada há ${Math.round(decorridoMin)} min).`,
          prazoExpirado: true,
          modelo: String(nota.modelo || '55'),
          minutosDecorridos: Math.round(decorridoMin),
        });
      }
    }

    // 2.1 Carregar o certificado do BANCO (mesmo da emissão). O cert de arquivo em disco
    // é legado/morto — a SEFAZ o rejeita no handshake (SSL alert 46 "certificate unknown").
    let certificadoKey = '';
    let certificadoCrt = '';
    let cadeiaCrt: string | null = null;
    let cnpjEmitente = '18053139000169';
    {
      const cliCert = await getPgPool().connect();
      try {
        const emp = await cliCert.query(
          `SELECT "certificadoKey", "certificadoCrt", "cadeiaCrt", cgc
             FROM dadosempresa
            WHERE "certificadoKey" IS NOT NULL AND "certificadoCrt" IS NOT NULL
            LIMIT 1`,
        );
        if (!emp.rowCount) {
          return res.status(400).json({ erro: 'Nenhuma empresa com certificado digital configurado.' });
        }
        const emitenteRaw = emp.rows[0];
        certificadoKey = (await decrypt(emitenteRaw.certificadoKey)) || '';
        certificadoCrt = (await decrypt(emitenteRaw.certificadoCrt)) || '';
        cadeiaCrt = emitenteRaw.cadeiaCrt ? await decrypt(emitenteRaw.cadeiaCrt) : null;
        if (!certificadoKey || !certificadoCrt) {
          return res.status(400).json({ erro: 'Erro ao descriptografar o certificado digital.' });
        }
        cnpjEmitente = String(emitenteRaw.cgc || '18053139000169').replace(/\D/g, '');
      } finally {
        cliCert.release();
      }
    }

    // 3. Gerar XML de cancelamento com estrutura correta
    const chave = nota.chave;
    const nProt = nota.numprotocolo;
    const cnpj = cnpjEmitente;

    // CORREÇÃO: Usar a data de autorização da NFe como base para evitar erros 578/579
    const dataAutorizacao = new Date(dataAutorizacaoRaw);
    const agora = new Date();

    // A data do evento deve ser:
    // - Maior ou igual à data de autorização da NFe (erro 579)
    // - Menor ou igual à data atual do servidor da SEFAZ (erro 578)

    // dhEvento = horário ATUAL no fuso do Amazonas (UTC-4). Precisa ser >= data de
    // autorização (senão rejeição 579) e <= horário do servidor SEFAZ (senão 578).
    // Como o prazo já foi validado acima, "agora" está sempre dentro da janela.
    // Calculado via UTC-4 explícito para independer do fuso do servidor.
    const agoraAm = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const p2 = (n: number) => String(n).padStart(2, '0');
    const dhEvento =
      `${agoraAm.getUTCFullYear()}-${p2(agoraAm.getUTCMonth() + 1)}-${p2(agoraAm.getUTCDate())}` +
      `T${p2(agoraAm.getUTCHours())}:${p2(agoraAm.getUTCMinutes())}:${p2(agoraAm.getUTCSeconds())}-04:00`;

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

    // 4. Assinar XML de cancelamento (certificado do BANCO, igual à emissão)
    const xmlAssinado = await assinarXMLComCertificados(
      xmlCancelamento,
      'infEvento',
      certificadoKey,
      certificadoCrt,
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
      key: Buffer.from(certificadoKey),
      cert: Buffer.from(certificadoCrt),
      ca: cadeiaCrt ? Buffer.from(cadeiaCrt) : undefined,
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
