import React, { useState, useEffect } from 'react';
import { Building2, Calculator, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface RateioFormFieldsProps {
  value: RateioData;
  onChange: (data: RateioData) => void;
  className?: string;
}

export interface RateioData {
  tipo: 'centro_custo' | 'criterio_rateio' | 'nenhum';
  centroCusto?: string;
  centroCustoNome?: string;
  criterioRateio?: string;
  criterioRateioNome?: string;
  observacoes?: string;
}

interface CentroCusto {
  codigo: string;
  nome: string;
  departamento: string;
  ativo: boolean;
}

interface CriterioRateio {
  id: string;
  nome: string;
  descricao: string;
  percentuais: Array<{
    centroCusto: string;
    percentual: number;
  }>;
}

export const RateioFormFields: React.FC<RateioFormFieldsProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [criteriosRateio, setCriteriosRateio] = useState<CriterioRateio[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCentroCustoSearch, setShowCentroCustoSearch] = useState(false);
  const [centroCustoSearch, setCentroCustoSearch] = useState('');

  // Carregar dados iniciais
  useEffect(() => {
    loadCentrosCusto();
    loadCriteriosRateio();
  }, []);

  const loadCentrosCusto = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/contabilidade/centros-custo');
      if (response.ok) {
        const data = await response.json();
        setCentrosCusto(data.centrosCusto || []);
      }
    } catch (error) {
      console.error('Erro ao carregar centros de custo:', error);
      // Mock data para desenvolvimento
      setCentrosCusto([
        { codigo: '001', nome: 'Vendas', departamento: 'Comercial', ativo: true },
        { codigo: '002', nome: 'Compras', departamento: 'Suprimentos', ativo: true },
        { codigo: '003', nome: 'TI', departamento: 'Tecnologia', ativo: true },
        { codigo: '004', nome: 'Administração', departamento: 'Administrativo', ativo: true },
        { codigo: '005', nome: 'Financeiro', departamento: 'Financeiro', ativo: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCriteriosRateio = async () => {
    try {
      const response = await fetch('/api/contabilidade/criterios-rateio');
      if (response.ok) {
        const data = await response.json();
        setCriteriosRateio(data.criterios || []);
      }
    } catch (error) {
      console.error('Erro ao carregar critérios de rateio:', error);
      // Mock data para desenvolvimento
      setCriteriosRateio([
        {
          id: 'GERAL',
          nome: 'Rateio Geral',
          descricao: 'Distribuição proporcional entre todos os setores',
          percentuais: [
            { centroCusto: '001', percentual: 30 },
            { centroCusto: '002', percentual: 20 },
            { centroCusto: '003', percentual: 15 },
            { centroCusto: '004', percentual: 20 },
            { centroCusto: '005', percentual: 15 },
          ]
        },
        {
          id: 'OPERACIONAL',
          nome: 'Rateio Operacional',
          descricao: 'Foco em áreas operacionais',
          percentuais: [
            { centroCusto: '001', percentual: 50 },
            { centroCusto: '002', percentual: 30 },
            { centroCusto: '003', percentual: 20 },
          ]
        }
      ]);
    }
  };

  const handleTipoChange = (tipo: RateioData['tipo']) => {
    onChange({
      ...value,
      tipo,
      // Limpar campos quando mudar o tipo
      centroCusto: tipo === 'centro_custo' ? value.centroCusto : undefined,
      centroCustoNome: tipo === 'centro_custo' ? value.centroCustoNome : undefined,
      criterioRateio: tipo === 'criterio_rateio' ? value.criterioRateio : undefined,
      criterioRateioNome: tipo === 'criterio_rateio' ? value.criterioRateioNome : undefined,
    });
  };

  const handleCentroCustoSelect = (codigo: string) => {
    const centroCusto = centrosCusto.find(cc => cc.codigo === codigo);
    onChange({
      ...value,
      centroCusto: codigo,
      centroCustoNome: centroCusto?.nome || ''
    });
  };

  const handleCriterioRateioSelect = (criterioId: string) => {
    const criterio = criteriosRateio.find(cr => cr.id === criterioId);
    onChange({
      ...value,
      criterioRateio: criterioId,
      criterioRateioNome: criterio?.nome || ''
    });
  };

  const filteredCentrosCusto = centrosCusto.filter(cc => 
    cc.ativo && (
      cc.nome.toLowerCase().includes(centroCustoSearch.toLowerCase()) ||
      cc.codigo.includes(centroCustoSearch) ||
      cc.departamento.toLowerCase().includes(centroCustoSearch.toLowerCase())
    )
  );

  const selectedCriterio = criteriosRateio.find(cr => cr.id === value.criterioRateio);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Rateio Contábil</h3>
        </div>

        {/* Tipo de Rateio */}
        <div className="space-y-3">
          <Label>Tipo de Distribuição</Label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="rateio-tipo"
                value="nenhum"
                checked={value.tipo === 'nenhum'}
                onChange={() => handleTipoChange('nenhum')}
                className="text-blue-600"
              />
              <span className="text-sm">Sem rateio (centro de custo específico será definido posteriormente)</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="rateio-tipo"
                value="centro_custo"
                checked={value.tipo === 'centro_custo'}
                onChange={() => handleTipoChange('centro_custo')}
                className="text-blue-600"
              />
              <span className="text-sm">Centro de Custo Específico</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="rateio-tipo"
                value="criterio_rateio"
                checked={value.tipo === 'criterio_rateio'}
                onChange={() => handleTipoChange('criterio_rateio')}
                className="text-blue-600"
              />
              <span className="text-sm">Critério de Rateio Automático</span>
            </label>
          </div>
        </div>

        {/* Centro de Custo Específico */}
        {value.tipo === 'centro_custo' && (
          <div className="mt-4 space-y-3">
            <Label>Centro de Custo</Label>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={value.centroCusto || ''}
                  onValueChange={handleCentroCustoSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCentrosCusto.map(cc => (
                      <SelectItem key={cc.codigo} value={cc.codigo}>
                        {cc.codigo} - {cc.nome} ({cc.departamento})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCentroCustoSearch(!showCentroCustoSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {showCentroCustoSearch && (
              <Input
                placeholder="Buscar centro de custo..."
                value={centroCustoSearch}
                onChange={(e) => setCentroCustoSearch(e.target.value)}
              />
            )}

            {value.centroCusto && (
              <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                <strong>Selecionado:</strong> {value.centroCusto} - {value.centroCustoNome}
              </div>
            )}
          </div>
        )}

        {/* Critério de Rateio */}
        {value.tipo === 'criterio_rateio' && (
          <div className="mt-4 space-y-3">
            <Label>Critério de Rateio</Label>
            
            <Select
              value={value.criterioRateio || ''}
              onValueChange={handleCriterioRateioSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um critério de rateio" />
              </SelectTrigger>
              <SelectContent>
                {criteriosRateio.map(cr => (
                  <SelectItem key={cr.id} value={cr.id}>
                    {cr.nome} - {cr.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCriterio && (
              <div className="bg-purple-50 p-3 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-800">Distribuição Automática</span>
                </div>
                <div className="space-y-1 text-sm">
                  {selectedCriterio.percentuais.map(p => {
                    const cc = centrosCusto.find(c => c.codigo === p.centroCusto);
                    return (
                      <div key={p.centroCusto} className="flex justify-between">
                        <span>{cc?.nome || p.centroCusto}</span>
                        <span className="font-medium">{p.percentual}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Observações */}
        <div className="mt-4">
          <Label htmlFor="rateio-observacoes">Observações</Label>
          <Input
            id="rateio-observacoes"
            placeholder="Observações sobre o rateio (opcional)"
            value={value.observacoes || ''}
            onChange={(e) => onChange({ ...value, observacoes: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
};