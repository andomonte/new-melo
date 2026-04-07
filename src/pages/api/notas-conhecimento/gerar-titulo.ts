import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Pool global compartilhado
declare global {
  // eslint-disable-line no-var
  var pgPool: Pool | undefined;
}

let pool: Pool | undefined = global.pgPool;
if (!pool) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  global.pgPool = pool;
}

interface NotaConhecimento {
  codtransp: string;
  nrocon: string;
}

interface RequestBody {
  notas: NotaConhecimento[]; // Array de notas de conhecimento
  cod_conta: string; // Conta contábil obrigatória
  cod_ccusto?: string; // Centro de custo opcional
  cod_comprador?: string; // Comprador opcional
  dt_venc: string; // Data de vencimento obrigatória
  obs?: string; // Observações opcionais
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ sucesso: boolean; conta?: any; erro?: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, erro: 'Método não permitido' });
  }

  try {
    const { notas, cod_conta, cod_ccusto, cod_comprador, dt_venc, obs }: RequestBody = req.body;

    // Validações
    if (!notas || notas.length === 0) {
      return res.status(400).json({ sucesso: false, erro: 'Pelo menos uma nota de conhecimento deve ser informada' });
    }

    if (!cod_conta) {
      return res.status(400).json({ sucesso: false, erro: 'Conta contábil é obrigatória' });
    }

    if (!dt_venc) {
      return res.status(400).json({ sucesso: false, erro: 'Data de vencimento é obrigatória' });
    }

    console.log('💰 [Gerar Conta CT-e] Iniciando geração de conta consolidada para', notas.length, 'CT-e(s)');

    const client = await pool!.connect();

    try {
      // 1. Buscar dados de todas as notas selecionadas
      const placeholders = notas.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const params = notas.flatMap(nota => [nota.codtransp, nota.nrocon]);

      const cteQuery = `
        SELECT
          nc.codtransp,
          nc.nrocon,
          nc.serie,
          nc.dtcon,
          nc.totaltransp,
          nc.codtransp,
          t.nome as nome_transp,
          nc.pago
        FROM db_manaus.dbconhecimentoent nc
        LEFT JOIN db_manaus.dbtransp t ON t.codtransp = nc.codtransp
        WHERE (nc.codtransp, nc.nrocon) IN (${placeholders})
      `;

      const cteResult = await client.query(cteQuery, params);

      if (cteResult.rows.length === 0) {
        return res.status(404).json({ sucesso: false, erro: 'Nenhuma CT-e encontrada' });
      }

      if (cteResult.rows.length !== notas.length) {
        return res.status(404).json({ sucesso: false, erro: 'Algumas CT-e(s) não foram encontradas' });
      }

      // Verificar se todas as CT-e estão pendentes (não pagas)
      const notasNaoPendentes = cteResult.rows.filter(cte => cte.pago !== 'N');
      if (notasNaoPendentes.length > 0) {
        return res.status(400).json({
          sucesso: false,
          erro: `As seguintes CT-e(s) já estão pagas: ${notasNaoPendentes.map(n => n.nrocon).join(', ')}`
        });
      }

      // 2. Calcular valor total e verificar transportadora única
      const valorTotal = cteResult.rows.reduce((total, cte) => total + parseFloat(cte.totaltransp || 0), 0);
      const transportadoras = [...new Set(cteResult.rows.map(cte => cte.codtransp))];

      if (transportadoras.length !== 1) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Todas as CT-e(s) devem pertencer à mesma transportadora'
        });
      }

      const codTransp = transportadoras[0];
      const nomeTransp = cteResult.rows[0].nome_transp || `Transportadora ${codTransp}`;

      // 3. Gerar título diretamente na tabela dbpgto
      console.log('💰 [Gerar Conta CT-e] Gerando título diretamente...');

      // Gerar código do pagamento
      const maxCodResult = await client.query(
        'SELECT COALESCE(MAX(cod_pgto::integer), 0) + 1 as next_cod FROM db_manaus.dbpgto'
      );
      const nextCodPgto = maxCodResult.rows[0].next_cod.toString().padStart(9, '0');

      // Gerar pag_cof_id
      const maxPagCofResult = await client.query(
        'SELECT COALESCE(MAX(pag_cof_id), 0) + 1 as next_pag_cof_id FROM db_manaus.dbpgto'
      );
      const nextPagCofId = maxPagCofResult.rows[0].next_pag_cof_id;

      // Inserir título na dbpgto
      const tituloObservacao = obs || `Pagamento de ${notas.length} CT-e(s): ${cteResult.rows.map(n => n.nrocon).join(', ')}`;

      await client.query(
        `INSERT INTO db_manaus.dbpgto (
          cod_pgto,
          pag_cof_id,
          tipo,
          cod_transp,
          cod_conta,
          cod_ccusto,
          codcomprador,
          dt_venc,
          dt_emissao,
          valor_pgto,
          obs,
          paga,
          cancel,
          titulo_importado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          nextCodPgto,
          nextPagCofId,
          'T', // Tipo Transportadora
          codTransp,
          cod_conta,
          cod_ccusto || null,
          cod_comprador || null,
          dt_venc,
          new Date().toISOString().split('T')[0], // dt_emissao = hoje
          valorTotal.toFixed(2),
          tituloObservacao,
          'N', // paga = N (não paga)
          'N', // cancel = N (não cancelada)
          true // titulo_importado = true
        ]
      );

      // 4. Criar relacionamentos em dbconhecimento para cada CT-e
      for (const cte of cteResult.rows) {
        await client.query(
          `INSERT INTO db_manaus.dbconhecimento (codpgto, codtransp, nrocon)
           VALUES ($1, $2, $3)
           ON CONFLICT (codpgto, codtransp, nrocon) DO NOTHING`,
          [nextCodPgto, cte.codtransp, cte.nrocon]
        );
      }

      console.log('💰 [Gerar Conta CT-e] Título gerado com sucesso:', nextCodPgto);

      return res.status(200).json({
        sucesso: true,
        conta: {
          cod_pgto: nextCodPgto,
          valor_total: valorTotal,
          transportadora: nomeTransp,
          quantidade_notas: notas.length,
          notas: cteResult.rows.map(cte => ({
            codtransp: cte.codtransp,
            nrocon: cte.nrocon,
            valor: cte.totaltransp
          }))
        },
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Erro ao gerar conta CT-e:', error);
    return res.status(500).json({
      sucesso: false,
      erro: `Erro ao gerar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    });
  }
}