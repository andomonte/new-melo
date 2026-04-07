import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DefaultButton } from '@/components/common/Buttons';
import {
  loginConferente,
  Conferente,
} from '@/data/conferencia/conferenciaService';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, User, Building } from 'lucide-react';

interface LoginConferenciaProps {
  onLoginSuccess: (conferente: Conferente) => void;
}

const LoginConferencia: React.FC<LoginConferenciaProps> = ({
  onLoginSuccess,
}) => {
  const [matricula, setMatricula] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [filial, setFilial] = useState('MANAUS'); // Default MANAUS
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!matricula.trim() || !codigoAcesso.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha a matrícula e o código de acesso.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const conferente = await loginConferente(
        matricula.trim(),
        codigoAcesso.trim(),
        filial, // Enviar filial selecionada
      );

      toast({
        title: 'Login realizado com sucesso',
        description: `Bem-vindo(a) ao painel de conferência, ${conferente.nome}!`,
        variant: 'default',
      });

      onLoginSuccess(conferente);
    } catch (error) {
      console.error('Erro no login:', error);
      toast({
        title: 'Erro no login',
        description:
          'Matrícula ou código de acesso inválido. Verifique e tente novamente.',
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
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sistema de Conferência
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Digite sua matrícula e código de acesso para continuar
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="matricula"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Matrícula
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
                  placeholder="Digite sua matrícula"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="codigoAcesso"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Código de Acesso
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
                  placeholder="Digite seu código de acesso"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  <option value="MANAUS">Manaus</option>
                  <option value="RORAIMA">Boa Vista / Roraima</option>
                  <option value="RONDONIA">Porto Velho / Rondônia</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <DefaultButton
              type="submit"
              className="w-full"
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

export default LoginConferencia;
