/**
 * Login do Recebimento de Entradas — mesmo modelo das estações de Separação/Conferência:
 * a FILIAL vem do link (/entrada/recebimento/1 = MANAUS) e não é escolhida aqui; o
 * recebedor entra com MATRÍCULA + CÓDIGO pessoal. No primeiro acesso (código ainda
 * igual à matrícula) a tela obriga a criar o código.
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DefaultButton } from '@/components/common/Buttons';
import {
  loginRecebedor,
  criarCodigoRecebedor,
  Recebedor,
} from '@/data/recebimento-entrada/recebimentoEntradaService';
import { Eye, EyeOff, User, Lock, Building, Package } from 'lucide-react';

interface LoginRecebimentoProps {
  filial: string;
  onLoginSuccess: (recebedor: Recebedor) => void;
  /** link sem número: permite voltar e escolher outra filial */
  onTrocarFilial?: () => void;
  /** reaproveitado pela Alocação: título, texto e chamadas próprias */
  titulo?: string;
  subtitulo?: string;
  fazerLogin?: (matricula: string, codigo: string) => Promise<Recebedor>;
  criarCodigo?: (matricula: string, novoCodigo: string) => Promise<void>;
}

const erroDe = (e: any, padrao: string) => e?.response?.data?.error || padrao;

const LoginRecebimento: React.FC<LoginRecebimentoProps> = ({
  filial,
  onLoginSuccess,
  onTrocarFilial,
  titulo = 'Recebimento de Entradas',
  subtitulo = 'Informe sua matrícula e seu código para conferir o recebimento físico',
  fazerLogin = loginRecebedor,
  criarCodigo: criarCodigoApi = criarCodigoRecebedor,
}) => {
  const [matricula, setMatricula] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState('');

  // primeiro acesso
  const [primeiro, setPrimeiro] = useState<Recebedor | null>(null);
  const [novo, setNovo] = useState('');
  const [conf, setConf] = useState('');
  const [erroNovo, setErroNovo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!matricula.trim()) {
      setErro('Informe a matrícula.');
      return;
    }
    setIsLoading(true);
    try {
      const r = await fazerLogin(matricula.trim(), codigoAcesso.trim());
      if (r.primeiroAcesso) {
        setPrimeiro(r);
        setNovo('');
        setConf('');
        setErroNovo('');
        return;
      }
      onLoginSuccess(r);
    } catch (err) {
      setErro(erroDe(err, 'Matrícula ou código de acesso inválidos.'));
    } finally {
      setIsLoading(false);
    }
  };

  const criarCodigo = async () => {
    if (!primeiro) return;
    setErroNovo('');
    if (novo.trim().length < 4) return setErroNovo('O código deve ter ao menos 4 dígitos.');
    if (novo.trim() === primeiro.matricula) return setErroNovo('O código não pode ser igual à matrícula.');
    if (novo.trim() !== conf.trim()) return setErroNovo('A confirmação não confere.');
    setIsLoading(true);
    try {
      await criarCodigoApi(primeiro.matricula, novo.trim());
      const r = primeiro;
      setPrimeiro(null);
      onLoginSuccess({ matricula: r.matricula, nome: r.nome });
    } catch (err) {
      setErroNovo(erroDe(err, 'Não foi possível criar o código.'));
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
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">{titulo}</h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {subtitulo}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm">
              <Building className="h-5 w-5 text-gray-400" />
              <span className="text-gray-500">Filial:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{filial}</span>
              {onTrocarFilial && (
                <button type="button" onClick={onTrocarFilial} className="ml-auto text-emerald-700 hover:underline text-xs">
                  trocar
                </button>
              )}
            </div>

            <div>
              <label htmlFor="matricula" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={matricula}
                  onChange={(e) => {
                    setMatricula(e.target.value);
                    setErro('');
                  }}
                  className="pl-10"
                  placeholder="Digite sua matrícula"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="codigoAcesso" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código de acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="codigoAcesso"
                  name="codigoAcesso"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  value={codigoAcesso}
                  onChange={(e) => {
                    setCodigoAcesso(e.target.value);
                    setErro('');
                  }}
                  className="pl-10 pr-10"
                  placeholder="Seu código (no primeiro acesso, deixe em branco)"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Esconder código' : 'Mostrar código'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {erro && <div className="text-sm font-semibold text-red-600">{erro}</div>}
          </div>

          <DefaultButton
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            text={isLoading ? 'Entrando...' : 'Entrar'}
            disabled={isLoading}
            variant="primary"
          />
        </form>
      </div>

      {/* Primeiro acesso: criar o código pessoal */}
      {primeiro && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Primeiro acesso</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {primeiro.nome}, crie seu código de acesso pessoal (mínimo 4 dígitos, diferente da matrícula).
              </p>
            </div>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              autoFocus
              placeholder="Novo código"
              value={novo}
              onChange={(e) => {
                setNovo(e.target.value);
                setErroNovo('');
              }}
            />
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="Confirme o código"
              value={conf}
              onChange={(e) => {
                setConf(e.target.value);
                setErroNovo('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') criarCodigo();
              }}
            />
            {erroNovo && <div className="text-sm font-semibold text-red-600">{erroNovo}</div>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPrimeiro(null)}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={criarCodigo}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                disabled={isLoading}
              >
                {isLoading ? 'Salvando...' : 'Criar código e entrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginRecebimento;
