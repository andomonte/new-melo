import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Carregamento from '@/utils/carregamento';
import FormInput from '@/components/common/FormInput';
import { Loader2 } from 'lucide-react';
import { DefaultButton } from '@/components/common/Buttons';
import axios from 'axios';

interface SMTPConfig {
  id?: number;
  host: string;
  port: string;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

interface ConfiguracaoSMTPProps {
  onClose?: () => void;
  configId?: number;
  onSalvar?: () => void;
}

const SMTPPageContent = ({ onClose, configId, onSalvar }: ConfiguracaoSMTPProps) => {
  const [config, setConfig] = useState<SMTPConfig>({
    host: '',
    port: '587',
    secure: false,
    user: '',
    pass: '',
    fromEmail: '',
    fromName: 'Melo Peças - NFe',
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [configCarregada, setConfigCarregada] = useState(false);
  const { toast } = useToast();

  // Carregar configuração existente ao abrir
  useEffect(() => {
    if (configId) {
      carregarConfiguracaoPorId(configId);
    } else {
      carregarConfiguracao();
    }
  }, [configId]);

  const carregarConfiguracaoPorId = async (id: number) => {
    setLoading(true);
    try {
      // Buscar todas e filtrar pelo ID
      const response = await axios.get('/api/smtp/config?all=true');
      
      if (response.data.sucesso && response.data.configs) {
        const configEncontrada = response.data.configs.find((c: any) => c.id === id);
        
        if (configEncontrada) {
          setConfig({
            id: configEncontrada.id,
            host: configEncontrada.host,
            port: configEncontrada.port.toString(),
            secure: configEncontrada.secure,
            user: configEncontrada.username,
            pass: '', // Deixar vazio para não exibir senha criptografada
            fromEmail: configEncontrada.from_email,
            fromName: configEncontrada.from_name,
          });
          setConfigCarregada(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarConfiguracao = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/smtp/config');
      
      if (response.data.sucesso && response.data.configuracao) {
        const cfg = response.data.configuracao;
        setConfig({
          id: cfg.id,
          host: cfg.host,
          port: cfg.port.toString(),
          secure: cfg.secure,
          user: cfg.user,
          pass: cfg.passCompleta || '', // Senha completa para edição
          fromEmail: cfg.fromEmail,
          fromName: cfg.fromName,
        });
        setConfigCarregada(true);
        toast({
          title: "Configuração carregada",
          description: "Configuração SMTP carregada com sucesso",
        });
      } else {
        // Nenhuma configuração cadastrada - usar valores padrão
        setConfigCarregada(false);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração SMTP:', error);
      toast({
        title: "Aviso",
        description: "Nenhuma configuração encontrada. Configure o SMTP abaixo.",
        variant: "default",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;

    setConfig(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const salvarConfiguracao = async () => {
    setLoading(true);
    try {
      // Validações
      if (!config.host || !config.port || !config.user || !config.pass || !config.fromEmail || !config.fromName) {
        toast({
          title: "Erro de validação",
          description: "Todos os campos são obrigatórios",
          variant: "destructive",
        });
        return;
      }

      const method = config.id ? 'PUT' : 'POST';
      const response = await axios({
        method,
        url: '/api/smtp/config',
        data: {
          id: config.id,
          host: config.host,
          port: parseInt(config.port),
          secure: config.secure,
          user: config.user,
          pass: config.pass,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
        },
      });

      if (response.data.sucesso) {
        toast({
          title: "Sucesso!",
          description: response.data.mensagem,
        });
        
        // Atualizar ID se for novo cadastro
        if (response.data.configuracao?.id) {
          setConfig(prev => ({
            ...prev,
            id: response.data.configuracao.id
          }));
        }
        
        setConfigCarregada(true);
        
        // Chamar callback se fornecido (para fechar modal na lista)
        if (onSalvar) {
          onSalvar();
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar configuração SMTP:', error);
      toast({
        title: "Erro ao salvar",
        description: error.response?.data?.erro || error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testSMTPConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/faturamento/testar-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailTeste: config.user }),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult(`✅ Sucesso: ${result.message}`);
        toast({
          title: "Teste SMTP",
          description: "Configuração válida e email enviado com sucesso!",
        });
      } else {
        setTestResult(`❌ Erro: ${result.details || result.error}`);
        toast({
          title: "Erro no teste SMTP",
          description: result.details || result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setTestResult(`❌ Erro de conexão: ${errorMsg}`);
      toast({
        title: "Erro de conexão",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading && <Carregamento />}

      {!loading && (
        <div className="space-y-4">
          {/* Configurações do Servidor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              autoComplete="off"
              name="host"
              type="text"
              label="Servidor SMTP"
              value={config.host}
              onChange={handleChange}
              placeholder="smtp.gmail.com"
              required
            />
            
            <FormInput
              autoComplete="off"
              name="port"
              type="text"
              label="Porta"
              value={config.port}
              onChange={handleChange}
              placeholder="587"
              required
            />

            <FormInput
              autoComplete="off"
              name="user"
              type="email"
              label="Email de usuário"
              value={config.user}
              onChange={handleChange}
              placeholder="seu-email@gmail.com"
              required
            />

            <FormInput
              autoComplete="off"
              name="pass"
              type="password"
              label="Senha de App (16 caracteres)"
              value={config.pass}
              onChange={handleChange}
              placeholder="abcd efgh ijkl mnop"
              maxLength={19}
              required
            />

            <FormInput
              autoComplete="off"
              name="fromEmail"
              type="email"
              label="Email remetente"
              value={config.fromEmail}
              onChange={handleChange}
              placeholder="nfe@empresa.com"
              required
            />

            <FormInput
              autoComplete="off"
              name="fromName"
              type="text"
              label="Nome do remetente"
              value={config.fromName}
              onChange={handleChange}
              placeholder="Empresa - NFe"
              required
            />
          </div>

          {/* Checkbox para conexão segura */}
          <div className="flex items-center space-x-3 pt-2">
            <input
              type="checkbox"
              name="secure"
              checked={config.secure}
              onChange={handleChange}
              className="h-4 w-4 text-[#347AB6] focus:ring-[#347AB6] border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Conexão segura (SSL/TLS) - use apenas para porta 465
            </label>
          </div>

          {/* Resultado do teste */}
          {testResult && (
            <div className={`p-4 rounded-md border ${
              testResult.startsWith('✅') 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
            }`}>
              <div className="text-sm font-medium">{testResult}</div>
            </div>
          )}

          {/* Dicas de configuração */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-700">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Dicas de Configuração:
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li><strong>Gmail:</strong> Use smtp.gmail.com, porta 587, e gere uma "Senha de app" nas configurações de segurança</li>
              <li><strong>Outlook/Hotmail:</strong> Use smtp.office365.com, porta 587</li>
              <li><strong>Yahoo:</strong> Use smtp.mail.yahoo.com, porta 587</li>
              <li><strong>Porta 587:</strong> TLS (recomendado) - Secure=false</li>
              <li><strong>Porta 465:</strong> SSL - Secure=true</li>
            </ul>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <DefaultButton
              variant="secondary"
              size="default"
              text={testing ? 'Testando...' : 'Testar Configuração'}
              onClick={testSMTPConnection}
              disabled={testing || !config.host || !config.user || !config.pass}
              icon={testing ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            />
            <DefaultButton
              variant="primary"
              size="default"
              text={loading ? 'Salvando...' : 'Salvar Configuração'}
              onClick={salvarConfiguracao}
              disabled={loading || testing}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SMTPPageContent;
export { SMTPPageContent as ConfiguracaoSMTP };
