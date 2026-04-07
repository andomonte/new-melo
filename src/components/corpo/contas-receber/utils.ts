// Funções utilitárias para Contas a Receber

/**
 * Formata um valor numérico para moeda brasileira (R$)
 */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return 'R$ 0,00';

  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(num)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Formata uma data para o padrão brasileiro (DD/MM/YYYY)
 */
export function formatarData(data: string | null | undefined): string {
  if (!data) return '-';

  try {
    const date = new Date(data);
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

/**
 * Formata data e hora para o padrão brasileiro
 */
export function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '-';

  try {
    const date = new Date(data);
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

/**
 * Calcula quantos dias uma conta está atrasada
 */
export function calcularDiasAtraso(dtVencimento: string | null | undefined): number {
  if (!dtVencimento) return 0;

  try {
    const vencimento = new Date(dtVencimento);
    const hoje = new Date();

    // Zera as horas para comparar apenas datas
    vencimento.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  } catch {
    return 0;
  }
}

/**
 * Retorna a cor apropriada para o status
 */
export function obterCorStatus(status: string): string {
  switch (status) {
    case 'recebido':
      return 'text-green-600 dark:text-green-400';
    case 'recebido_parcial':
      return 'text-blue-600 dark:text-blue-400';
    case 'cancelado':
      return 'text-red-600 dark:text-red-400';
    case 'vencido':
      return 'text-orange-600 dark:text-orange-400';
    default:
      return 'text-yellow-600 dark:text-yellow-400';
  }
}

/**
 * Retorna o texto apropriado para o status
 */
export function obterTextoStatus(status: string): string {
  switch (status) {
    case 'recebido':
      return 'Recebido';
    case 'recebido_parcial':
      return 'Recebido Parcial';
    case 'cancelado':
      return 'Cancelado';
    case 'vencido':
      return 'Vencido';
    default:
      return 'Pendente';
  }
}

/**
 * Calcula o valor restante a receber
 */
export function calcularValorRestante(valorOriginal: number, valorRecebido: number = 0): number {
  return Math.max(0, valorOriginal - valorRecebido);
}

/**
 * Verifica se uma conta está vencida
 */
export function estaVencida(dtVencimento: string | null | undefined, status: string): boolean {
  if (!dtVencimento || status !== 'pendente') return false;

  try {
    const vencimento = new Date(dtVencimento);
    const hoje = new Date();

    // Zera as horas para comparar apenas datas
    vencimento.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    return hoje > vencimento;
  } catch {
    return false;
  }
}

/**
 * Formata um valor para input monetário (remove formatação)
 */
export function formatarValorParaInput(valor: number | string): string {
  if (!valor || valor === '0' || valor === 0) return '';

  const num = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.')) : valor;
  return num.toFixed(2);
}

/**
 * Converte valor formatado em string para número
 */
export function valorFormatadoParaNumero(valorFormatado: string): number {
  if (!valorFormatado) return 0;

  // Remove tudo exceto números, vírgulas e pontos
  const valorLimpo = valorFormatado.replace(/[^\d.,]/g, '');

  // Substitui vírgula por ponto para conversão
  const valorComPonto = valorLimpo.replace(',', '.');

  return parseFloat(valorComPonto) || 0;
}

/**
 * Calcula juros baseado na data de vencimento e taxa
 */
export function calcularJuros(
  valorOriginal: number,
  dtVencimento: string,
  taxaJurosDiaria: number = 0.033, // 3,3% ao mês ≈ 0,033% ao dia
  dtRecebimento?: string
): { valorJuros: number; diasAtraso: number } {
  const diasAtraso = calcularDiasAtraso(dtVencimento);

  if (diasAtraso <= 0) {
    return { valorJuros: 0, diasAtraso: 0 };
  }

  const valorJuros = valorOriginal * (taxaJurosDiaria / 100) * diasAtraso;

  return {
    valorJuros: Math.round(valorJuros * 100) / 100, // Arredonda para 2 casas decimais
    diasAtraso
  };
}

/**
 * Gera um número de documento sequencial
 */
export function gerarNumeroDocumento(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4); // Últimos 4 dígitos do timestamp

  return `${ano}${mes}-${timestamp}`;
}

/**
 * Valida se uma data é válida
 */
export function dataValida(data: string): boolean {
  if (!data) return false;

  const date = new Date(data);
  return !isNaN(date.getTime());
}

/**
 * Compara duas datas (retorna -1 se data1 < data2, 0 se igual, 1 se data1 > data2)
 */
export function compararDatas(data1: string, data2: string): number {
  const d1 = new Date(data1);
  const d2 = new Date(data2);

  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/**
 * Formata um número de telefone
 */
export function formatarTelefone(telefone: string): string {
  if (!telefone) return '';

  // Remove tudo exceto números
  const apenasNumeros = telefone.replace(/\D/g, '');

  // Formata conforme o tamanho
  if (apenasNumeros.length === 11) {
    // Celular: (11) 99999-9999
    return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
  } else if (apenasNumeros.length === 10) {
    // Fixo: (11) 9999-9999
    return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 6)}-${apenasNumeros.slice(6)}`;
  }

  return telefone; // Retorna como está se não conseguir formatar
}

/**
 * Remove acentos de uma string
 */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Converte string para slug
 */
export function slugify(texto: string): string {
  return removerAcentos(texto)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Trunca texto com reticências
 */
export function truncarTexto(texto: string, maxLength: number): string {
  if (texto.length <= maxLength) return texto;
  return texto.slice(0, maxLength - 3) + '...';
}

/**
 * Gera cores aleatórias para badges/avatares
 */
export function gerarCorAleatoria(seed?: string): string {
  const cores = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500'
  ];

  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return cores[Math.abs(hash) % cores.length];
  }

  return cores[Math.floor(Math.random() * cores.length)];
}