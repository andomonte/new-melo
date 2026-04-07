import { useState, useCallback, useRef, useEffect } from 'react';

// Interface para métricas de performance
interface PerformanceMetrics {
  startTime: number;
  endTime: number | null;
  duration: number;
  memoryUsage: number;
  operationsPerSecond: number;
  totalOperations: number;
  errors: number;
  status: 'idle' | 'running' | 'completed' | 'error';
}

// Interface para configuração do monitor
interface PerformanceConfig {
  enableMemoryMonitoring?: boolean;
  enableThroughputCalculation?: boolean;
  logInterval?: number;
  maxOperations?: number;
}

/**
 * 🚀 Hook personalizado para monitoramento de performance em tempo real
 * 
 * Funcionalidades Senior:
 * 1. Tracking de tempo de execução em tempo real
 * 2. Monitoramento de uso de memória (quando disponível)
 * 3. Cálculo de throughput (operações por segundo)
 * 4. Contagem de operações e erros
 * 5. Estado de execução em tempo real
 * 6. Logging automático de métricas
 * 7. Reset automático entre execuções
 */
export function usePerformanceMonitor(config: PerformanceConfig = {}) {
  const {
    enableMemoryMonitoring = true,
    enableThroughputCalculation = true,
    logInterval = 1000,
    maxOperations = 10000,
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    startTime: 0,
    endTime: null,
    duration: 0,
    memoryUsage: 0,
    operationsPerSecond: 0,
    totalOperations: 0,
    errors: 0,
    status: 'idle',
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationCountRef = useRef(0);
  const errorCountRef = useRef(0);

  /**
   * 🚀 Iniciar monitoramento de performance
   */
  const startMonitoring = useCallback((initialOperations: number = 0) => {
    const startTime = Date.now();
    
    // Reset de todos os contadores
    operationCountRef.current = initialOperations;
    errorCountRef.current = 0;

    setMetrics({
      startTime,
      endTime: null,
      duration: 0,
      memoryUsage: 0,
      operationsPerSecond: 0,
      totalOperations: initialOperations,
      errors: 0,
      status: 'running',
    });

    // Iniciar intervalo de atualização em tempo real
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const currentTime = Date.now();
      const duration = currentTime - startTime;
      const totalOperations = operationCountRef.current;
      const errors = errorCountRef.current;
      
      let memoryUsage = 0;
      if (enableMemoryMonitoring && typeof window !== 'undefined' && 'performance' in window) {
        // @ts-expect-error - performance.memory pode não estar disponível em todos os browsers
        const memory = (window.performance as any).memory;
        if (memory) {
          memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
        }
      }

      let operationsPerSecond = 0;
      if (enableThroughputCalculation && duration > 0) {
        operationsPerSecond = Math.round((totalOperations / duration) * 1000);
      }

      setMetrics({
        startTime,
        endTime: null,
        duration,
        memoryUsage,
        operationsPerSecond,
        totalOperations,
        errors,
        status: 'running',
      });

      // Log periódico para debug
      if (duration > 0 && duration % logInterval < 100) {
        console.log(`📊 Performance: ${totalOperations} ops, ${operationsPerSecond} ops/s, ${memoryUsage}MB`);
      }

      // Auto-stop se atingir limite máximo
      if (totalOperations >= maxOperations) {
        console.warn(`⚠️ Limite máximo de operações atingido: ${maxOperations}`);
      }

    }, 100); // Atualiza a cada 100ms para suavidade

    console.log('🚀 Monitoramento de performance iniciado');
  }, [enableMemoryMonitoring, enableThroughputCalculation, logInterval, maxOperations]);

  /**
   * 🚀 Parar monitoramento de performance
   */
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const endTime = Date.now();
    const currentStartTime = metrics.startTime;
    const duration = endTime - currentStartTime;
    const totalOperations = operationCountRef.current;
    const errors = errorCountRef.current;
    const operationsPerSecond = duration > 0 ? Math.round((totalOperations / duration) * 1000) : 0;

    let memoryUsage = 0;
    if (enableMemoryMonitoring && typeof window !== 'undefined' && 'performance' in window) {
      const memory = (window.performance as any).memory;
      if (memory) {
        memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      }
    }

    const finalMetrics = {
      startTime: currentStartTime,
      endTime,
      duration,
      memoryUsage,
      operationsPerSecond,
      totalOperations,
      errors,
      status: errors > 0 ? 'error' as const : 'completed' as const,
    };

    setMetrics(finalMetrics);

    // Log final de performance
    console.log('✅ Monitoramento de performance finalizado:');
    console.log(`  ⏱️  Duração: ${duration}ms`);
    console.log(`  📊 Operações: ${totalOperations}`);
    console.log(`  🚀 Throughput: ${operationsPerSecond} ops/s`);
    console.log(`  💾 Memória: ${memoryUsage}MB`);
    console.log(`  ❌ Erros: ${errors}`);

    return finalMetrics;
  }, [enableMemoryMonitoring, metrics.startTime]);

  /**
   * 🚀 Incrementar contador de operações
   */
  const incrementOperations = useCallback((count: number = 1) => {
    operationCountRef.current += count;
  }, []);

  /**
   * 🚀 Incrementar contador de erros
   */
  const incrementErrors = useCallback((count: number = 1) => {
    errorCountRef.current += count;
  }, []);

  /**
   * 🚀 Resetar todas as métricas
   */
  const resetMetrics = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    operationCountRef.current = 0;
    errorCountRef.current = 0;

    setMetrics({
      startTime: 0,
      endTime: null,
      duration: 0,
      memoryUsage: 0,
      operationsPerSecond: 0,
      totalOperations: 0,
      errors: 0,
      status: 'idle',
    });

    console.log('🔄 Métricas de performance resetadas');
  }, []);

  /**
   * 🚀 Obter relatório de performance formatado
   */
  const getPerformanceReport = useCallback(() => {
    const { duration, totalOperations, operationsPerSecond, memoryUsage, errors, status } = metrics;
    
    return {
      summary: `${totalOperations} operações em ${duration}ms (${operationsPerSecond} ops/s)`,
      details: {
        tempo: `${duration}ms`,
        operacoes: totalOperations.toLocaleString(),
        throughput: `${operationsPerSecond} ops/s`,
        memoria: `${memoryUsage}MB`,
        erros: errors,
        status: status,
        eficiencia: errors > 0 ? `${((totalOperations - errors) / totalOperations * 100).toFixed(1)}%` : '100%',
      },
      isRunning: status === 'running',
      hasErrors: errors > 0,
      isCompleted: status === 'completed',
    };
  }, [metrics]);

  /**
   * 🚀 Cleanup automático no unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    metrics,
    startMonitoring,
    stopMonitoring,
    incrementOperations,
    incrementErrors,
    resetMetrics,
    getPerformanceReport,
    
    // Propriedades derivadas para facilitar uso
    isRunning: metrics.status === 'running',
    isCompleted: metrics.status === 'completed',
    hasErrors: metrics.errors > 0,
    duration: metrics.duration,
    throughput: metrics.operationsPerSecond,
    progress: maxOperations > 0 ? Math.min((metrics.totalOperations / maxOperations) * 100, 100) : 0,
  };
}