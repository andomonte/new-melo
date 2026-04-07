import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { DefaultButton } from '@/components/common/Buttons';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, X, Type, QrCode } from 'lucide-react';
import { alterarCodigoAcesso } from '@/data/separacao/separacaoService';

// Tipos e constantes
interface ModalAlterarCodigoProps {
  isOpen: boolean;
  onClose: () => void;
  matricula: string;
  nomeFuncionario: string;
}

type InputMode = 'manual' | 'qr';

interface ValidationError {
  field: string;
  message: string;
}

// Constantes de validação
const VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: 4,
  PASSWORD_REGEX: /^[a-zA-Z0-9]{4,}$/,
} as const;

// Mensagens de erro padronizadas
const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'Este campo é obrigatório',
  MIN_LENGTH: `O código deve ter pelo menos ${VALIDATION_RULES.MIN_PASSWORD_LENGTH} caracteres`,
  PASSWORDS_MISMATCH: 'Os códigos não conferem',
  INVALID_FORMAT: 'Código deve conter apenas letras e números',
} as const;

/**
 * Modal para alteração de código de acesso dos funcionários do estoque
 *
 * Funcionalidades:
 * - Digitação manual do código (modo padrão)
 * - Leitura via QR Code (modo opcional)
 * - Validação em tempo real
 * - Feedback visual completo
 *
 * @param props - Propriedades do componente
 */
