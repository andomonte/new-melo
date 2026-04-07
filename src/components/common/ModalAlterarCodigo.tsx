import React, { useState } from 'react';
import { DefaultButton } from '@/components/common/Buttons';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { alterarCodigoAcesso } from '@/data/separacao/separacaoService';
import { Eye, EyeOff, X, Key } from 'lucide-react';

interface ModalAlterarCodigoProps {
  isOpen: boolean;
  onClose: () => void;
  matricula: string;
  nome: string;
}

/**
 * Modal para alterar código de acesso
 *
 * Permite que o usuário altere seu código de acesso fornecendo:
 * - Código atual (para validação)
 * - Novo código (mínimo 4 caracteres)
 * - Confirmação do novo código
 */
const ModalAlterarCodigo: React.FC<ModalAlterarCodigoProps> = ({
  isOpen,
  onClose,
  matricula,
  nome,
}) => {
  const [codigoAtual, setCodigoAtual] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [confirmarCodigo, setConfirmarCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCodigoAtual, setShowCodigoAtual] = useState(false);
  const [showNovoCodigo, setShowNovoCodigo] = useState(false);
  const [showConfirmarCodigo, setShowConfirmarCodigo] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!codigoAtual.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, informe o código atual.',
        variant: 'destructive',
      });
      return;
    }

    if (!novoCodigo.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, informe o novo código.',
        variant: 'destructive',
      });
      return;
    }

    if (novoCodigo.length < 4) {
      toast({
        title: 'Código inválido',
        description: 'O novo código deve ter pelo menos 4 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (novoCodigo !== confirmarCodigo) {
      toast({
        title: 'Códigos não conferem',
        description: 'O novo código e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    if (codigoAtual === novoCodigo) {
      toast({
        title: 'Código inalterado',
        description: 'O novo código deve ser diferente do código atual.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await alterarCodigoAcesso(
        matricula,
        codigoAtual.trim(),
        novoCodigo.trim(),
      );

      toast({
        title: 'Código alterado com sucesso',
        description: 'Seu código de acesso foi atualizado.',
        variant: 'default',
      });

      // Limpar formulário e fechar modal
      setCodigoAtual('');
      setNovoCodigo('');
      setConfirmarCodigo('');
      onClose();
    } catch (error: any) {
      console.error('Erro ao alterar código:', error);

      let errorMessage = 'Erro interno do servidor. Tente novamente.';

      if (error?.response?.status === 401) {
        errorMessage = 'Código atual incorreto.';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Erro ao alterar código',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCodigoAtual('');
      setNovoCodigo('');
      setConfirmarCodigo('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Alterar Código de Acesso
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações do usuário */}
        <div className="mb-6 p-3 bg-gray-50 dark:bg-zinc-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Alterando código para:
          </p>
          <p className="font-medium text-gray-900 dark:text-white">
            {nome} • Matrícula: {matricula}
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Código Atual */}
          <div>
            <label
              htmlFor="codigoAtual"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Código Atual
            </label>
            <div className="relative">
              <Input
                id="codigoAtual"
                type={showCodigoAtual ? 'text' : 'password'}
                value={codigoAtual}
                onChange={(e) => setCodigoAtual(e.target.value)}
                placeholder="Digite seu código atual"
                disabled={isLoading}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCodigoAtual(!showCodigoAtual)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showCodigoAtual ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Novo Código */}
          <div>
            <label
              htmlFor="novoCodigo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Novo Código
            </label>
            <div className="relative">
              <Input
                id="novoCodigo"
                type={showNovoCodigo ? 'text' : 'password'}
                value={novoCodigo}
                onChange={(e) => setNovoCodigo(e.target.value)}
                placeholder="Digite o novo código (mín. 4 caracteres)"
                disabled={isLoading}
                className="pr-10"
                required
                minLength={4}
              />
              <button
                type="button"
                onClick={() => setShowNovoCodigo(!showNovoCodigo)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showNovoCodigo ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Confirmar Código */}
          <div>
            <label
              htmlFor="confirmarCodigo"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Confirmar Novo Código
            </label>
            <div className="relative">
              <Input
                id="confirmarCodigo"
                type={showConfirmarCodigo ? 'text' : 'password'}
                value={confirmarCodigo}
                onChange={(e) => setConfirmarCodigo(e.target.value)}
                placeholder="Confirme o novo código"
                disabled={isLoading}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmarCodigo(!showConfirmarCodigo)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showConfirmarCodigo ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <DefaultButton
              type="button"
              text="Cancelar"
              variant="secondary"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            />
            <DefaultButton
              type="submit"
              text={isLoading ? 'Alterando...' : 'Alterar Código'}
              variant="primary"
              disabled={isLoading}
              className="flex-1"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalAlterarCodigo;
