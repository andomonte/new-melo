const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function salvarRemessaEquifax(dadosRemessa) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    // Iniciar transação
    await client.query('BEGIN');

    // 1. Obter próximo código de remessa
    const proximoCodQuery = `
      SELECT COALESCE(MAX(codremessa), 0) + 1 as proximo_cod
      FROM db_manaus.dbremessa_arquivo
    `;
    const proximoCodResult = await client.query(proximoCodQuery);
    const codremessa = proximoCodResult.rows[0].proximo_cod;

    // 2. Obter próximo codbodero
    const proximoBodeQuery = `
      SELECT COALESCE(MAX(CAST(codbodero AS INTEGER)), 0) + 1 as proximo_bode
      FROM db_manaus.dbremessa_arquivo
    `;
    const proximoBodeResult = await client.query(proximoBodeQuery);
    const codbodero = String(proximoBodeResult.rows[0].proximo_bode).padStart(9, '0');

    // 3. Inserir na tabela dbremessa_arquivo
    const arquivoQuery = `
      INSERT INTO db_manaus.dbremessa_arquivo
      (codremessa, banco, data_gerado, nome_arquivo, usuario_importacao, codbodero)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING codremessa
    `;

    const arquivoValues = [
      codremessa,
      dadosRemessa.banco,
      new Date(),
      dadosRemessa.caminhoArquivo, // Caminho completo do arquivo
      dadosRemessa.usuario || 'SYSTEM',
      codbodero
    ];

    const arquivoResult = await client.query(arquivoQuery, arquivoValues);
    const codremessaInserido = arquivoResult.rows[0].codremessa;

    console.log(`✅ Arquivo de remessa inserido com código: ${codremessaInserido}, codbodero: ${codbodero}`);

    // 4. Inserir detalhes na tabela dbremessa_detalhe
    if (dadosRemessa.detalhes && dadosRemessa.detalhes.length > 0) {
      for (let i = 0; i < dadosRemessa.detalhes.length; i++) {
        const detalhe = dadosRemessa.detalhes[i];

        const detalheQuery = `
          INSERT INTO db_manaus.dbremessa_detalhe
          ("CODREMESSA_DETALHE", "CODREMESSA", "NROSEQ", "CODCLI", "CODRECEB", "NROBANCO", "DOCUMENTO", "CONTA", "VALOR", "ABATIMENTO")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        const detalheValues = [
          codremessa * 1000 + i + 1, // CODREMESSA_DETALHE único
          codremessaInserido, // CODREMESSA (ligação com arquivo)
          i + 1, // NROSEQ
          detalhe.codcli,
          detalhe.codreceb,
          detalhe.nrobanco,
          detalhe.documento,
          detalhe.conta || '',
          detalhe.valor,
          detalhe.abatimento || 0
        ];

        await client.query(detalheQuery, detalheValues);
      }

      console.log(`✅ ${dadosRemessa.detalhes.length} detalhes inseridos`);
    }

    // Confirmar transação
    await client.query('COMMIT');

    return {
      sucesso: true,
      codremessa: codremessaInserido,
      codbodero: codbodero,
      mensagem: 'Remessa salva com sucesso'
    };

  } catch (error) {
    // Reverter transação em caso de erro
    await client.query('ROLLBACK');
    console.error('❌ Erro ao salvar remessa:', error);
    return {
      sucesso: false,
      erro: error.message
    };
  } finally {
    await client.end();
  }
}

// Exemplo de uso
async function exemplo() {
  const dadosExemplo = {
    banco: 'BANCO ITAU', // Nome do banco (como aparece nas remessas existentes)
    caminhoArquivo: 'C:\\Users\\lucas\\Sistema-Melo\\site-melo\\remessas\\CB102825.rem', // Caminho completo onde o arquivo foi salvo
    usuario: 'GRACIENY', // Usuário logado no sistema
    detalhes: [
      {
        codcli: '03926',
        codreceb: '100627334',
        nrobanco: '00749786',
        documento: 'NF304113C',
        conta: '',
        valor: 1183.10,
        abatimento: 0
      },
      {
        codcli: '01166',
        codreceb: '100627338',
        nrobanco: '00749788',
        documento: 'NF304113B',
        conta: '',
        valor: 51.86,
        abatimento: 0
      }
    ]
  };

  const resultado = await salvarRemessaEquifax(dadosExemplo);
  console.log('Resultado:', resultado);
}

// Executar exemplo se chamado diretamente
if (require.main === module) {
  exemplo();
}

module.exports = { salvarRemessaEquifax };