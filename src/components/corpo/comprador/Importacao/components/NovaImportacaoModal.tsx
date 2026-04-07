/**
 * Modal para criar nova Importação
 * Formulário sempre visível, botão Upload XML no header
 * Ao carregar XML, campos preenchem com animação de loading
 */

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Save, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SectionPanel, FormField } from './SectionPanel';
import { useXmlUpload } from '../hooks/useXmlUpload';
import { fmtUSD, fmtBRL, fmtTaxa } from '../utils/formatters';
import api from '@/components/services/api';

interface NovaImportacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (id: number) => void;
}

export const NovaImportacaoModal: React.FC<NovaImportacaoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    xmlParsed,
    xmlRaw,
    fileName,
    error: xmlError,
    loading: xmlLoading,
    cabecalhoFromXml,
    handleDrop,
    handleFileInput,
    reset: resetXml,
  } = useXmlUpload();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [extras, setExtras] = useState({
    anuencia: 0,
    despachante: 0,
    freteorigem_total: 0,
    infraero_porto: 0,
    carreteiro_eadi: 0,
    carreteiro_melo: 0,
    eadi: 0,
    contrato_cambio: 0,
  });

  if (!isOpen) return null;

  const loaded = !!xmlParsed;

  const handleClose = () => {
    resetXml();
    setExtras({
      anuencia: 0, despachante: 0, freteorigem_total: 0,
      infraero_porto: 0, carreteiro_eadi: 0, carreteiro_melo: 0,
      eadi: 0, contrato_cambio: 0,
    });
    setSaveError('');
    onClose();
  };

  const handleLimpar = () => {
    resetXml();
    setExtras({
      anuencia: 0, despachante: 0, freteorigem_total: 0,
      infraero_porto: 0, carreteiro_eadi: 0, carreteiro_melo: 0,
      eadi: 0, contrato_cambio: 0,
    });
    setSaveError('');
  };

  const handleExtraChange = (campo: string, valor: number) => {
    setExtras((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSalvar = async () => {
    if (!cabecalhoFromXml) return;

    setSaving(true);
    setSaveError('');

    try {
      // Agrupar itens por fornecedor a partir das adições do XML
      const fornecedorMap = new Map<string, { descricao: string; qtd: number; proforma_unit: number; invoice_unit: number; ncm: string; unidade: string; numero_adicao: number }[]>();
      for (const adicao of xmlParsed?.adicoes || []) {
        const nome = adicao.nomeFornecedor || '';
        if (!fornecedorMap.has(nome)) {
          fornecedorMap.set(nome, []);
        }
        for (const item of adicao.itens) {
          fornecedorMap.get(nome)!.push({
            descricao: item.descricao,
            qtd: item.qtd,
            proforma_unit: item.vlUnitario,
            invoice_unit: item.vlUnitario,
            ncm: item.cdNcm,
            unidade: item.unidade,
            numero_adicao: item.numAdicao,
          });
        }
      }

      const fornecedores = Array.from(fornecedorMap.entries()).map(([nome, itens]) => ({
        fornecedor_nome: nome,
        itens,
      }));

      const payload = {
        ...cabecalhoFromXml,
        ...extras,
        xml_original: xmlRaw,
        contratos: xmlParsed?.contratos?.map((c) => ({
          contrato: c.numero,
          vl_merc_dolar: c.valorUsd,
          moeda: 'USD',
        })) || [],
        fornecedores,
      };

      const response = await api.post('/api/importacao/post', payload);

      if (response.data?.success && response.data?.id) {
        onSuccess?.(response.data.id);
        handleClose();
      } else {
        setSaveError(response.data?.message || 'Erro ao salvar');
      }
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const totalCifBrl = cabecalhoFromXml
    ? (cabecalhoFromXml.total_cif as number) * (cabecalhoFromXml.taxa_dolar as number)
    : 0;

  const totalItens = xmlParsed?.adicoes.reduce((s, a) => s + a.itens.length, 0) || 0;

  // Drag & drop no modal inteiro
  const handleModalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDrop(e);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div
        className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
        onDragOver={handleModalDragOver}
        onDrop={handleModalDrop}
      >
        {/* Header - padrão 60/35/5 */}
        <div className="flex justify-center items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <header className="mb-0 w-[60%] flex items-center gap-3">
            <h4 className="text-xl font-bold text-[#347AB6]">Nova Importação</h4>
            {fileName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate max-w-[400px]">
                <FileText size={12} />
                {fileName}
              </span>
            )}
          </header>

          <div className="w-[35%] flex justify-end gap-2">
            {/* Botão Upload XML - sempre visível e em evidência */}
            <Button
              variant={loaded ? 'outline' : 'default'}
              size="sm"
              disabled={xmlLoading}
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1 ${
                !loaded
                  ? 'bg-[#347AB6] hover:bg-[#2a5f8f] text-white animate-pulse'
                  : ''
              }`}
            >
              {xmlLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {xmlLoading ? 'Processando...' : loaded ? 'Trocar XML' : 'Upload XML'}
            </Button>

            {loaded && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLimpar}
                  className="flex items-center gap-1"
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={handleSalvar}
                  className="flex items-center gap-1 bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar
                </Button>
              </>
            )}
          </div>

          <div className="w-[5%] flex justify-end">
            <button onClick={handleClose} className="text-gray-500 dark:text-gray-100 hover:text-red-500">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Input file hidden */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Content - formulário sempre visível */}
        <div className="flex-1 px-6 py-4 overflow-auto text-gray-800 dark:text-gray-100">
          {saveError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} />
              {saveError}
            </div>
          )}

          {xmlError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} />
              {xmlError}
            </div>
          )}

          <div className="space-y-6">
            {/* Dados do Documento */}
            <SectionPanel titulo="Dados do Documento">
              <Field label="Nº da DI" value={cabecalhoFromXml?.nro_di} loading={xmlLoading} />
              <Field label="Data da DI" value={cabecalhoFromXml?.data_di} loading={xmlLoading} />
              <Field label="Tipo DIe" value={cabecalhoFromXml?.tipo_die} loading={xmlLoading} />
              <Field label="País Procedência" value={cabecalhoFromXml?.pais_procedencia} loading={xmlLoading} />
            </SectionPanel>

            {/* Valores Financeiros */}
            <SectionPanel titulo="Valores Financeiros (USD)">
              <Field label="Taxa Dólar (DI)" value={loaded ? fmtTaxa(cabecalhoFromXml?.taxa_dolar || 0) : undefined} loading={xmlLoading} />
              <Field label="Total Mercadoria (FOB)" value={loaded ? fmtUSD(cabecalhoFromXml?.total_mercadoria || 0) : undefined} loading={xmlLoading} />
              <Field label="Frete Internacional" value={loaded ? fmtUSD(cabecalhoFromXml?.frete || 0) : undefined} loading={xmlLoading} />
              <Field label="Seguro" value={loaded ? fmtUSD(cabecalhoFromXml?.seguro || 0) : undefined} loading={xmlLoading} />
              <Field label="THC / Capatazia" value={loaded ? fmtUSD(cabecalhoFromXml?.thc || 0) : undefined} loading={xmlLoading} />
              <Field label="Total CIF (USD)" value={loaded ? fmtUSD(cabecalhoFromXml?.total_cif || 0) : undefined} loading={xmlLoading} />
              <Field label="Total CIF (BRL)" value={loaded ? fmtBRL(totalCifBrl) : undefined} loading={xmlLoading} />
              <Field label="Peso Líquido (kg)" value={loaded ? String(cabecalhoFromXml?.peso_liquido || 0) : undefined} loading={xmlLoading} />
            </SectionPanel>

            {/* Impostos */}
            <SectionPanel titulo="Impostos (do XML)" gridCols="grid-cols-5">
              <Field label="PIS/COFINS" value={loaded ? fmtBRL(cabecalhoFromXml?.pis_cofins || 0) : undefined} loading={xmlLoading} />
              <Field label="II (Imp. Importação)" value={loaded ? fmtBRL(cabecalhoFromXml?.ii || 0) : undefined} loading={xmlLoading} />
              <Field label="IPI" value={loaded ? fmtBRL(cabecalhoFromXml?.ipi || 0) : undefined} loading={xmlLoading} />
              <Field label="SISCOMEX" value={loaded ? fmtBRL(cabecalhoFromXml?.siscomex || 0) : undefined} loading={xmlLoading} />
              <Field label="Taxas Diversas" value={loaded ? fmtBRL((xmlParsed as any)?.vlTaxasDiversas || 0) : undefined} loading={xmlLoading} />
            </SectionPanel>

            {/* Dados Complementares */}
            <SectionPanel titulo="Dados Complementares">
              <Field label="Navio" value={loaded ? (cabecalhoFromXml?.navio || '-') : undefined} loading={xmlLoading} />
              <Field label="Entrada no Brasil" value={loaded ? (cabecalhoFromXml?.data_entrada_brasil || '-') : undefined} loading={xmlLoading} />
              <Field label="Inscrição SUFRAMA" value={loaded ? (cabecalhoFromXml?.inscricao_suframa || '-') : undefined} loading={xmlLoading} />
              <Field label="Recinto Aduaneiro" value={loaded ? (cabecalhoFromXml?.recinto_aduaneiro || '-') : undefined} loading={xmlLoading} />
            </SectionPanel>

            {/* Taxas e Despesas - editáveis */}
            <SectionPanel titulo="Taxas e Despesas (preencher)">
              <NumField label="Anuência (R$)" value={extras.anuencia} onChange={(v) => handleExtraChange('anuencia', v)} disabled={!loaded} />
              <NumField label="Contrato Câmbio (USD)" value={extras.contrato_cambio} onChange={(v) => handleExtraChange('contrato_cambio', v)} disabled={!loaded} />
              <NumField label="Despachante (R$)" value={extras.despachante} onChange={(v) => handleExtraChange('despachante', v)} disabled={!loaded} />
              <NumField label="Frete Origem Total (R$)" value={extras.freteorigem_total} onChange={(v) => handleExtraChange('freteorigem_total', v)} disabled={!loaded} />
              <NumField label="Infraero / Porto (R$)" value={extras.infraero_porto} onChange={(v) => handleExtraChange('infraero_porto', v)} disabled={!loaded} />
              <NumField label="Carreteiro EADI (R$)" value={extras.carreteiro_eadi} onChange={(v) => handleExtraChange('carreteiro_eadi', v)} disabled={!loaded} />
              <NumField label="Carreteiro Melo (R$)" value={extras.carreteiro_melo} onChange={(v) => handleExtraChange('carreteiro_melo', v)} disabled={!loaded} />
              <NumField label="EADI (R$)" value={extras.eadi} onChange={(v) => handleExtraChange('eadi', v)} disabled={!loaded} />
            </SectionPanel>

            {/* Contratos de Câmbio */}
            <div className="border border-gray-200 dark:border-zinc-700 rounded-lg">
              <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 rounded-t-lg">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Contratos de Câmbio {loaded && xmlParsed!.contratos.length > 0 ? `(${xmlParsed!.contratos.length})` : ''}
                </h3>
              </div>
              <div className="p-4">
                {xmlLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    Carregando contratos...
                  </div>
                ) : loaded && xmlParsed!.contratos.length > 0 ? (
                  <div className="border border-gray-200 dark:border-zinc-600 rounded overflow-hidden">
                    <table className="table-auto w-full text-sm">
                      <thead className="bg-gray-200 dark:bg-zinc-800">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Nº Contrato</th>
                          <th className="px-4 py-2 text-right font-medium">Valor (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xmlParsed!.contratos.map((c, idx) => (
                          <tr key={idx} className="border-t border-gray-200 dark:border-zinc-700">
                            <td className="px-4 py-2 font-mono">{c.numero}</td>
                            <td className="px-4 py-2 text-right text-green-600 dark:text-green-400 font-medium">{fmtUSD(c.valorUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-500 py-2">
                    Nenhum contrato carregado. Faça upload do XML.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Campo readonly com loading spinner */
const Field: React.FC<{ label: string; value?: string | number | null; loading?: boolean }> = ({ label, value, loading }) => (
  <FormField label={label}>
    <div className="relative">
      <Input
        value={loading ? '' : (value ?? '')}
        disabled
        placeholder="-"
        className="h-8 text-sm"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-[#347AB6]" />
        </div>
      )}
    </div>
  </FormField>
);

/** Campo numérico editável */
const NumField: React.FC<{ label: string; value: number; onChange: (v: number) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <FormField label={label}>
    <Input
      type="number"
      step="0.01"
      placeholder="0.00"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      disabled={disabled}
      className="h-8 text-sm"
    />
  </FormField>
);
