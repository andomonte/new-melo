import React, { useState } from 'react';

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export const SMTPconfig = () => {
  const [config, setConfig] = useState<SMTPConfig>({
    host: process.env.NEXT_PUBLIC_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.NEXT_PUBLIC_SMTP_PORT || '587'),
    secure: process.env.NEXT_PUBLIC_SMTP_SECURE === 'true',
    user: process.env.NEXT_PUBLIC_SMTP_USER || '',
    pass: '',
    fromEmail: process.env.NEXT_PUBLIC_EMAIL_FROM || '',
    fromName: process.env.NEXT_PUBLIC_EMAIL_FROM_NAME || 'Melo Peças - NFe',
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleInputChange = (
    field: keyof SMTPConfig,
    value: string | number | boolean,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
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
      } else {
        setTestResult(`❌ Erro: ${result.details || result.error}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Erro de conexão: ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`,
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        📧 Configuração SMTP para Envio de NFe
      </h1>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Servidor SMTP
            </label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Porta
            </label>
            <input
              type="number"
              value={config.port}
              onChange={(e) =>
                handleInputChange('port', parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="587"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email de usuário
            </label>
            <input
              type="email"
              value={config.user}
              onChange={(e) => handleInputChange('user', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="seu-email@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha de App (16 caracteres)
            </label>
            <input
              type="password"
              value={config.pass}
              onChange={(e) => handleInputChange('pass', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="abcd efgh ijkl mnop"
              maxLength={16}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email remetente
            </label>
            <input
              type="email"
              value={config.fromEmail}
              onChange={(e) => handleInputChange('fromEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="nfe@empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do remetente
            </label>
            <input
              type="text"
              value={config.fromName}
              onChange={(e) => handleInputChange('fromName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Empresa - NFe"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={config.secure}
            onChange={(e) => handleInputChange('secure', e.target.checked)}
            className="mr-2"
          />
          <label className="text-sm text-gray-700">
            Conexão segura (SSL/TLS) - use apenas para porta 465
          </label>
        </div>

        <div className="pt-4 border-t">
          <button
            onClick={testSMTPConnection}
            disabled={testing}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            {testing ? '🔄 Testando...' : '🧪 Testar Configuração'}
          </button>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-md ${
                testResult.startsWith('✅')
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
              }`}
            >
              {testResult}
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="font-medium text-gray-800 mb-2">
            📋 Variáveis de ambiente atuais:
          </h3>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap">
            {`SMTP_HOST=${config.host}
SMTP_PORT=${config.port}
SMTP_SECURE=${config.secure}
SMTP_USER=${config.user}
SMTP_PASS=${config.pass ? '***configurada***' : 'não configurada'}
EMAIL_FROM=${config.fromEmail}
EMAIL_FROM_NAME=${config.fromName}`}
          </pre>
        </div>
      </div>
    </div>
  );
};
