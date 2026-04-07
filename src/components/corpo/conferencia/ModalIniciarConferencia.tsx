import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DefaultButton } from '@/components/common/Buttons';
import {
  iniciarConferencia,
  IniciarConferenciaPayload,
  Conferente,
} from '@/data/conferencia/conferenciaService';
import { useToast } from '@/hooks/use-toast';
import { Package, AlertCircle } from 'lucide-react';

interface ModalIniciarConferenciaProps {
  isOpen: boolean;
  onClose: () => void;
  conferente: Conferente;
  onSuccess: () => void;
}

const ModalIniciarConferencia: React.FC<ModalIniciarConferenciaProps> = ({
  isOpen,
  onClose,
  conferente,
  onSuccess,
}) => {
  const [codVenda, setCodVenda] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleButtonClick = async () => {
    if (!codVenda.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, digite o código da venda.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload: IniciarConferenciaPayload = {
        codVenda: codVenda.trim(),
        matriculaConferente: conferente.matricula,
        nomeConferente: conferente.nome,
      };

      await iniciarConferencia(payload);

      toast({
        title: 'Conferência iniciada',
        description: `Pedido ${codVenda} foi atribuído para conferência.`,
        variant: 'default',
      });

      setCodVenda('');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao iniciar conferência:', error);
      toast({
        title: 'Erro ao iniciar conferência',
        description:
          'Não foi possível iniciar a conferência. Verifique o código da venda.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCodVenda('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Iniciar Nova Conferência
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleButtonClick();
          }}
          className="space-y-4"
        >
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Atenção:</p>
                <p>
                  Digite o código da venda que você deseja conferir. O pedido
                  será atribuído a você e entrará no status &ldquo;Em
                  Conferência&rdquo;.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="codVenda"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Código da Venda
            </label>
            <Input
              id="codVenda"
              type="text"
              value={codVenda}
              onChange={(e) => setCodVenda(e.target.value)}
              placeholder="Digite o código da venda"
              disabled={isLoading}
              className="w-full"
              autoFocus
            />
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>
                <strong>Conferente:</strong> {conferente.nome}
              </p>
              <p>
                <strong>Matrícula:</strong> {conferente.matricula}
              </p>
            </div>
          </div>
        </form>

        <DialogFooter className="flex gap-2">
          <DefaultButton
            text="Cancelar"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          />
          <DefaultButton
            text={isLoading ? 'Iniciando...' : 'Iniciar Conferência'}
            variant="primary"
            onClick={handleButtonClick}
            disabled={isLoading || !codVenda.trim()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalIniciarConferencia;
