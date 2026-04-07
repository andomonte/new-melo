/**
 * Tela de Login para o modulo de Recebimento de Entradas
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DefaultButton } from '@/components/common/Buttons';
import { loginRecebedor, Recebedor } from '@/data/recebimento-entrada/recebimentoEntradaService';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, User, Lock, Building, Package } from 'lucide-react';

interface LoginRecebimentoProps {
  onLoginSuccess: (recebedor: Recebedor) => void;
}

const LoginRecebimento: React.FC<LoginRecebimentoProps> = ({ onLoginSuccess }) => {
  const [matricula, setMatricula] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [filial, setFilial] = useState('MANAUS');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { dismiss, toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dismiss();

    if (!matricula.trim() || !codigoAcesso.trim()) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Por favor, preencha matricula e codigo de acesso.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const recebedor = await loginRecebedor(
        matricula.trim(),
        codigoAcesso.trim(),
        filial,
      );

      toast({
        title: 'Login realizado com sucesso',
        description: `Bem-vindo(a), ${recebedor.nome}!`,
        variant: 'default',
      });

      onLoginSuccess(recebedor);
    } catch (error) {
      console.error('Erro no login:', error);
      toast({
        title: 'Erro no login',
        description: 'Matricula ou codigo de acesso invalidos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Recebimento de Entradas
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Faca login para conferir o recebimento fisico de mercadorias
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="matricula"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Matricula
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="matricula"
                  name="matricula"
                  type="text"
                  required
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="pl-10"
                  placeholder="Digite sua matricula"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="filial"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Filial
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="filial"
                  name="filial"
                  value={filial}
                  onChange={(e) => setFilial(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={isLoading}
                >
                  <option value="MANAUS">Manaus</option>
                  <option value="RORAIMA">Boa Vista / Roraima</option>
                  <option value="RONDONIA">Porto Velho / Rondonia</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="codigoAcesso"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Codigo de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="codigoAcesso"
                  name="codigoAcesso"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={codigoAcesso}
                  onChange={(e) => setCodigoAcesso(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Digite seu codigo de acesso"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <DefaultButton
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              text={isLoading ? 'Entrando...' : 'Entrar'}
              disabled={isLoading}
              variant="primary"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginRecebimento;
