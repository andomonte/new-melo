import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { Cliente } from '@/data/clientes/clientes';
import { serializeBigInt } from '@/utils/serializeBigInt';

// Mapeamento de campos e seus limites (baseado no schema.prisma)
const FIELD_LIMITS: Record<string, { limit: number; label: string }> = {
  codcli: { limit: 10, label: 'Código Cliente' },
  nome: { limit: 40, label: 'Nome' },
  nomefant: { limit: 30, label: 'Nome Fantasia' },
  cpfcgc: { limit: 20, label: 'CPF/CNPJ' },
  tipo: { limit: 1, label: 'Tipo' },
  codcc: { limit: 5, label: 'Centro de Custo' },
  codvend: { limit: 5, label: 'Vendedor' },
  ender: { limit: 100, label: 'Logradouro' },
  bairro: { limit: 100, label: 'Bairro' },
  cidade: { limit: 100, label: 'Cidade' },
  uf: { limit: 2, label: 'UF' },
  cep: { limit: 9, label: 'CEP' },
  iest: { limit: 20, label: 'Inscrição Estadual' },
  isuframa: { limit: 20, label: 'Inscrição Suframa' },
  imun: { limit: 20, label: 'Inscrição Municipal' },
  status: { limit: 1, label: 'Status' },
  obs: { limit: 100, label: 'Observação' },
  tipoemp: { limit: 3, label: 'Tipo Empresa' },
  contato: { limit: 20, label: 'Contato' },
  socios: { limit: 50, label: 'Sócios' },
  icms: { limit: 1, label: 'ICMS' },
  endercobr: { limit: 100, label: 'Logradouro Cobrança' },
  cidadecobr: { limit: 100, label: 'Cidade Cobrança' },
  bairrocobr: { limit: 100, label: 'Bairro Cobrança' },
  ufcobr: { limit: 2, label: 'UF Cobrança' },
  cepcobr: { limit: 9, label: 'CEP Cobrança' },
  claspgto: { limit: 1, label: 'Classificação Pagamento' },
  email: { limit: 100, label: 'Email' },
  ipi: { limit: 1, label: 'IPI' },
  prvenda: { limit: 1, label: 'Preço Venda' },
  codbairro: { limit: 5, label: 'Código Bairro' },
  codbairrocobr: { limit: 5, label: 'Código Bairro Cobrança' },
  banco: { limit: 1, label: 'Banco' },
  tipocliente: { limit: 1, label: 'Tipo Cliente' },
  codtmk: { limit: 5, label: 'Código TMK' },
  numero: { limit: 60, label: 'Número' },
  referencia: { limit: 200, label: 'Referência' },
  numerocobr: { limit: 60, label: 'Número Cobrança' },
  referenciacobr: { limit: 200, label: 'Referência Cobrança' },
  codmunicipio: { limit: 7, label: 'Código Município' },
  codmunicipiocobr: { limit: 7, label: 'Código Município Cobrança' },
  complemento: { limit: 100, label: 'Complemento' },
  complementocobr: { limit: 100, label: 'Complemento Cobrança' },
  habilitasuframa: { limit: 1, label: 'Habilita Suframa' },
  emailnfe: { limit: 100, label: 'Email NFe' },
  faixafin: { limit: 2, label: 'Faixa Financeira' },
  codunico: { limit: 7, label: 'Código Único' },
  bloquear_preco: { limit: 1, label: 'Bloquear Preço' },
  local_entrega: { limit: 1, label: 'Local Entrega' },
};

