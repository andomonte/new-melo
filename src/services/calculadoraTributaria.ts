// src/services/calculadoraTributaria.ts
/**
 * Serviço para cálculo de impostos
 * Usa a API interna do sistema (/api/impostos) que consulta as tabelas do banco
 */

export interface CalculadoraTributariaRequest {
  // Identificação do produto
  ncm: string; // Código NCM do produto (8 dígitos)
  cest?: string; // Código CEST (opcional)
  
  // Valores
  valorOperacao: number; // Valor da operação em reais
  quantidadeComercial?: number; // Quantidade comercial
  
  // Origem/Destino
  ufOrigem: string; // UF de origem (sigla com 2 letras)
  ufDestino: string; // UF de destino (sigla com 2 letras)
  
  // Tipo de operação
  tipoOperacao?: 'venda' | 'importacao' | 'industrializacao';
  finalidade?: 'consumo' | 'revenda' | 'industrializacao';
  
  // Regime tributário
  regimeTributario?: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
  
  // Para cálculo interno (opcional)
  codProd?: string;
  codCli?: string;
}

export interface ImpostoCalculado {
  tipo: string; // IBS, CBS, ICMS, PIS, COFINS, etc
  aliquota: number; // Alíquota em percentual
  base: number; // Base de cálculo
  valor: number; // Valor do imposto
}

export interface CalculadoraTributariaResponse {
  sucesso: boolean;
  impostos: ImpostoCalculado[];
  totalImpostos: number;
  valorTotal: number; // Valor da operação + impostos
  detalhes?: any; // Resposta completa da API
  erro?: string;
}

/**
 * Calcula os impostos usando cálculo manual (sem API externa)
 * Usa alíquotas padrão baseadas em NCM e UF
 */
export async function calcularImpostosGoverno(
  params: CalculadoraTributariaRequest
): Promise<CalculadoraTributariaResponse> {
  try {
    const {
      ncm,
      valorOperacao,
      quantidadeComercial = 1,
      ufOrigem,
      ufDestino,
    } = params;

    // Validações
    if (!ncm || ncm.length !== 8) {
      return {
        sucesso: false,
        impostos: [],
        totalImpostos: 0,
        valorTotal: valorOperacao,
        erro: 'NCM inválido. Deve conter 8 dígitos.',
      };
    }

    if (!ufOrigem || !ufDestino) {
      return {
        sucesso: false,
        impostos: [],
        totalImpostos: 0,
        valorTotal: valorOperacao,
        erro: 'UF de origem e destino são obrigatórias.',
      };
    }

    // Cálculo manual usando alíquotas padrão
    // Alíquotas aproximadas da reforma tributária (IBS + CBS = ~26.5%)
    const aliquotaIBS = 17.7; // Alíquota IBS (estadual + municipal) 
    const aliquotaCBS = 8.8;  // Alíquota CBS (federal)
    
    // ICMS baseado em operação interna ou interestadual
    const isOperacaoInterna = ufOrigem.toUpperCase() === ufDestino.toUpperCase();
    const aliquotaICMS = isOperacaoInterna ? 18 : 12; // ICMS interno ou interestadual
    
    // PIS e COFINS (regime não-cumulativo padrão)
    const aliquotaPIS = 1.65;
    const aliquotaCOFINS = 7.6;

    // Calcular valores
    const valorTotal = valorOperacao * quantidadeComercial;
    
    const valorIBS = +(valorTotal * aliquotaIBS / 100).toFixed(2);
    const valorCBS = +(valorTotal * aliquotaCBS / 100).toFixed(2);
    const valorICMS = +(valorTotal * aliquotaICMS / 100).toFixed(2);
    const valorPIS = +(valorTotal * aliquotaPIS / 100).toFixed(2);
    const valorCOFINS = +(valorTotal * aliquotaCOFINS / 100).toFixed(2);

    const impostos: ImpostoCalculado[] = [
      {
        tipo: 'IBS',
        aliquota: aliquotaIBS,
        base: valorTotal,
        valor: valorIBS,
      },
      {
        tipo: 'CBS',
        aliquota: aliquotaCBS,
        base: valorTotal,
        valor: valorCBS,
      },
      {
        tipo: 'ICMS',
        aliquota: aliquotaICMS,
        base: valorTotal,
        valor: valorICMS,
      },
      {
        tipo: 'PIS',
        aliquota: aliquotaPIS,
        base: valorTotal,
        valor: valorPIS,
      },
      {
        tipo: 'COFINS',
        aliquota: aliquotaCOFINS,
        base: valorTotal,
        valor: valorCOFINS,
      },
    ];

    const totalImpostos = valorIBS + valorCBS + valorICMS + valorPIS + valorCOFINS;

    return {
      sucesso: true,
      impostos,
      totalImpostos: +totalImpostos.toFixed(2),
      valorTotal: +(valorTotal + totalImpostos).toFixed(2),
      detalhes: {
        ncm,
        ufOrigem: ufOrigem.toUpperCase(),
        ufDestino: ufDestino.toUpperCase(),
        operacaoInterna: isOperacaoInterna,
        quantidade: quantidadeComercial,
        valorUnitario: valorOperacao,
        valorBase: valorTotal,
        observacao: 'Cálculo com alíquotas padrão. Para valores precisos, consulte a legislação vigente.',
      },
    };
  } catch (error) {
    console.error('Erro ao calcular impostos:', error);
    return {
      sucesso: false,
      impostos: [],
      totalImpostos: 0,
      valorTotal: params.valorOperacao,
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Função auxiliar para calcular impostos de múltiplos produtos
 */
export async function calcularImpostosMultiplosProdutos(
  produtos: CalculadoraTributariaRequest[]
): Promise<CalculadoraTributariaResponse[]> {
  const promessas = produtos.map((produto) => calcularImpostosGoverno(produto));
  return Promise.all(promessas);
}
