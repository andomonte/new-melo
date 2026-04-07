/**
 * Função placeholder para envio de dados para impressora
 *
 * Esta função deve ser implementada futuramente por outro desenvolvedor
 * que irá integrar com o sistema de impressão específico da empresa.
 *
 * Por enquanto, simula o envio bem-sucedido após um delay realista.
 */

export interface DadosImpressao {
  codvenda: string;
  motivo: string;
  usuario?: string;
  timestamp?: Date;
}

/**
 * Simula o envio de dados para a impressora
 *
 * @param dados - Dados do pedido e motivo da impressão
 * @returns Promise que resolve quando a "impressão" é concluída
 */
export const enviarParaImpressora = async (
  dados: DadosImpressao,
): Promise<void> => {
  // Simular delay de processamento (1-3 segundos)
  const delay = Math.random() * 2000 + 1000; // 1000ms a 3000ms

  console.log('📄 SIMULAÇÃO: Enviando para impressora...', {
    pedido: dados.codvenda,
    motivo: dados.motivo,
    timestamp: new Date().toISOString(),
  });

  await new Promise((resolve) => setTimeout(resolve, delay));

  // Simular sucesso (pode ser modificado para incluir falhas ocasionais para testes)
  console.log('✅ SIMULAÇÃO: Pedido enviado para impressora com sucesso!');

  // TODO: Implementar integração real com impressora
  // Esta função deve ser substituída pela implementação real:
  // - Conectar com o sistema de impressão da empresa
  // - Enviar dados formatados para a impressora específica
  // - Tratar erros de conexão/impressão
  // - Retornar status real da operação
};

/**
 * Valida se os dados estão prontos para impressão
 *
 * @param dados - Dados a serem validados
 * @returns true se válidos, false caso contrário
 */
export const validarDadosImpressao = (dados: DadosImpressao): boolean => {
  return Boolean(
    dados.codvenda?.trim() &&
      dados.motivo?.trim() &&
      dados.motivo.trim().length >= 15,
  );
};
