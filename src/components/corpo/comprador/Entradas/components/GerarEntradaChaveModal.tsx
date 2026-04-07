/**
 * Modal para gerar entrada de estoque a partir da chave de acesso da NFe.
 * Input simples de 44 dígitos, seguindo padrão do ModalIniciarRecebimento.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, AlertCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';
import RomaneioModal from '@/components/entradas/RomaneioModal';

const CHAVE_NFE_LENGTH = 44;

interface GerarEntradaChaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GerarEntradaChaveModal: React.FC<GerarEntradaChaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [chave, setChave] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [entradaGerada, setEntradaGerada] = useState<{ entradaId: number; numeroEntrada: string } | null>(null);
  const [showRomaneio, setShowRomaneio] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setChave('');
      setErro('');
      setSucesso('');
      setLoading(false);
      setEntradaGerada(null);
      setShowRomaneio(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const isImportacao = chave.startsWith('IMP');
  const chaveValida = isImportacao ? chave.length >= 20 : chave.length === CHAVE_NFE_LENGTH;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Aceitar chaves de importação (prefixo IMP) ou NFe normal (só dígitos)
    const valor = raw.startsWith('IMP') ? raw.slice(0, 50) : raw.replace(/\D/g, '').slice(0, CHAVE_NFE_LENGTH);
    setChave(valor);
    setErro('');
    setSucesso('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && chaveValida && !loading) {
      handleConfirmar();
    }
  };

  const handleConfirmar = async () => {
    if (!chaveValida) {
      setErro(isImportacao ? 'Chave de importação inválida.' : `A chave deve ter exatamente ${CHAVE_NFE_LENGTH} dígitos.`);
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const res = await api.post('/api/entradas/gerar-por-chave', { chaveNFe: chave });
      setSucesso(res.data.message || 'Entrada gerada com sucesso!');
      setEntradaGerada({
        entradaId: res.data.entradaId,
        numeroEntrada: res.data.numeroEntrada,
      });
      setShowRomaneio(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao gerar entrada.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {!showRomaneio && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-[#347AB6]" />
                <h3 className="text-lg font-bold text-[#347AB6]">Gerar Entrada</h3>
              </div>
              <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Digite ou cole a chave de acesso da NFe ({CHAVE_NFE_LENGTH} digitos) ou chave de importacao (prefixo IMP).
                  Somente NFes ja processadas podem ter entrada gerada.
                </p>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chave de Acesso da NFe
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={chave}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  maxLength={50}
                  placeholder="Digite ou cole os 44 digitos ou chave IMP..."
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm font-mono bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
                  disabled={loading}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${chaveValida ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {chave.length}{isImportacao ? ' chars (importação)' : `/${CHAVE_NFE_LENGTH} digitos`}
                  </span>
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{erro}</p>
                </div>
              )}

              {/* Sucesso */}
              {sucesso && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">{sucesso}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-zinc-700">
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmar}
                disabled={!chaveValida || loading}
                className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1" />
                    Gerando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRomaneio && entradaGerada && (
        <RomaneioModal
          open={showRomaneio}
          entradaId={entradaGerada.entradaId}
          numeroEntrada={entradaGerada.numeroEntrada}
          obrigatorio={true}
          onSalvoComSucesso={() => {
            setShowRomaneio(false);
            onSuccess();
            onClose();
          }}
        />
      )}
    </>
  );
};
