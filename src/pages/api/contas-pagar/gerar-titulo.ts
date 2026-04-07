import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { gerarBoleto, type DadosBoleto, type BoletoGerado } from '@/lib/boleto/calculoBoleto';

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

interface RequestBody {
  id_conta: number;
  banco?: '0' | '1' | '2'; // Bradesco, BB, Itaú
  descricao?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ sucesso: boolean; boleto?: BoletoGerado; erro?: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, erro: 'Método não permitido' });
  }

  try {
    const { id_conta, banco = '0', descricao }: RequestBody = req.body;

    // Validações
    if (!id_conta) {
      return res.status(400).json({ sucesso: false, erro: 'id_conta é obrigatório' });
    }

    console.log('🎫 [Gerar Título] Iniciando geração de título para conta:', id_conta);

    const client = await pool!.connect();

    try {
      // 1. Buscar dados da conta a pagar
      const contaQuery = `
        SELECT
          p.cod_pgto,
          p.cod_credor,
          c.nome as nome_credor,
          p.dt_venc,
          p.valor_pgto,
          p.obs,
          p.nro_nf,
          cc.descr as descricao_ccusto,
          co.nro_conta as descricao_conta
        FROM db_manaus.dbpgto p
        LEFT JOIN db_manaus.dbcredor c ON c.cod_credor = p.cod_credor
        LEFT JOIN db_manaus.dbccusto cc ON cc.cod_ccusto = p.cod_ccusto
        LEFT JOIN db_manaus.dbconta co ON co.cod_conta = p.cod_conta
        WHERE p.cod_pgto = $1
      `;

      const contaResult = await client.query(contaQuery, [id_conta]);

      if (contaResult.rows.length === 0) {
        return res.status(404).json({ sucesso: false, erro: 'Conta a pagar não encontrada' });
      }

      const conta = contaResult.rows[0];

      // 2. Buscar dados do cliente/empresa (usando dados fixos por enquanto)
      // TODO: Implementar busca de dados do cliente da conta

      // 3. Preparar dados para geração do boleto
      const dadosBoleto: DadosBoleto = {
        // Dados da conta bancária (usando valores padrão por enquanto)
        banco: banco as '0' | '1' | '2',
        nroConta: '00000', // TODO: Buscar do banco
        agencia: '0000', // TODO: Buscar do banco

        // Dados do documento
        codReceb: conta.cod_pgto.toString().padStart(11, '0'), // Código do recebível
        nroDoc: conta.cod_pgto.toString(),
        nroDocBanco: conta.cod_pgto.toString(),

        // Valores e datas
        valor: conta.valor_pgto,
        dtEmissao: new Date(),
        dtVencimento: new Date(conta.dt_venc),

        // Dados do sacado (credor)
        nomeCli: conta.nome_credor,
        endereco: '', // TODO: Buscar endereço do credor
        bairro: '',
        cidade: '',
        uf: '',
        cep: '',

        // Informações adicionais
        descricao: descricao || `Conta a pagar - ${conta.nome_credor}`,
        instrucoes: [
          'Não receber após o vencimento',
          'Após vencimento cobrar juros de 0,03% ao dia'
        ]
      };

      // 4. Gerar o boleto
      const boleto = gerarBoleto(dadosBoleto);

      console.log('🎫 [Gerar Título] Boleto gerado com sucesso:', boleto.linhaDigitavel);

      // 5. TODO: Salvar dados do boleto no banco (dbfatura, dbreceb, etc.)
      // Por enquanto, apenas retornamos o boleto gerado

      res.status(200).json({
        sucesso: true,
        boleto
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('❌ Erro ao gerar título:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message || 'Erro interno do servidor'
    });
  }
}