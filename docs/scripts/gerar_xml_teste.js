const fs = require('fs');
const path = require('path');

(async ()=>{
  try {
    const payloadPath = path.resolve(__dirname, 'diagnose_payload.json');
    if (!fs.existsSync(payloadPath)) throw new Error('Arquivo diagnose_payload.json não encontrado');
    const payload = JSON.parse(fs.readFileSync(payloadPath,'utf8'));

    // Tentar registrar ts-node para permitir require() de arquivos TypeScript em tempo de execução.
    let canRequireTs = false;
    try {
      // Usar a API de registro do ts-node se estiver disponível
      // eslint-disable-next-line global-require
      const tsNode = require('ts-node');
      if (tsNode && typeof tsNode.register === 'function') {
        tsNode.register({ transpileOnly: true });
        canRequireTs = true;
      }
    } catch (e) {
      canRequireTs = false;
    }

    if (!canRequireTs) {
      console.error('\nErro: não foi possível carregar arquivos TypeScript diretamente.');
      console.error('Instale as dependências de desenvolvimento necessárias e execute novamente:');
      console.error('  npm install --save-dev ts-node typescript');
      console.error('\nOu execute diretamente com npx:');
      console.error('  npx ts-node scripts/gerar_xml_teste.js');
      process.exit(1);
    }

    // Importar normalizarPayloadNFe e gerarXMLNFe (agora que ts-node está registrado)
    // eslint-disable-next-line global-require
    const { normalizarPayloadNFe } = require('../src/utils/normalizarPayloadNFe.ts');
    // eslint-disable-next-line global-require
    const { gerarXMLNFe } = require('../src/components/services/sefazNfe/gerarXml.ts');

    const dados = await normalizarPayloadNFe(payload);
    const xml = gerarXMLNFe(dados);

    const outPath = path.resolve(__dirname, 'diagnose_output.xml');
    fs.writeFileSync(outPath, xml, 'utf8');
    console.log('XML gerado e salvo em', outPath);
  } catch (err) {
    console.error('Erro ao gerar XML de teste:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
