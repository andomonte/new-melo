/**
 * Tab "Dados Gerais" da Declaração de Importação
 * Segue padrão visual do sistema
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import type { ImportacaoCabecalho } from '../types/importacao';
import { SectionPanel, FormField } from './SectionPanel';

interface DadosGeraisTabProps {
  dados: Partial<ImportacaoCabecalho>;
  onChange: (dados: Partial<ImportacaoCabecalho>) => void;
  readOnly?: boolean;
}

export const DadosGeraisTab: React.FC<DadosGeraisTabProps> = ({
  dados,
  onChange,
  readOnly = false,
}) => {
  const handleChange = (campo: keyof ImportacaoCabecalho, valor: string | number) => {
    onChange({ ...dados, [campo]: valor });
  };

  const text = (campo: keyof ImportacaoCabecalho, placeholder?: string) => (
    <Input
      placeholder={placeholder}
      value={(dados[campo] as string) || ''}
      onChange={(e) => handleChange(campo, e.target.value)}
      disabled={readOnly}
      className="h-8 text-sm"
    />
  );

  const date = (campo: keyof ImportacaoCabecalho) => (
    <Input
      type="date"
      value={(dados[campo] as string) || ''}
      onChange={(e) => handleChange(campo, e.target.value)}
      disabled={readOnly}
      className="h-8 text-sm"
    />
  );

  const num = (campo: keyof ImportacaoCabecalho, step = '0.01') => (
    <Input
      type="number"
      step={step}
      placeholder="0.00"
      value={(dados[campo] as number) || ''}
      onChange={(e) => handleChange(campo, parseFloat(e.target.value))}
      disabled={readOnly}
      className="h-8 text-sm"
    />
  );

  return (
    <div className="space-y-6">
      <SectionPanel titulo="Dados do Documento">
        <FormField label="Nº da DI">{text('nro_di', 'Ex: 2524961558')}</FormField>
        <FormField label="Data da DI">{date('data_di')}</FormField>
        <FormField label="Tipo DIe">{text('tipo_die', 'Ex: 01')}</FormField>
        <FormField label="País Procedência">{text('pais_procedencia', 'Ex: China')}</FormField>
      </SectionPanel>

      <SectionPanel titulo="Valores Financeiros">
        <FormField label="Taxa Dólar (DI)">{num('taxa_dolar', '0.0001')}</FormField>
        <FormField label="Total Mercadoria (FOB USD)">{num('total_mercadoria')}</FormField>
        <FormField label="Frete Internacional">{num('frete')}</FormField>
        <FormField label="Seguro">{num('seguro')}</FormField>
        <FormField label="THC / Capatazia">{num('thc')}</FormField>
        <FormField label="Total CIF (USD)">{num('total_cif')}</FormField>
      </SectionPanel>

      <SectionPanel titulo="Impostos" gridCols="grid-cols-5">
        <FormField label="PIS">{num('pis')}</FormField>
        <FormField label="COFINS">{num('cofins')}</FormField>
        <FormField label="II (Imp. Importação)">{num('ii')}</FormField>
        <FormField label="IPI">{num('ipi')}</FormField>
        <FormField label="ICMS-ST">{num('icms_st')}</FormField>
      </SectionPanel>

      <SectionPanel titulo="Taxas e Despesas">
        <FormField label="Anuência">{num('anuencia')}</FormField>
        <FormField label="SISCOMEX">{num('siscomex')}</FormField>
        <FormField label="Despachante">{num('despachante')}</FormField>
        <FormField label="Contrato Câmbio (USD)">{num('contrato_cambio')}</FormField>
        <FormField label="Frete Origem Total">{num('freteorigem_total')}</FormField>
        <FormField label="Infraero / Porto">{num('infraero_porto')}</FormField>
        <FormField label="Carreteiro EADI">{num('carreteiro_eadi')}</FormField>
        <FormField label="Carreteiro Melo">{num('carreteiro_melo')}</FormField>
        <FormField label="EADI">{num('eadi')}</FormField>
      </SectionPanel>

      <SectionPanel titulo="Dados Complementares">
        <FormField label="Navio">{text('navio', 'Nome do navio')}</FormField>
        <FormField label="Entrada no Brasil">{date('data_entrada_brasil')}</FormField>
        <FormField label="Inscrição SUFRAMA">{text('inscricao_suframa', 'XX.XXXX.XX-X')}</FormField>
        <FormField label="Recinto Aduaneiro">{text('recinto_aduaneiro', 'Código')}</FormField>
      </SectionPanel>
    </div>
  );
};