const ModalAlterarCodigo: React.FC<ModalAlterarCodigoProps> = ({
  isOpen,
  onClose,
  matricula,
  nomeFuncionario,
}) => {
  // Estados do formulário
  const [formData, setFormData] = useState({
    codigoAtual: '',
    novoCodigoAcesso: '',
    confirmarCodigo: '',
  });

  // Estados de UI
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    atual: false,
    novo: false,
    confirmar: false,
  });

  // Estados de validação
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );

  const { dismiss, toast } = useToast();

  /**
   * Validações de entrada
   */
  const validateField = useCallback(
    (field: string, value: string): string | null => {
      switch (field) {
        case 'codigoAtual':
          if (!value.trim()) return ERROR_MESSAGES.REQUIRED_FIELD;
          if (value.length < VALIDATION_RULES.MIN_PASSWORD_LENGTH)
            return ERROR_MESSAGES.MIN_LENGTH;
          if (!VALIDATION_RULES.PASSWORD_REGEX.test(value))
            return ERROR_MESSAGES.INVALID_FORMAT;
          return null;

        case 'novoCodigoAcesso':
          if (!value.trim()) return ERROR_MESSAGES.REQUIRED_FIELD;
          if (value.length < VALIDATION_RULES.MIN_PASSWORD_LENGTH)
            return ERROR_MESSAGES.MIN_LENGTH;
          if (!VALIDATION_RULES.PASSWORD_REGEX.test(value))
            return ERROR_MESSAGES.INVALID_FORMAT;
          return null;

        case 'confirmarCodigo':
          if (!value.trim()) return ERROR_MESSAGES.REQUIRED_FIELD;
          if (value !== formData.novoCodigoAcesso)
            return ERROR_MESSAGES.PASSWORDS_MISMATCH;
          return null;

        default:
          return null;
      }
    },
    [formData.novoCodigoAcesso],
  );

  /**
   * Valida todos os campos do formulário
   */
  const validateForm = useCallback((): boolean => {
    const errors: ValidationError[] = [];

    Object.entries(formData).forEach(([field, value]) => {
      const error = validateField(field, value);
      if (error) {
        errors.push({ field, message: error });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  }, [formData, validateField]);

  /**
   * Obtém erro de validação para um campo específico
   */
  const getFieldError = useCallback(
    (field: string): string | undefined => {
      return validationErrors.find((error) => error.field === field)?.message;
    },
    [validationErrors],
  );

  /**
   * Atualiza valores do formulário com validação em tempo real
   */
  const updateFormField = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Remove erro do campo quando o usuário começa a digitar
      setValidationErrors((prev) =>
        prev.filter((error) => error.field !== field),
      );
    },
    [],
  );

  /**
   * Alterna visibilidade da senha
   */
  const togglePasswordVisibility = useCallback(
    (field: 'novo' | 'confirmar') => {
      setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
    },
    [],
  );

  /**
   * Reseta o estado do modal
   */
  const resetModal = useCallback(() => {
    setFormData({ codigoAtual: '', novoCodigoAcesso: '', confirmarCodigo: '' });
    setInputMode('manual');
    setShowPasswords({ atual: false, novo: false, confirmar: false });
    setValidationErrors([]);
    setIsLoading(false);
  }, []);

  /**
   * Manipula o fechamento do modal
   */
  const handleClose = useCallback(() => {
    if (!isLoading) {
      resetModal();
      onClose();
    }
  }, [isLoading, resetModal, onClose]);

  /**
   * Manipula a submissão do formulário
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dismiss(); // Dismiss any existing toasts

      if (!validateForm()) {
        toast({
          title: 'Dados inválidos',
          description: 'Por favor, corrija os erros antes de continuar.',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(true);

      try {
        await alterarCodigoAcesso(
          matricula,
          formData.codigoAtual,
          formData.novoCodigoAcesso,
        );

        toast({
          title: 'Código alterado com sucesso',
          description: 'Seu código de acesso foi atualizado.',
          variant: 'default',
        });

        handleClose();
      } catch (error) {
        console.error('Erro ao alterar código:', error);

        toast({
          title: 'Erro ao alterar código',
          description:
            'Não foi possível alterar o código de acesso. Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData, matricula, validateForm, toast, handleClose],
  );

  // Não renderiza se o modal não estiver aberto
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Alterar Código de Acesso
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              <strong>{nomeFuncionario}</strong> • Matrícula: {matricula}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6">
          {/* Seleção de Modo de Entrada */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Como deseja definir o novo código?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                disabled={isLoading}
                className={`flex items-center justify-center p-3 border-2 rounded-lg transition-all ${
                  inputMode === 'manual'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Type className="w-4 h-4 mr-2" />
                <span className="font-medium text-sm">Digitar</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMode('qr')}
                disabled={isLoading}
                className={`flex items-center justify-center p-3 border-2 rounded-lg transition-all ${
                  inputMode === 'qr'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <QrCode className="w-4 h-4 mr-2" />
                <span className="font-medium text-sm">QR Code</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Novo Código */}
            {inputMode === 'manual' && (
              <>
                <div>
                  <label
                    htmlFor="codigoAtual"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Código Atual *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="codigoAtual"
                      type={showPasswords.atual ? 'text' : 'password'}
                      required
                      value={formData.codigoAtual}
                      onChange={(e) =>
                        updateFormField('codigoAtual', e.target.value)
                      }
                      className={`pl-10 pr-10 ${
                        getFieldError('codigoAtual')
                          ? 'border-red-500 focus:border-red-500'
                          : ''
                      }`}
                      placeholder="Digite o código atual"
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          atual: !prev.atual,
                        }))
                      }
                      disabled={isLoading}
                    >
                      {showPasswords.atual ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {getFieldError('codigoAtual') && (
                    <p className="mt-1 text-sm text-red-600">
                      {getFieldError('codigoAtual')}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="novoCodigo"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Novo Código de Acesso *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="novoCodigo"
                      type={showPasswords.novo ? 'text' : 'password'}
                      required
                      value={formData.novoCodigoAcesso}
                      onChange={(e) =>
                        updateFormField('novoCodigoAcesso', e.target.value)
                      }
                      className={`pl-10 pr-10 ${
                        getFieldError('novoCodigoAcesso')
                          ? 'border-red-500 focus:border-red-500'
                          : ''
                      }`}
                      placeholder="Digite o novo código (mín. 4 caracteres)"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => togglePasswordVisibility('novo')}
                      disabled={isLoading}
                      aria-label={
                        showPasswords.novo ? 'Ocultar código' : 'Mostrar código'
                      }
                    >
                      {showPasswords.novo ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  {getFieldError('novoCodigoAcesso') && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {getFieldError('novoCodigoAcesso')}
                    </p>
                  )}
                </div>

                {/* Campo Confirmar Código */}
                <div>
                  <label
                    htmlFor="confirmarCodigo"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Confirmar Novo Código *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="confirmarCodigo"
                      type={showPasswords.confirmar ? 'text' : 'password'}
                      required
                      value={formData.confirmarCodigo}
                      onChange={(e) =>
                        updateFormField('confirmarCodigo', e.target.value)
                      }
                      className={`pl-10 pr-10 ${
                        getFieldError('confirmarCodigo')
                          ? 'border-red-500 focus:border-red-500'
                          : ''
                      }`}
                      placeholder="Digite novamente o novo código"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => togglePasswordVisibility('confirmar')}
                      disabled={isLoading}
                      aria-label={
                        showPasswords.confirmar
                          ? 'Ocultar código'
                          : 'Mostrar código'
                      }
                    >
                      {showPasswords.confirmar ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  {getFieldError('confirmarCodigo') && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {getFieldError('confirmarCodigo')}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Área QR Code */}
            {inputMode === 'qr' && (
              <div className="text-center py-8">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 mb-4">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Funcionalidade de QR Code
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Esta funcionalidade será implementada em breve
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  Voltar para digitação manual
                </button>
              </div>
            )}

            {/* Dica de Segurança */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Dica:</strong> Use um código fácil de lembrar, mas
                difícil de adivinhar. Combine letras e números para maior
                segurança.
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <DefaultButton
                type="button"
                className="flex-1 order-2 sm:order-1"
                text="Cancelar"
                onClick={handleClose}
                disabled={isLoading}
                variant="secondary"
              />
              {inputMode === 'manual' && (
                <DefaultButton
                  type="submit"
                  className="flex-1 order-1 sm:order-2"
                  text={isLoading ? 'Alterando...' : 'Alterar Código'}
                  disabled={
                    isLoading ||
                    !formData.novoCodigoAcesso ||
                    !formData.confirmarCodigo
                  }
                  variant="primary"
                />
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalAlterarCodigo;
