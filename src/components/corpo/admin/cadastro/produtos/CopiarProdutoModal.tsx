import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Produto } from '@/data/produtos/produtos';
import { Copy, Loader2 } from 'lucide-react';

interface CopiarProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  produtoOriginal: Produto | null;
  onSuccess: (produtoCopiado: Produto) => void;
}

export const CopiarProdutoModal: React.FC<CopiarProdutoModalProps> = ({
  isOpen,
  onClose,
  produtoOriginal,
  onSuccess,
}) => {
  const [novaRef, setNovaRef] = useState('');
  const [novoCodigoBarras, setNovoCodigoBarras] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCopiar = async () => {
    if (!produtoOriginal) return;

    if (!novaRef.trim()) {
      toast({
        title: 'Referência obrigatória',
        description: 'Informe uma nova referência para o produto copiado.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Validar se a nova referência já existe
      const validacaoRef = await fetch('/api/produtos/validar-referencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: novaRef }),
      });

      const resultadoValidacao = await validacaoRef.json();

      if (resultadoValidacao.resultado === 'NOK') {
        toast({
          title: 'Referência duplicada',
          description: resultadoValidacao.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Preparar dados do produto copiado
      const produtoCopiado = {
        ...produtoOriginal,
        // Remover campos únicos
        codprod: undefined, // Será gerado automaticamente
        ref: novaRef.trim().toUpperCase(),
        codbar: novoCodigoBarras.trim() || null,
        // Resetar alguns campos
        qtest: 0,
        qtdreservada: 0,
        qtest_filial: 0,
      };

      // Enviar para API de cadastro
      const response = await fetch('/api/produtos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(produtoCopiado),
      });

      if (!response.ok) {
        throw new Error('Erro ao copiar produto');
      }

      const resultado = await response.json();

      toast({
        title: 'Produto copiado com sucesso!',
        description: `Novo código: ${resultado.data.codprod}`,
      });

      // Resetar campos
      setNovaRef('');
      setNovoCodigoBarras('');

      onSuccess(resultado.data);
      onClose();
    } catch (error: any) {
      console.error('Erro ao copiar produto:', error);
      toast({
        title: 'Erro ao copiar produto',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNovaRef('');
      setNovoCodigoBarras('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copiar Produto
          </DialogTitle>
          <DialogDescription>
            Criar uma cópia do produto{' '}
            <strong>
              {produtoOriginal?.codprod} - {produtoOriginal?.descr}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="novaRef">
              Nova Referência <span className="text-red-500">*</span>
            </Label>
            <Input
              id="novaRef"
              value={novaRef}
              onChange={(e) => setNovaRef(e.target.value.toUpperCase())}
              placeholder="Digite a nova referência"
              maxLength={20}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Referência original: <strong>{produtoOriginal?.ref || '-'}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="novoCodigoBarras">Novo Código de Barras (opcional)</Label>
            <Input
              id="novoCodigoBarras"
              value={novoCodigoBarras}
              onChange={(e) => setNovoCodigoBarras(e.target.value)}
              placeholder="Digite o novo código de barras"
              maxLength={15}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Código original: <strong>{produtoOriginal?.codbar || '-'}</strong>
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Atenção:</strong> Todos os dados do produto original serão copiados, exceto:
              <ul className="list-disc list-inside mt-1 text-xs">
                <li>Código do produto (gerado automaticamente)</li>
                <li>Referência e código de barras (você definirá novos)</li>
                <li>Estoque (será zerado)</li>
              </ul>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCopiar} disabled={loading || !novaRef.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Copiando...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Produto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
