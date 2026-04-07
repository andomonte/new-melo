import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Interface para representar um registro DDA
interface DDARecord {
  seq: number;
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
  cadastrado: string;
  tipoCedente: string; // 'F' para fornecedor, 'T' para transportadora
}

// Função para converter data DDMMAAAA para AAAA-MM-DD
function dmaToIso(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return '';
  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = dateStr.substring(4, 8);
  return `${year}-${month}-${day}`;
}

// Função para converter valor textual para número
function txtToFloat(valueStr: string, decimals: number = 2): number {
  if (!valueStr) return 0;
  const cleanValue = valueStr.replace(/[^\d]/g, '');
  return parseFloat(cleanValue) / Math.pow(10, decimals);
}

// Função para obter descrição da espécie
function getEspecieDescricao(codEspecie: number): string {
  const especies: { [key: number]: string } = {
    1: 'DUPLICATA MERCANTIL',
    2: 'NOTA PROMISSÓRIA',
    3: 'NOTA DE SEGURO',
    4: 'MENSALIDADE ESCOLAR',
    5: 'RECIBO',
    6: 'CONTRATO',
    7: 'CO-SEGUROS',
    8: 'DUPLICATA DE SERVIÇO',
    9: 'LETRA DE CÂMBIO',
    10: 'ESCRITURAL/OUTROS',
    13: 'NOTA DE DÉBITO'
  };
  return especies[codEspecie] || 'NÃO IDENTIFICADA';
}

// Função para obter tipo de protesto
function getTipoProtesto(codProtesto: number): string {
  const tipos: { [key: number]: string } = {
    1: 'Corridos',
    2: 'Úteis',
    3: ''
  };
  return tipos[codProtesto] || '';
}

// Função para verificar se CNPJ existe como fornecedor ou transportadora
async function verificarCedente(cnpj: string): Promise<{ existe: boolean; tipo: string }> {
  try {
    // Verificar fornecedor
    const fornecedorQuery = 'SELECT cod_credor FROM db_credor WHERE cpf_cgc = $1';
    const fornecedorResult = await pool.query(fornecedorQuery, [cnpj]);

    if (fornecedorResult.rows.length > 0) {
      return { existe: true, tipo: 'F' };
    }

    // Verificar transportadora
    const transportadoraQuery = 'SELECT codtransp FROM db_transportadora WHERE cpf_cgc = $1';
    const transportadoraResult = await pool.query(transportadoraQuery, [cnpj]);

    if (transportadoraResult.rows.length > 0) {
      return { existe: true, tipo: 'T' };
    }

    return { existe: false, tipo: '' };
  } catch (error) {
    console.error('Erro ao verificar cedente:', error);
    return { existe: false, tipo: '' };
  }
}

// Função para verificar se pagamento já existe
async function verificarPagamentoExistente(cnpj: string, dtVenc: string, valor: number): Promise<boolean> {
  try {
    const query = `
      SELECT COUNT(*) as total
      FROM db_contas_pagar
      WHERE cod_credor IN (
        SELECT cod_credor FROM db_credor WHERE cpf_cgc = $1
        UNION
        SELECT codtransp FROM db_transportadora WHERE cpf_cgc = $1
      )
      AND dt_venc = $2
      AND valor_pgto = $3
    `;
    const result = await pool.query(query, [cnpj, dtVenc, valor]);
    return parseInt(result.rows[0].total) > 0;
  } catch (error) {
    console.error('Erro ao verificar pagamento existente:', error);
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'Caminho do arquivo é obrigatório' });
    }

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Arquivo não encontrado' });
    }

    // Ler o arquivo
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    const registros: DDARecord[] = [];
    let seqCounter = 1;

    // Pular as duas primeiras linhas (cabeçalho)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;

      // Verificar se é um registro válido (tipo '3' na posição 8 e 'G' na posição 14)
      if (line.length >= 240 && line.charAt(7) === '3' && line.charAt(13) === 'G') {
        try {
          const cnpj = line.substring(63, 77).trim(); // posições 64-77
          const nome = line.substring(77, 107).trim(); // posições 78-107
          const dtVenc = dmaToIso(line.substring(107, 115)); // posições 108-115
          const valorStr = line.substring(115, 130); // posições 116-130
          const valorPgto = txtToFloat(valorStr, 2);
          const nroDoc = line.substring(146, 161).trim(); // posições 147-161
          const codEspecie = parseInt(line.substring(179, 181)) || 0; // posições 180-181
          const dtEmissao = dmaToIso(line.substring(181, 189)); // posições 182-189
          const valorJurosStr = line.substring(189, 204); // posições 190-204
          const valorJuros = txtToFloat(valorJurosStr, 2);
          const codProtesto = parseInt(line.charAt(228)) || 0; // posição 229
          const diasJuros = line.substring(229, 231).trim(); // posições 230-231
          const dtLimite = dmaToIso(line.substring(231, 239)); // posições 232-239

          // Verificar se já existe este pagamento
          const pagamentoExiste = await verificarPagamentoExistente(cnpj, dtVenc, valorPgto);
          if (pagamentoExiste) {
            continue; // Pular duplicatas
          }

          // Verificar se o cedente existe
          const cedenteInfo = await verificarCedente(cnpj);
          const cadastrado = cedenteInfo.existe ? 'SIM' : 'NAO';

          const registro: DDARecord = {
            seq: seqCounter++,
            cedente: nome,
            cnpj: cnpj,
            dtEmissao: dtEmissao,
            dtVenc: dtVenc,
            dtLimite: dtLimite,
            valorPgto: valorPgto,
            valorJuros: valorJuros,
            nroDoc: nroDoc,
            codEspecie: codEspecie.toString(),
            especie: getEspecieDescricao(codEspecie),
            codProtesto: codProtesto.toString(),
            tipoProtesto: getTipoProtesto(codProtesto),
            diasJuros: diasJuros,
            cadastrado: cadastrado,
            tipoCedente: cedenteInfo.tipo
          };

          registros.push(registro);
        } catch (error) {
          console.error(`Erro ao processar linha ${i + 1}:`, error);
          continue;
        }
      }
    }

    // Agrupar por CNPJ para mostrar resumo
    const cedentesMap = new Map<string, { cedente: string; cnpj: string; cadastrado: string; tipo: string; titulos: DDARecord[] }>();

    registros.forEach(registro => {
      if (!cedentesMap.has(registro.cnpj)) {
        cedentesMap.set(registro.cnpj, {
          cedente: registro.cedente,
          cnpj: registro.cnpj,
          cadastrado: registro.cadastrado,
          tipo: registro.tipoCedente,
          titulos: []
        });
      }
      cedentesMap.get(registro.cnpj)!.titulos.push(registro);
    });

    const cedentes = Array.from(cedentesMap.values());

    res.status(200).json({
      success: true,
      message: 'Arquivo DDA processado com sucesso',
      data: {
        totalRegistros: registros.length,
        cedentesCadastrados: cedentes.filter(c => c.cadastrado === 'SIM').length,
        cedentesNaoCadastrados: cedentes.filter(c => c.cadastrado === 'NAO').length,
        cedentes: cedentes,
        registros: registros
      }
    });

  } catch (error) {
    console.error('Erro ao processar arquivo DDA:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}