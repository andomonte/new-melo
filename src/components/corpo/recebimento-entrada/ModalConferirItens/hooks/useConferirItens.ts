/**
 * Hook principal para logica do modal de conferir itens
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getItensEntrada,
  conferirItem,
} from '@/data/recebimento-entrada/recebimentoEntradaService';
import { useToast } from '@/hooks/use-toast';
import {
  StatusItem,
  StatusConferido,
  ItemLocal,
  Armazem,
  EntradaParaReceber,
  ARMAZEM_PADRAO_ID,
} from '../constants';
import {
  calcularResumo,
  determinarStatusPorQuantidade,
  temItensPendentes,
  temItensModificados,
  podeFinalizar,
  contarModificados,
} from '../utils/statusHelpers';

interface UseConferirItensProps {
  isOpen: boolean;
  entrada: EntradaParaReceber | null;
  matricula: string;
  onFinalizar: (observacao?: string) => void;
  onClose: () => void;
}

export const useConferirItens = ({
  isOpen,
  entrada,
  matricula,
  onFinalizar,
  onClose,
}: UseConferirItensProps) => {
  // Estados principais
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [observacaoGeral, setObservacaoGeral] = useState('');
  const [isSalvandoTodos, setIsSalvandoTodos] = useState(false);
  const [isFinalizando, setIsFinalizando] = useState(false);

  // Estados de alocacao/armazem
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [armazemSelecionado, setArmazemSelecionado] = useState<number | null>(ARMAZEM_PADRAO_ID);
  const [loadingArmazens, setLoadingArmazens] = useState(false);

  // Estado do dialog de confirmacao
  const [showDialogFechar, setShowDialogFechar] = useState(false);

  const { toast } = useToast();
  const isSubmittingRef = useRef(false);

  // Carregar armazens
  const loadArmazens = useCallback(async () => {
    setLoadingArmazens(true);
    try {
      const response = await fetch('/api/armazens/listar');
      if (!response.ok) throw new Error('Erro ao buscar armazens');
      const data = await response.json();
      setArmazens(data.armazens || []);

      // Se GERAL (1001) existe, manter como padrao
      const geralExists = data.armazens?.some((a: Armazem) => a.arm_id === ARMAZEM_PADRAO_ID);
      if (!geralExists && data.armazens?.length > 0) {
        setArmazemSelecionado(data.armazens[0].arm_id);
      }
    } catch (error) {
      console.error('Erro ao carregar armazens:', error);
    } finally {
      setLoadingArmazens(false);
    }
  }, []);

  // Carregar itens - JA VEM COMO OK POR PADRAO E SALVA AUTOMATICAMENTE
  const loadItens = useCallback(async () => {
    if (!entrada) return;

    setIsLoading(true);
    try {
      let itensData = await getItensEntrada(entrada.entrada_id);

      // Identificar itens pendentes que precisam ser salvos como OK
      const itensPendentes = itensData.filter(item => item.status_item === 'PENDENTE');

      // Se tem itens pendentes, salvar todos como OK automaticamente
      if (itensPendentes.length > 0) {
        console.log(`Salvando ${itensPendentes.length} itens pendentes como OK...`);

        for (const item of itensPendentes) {
          try {
            await conferirItem({
              entradaItemId: item.entrada_item_id,
              qtdRecebida: item.qtd_esperada,
              statusItem: 'OK',
              matricula,
            });
          } catch (err) {
            console.error(`Erro ao salvar item ${item.entrada_item_id}:`, err);
          }
        }

        // Recarregar itens apos salvar para ter os dados atualizados
        itensData = await getItensEntrada(entrada.entrada_id);
      }

      // Mapear itens - TODOS JA SALVOS
      setItens(
        itensData.map(item => ({
          ...item,
          // Usar valores do banco (ja salvos)
          qtdRecebidaLocal: item.qtd_recebida ?? item.qtd_esperada,
          statusLocal: item.status_item === 'PENDENTE' ? 'OK' : item.status_item,
          observacaoLocal: item.observacao || '',
          // Nao marcado como modificado pois ja esta salvo no banco
          modificado: false,
          salvando: false,
          // Armazem padrao
          armazemId: ARMAZEM_PADRAO_ID,
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast({
        title: 'Erro ao carregar itens',
        description: 'Nao foi possivel obter os itens da entrada.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [entrada, matricula, toast]);

  // Efeito para carregar dados ao abrir
  useEffect(() => {
    if (isOpen && entrada) {
      loadItens();
      loadArmazens();
      setObservacaoGeral('');
    }
  }, [isOpen, entrada, loadItens, loadArmazens]);

  // Atualizar quantidade de um item
  const handleQtdChange = useCallback((index: number, value: number) => {
    setItens(prev => {
      const updated = [...prev];
      const item = updated[index];
      item.qtdRecebidaLocal = value;
      item.modificado = true;

      // Auto-determinar status baseado na quantidade
      item.statusLocal = determinarStatusPorQuantidade(value, item.qtd_esperada);

      return updated;
    });
  }, []);

  // Atualizar status de um item
  const handleStatusChange = useCallback((index: number, status: StatusItem) => {
    setItens(prev => {
      const updated = [...prev];
      updated[index].statusLocal = status;
      updated[index].modificado = true;
      return updated;
    });
  }, []);

  // Atualizar observacao de um item
  const handleObservacaoChange = useCallback((index: number, value: string) => {
    setItens(prev => {
      const updated = [...prev];
      updated[index].observacaoLocal = value;
      updated[index].modificado = true;
      return updated;
    });
  }, []);

  // Atualizar armazem de um item
  const handleArmazemChange = useCallback((index: number, armazemId: number) => {
    setItens(prev => {
      const updated = [...prev];
      updated[index].armazemId = armazemId;
      updated[index].modificado = true;
      return updated;
    });
  }, []);

  // Selecionar armazem - JA APLICA AUTOMATICAMENTE PARA TODOS OS ITENS
  const handleSelecionarArmazem = useCallback((armId: number) => {
    setArmazemSelecionado(armId);

    // Aplicar automaticamente para todos os itens
    setItens(prev =>
      prev.map(item => ({
        ...item,
        armazemId: armId,
        // Nao marca como modificado - armazem e apenas para alocacao
      }))
    );
  }, []);

  // Salvar um item individual
  const handleSalvarItem = useCallback(async (index: number) => {
    const item = itens[index];

    setItens(prev => {
      const updated = [...prev];
      updated[index].salvando = true;
      return updated;
    });

    try {
      // Cast statusLocal para StatusConferido (sem PENDENTE)
      // Itens PENDENTE nao deveriam ser salvos, mas tratamos como OK por seguranca
      const statusParaAPI: StatusConferido = item.statusLocal === 'PENDENTE' ? 'OK' : item.statusLocal;

      await conferirItem({
        entradaItemId: item.entrada_item_id,
        qtdRecebida: item.qtdRecebidaLocal,
        statusItem: statusParaAPI,
        observacao: item.observacaoLocal || undefined,
        matricula,
      });

      setItens(prev => {
        const updated = [...prev];
        updated[index].modificado = false;
        updated[index].salvando = false;
        updated[index].qtd_recebida = updated[index].qtdRecebidaLocal;
        updated[index].status_item = updated[index].statusLocal;
        updated[index].observacao = updated[index].observacaoLocal;
        return updated;
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao salvar item:', error);
      setItens(prev => {
        const updated = [...prev];
        updated[index].salvando = false;
        return updated;
      });
      toast({
        title: 'Erro ao salvar item',
        description: error?.response?.data?.error || 'Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
  }, [itens, matricula, toast]);

  // Salvar todos os itens modificados
  const handleSalvarTodos = useCallback(async () => {
    const itensModificados = itens.filter(i => i.modificado);
    if (itensModificados.length === 0) {
      toast({
        title: 'Nenhuma alteracao',
        description: 'Nenhum item foi modificado.',
        variant: 'default',
      });
      return true;
    }

    setIsSalvandoTodos(true);

    try {
      let sucessos = 0;
      for (let i = 0; i < itens.length; i++) {
        if (itens[i].modificado) {
          const sucesso = await handleSalvarItem(i);
          if (sucesso) sucessos++;
        }
      }

      toast({
        title: 'Itens salvos',
        description: `${sucessos} item(ns) salvo(s) com sucesso.`,
        variant: 'default',
      });
      return sucessos === itensModificados.length;
    } catch (error) {
      console.error('Erro ao salvar todos:', error);
      return false;
    } finally {
      setIsSalvandoTodos(false);
    }
  }, [itens, handleSalvarItem, toast]);

  // Marcar todos como OK
  const handleMarcarTodosOK = useCallback(() => {
    setItens(prev =>
      prev.map(item => ({
        ...item,
        qtdRecebidaLocal: item.qtd_esperada,
        statusLocal: 'OK',
        modificado: true,
      }))
    );
  }, []);

  // Iniciar finalizacao
  const handleFinalizar = useCallback(() => {
    if (isSubmittingRef.current) return;

    // Validar itens pendentes (nao deveria ter com novo comportamento)
    if (temItensPendentes(itens)) {
      toast({
        title: 'Itens pendentes',
        description: `Ainda ha ${calcularResumo(itens).pendente} item(ns) pendente(s).`,
        variant: 'destructive',
      });
      return;
    }

    executarFinalizacao();
  }, [itens, toast]);

  // Executar finalizacao de fato
  const executarFinalizacao = useCallback(async () => {
    isSubmittingRef.current = true;
    setIsFinalizando(true);

    try {
      // Se tem itens modificados (incluindo itens OK padrao nao salvos), salvar primeiro
      if (temItensModificados(itens)) {
        const salvou = await handleSalvarTodos();
        if (!salvou) {
          isSubmittingRef.current = false;
          setIsFinalizando(false);
          return;
        }
      }

      await onFinalizar(observacaoGeral || undefined);
    } finally {
      isSubmittingRef.current = false;
      setIsFinalizando(false);
    }
  }, [itens, observacaoGeral, handleSalvarTodos, onFinalizar]);

  // Tentar fechar modal - verifica se tem alteracoes nao salvas
  const handleClose = useCallback(() => {
    if (temItensModificados(itens)) {
      setShowDialogFechar(true);
      return;
    }
    onClose();
  }, [itens, onClose]);

  // Confirmar fechamento do modal
  const confirmarFechar = useCallback(() => {
    setShowDialogFechar(false);
    onClose();
  }, [onClose]);

  // Calcular resumo
  const resumo = calcularResumo(itens);

  // Verificar se pode finalizar
  const podeFinalizarRecebimento = podeFinalizar(itens) || !temItensPendentes(itens);

  // Obter nome do armazem
  const getArmazemNome = useCallback((armId: number | null): string => {
    if (!armId) return '-';
    const arm = armazens.find(a => a.arm_id === armId);
    return arm?.arm_descricao || `Armazem ${armId}`;
  }, [armazens]);

  return {
    // Estados
    itens,
    isLoading,
    observacaoGeral,
    setObservacaoGeral,
    isSalvandoTodos,
    isFinalizando,
    armazens,
    armazemSelecionado,
    loadingArmazens,
    resumo,
    podeFinalizarRecebimento,

    // Estados de dialogs
    showDialogFechar,
    setShowDialogFechar,

    // Handlers
    handleQtdChange,
    handleStatusChange,
    handleObservacaoChange,
    handleArmazemChange,
    handleSelecionarArmazem,
    handleSalvarItem,
    handleSalvarTodos,
    handleMarcarTodosOK,
    handleFinalizar,
    handleClose,
    getArmazemNome,
    confirmarFechar,

    // Utils
    temItensModificados: () => temItensModificados(itens),
    contarModificados: () => contarModificados(itens),
  };
};
