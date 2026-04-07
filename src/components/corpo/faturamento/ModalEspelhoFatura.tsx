import React, { useState } from 'react';
import ModalFormulario from '@/components/common/modalform';
import FormInput from '@/components/common/FormInput';
import NotaFiscalPreviewModal from './NotaFiscalPreviewModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fatura: any;
  venda: any;
  vendas_faturadas: any[];
  itens_por_venda: any[];
  produtos?: any[];
}


export default function EspelhoFaturaModal({
  isOpen,
  onClose,
  fatura,
  venda,
  vendas_faturadas,
  itens_por_venda,
  produtos = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'dados' | 'itens' | 'venda'>(
    'dados',
  );
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);



  if (!isOpen || !fatura) return null;

   const handleGerarPreview = () => {
    setIsPreviewOpen(true);
  };
  

  const renderDadosFatura = () => (
    <div className="space-y-6">
      {/* Identificação da Fatura */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          Identificação da Fatura
        </legend>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <FormInput
            label="Cliente"
            value={`${fatura.cliente?.codcli ?? '—'} — ${
              fatura.cliente?.nome ?? '—'
            }`}
            readOnly
            name="codcli"
            type=""
          />
          <FormInput
            label="UF"
            value={fatura.cliente?.uf ?? '—'}
            readOnly
            name="uf"
            type=""
          />
          <FormInput
            label="Tipo"
            value={fatura.tipofat ?? '—'}
            readOnly
            name="tipofat"
            type=""
          />
          <FormInput
            label="Data"
            value={fatura.data?.slice(0, 10) ?? '—'}
            readOnly
            name="data"
            type=""
          />
          <FormInput
            label="Vendedor"
            value={`${fatura.vendedor?.cod ?? '—'} — ${
              fatura.vendedor?.nome ?? '—'
            }`}
            readOnly
            name="codvend"
            type=""
          />
          <FormInput
            label="Formulário"
            value={fatura.nroform ?? '—'}
            readOnly
            name="nroform"
            type=""
          />
          <FormInput
            label="Documento"
            value={fatura.nronf ?? '—'}
            readOnly
            name="nronf"
            type=""
          />
        </div>
      </fieldset>

      {/* CFOP e Status */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          CFOP e Status
        </legend>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <FormInput
            label="CFOP 1"
            value={fatura.cfop1 ?? '—'}
            readOnly
            name="cfop1"
            type=""
          />
          <FormInput
            label="Descrição CFOP 1"
            value={fatura.descrcfop1 ?? '—'}
            readOnly
            name="descrcfop1"
            type=""
          />
          <FormInput
            label="CFOP 2"
            value={fatura.cfop2 ?? '—'}
            readOnly
            name="cfop2"
            type=""
          />
          <FormInput
            label="Descrição CFOP 2"
            value={fatura.descrcfop2 ?? '—'}
            readOnly
            name="descrcfop2"
            type=""
          />
          <FormInput
            label="Agrupada"
            value={fatura.agrupada === 'S' ? 'SIM' : 'NÃO'}
            readOnly
            name="agrupada"
            type=""
          />
          <FormInput
            label="Cancelada"
            value={fatura.cancel === 'S' ? 'SIM' : 'NÃO'}
            readOnly
            name="cancel"
            type=""
          />
          <FormInput
            label="Cobrança"
            value={fatura.cobranca === 'S' ? 'SIM' : 'NÃO'}
            readOnly
            name="cobranca"
            type=""
          />
        </div>
      </fieldset>

      {/* Totais e Valores */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          Totais e Valores
        </legend>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <FormInput
            label="Base ICMS"
            value={`R$ ${Number(fatura.baseicms ?? 0).toFixed(2)}`}
            readOnly
            name="baseicms"
            type=""
          />
          <FormInput
            label="Valor ICMS"
            value={`R$ ${Number(fatura.valor_icms ?? 0).toFixed(2)}`}
            readOnly
            name="valor_icms"
            type=""
          />
          <FormInput
            label="Valor PIS"
            value={`R$ ${Number(fatura.valor_pis ?? 0).toFixed(2)}`}
            readOnly
            name="valor_pis"
            type=""
          />
          <FormInput
            label="Valor COFINS"
            value={`R$ ${Number(fatura.valor_cofins ?? 0).toFixed(2)}`}
            readOnly
            name="valor_cofins"
            type=""
          />
          <FormInput
            label="Base ICMS Subst."
            value={`R$ ${Number(fatura.baseicms_subst ?? 0).toFixed(2)}`}
            readOnly
            name="baseicms_subst"
            type=""
          />
          <FormInput
            label="Valor ICMS Subst."
            value={`R$ ${Number(fatura.valoricms_subst ?? 0).toFixed(2)}`}
            readOnly
            name="valoricms_subst"
            type=""
          />
          <FormInput
            label="Frete"
            value={`R$ ${Number(fatura.totalfrete ?? 0).toFixed(2)}`}
            readOnly
            name="totalfrete"
            type=""
          />
          <FormInput
            label="Total Produtos"
            value={`R$ ${Number(fatura.totalprod ?? 0).toFixed(2)}`}
            readOnly
            name="totalprod"
            type=""
          />
          <FormInput
            label="Total IPI"
            value={`R$ ${Number(fatura.totalipi ?? 0).toFixed(2)}`}
            readOnly
            name="totalipi"
            type=""
          />
          <FormInput
            label="Desconto"
            value={`R$ ${Number(fatura.desconto ?? 0).toFixed(2)}`}
            readOnly
            name="desconto"
            type=""
          />
          <FormInput
            label="Obs. Desconto"
            value={fatura.obsdesconto ?? '—'}
            readOnly
            name="obsdesconto"
            type=""
          />
          <FormInput
            label="Acréscimo"
            value={`R$ ${Number(fatura.acrescimo ?? 0).toFixed(2)}`}
            readOnly
            name="acrescimo"
            type=""
          />
          <FormInput
            label="Total NF"
            value={`R$ ${Number(fatura.totalnf ?? 0).toFixed(2)}`}
            readOnly
            name="totalnf"
            type=""
          />
        </div>
      </fieldset>

      {/* Transporte */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">Transporte</legend>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <FormInput
            label="Peso Bruto"
            value={`${Number(fatura.psbruto ?? 0).toFixed(2)} kg`}
            readOnly
            name="psbruto"
            type=""
          />
          <FormInput
            label="Peso Líquido"
            value={`${Number(fatura.psliquido ?? 0).toFixed(2)} kg`}
            readOnly
            name="psliquido"
            type=""
          />
          <FormInput
            label="Espécie"
            value={fatura.especie ?? '—'}
            readOnly
            name="especie"
            type=""
          />
          <FormInput
            label="Marca"
            value={fatura.marca ?? '—'}
            readOnly
            name="marca"
            type=""
          />
          <FormInput
            label="Número"
            value={fatura.numero ?? '—'}
            readOnly
            name="numero"
            type=""
          />
        </div>
      </fieldset>

      {/* Complementares */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          Dados Complementares
        </legend>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <FormInput
            label="Tipo NF"
            value={fatura.tiponf ?? '—'}
            readOnly
            name="tiponf"
            type=""
          />
          <FormInput
            label="NF-e?"
            value={fatura.nfs === 'S' ? 'SIM' : 'NÃO'}
            readOnly
            name="nfs"
            type=""
          />
          <FormInput
            label="Série"
            value={fatura.serie ?? '—'}
            readOnly
            name="serie"
            type=""
          />
          <FormInput
            label="Selo"
            value={fatura.selo ?? '—'}
            readOnly
            name="selo"
            type=""
          />
          <FormInput
            label="Tipo Dest."
            value={fatura.tipodest ?? '—'}
            readOnly
            name="tipodest"
            type=""
          />
          <FormInput
            label="Origem"
            value={fatura.origem ?? '—'}
            readOnly
            name="origem"
            type=""
          />
          <FormInput
            label="Importada"
            value={fatura.import === 'S' ? 'SIM' : 'NÃO'}
            readOnly
            name="import"
            type=""
          />
          <FormInput
            label="Insc. Estadual 07"
            value={fatura.insc07 ?? '—'}
            readOnly
            name="insc07"
            type=""
          />
          <FormInput
            label="Info Compl. (Estorno)"
            value={fatura.info_compl ?? '—'}
            readOnly
            name="info_compl"
            type=""
          />
        </div>
      </fieldset>
    </div>
  );

  const renderItensFatura = () => (
    <div className="overflow-auto border border-gray-200 rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className="px-3 py-2 text-left">Código</th>
            <th className="px-3 py-2 text-left">Descrição</th>
            <th className="px-3 py-2 text-right">Qtd</th>
            <th className="px-3 py-2 text-right">Unitário</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {produtos?.length > 0 ? (
            produtos.map((item, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-3 py-2">{item.codprod ?? '—'}</td>
                <td className="px-3 py-2">{item.descr ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  {Number(item.qtd).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  R$ {Number(item.prunit).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  R$ {Number(item.total_item).toFixed(2)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="text-center text-gray-400 py-4">
                Nenhum item encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderDadosVenda = () => (
    <div className="space-y-6">
      {/* Venda principal */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          Informações da Venda
        </legend>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <FormInput
            label="Tipo"
            value={venda.tipo ?? '—'}
            readOnly
            name="tipo"
            type=""
          />
          <FormInput
            label="Nº Venda"
            value={venda.nrovenda ?? '—'}
            readOnly
            name="nrovenda"
            type=""
          />
          <FormInput
            label="Data"
            value={venda.data ?? '—'}
            readOnly
            name="data"
            type=""
          />
          <FormInput
            label="Total"
            value={`R$ ${Number(venda.total ?? 0).toFixed(2)}`}
            readOnly
            name="total"
            type=""
          />
          <FormInput
            label="Status"
            value={venda.status ?? '—'}
            readOnly
            name="status"
            type=""
          />
          <FormInput
            label="Pedido"
            value={venda.pedido ?? '—'}
            readOnly
            name="pedido"
            type=""
          />
          <FormInput
            label="Observações"
            value={venda.obs ?? '—'}
            readOnly
            name="obs"
            type=""
          />
        </div>
      </fieldset>

      {/* Vendas já faturadas */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          Vendas Já Faturadas
        </legend>
        <div className="overflow-auto">
          <table className="w-full text-sm mt-2">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left px-2 py-1">Tipo</th>
                <th className="text-left px-2 py-1">CodVenda</th>
                <th className="text-left px-2 py-1">NroVenda</th>
                <th className="text-left px-2 py-1">Data</th>
                <th className="text-right px-2 py-1">Total</th>
                <th className="text-left px-2 py-1">Pedido</th>
                <th className="text-left px-2 py-1">Status</th>
                <th className="text-left px-2 py-1">Obs</th>
              </tr>
            </thead>
            <tbody>
              {vendas_faturadas.map((v: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{v.tipo}</td>
                  <td className="px-2 py-1">{v.codvenda}</td>
                  <td className="px-2 py-1">{v.nrovenda}</td>
                  <td className="px-2 py-1">{v.data}</td>
                  <td className="px-2 py-1 text-right">
                    R$ {Number(v.total).toFixed(2)}
                  </td>
                  <td className="px-2 py-1">{v.pedido}</td>
                  <td className="px-2 py-1">{v.status}</td>
                  <td className="px-2 py-1">{v.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      {/* Itens por venda */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="font-semibold text-gray-700 px-2">
          Itens por Venda
        </legend>
        <div className="overflow-auto">
          <table className="w-full text-sm mt-2">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left px-2 py-1">Código</th>
                <th className="text-left px-2 py-1">Referência</th>
                <th className="text-left px-2 py-1">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {itens_por_venda.map((item: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="px-2 py-1">{item.codprod}</td>
                  <td className="px-2 py-1">{item.ref}</td>
                  <td className="px-2 py-1">{item.descr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  );

  return (
    <>
    <ModalFormulario
      titulo={`Espelho da Fatura ${fatura.codfat}`}
      tabs={[
        { key: 'dados', name: 'Dados da Fatura' },
        { key: 'itens', name: 'Itens da Fatura' },
        { key: 'venda', name: 'Dados Venda' },
      ]}
      activeTab={activeTab}
      setActiveTab={(tab: string) => setActiveTab(tab as 'dados' | 'itens' | 'venda')}
      handleSubmit={onClose}
      handleClear={onClose}
      onClose={onClose}
    footer={
          <div className="flex justify-end gap-4">
          
            <button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              onClick={handleGerarPreview} // 3. Ação para abrir o preview
            >
              Gerar Preview da Nota
            </button>
          </div>
        }
      renderTabContent={() => {
        switch (activeTab) {
          case 'dados':
            return renderDadosFatura();
          case 'itens':
            return renderItensFatura();
          case 'venda':
            return renderDadosVenda();
          default:
            return null;
        }
      }}
      

      
    />
{isPreviewOpen && (
        <NotaFiscalPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          fatura={fatura}
          produtos={produtos}
          venda={venda}
        />
      )}
    </>
    
    
  );
}