// Função para detectar qual campo excedeu o limite
function detectarCampoExcedido(
  data: any,
): {
  field: string;
  label: string;
  currentLength: number;
  limit: number;
} | null {
  for (const [fieldName, fieldInfo] of Object.entries(FIELD_LIMITS)) {
    const value = data[fieldName];
    if (value && typeof value === 'string' && value.length > fieldInfo.limit) {
      return {
        field: fieldName,
        label: fieldInfo.label,
        currentLength: value.length,
        limit: fieldInfo.limit,
      };
    }
  }
  return null;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | undefined;

  const {
    cliente,
    observacao,
    codusr,
  }: {
    cliente: Cliente;
    observacao: string;
    codusr: string;
  } = req.body;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // ✅ CORREÇÃO TYPESCRIPT: A função agora retorna 'string | undefined' para ser compatível com a interface Cliente.
    const ajustarCodigo = (
      codigo: string | null | undefined,
    ): string | undefined => {
      if (!codigo || typeof codigo !== 'string' || codigo.trim() === '')
        return undefined;
      // Retorna o valor numérico como string, removendo zeros à esquerda.
      return String(parseInt(codigo, 10));
    };

    cliente.codcc = ajustarCodigo(cliente.codcc);
    cliente.codvend = ajustarCodigo(cliente.codvend);
    cliente.codbairro = ajustarCodigo(cliente.codbairro);
    cliente.codbairrocobr = ajustarCodigo(cliente.codbairrocobr);
    const codusrAjustado = ajustarCodigo(codusr);

    // 1. Buscar último codcli
    const latestClienteResult = await client.query(
      `SELECT codcli FROM dbclien WHERE codcli != '99999' ORDER BY CAST(codcli AS INTEGER) DESC LIMIT 1`,
    );

    const newCodCli =
      parseInt(latestClienteResult.rows[0]?.codcli ?? '0', 10) + 1;

    // 2. Verificar se cliente já existe
    const clienteExistenteResult = await client.query(
      `SELECT codcli FROM dbclien WHERE cpfcgc = $1`,
      [cliente.cpfcgc],
    );

    let clienteSalvo;

    if (clienteExistenteResult.rows.length > 0) {
      // Atualizar cliente existente
      const codCliExistente = clienteExistenteResult.rows[0].codcli;

      // ✅ CORREÇÃO ESLINT: Renomeamos 'codcli' para '_codcli' para indicar que não será usado.
      const { codcli: _codcli, ...clienteDataToUpdate } = cliente;

      const updateFields = Object.keys(clienteDataToUpdate)
        .map((key, index) => `"${key}" = $${index + 2}`)
        .join(', ');

      const updateValues = Object.values(clienteDataToUpdate);

      const updateResult = await client.query(
        `UPDATE dbclien SET ${updateFields} WHERE codcli = $1 RETURNING *`,
        [codCliExistente, ...updateValues],
      );

      clienteSalvo = updateResult.rows[0];
    } else {
      // Criar novo cliente
      const clienteParaCriar = {
        ...cliente,
        codcli: newCodCli.toString().padStart(5, '0'),
      };

      // 🔥 CORREÇÃO: Construção correta da query sem duplicação
      const insertFields = Object.keys(clienteParaCriar)
        .map((k) => `"${k}"`)
        .join(', ');
      const insertPlaceholders = Object.keys(clienteParaCriar)
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const insertValues = Object.values(clienteParaCriar);

      console.log('🔍 DEBUG - INSERT Query:', {
        fields: insertFields,
        placeholders: insertPlaceholders,
        valuesCount: insertValues.length,
        firstFewValues: insertValues.slice(0, 3),
      });

      const insertResult = await client.query(
        `INSERT INTO dbclien (${insertFields}) VALUES (${insertPlaceholders}) RETURNING *`,
        insertValues,
      );

      clienteSalvo = insertResult.rows[0];
    }

    // 3. Buscar último codclilim
    const latestLimiteResult = await client.query(
      `SELECT codclilim FROM dbcliente_limite ORDER BY codclilim DESC LIMIT 1`,
    );

    const newCodCliLim = latestLimiteResult.rows[0]
      ? Number(latestLimiteResult.rows[0].codclilim) + 1
      : 1;

    // 4. Criar limite
    const limiteResult = await client.query(
      `INSERT INTO dbcliente_limite (codcli, ultimo_limite, data, observacao, codusr, codclilim)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        clienteSalvo.codcli,
        Number(cliente.limite),
        new Date(),
        observacao,
        codusrAjustado,
        newCodCliLim,
      ],
    );

    await client.query('COMMIT');

    const result = {
      cliente: clienteSalvo,
      limite: limiteResult.rows[0],
    };

    res.status(201).json({
      data: serializeBigInt(result),
    });
  } catch (errors: any) {
    await client?.query('ROLLBACK');
    console.error(`🚨 ERRO NO BANCO (addComLimite):`, {
      message: errors.message,
      code: errors.code,
      detail: errors.detail,
      constraint: errors.constraint,
      table: errors.table,
      column: errors.column,
      routine: errors.routine,
      stack: errors.stack,
    });

    // Identificar tipos específicos de erro
    let userMessage = 'Erro ao cadastrar cliente e limite';
    let fieldError: any = null;

    if (errors.code === '23505') {
      userMessage = 'Cliente já existe com este CPF/CNPJ';
    } else if (errors.code === '23502') {
      userMessage = `Campo obrigatório não informado: ${
        errors.column || 'campo desconhecido'
      }`;
    } else if (errors.code === '22001') {
      // Detectar qual campo excedeu o limite
      const campoExcedido = detectarCampoExcedido(cliente);

      if (campoExcedido) {
        userMessage = `Campo "${campoExcedido.label}" excede o tamanho máximo de ${campoExcedido.limit} caracteres (atual: ${campoExcedido.currentLength}).`;
        fieldError = {
          field: campoExcedido.field,
          message: `${campoExcedido.label} não pode ter mais de ${campoExcedido.limit} caracteres.`,
          currentLength: campoExcedido.currentLength,
          maxLength: campoExcedido.limit,
        };
      } else {
        userMessage =
          'Um ou mais campos excedem o tamanho máximo permitido. Verifique os dados e tente novamente.';
      }
    } else if (errors.code === '42703') {
      userMessage = 'Erro de estrutura do banco de dados. Contate o suporte.';
    }

    res.status(500).json({
      error: userMessage,
      detail: String(errors.message),
      code: errors.code,
      fieldError, // Informação do campo específico que excedeu
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
