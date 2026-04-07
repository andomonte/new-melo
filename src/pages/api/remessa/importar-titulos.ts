import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface TituloImportacao {
  cedente: string;
  cnpj: string;
  dtEmissao: string;
  dtVenc: string;
  dtLimite: string;
  valorPgto: number;
  valorJuros: number;
  nroDoc: string;
  codEspecie: string;
  especie: string;
  codProtesto: string;
  tipoProtesto: string;
  diasJuros: string;
  tipoCedente: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const client = await pool.connect();

  try {
    const { titulos, codComprador, codConta, codCentroCusto, username } = req.body;

    if (!titulos || !Array.isArray(titulos) || titulos.length === 0) {
      return res.status(400).json({ error: 'Lista de títulos é obrigatória' });
    }

    if (!codComprador || !codConta || !codCentroCusto) {
      return res.status(400).json({ error: 'Códigos de comprador, conta e centro de custo são obrigatórios' });
    }

    const resultados = [];
    let titulosImportados = 0;
    let titulosErro = 0;

    // Processar cada título
    for (const titulo of titulos as TituloImportacao[]) {
      try {
        await client.query('BEGIN');

        // Determinar códigos baseados no tipo de cedente
        let vTipo = titulo.tipoCedente;
        let vCodTransp = null;
        let vCodCredor = null;

        if (vTipo === 'F') {
          // Buscar código do credor (fornecedor)
          const credorResult = await client.query(
            'SELECT cod_credor FROM db_credor WHERE cpf_cgc = $1',
            [titulo.cnpj]
          );
          if (credorResult.rows.length === 0) {
            throw new Error(`Credor não encontrado para CNPJ ${titulo.cnpj}`);
          }
          vCodCredor = credorResult.rows[0].cod_credor;
        } else if (vTipo === 'T') {
          // Buscar código da transportadora
          const transpResult = await client.query(
            'SELECT codtransp FROM db_transportadora WHERE cpf_cgc = $1',
            [titulo.cnpj]
          );
          if (transpResult.rows.length === 0) {
            throw new Error(`Transportadora não encontrada para CNPJ ${titulo.cnpj}`);
          }
          vCodTransp = transpResult.rows[0].codtransp;
        } else {
          throw new Error(`Tipo de cedente inválido: ${vTipo}`);
        }

        // Verificar se já existe um título similar (mesmo CNPJ, vencimento e valor)
        const existeQuery = `
          SELECT COUNT(*) as total
          FROM db_contas_pagar
          WHERE cod_credor ${vCodCredor ? '= $1' : 'IS NULL'}
            AND cod_transportadora ${vCodTransp ? '= $2' : 'IS NULL'}
            AND dt_venc = $3
            AND valor_pgto = $4
        `;
        const paramsExiste = [vCodCredor, vCodTransp, titulo.dtVenc, titulo.valorPgto].filter(p => p !== null);
        const existeResult = await client.query(existeQuery, paramsExiste);

        if (parseInt(existeResult.rows[0].total) > 0) {
          throw new Error('Título já existe no sistema');
        }

        // Inserir na tabela db_contas_pagar
        const insertQuery = `
          INSERT INTO db_contas_pagar (
            cod_credor,
            cod_transportadora,
            cod_conta,
            cod_comprador,
            cod_cof,
            dt_venc,
            dt_emissao,
            valor_pgto,
            obs,
            tem_nota,
            tem_cobr,
            nro_dup,
            uname,
            paga,
            dt_cadastro
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_DATE
          )
          RETURNING cod_titulo
        `;

        // Preparar observação baseada na espécie
        const obs = titulo.especie || 'Importado via DDA';

        // Determinar se tem nota fiscal baseado no código da espécie
        const temNota = ['2', '3', '13'].includes(titulo.codEspecie) ? 'S' : 'N';
        const temCobr = ['1', '8'].includes(titulo.codEspecie) ? 'S' : 'N';

        // Preparar número da duplicata/nota baseado na espécie
        let nroDup = null;
        let nroNf = null;

        if (temCobr === 'S') {
          nroDup = titulo.nroDoc;
        } else if (temNota === 'S') {
          nroNf = titulo.nroDoc;
        }

        const insertParams = [
          vCodCredor,
          vCodTransp,
          codConta,
          codComprador,
          codCentroCusto,
          titulo.dtVenc,
          titulo.dtEmissao || titulo.dtVenc, // Usar data de vencimento se emissão não estiver disponível
          titulo.valorPgto,
          obs,
          temNota,
          temCobr,
          nroDup,
          username || 'SYSTEM_DDA',
          'N' // Não pago
        ];

        const insertResult = await client.query(insertQuery, insertParams);

        await client.query('COMMIT');

        resultados.push({
          titulo: titulo.nroDoc,
          cedente: titulo.cedente,
          status: 'sucesso',
          codTitulo: insertResult.rows[0].cod_titulo,
          mensagem: 'Título importado com sucesso'
        });

        titulosImportados++;

      } catch (error) {
        await client.query('ROLLBACK');

        console.error(`Erro ao importar título ${titulo.nroDoc}:`, error);

        resultados.push({
          titulo: titulo.nroDoc,
          cedente: titulo.cedente,
          status: 'erro',
          mensagem: error instanceof Error ? error.message : 'Erro desconhecido'
        });

        titulosErro++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Importação concluída: ${titulosImportados} títulos importados, ${titulosErro} erros`,
      data: {
        titulosImportados,
        titulosErro,
        totalProcessados: titulos.length,
        resultados
      }
    });

  } catch (error) {
    console.error('Erro geral na importação:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    client.release();
  }
}