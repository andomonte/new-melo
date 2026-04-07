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
  codfat: string;
  codReceb?: string; // Opcional, será gerado se não fornecido
  nroDoc?: string; // Opcional, será gerado se não fornecido
  valor?: number; // Opcional, será buscado da fatura
  vencimento?: string; // Opcional, será calculado se não fornecido
  banco?: '0' | '1' | '2'; // Opcional, será buscado dos dados do cliente
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
    const { codfat, valor, vencimento, banco, descricao }: RequestBody = req.body;

    // Validações
    if (!codfat) {
      return res.status(400).json({ sucesso: false, erro: 'codfat é obrigatório' });
    }

    console.log('🎫 [Boleto Legado] Iniciando geração de boleto:', { codfat, valor, vencimento });

    // 1. Buscar dados da fatura, cliente e banco no banco de dados
    const client = await pool!.connect();
    
    try {
      // Buscar dados completos
      const resultado = await client.query(
        `SELECT 
          -- Dados da fatura
          f.codfat,
          f.codcli,
          f.totalfat as valor_fatura,
          f.data as dt_emissao,
          f.nroform,
          f.serie,
          
          -- Dados do cliente
          c.nome as nome_cliente,
          c.cpfcgc,
          c.email,
          c.ender as endereco,
          c.numero,
          c.complemento,
          c.bairro,
          c.cep,
          c.cidade,
          c.uf,
          c.codpais,
          
          -- Dados da conta bancária do cliente (se houver preferência)
          c.banco as banco_codigo,
          
          -- Dados do banco (buscar da tabela dbdados_banco)
          db.banco as banco_tipo,
          db.nroconta,
          db.agencia,
          db.convenio,
          db.carteira,
          db.variacao,
          
          -- Dados do banco de cobrança
          bc.nome as nome_banco
          
         FROM db_manaus.dbfatura f
         INNER JOIN db_manaus.dbclien c ON c.codcli = f.codcli
         LEFT JOIN db_manaus.dbdados_banco db ON db.banco IN ('001', '0001', '0005', COALESCE($2, c.banco, '0'))
         LEFT JOIN db_manaus.dbbanco_cobranca bc ON bc.banco = db.banco
         WHERE f.codfat = $1
         LIMIT 1`,
        [codfat, banco || null]
      );

      if (resultado.rows.length === 0) {
        client.release();
        return res.status(404).json({ sucesso: false, erro: 'Fatura não encontrada' });
      }

      const dadosBanco = resultado.rows[0];
      
      console.log('✅ [Boleto Legado] Dados carregados:', {
        codfat: dadosBanco.codfat,
        cliente: dadosBanco.nome_cliente,
        banco: dadosBanco.banco_tipo,
        valor: dadosBanco.valor_fatura,
        agencia: dadosBanco.agencia,
        nroconta: dadosBanco.nroconta,
        convenio: dadosBanco.convenio,
        carteira: dadosBanco.carteira,
      });

      // 2. Gerar ou buscar COD_RECEB
      let codReceb: string;
      
      // Verificar se já existe um COD_RECEB para esta fatura
      const consultaReceb = await client.query(
        `SELECT cod_receb FROM db_manaus.dbreceb 
         WHERE cod_fat = $1 AND cancel != 'S' 
         ORDER BY cod_receb DESC LIMIT 1`,
        [codfat]
      );
      
      if (consultaReceb.rows.length > 0) {
        codReceb = consultaReceb.rows[0].cod_receb;
        console.log('📌 [Boleto Legado] Usando COD_RECEB existente:', codReceb);
      } else {
        // Gerar novo COD_RECEB usando sequence
        const sequenceResult = await client.query(
          `SELECT nextval('seq_cod_receb') as next_id`
        );
        const nextId = sequenceResult.rows[0].next_id;
        codReceb = nextId.toString().padStart(9, '0'); // VARCHAR(9)
        console.log('🆕 [Boleto Legado] Novo COD_RECEB gerado:', codReceb);
      }

      // 3. Determinar valores e datas
      const valorBoleto = valor || parseFloat(dadosBanco.valor_fatura) || 0;

      if (valorBoleto <= 0) {
        client.release();
        return res.status(400).json({ sucesso: false, erro: 'Valor do boleto inválido' });
      }

      const dtEmissao = new Date();

      let dtVencimento: Date;
      if (vencimento) {
        dtVencimento = new Date(vencimento);

        // Validar se a data de vencimento não está no passado
        // Comparar apenas as datas (sem horário)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const vencimentoSemHora = new Date(dtVencimento);
        vencimentoSemHora.setHours(0, 0, 0, 0);

        if (vencimentoSemHora < hoje) {
          client.release();
          return res.status(400).json({
            sucesso: false,
            erro: `Data de vencimento (${dtVencimento.toLocaleDateString('pt-BR')}) não pode ser anterior à data atual (${hoje.toLocaleDateString('pt-BR')})`
          });
        }
      } else {
        // Padrão: 30 dias após emissão
        dtVencimento = new Date(dtEmissao);
        dtVencimento.setDate(dtVencimento.getDate() + 30);
      }

      // 4. Determinar banco e converter para código interno
      const bancoOriginal = banco || dadosBanco.banco_tipo || '0';
      
      // Mapear código do banco para formato interno (0=Bradesco, 1=BB, 2=Itaú)
      const mapaBancos: { [key: string]: '0' | '1' | '2' } = {
        '0': '0',      // Bradesco
        '237': '0',    // Bradesco
        '1': '1',      // Banco do Brasil
        '001': '1',    // Banco do Brasil
        '0001': '1',   // Banco do Brasil
        '0005': '1',   // Banco do Brasil (código alternativo)
        '2': '2',      // Itaú
        '341': '2',    // Itaú
      };
      
      const bancoCode = mapaBancos[bancoOriginal] || '0'; // Default: Bradesco
      
      console.log('🏦 [Boleto Legado] Mapeamento banco:', { 
        bancoOriginal, 
        bancoCode,
        bancoCliente: dadosBanco.banco_tipo 
      });
      
      // 5. Preparar dados para geração do boleto
      const dadosBoleto: DadosBoleto = {
        // Dados bancários
        banco: bancoCode,
        nroConta: dadosBanco.nroconta || '0000000',
        agencia: dadosBanco.agencia || '0000',
        convenio: dadosBanco.convenio || '1805313900',  // Convênio padrão Banco do Brasil
        carteira: dadosBanco.carteira || '17', // Carteira padrão BB (RCR = Cobrança Simples)
        
        // Códigos do documento (padding para 11 dígitos apenas para cálculo do boleto)
        codReceb: codReceb.padStart(11, '0'),
        nroDoc: dadosBanco.nroform || codfat,
        nroDocBanco: codReceb.padStart(11, '0'),
        
        // Valores e datas
        valor: valorBoleto,
        dtEmissao: dtEmissao,
        dtVencimento: dtVencimento,
        juros: 0.02, // 2% ao mês
        multa: 0.02, // 2% após vencimento
        
        // Dados do sacado (cliente)
        nomeCli: dadosBanco.nome_cliente,
        cpfCnpj: dadosBanco.cpfcgc,
        endereco: dadosBanco.endereco || '',
        bairro: dadosBanco.bairro || '',
        cidade: dadosBanco.cidade || '',
        uf: dadosBanco.uf || '',
        cep: dadosBanco.cep || '',
        
        // Dados do cedente (empresa) - buscar de configuração
        nomeCedente: process.env.NOME_EMPRESA || 'Sua Empresa',
        enderecoCedente: process.env.ENDERECO_EMPRESA || '',
        
        // Informações adicionais
        instrucoes: [
          'Não receber após o vencimento',
          'Após vencimento cobrar multa de 2%',
          'Após vencimento cobrar juros de 0,067% ao dia',
        ],
        descricao: descricao || `Fatura ${codfat}`,
      };

      // 6. Gerar boleto usando a biblioteca legada
      const boletoGerado = gerarBoleto(dadosBoleto);
      
      console.log('✅ [Boleto Legado] Boleto gerado com sucesso:', {
        codReceb,
        linhaDigitavel: boletoGerado.linhaDigitavel,
        codigoBarras: boletoGerado.codigoBarras,
        nossoNumero: boletoGerado.nossoNumero,
      });

      // 7. Gerar nro_docbanco sequencial (limitado a 5 dígitos)
      const nroDocBancoResult = await client.query(
        `SELECT COALESCE(MAX(CAST(nro_docbanco AS INTEGER)), 0) + 1 as next_nro 
         FROM db_manaus.dbreceb 
         WHERE nro_docbanco ~ '^[0-9]+$'`
      );
      let nroDocBancoNum = nroDocBancoResult.rows[0].next_nro;
      
      // Se passar de 99999, reinicia em 1 (campo só aceita 5 dígitos)
      if (nroDocBancoNum > 99999) {
        nroDocBancoNum = 1;
      }
      
      const nroDocBanco = nroDocBancoNum.toString().padStart(5, '0');
      
      console.log('🔢 [Boleto Legado] nro_docbanco gerado:', nroDocBanco);

      // 8. Salvar ou atualizar registro na tabela dbreceb
      const existeReceb = consultaReceb.rows.length > 0;
      
      if (existeReceb) {
        // Atualizar registro existente
        await client.query(
          `UPDATE db_manaus.dbreceb 
           SET 
             nro_docbanco = $2,
             nro_banco = $3,
             dt_venc = $4,
             valor_pgto = $5,
             forma_fat = 'B',
             banco = $6
           WHERE cod_receb = $1`,
          [
            codReceb,
            nroDocBanco,
            codReceb, // nro_banco usa o mesmo código de recebimento
            dtVencimento,
            valorBoleto,
            bancoCode,
          ]
        );
        console.log('📝 [Boleto Legado] Registro dbreceb atualizado');
      } else {
        // Inserir novo registro
        await client.query(
          `INSERT INTO db_manaus.dbreceb (
             cod_receb, codcli, cod_fat, dt_venc, valor_pgto,
             nro_doc, nro_docbanco, nro_banco, forma_fat, banco,
             rec, cancel
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'B', $9, 'N', 'N')`,
          [
            codReceb,
            dadosBanco.codcli,
            codfat,
            dtVencimento,
            valorBoleto,
            dadosBoleto.nroDoc,
            nroDocBanco, // Número sequencial gerado
            codReceb, // nro_banco usa o mesmo código de recebimento
            bancoCode,
          ]
        );
        console.log('✅ [Boleto Legado] Novo registro dbreceb criado');
      }
      client.release();

      console.log('✅ [Boleto Legado] Boleto gerado e salvo com sucesso');

      // 9. Retornar boleto gerado
      return res.status(200).json({
        sucesso: true,
        boleto: boletoGerado,
      });

    } catch (error) {
      client.release();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ [Boleto Legado] Erro ao gerar boleto:', error);
    return res.status(500).json({
      sucesso: false,
      erro: error.message || 'Erro interno ao gerar boleto',
    });
  }
}
