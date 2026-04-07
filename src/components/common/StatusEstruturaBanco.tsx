import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Database, Settings } from 'lucide-react';

interface IndiceInfo {
  indexname: string;
  indexdef: string;
}

interface ColunaInfo {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: string;
}

interface VerificacaoBanco {
  tabela_dbfatura: {
    existe: boolean;
    coluna_codgp: boolean;
    coluna_agp: boolean;
    indices: IndiceInfo[];
  };
  tabela_grupo_pagamento: {
    existe: boolean;
    estrutura: ColunaInfo[];
  };
  tabela_grupo_pagamento_fatura: {
    existe: boolean;
    estrutura: ColunaInfo[];
  };
  problemas: string[];
  acoes_recomendadas: string[];
}

interface AnaliseBanco {
  estrutura_completa: boolean;
  sistema_funcional: boolean;
  total_problemas: number;
  pronto_para_agrupamento: boolean;
}

interface VerificacaoResponse {
  verificacao: VerificacaoBanco;
  analise: AnaliseBanco;
  timestamp: string;
  correcoes?: string[];
}

export const StatusEstruturaBanco: React.FC = () => {
  const [dados, setDados] = useState<VerificacaoResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const verificarEstrutura = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const response = await fetch('/api/faturamento/verificar-estrutura-banco');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao verificar estrutura');
      }

      setDados(result);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setCarregando(false);
    }
  };

  const corrigirEstrutura = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const response = await fetch('/api/faturamento/verificar-estrutura-banco', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acao: 'corrigir' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao corrigir estrutura');
      }

      setDados(result);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    verificarEstrutura();
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean, textoSim: string, textoNao: string) => {
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? textoSim : textoNao}
      </Badge>
    );
  };

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Erro ao verificar estrutura do banco: {erro}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={verificarEstrutura}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!dados && carregando) {
    return (
      <div className="flex items-center space-x-2 p-4">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Verificando estrutura do banco...</span>
      </div>
    );
  }

  if (!dados) return null;

  const { verificacao, analise, correcoes } = dados;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Status da Estrutura do Banco</h3>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={verificarEstrutura}
            disabled={carregando}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${carregando ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
          {verificacao.problemas.length > 0 && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={corrigirEstrutura}
              disabled={carregando}
            >
              <Settings className="h-3 w-3 mr-1" />
              Corrigir
            </Button>
          )}
        </div>
      </div>

      {/* Status geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          {getStatusIcon(analise.estrutura_completa)}
          <span className="text-sm">Estrutura Completa</span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(analise.sistema_funcional)}
          <span className="text-sm">Sistema Funcional</span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(analise.pronto_para_agrupamento)}
          <span className="text-sm">Agrupamento OK</span>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={analise.total_problemas === 0 ? "default" : "destructive"}>
            {analise.total_problemas} problemas
          </Badge>
        </div>
      </div>

      {/* Resumo das tabelas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <h4 className="font-medium flex items-center space-x-2">
            {getStatusIcon(verificacao.tabela_dbfatura.existe)}
            <span>dbfatura</span>
          </h4>
          <div className="pl-6 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm">codgp:</span>
              {getStatusBadge(verificacao.tabela_dbfatura.coluna_codgp, "OK", "Faltando")}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">agp:</span>
              {getStatusBadge(verificacao.tabela_dbfatura.coluna_agp, "OK", "Faltando")}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium flex items-center space-x-2">
            {getStatusIcon(verificacao.tabela_grupo_pagamento.existe)}
            <span>grupo_pagamento</span>
          </h4>
          <div className="pl-6">
            {getStatusBadge(verificacao.tabela_grupo_pagamento.existe, "Criada", "Não existe")}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium flex items-center space-x-2">
            {getStatusIcon(verificacao.tabela_grupo_pagamento_fatura.existe)}
            <span>grupo_pagamento_fatura</span>
          </h4>
          <div className="pl-6">
            {getStatusBadge(verificacao.tabela_grupo_pagamento_fatura.existe, "Criada", "Não existe")}
          </div>
        </div>
      </div>

      {/* Problemas e ações recomendadas */}
      {verificacao.problemas.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Problemas encontrados:</div>
              <ul className="list-disc list-inside space-y-1">
                {verificacao.problemas.map((problema, index) => (
                  <li key={index} className="text-sm">{problema}</li>
                ))}
              </ul>
              {verificacao.acoes_recomendadas.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium">Ações recomendadas:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {verificacao.acoes_recomendadas.map((acao, index) => (
                      <li key={index} className="text-sm font-mono">{acao}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Correções aplicadas */}
      {correcoes && correcoes.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Correções aplicadas:</div>
              <ul className="list-disc list-inside space-y-1">
                {correcoes.map((correcao, index) => (
                  <li key={index} className="text-sm">{correcao}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detalhes técnicos (opcional) */}
      <div className="border-t pt-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
        >
          {mostrarDetalhes ? 'Ocultar' : 'Mostrar'} detalhes técnicos
        </Button>
        
        {mostrarDetalhes && (
          <div className="mt-4 space-y-4">
            {/* Índices */}
            {verificacao.tabela_dbfatura.indices.length > 0 && (
              <div>
                <h5 className="font-medium mb-2">Índices relacionados ao agrupamento:</h5>
                <div className="space-y-1">
                  {verificacao.tabela_dbfatura.indices.map((indice, index) => (
                    <div key={index} className="text-sm font-mono bg-gray-100 p-2 rounded">
                      <div><strong>{indice.indexname}</strong></div>
                      <div className="text-gray-600">{indice.indexdef}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-500">
              Última verificação: {new Date(dados.timestamp).toLocaleString('pt-BR')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
