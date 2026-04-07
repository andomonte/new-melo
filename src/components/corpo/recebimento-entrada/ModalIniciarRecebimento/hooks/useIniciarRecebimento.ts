/**
 * Hook para lógica do Modal de Iniciar Recebimento
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Recebedor,
  EntradaParaReceber,
  iniciarRecebimentoPorChaveNFe,
} from '@/data/recebimento-entrada/recebimentoEntradaService';
import { MODAL_MODES, MESSAGES, CHAVE_NFE_LENGTH, CHAVE_MIN_LENGTH, ModalMode } from '../constants';
import { limparChave, validarChaveNFe } from '../utils/chaveNFe';

interface UseIniciarRecebimentoProps {
  isOpen: boolean;
  recebedor: Recebedor;
  onSuccess: (entrada: EntradaParaReceber) => void;
  onClose: () => void;
}

export const useIniciarRecebimento = ({
  isOpen,
  recebedor,
  onSuccess,
  onClose,
}: UseIniciarRecebimentoProps) => {
  const [chaveNFe, setChaveNFe] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(MODAL_MODES.MANUAL);
  const [isScanning, setIsScanning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Flag para evitar submits duplicados
  const isSubmittingRef = useRef(false);

  // Reset ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setChaveNFe('');
      setModalMode(MODAL_MODES.MANUAL);
      setIsScanning(false);
      isSubmittingRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Controlar scanner quando modo muda
  useEffect(() => {
    if (!isOpen) {
      setIsScanning(false);
      return;
    }

    if (modalMode === MODAL_MODES.BARCODE) {
      setIsScanning(true);
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    } else {
      setIsScanning(false);
    }
  }, [modalMode, isOpen]);

  // Iniciar recebimento
  const handleIniciarRecebimento = useCallback(async (chave: string) => {
    const chaveLimpa = limparChave(chave);

    if (!validarChaveNFe(chaveLimpa)) {
      toast({
        title: 'Chave inválida',
        description: MESSAGES.CHAVE_INVALIDA,
        variant: 'destructive',
      });
      return;
    }

    // Evitar submits duplicados
    if (isSubmittingRef.current || isLoading) {
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const entrada = await iniciarRecebimentoPorChaveNFe({
        chaveNFe: chaveLimpa,
        matriculaRecebedor: recebedor.matricula,
        nomeRecebedor: recebedor.nome,
      });

      toast({
        title: 'Recebimento iniciado',
        description: MESSAGES.RECEBIMENTO_INICIADO,
        variant: 'default',
      });

      setChaveNFe('');
      onSuccess(entrada);
      onClose();
    } catch (error: any) {
      console.error('Erro ao iniciar recebimento:', error);

      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        MESSAGES.ERRO_GENERICO;

      toast({
        title: 'Erro ao iniciar recebimento',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }, [recebedor, toast, onSuccess, onClose, isLoading]);

  // Fechar modal
  const handleClose = useCallback(() => {
    if (!isLoading) {
      setChaveNFe('');
      setIsScanning(false);
      onClose();
    }
  }, [isLoading, onClose]);

  // Mudar modo
  const handleModeChange = useCallback((mode: ModalMode) => {
    // Parar scanner ANTES de mudar o modo
    if (mode === MODAL_MODES.MANUAL) {
      setIsScanning(false);
    }
    setModalMode(mode);
    setChaveNFe('');
  }, []);

  // Input manual
  const handleInputChange = useCallback((value: string) => {
    const valorLimpo = limparChave(value);
    setChaveNFe(valorLimpo);
  }, []);

  // Submit manual
  const handleManualSubmit = useCallback(() => {
    if (chaveNFe.trim() && validarChaveNFe(chaveNFe)) {
      handleIniciarRecebimento(chaveNFe);
    }
  }, [chaveNFe, handleIniciarRecebimento]);

  // Input do barcode
  const handleBarcodeInput = useCallback((value: string) => {
    const valorLimpo = limparChave(value);
    setChaveNFe(valorLimpo);

    // Auto-submit quando atingir 44 dígitos (NFe padrao via scanner)
    if (valorLimpo.length === CHAVE_NFE_LENGTH && !isSubmittingRef.current) {
      handleIniciarRecebimento(valorLimpo);
    }
  }, [handleIniciarRecebimento]);

  // Ativar/refocar scanner
  const ativarScanner = useCallback(() => {
    setIsScanning(true);
    barcodeInputRef.current?.focus();
  }, []);

  // Enter no input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && chaveNFe.trim() && validarChaveNFe(chaveNFe)) {
      handleIniciarRecebimento(chaveNFe);
    }
  }, [chaveNFe, handleIniciarRecebimento]);

  return {
    // Estado
    chaveNFe,
    isLoading,
    modalMode,
    isScanning,
    isChaveValida: validarChaveNFe(chaveNFe),

    // Refs
    inputRef,
    barcodeInputRef,

    // Handlers
    handleClose,
    handleModeChange,
    handleInputChange,
    handleManualSubmit,
    handleBarcodeInput,
    handleKeyDown,
    ativarScanner,
  };
};
