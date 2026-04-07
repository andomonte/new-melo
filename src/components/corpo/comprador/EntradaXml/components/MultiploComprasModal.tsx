import React, { useState, useEffect } from 'react';
import { X, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMultiploCompras } from '../hooks/useMultiploCompras';

interface OrdemCompraDisponivel {
  id: string;
  codigo_requisicao: string;
  filial: string;
  fornecedor: string;
  produto_id: string;
  produto_descricao: string;
  quantidade_pedida: number;
  quantidade_disponivel: number;
  valor_unitario: string | number;
  data_previsao?: string;
}

interface MultiploComprasModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemCompraDisponivel;
  onConfirm: () => void;
}

export const MultiploComprasModal: React.FC<MultiploComprasModalProps> = ({
  isOpen,
  onClose,
  ordem,
  onConfirm
}) => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState<number>(ordem.quantidade_pedida);
  const [erro, setErro] = useState('');

  const { alterarQuantidadeOrdem, loading, validarAlteracao } = useMultiploCompras();

  // Reset form quando abrir
  useEffect(() => {
    if (isOpen) {
      setUsuario('');
      setSenha('');
      setNovaQuantidade(ordem.quantidade_pedida);
      setErro('');
    }
  }, [isOpen, ordem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    try {
      // Validações locais
      if (!usuario.trim()) {
        setErro('Usuário é obrigatório');
        return;
      }

      if (!senha.trim()) {
        setErro('Senha é obrigatória');
        return;
      }

      // Validar alteração usando o hook
      const validation = validarAlteracao(ordem.quantidade_pedida, novaQuantidade);
      if (!validation.isValid) {
        setErro(validation.errors[0]);
        return;
      }

      // Chamar API através do hook
      const result = await alterarQuantidadeOrdem({
        ordemId: ordem.id,
        produtoId: ordem.produto_id,
        novaQuantidade,
        usuario: usuario.trim(),
        senha
      });

      if (result.success) {
        onConfirm();
      } else {
        setErro(result.message || 'Erro na alteração da quantidade');
      }

    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro interno do servidor');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Múltiplo de Compras
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Ordem: {ordem.codigo_requisicao} - {ordem.produto_descricao}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Informações da Ordem */}
            <div className="bg-gray-50 dark:bg-zinc-700 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Quantidade Atual:</span>
                <span className="font-medium">{ordem.quantidade_pedida}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Quantidade Disponível:</span>
                <span className="font-medium">{ordem.quantidade_disponivel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Valor Unitário:</span>
                <span className="font-medium">
                  R$ {typeof ordem.valor_unitario === 'number'
                    ? ordem.valor_unitario.toFixed(2)
                    : parseFloat(ordem.valor_unitario || '0').toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Fornecedor:</span>
                <span className="font-medium">{ordem.fornecedor}</span>
              </div>
            </div>

            {/* Nova Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nova Quantidade
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={novaQuantidade}
                onChange={(e) => setNovaQuantidade(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              {novaQuantidade !== ordem.quantidade_pedida && (
                <p className="text-xs mt-1 text-blue-600">
                  Alteração: {ordem.quantidade_pedida} → {novaQuantidade}
                  ({novaQuantidade > ordem.quantidade_pedida ? '+' : ''}{novaQuantidade - ordem.quantidade_pedida})
                </p>
              )}
            </div>

            {/* Autenticação */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Autenticação Necessária
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                    placeholder="Digite seu usuário"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                    placeholder="Digite sua senha"
                  />
                </div>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
                {erro}
              </div>
            )}

            {/* Informações importantes */}
            <div className="bg-yellow-50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 p-3 rounded-md text-sm">
              <p className="font-medium mb-1">⚠️ Atenção:</p>
              <p>Esta operação alterará a quantidade da ordem de compra e requer autorização de gerente.</p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-600">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            <X size={16} className="mr-2" />
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={loading || !usuario.trim() || !senha.trim() || novaQuantidade <= 0}
            className="bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
            <Settings size={16} className="mr-2" />
            {loading ? 'Processando...' : 'Alterar Quantidade'}
          </Button>
        </div>
      </div>
    </div>
  );
};