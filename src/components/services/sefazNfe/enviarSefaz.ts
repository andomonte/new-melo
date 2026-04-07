import fs from 'fs';
import https from 'https';
import axios from 'axios';

export async function enviarParaSefaz(xmlAssinado: string) {
  const xmlEnvelope = `
    <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <soap:Header/>
      <soap:Body>
        <nfe:nfeDadosMsg>
          <![CDATA[${xmlAssinado}]]>
        </nfe:nfeDadosMsg>
      </soap:Body>
    </soap:Envelope>`;

  const agent = new https.Agent({
    key: fs.readFileSync('src/nfe-sefaz-node/certificado/certificado.key'),
    cert:
      fs.readFileSync(
        'src/nfe-sefaz-node/certificado/certificado.crt',
        'utf8',
      ) + fs.readFileSync('src/nfe-sefaz-node/certificado/cadeia.crt', 'utf8'),
    rejectUnauthorized: false, // apenas homologação
  });

  try {
    const response = await axios.post(
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      xmlEnvelope,
      {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
      },
    );

    const match = response.data.match(/<retEnviNFe[\s\S]*<\/retEnviNFe>/);
    const xmlAutorizado = match ? match[0] : null;

    return {
      sucesso: true,
      xmlResposta: response.data,
      xmlAutorizado,
    };
  } catch (error: any) {
    return {
      sucesso: false,
      erro: error.message,
      detalhes: error?.response?.data || error,
    };
  }
}
