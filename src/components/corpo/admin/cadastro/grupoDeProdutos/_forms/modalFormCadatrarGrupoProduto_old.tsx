// src/components/gruposDeProdutos/_forms/modalFormCadastrarGrupoProduto.tsx
import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { CreateGrupoProdutoFormInput } from '@/data/gruposDeProdutos/gruposProdutoSchema';
import { X } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import FormFooter from '@/components/common/FormFooter2';
import Carregamento from '@/utils/carregamento';

interface ModalFormCadastrarGrupoProdutoProps {
  titulo: string;
  onClose: () => void;
  loading?: boolean;
  handleSubmit: () => void;
  handleClear: () => void;
  register: UseFormRegister<CreateGrupoProdutoFormInput>;
  errors: FieldErrors<CreateGrupoProdutoFormInput>;
  isDirty: boolean;
}

const ModalFormCadastrarGrupoProduto: React.FC<ModalFormCadastrarGrupoProdutoProps> = ({
  titulo,
  handleSubmit,
  handleClear,
  onClose,
  register,
  errors,
  loading = false,
  isDirty,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="flex justify-center items-center px-4 py-3 border-b dark:border-gray-700">
          <header className="mb-0 w-[60%]">
            <h4 className="text-xl font-bold text-[#347AB6]">{titulo}</h4>
          </header>
          <div className="w-[35%] flex justify-end">
            <FormFooter
              onSubmit={handleSubmit}
              onClear={handleClear}
              isSaving={isSaving}
              hasChanges={hasChanges} // Use the calculated hasChanges
            />
          </div>
          <div className="w-[5%] flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-100 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          {loading ? (
            <Carregamento />
          ) : (
            <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 max-w-4xl mx-auto">
              {/* Campo: CODGP_P (String @id @db.VarChar(5) - REQUIRED for creation) */}
              <FormInput
                autoComplete="off"
                name="codgpp"
                type="text"
                label="Código Grupo de Produto"
                defaultValue={grupoProduto.codgpp || ''}
                onChange={handleInputChange}
                error={error?.codgpp}
                maxLength={5}
                required
              />

              {/* Campo: Descrição (String @unique @db.VarChar(30) - REQUIRED) */}
              <FormInput
                autoComplete="off"
                name="descr"
                type="text"
                label="Descrição"
                defaultValue={grupoProduto.descr || ''}
                onChange={handleInputChange}
                error={error?.descr}
                maxLength={30}
                required
              />

              {/* Campo: Cod. Vendedor (String? @db.VarChar(5) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="codvend"
                type="text"
                label="Código Vendedor"
                defaultValue={grupoProduto.codvend || ''}
                onChange={handleInputChange}
                error={error?.codvend}
                maxLength={5}
              />

              {/* Campo: Desc. Balcão (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="descbalcao"
                type="number" // Use type="number"
                label="Desconto Balcão"
                defaultValue={grupoProduto.descbalcao ?? ''} // Use ?? '' for numbers that can be null/undefined
                onChange={handleNumberInputChange} // Use handleNumberInputChange
                error={error?.descbalcao}
                step="0.01" // Important for decimal inputs
              />

              {/* Repita o padrão para os campos de desconto dscrev30, dscrev45, etc. */}
              {/* Campo: Dsc. Rev. 30 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscrev30"
                type="number"
                label="Desc. Rev. 30 dias"
                defaultValue={grupoProduto.dscrev30 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscrev30}
                step="0.01"
              />

              {/* Campo: Dsc. Rev. 45 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscrev45"
                type="number"
                label="Desc. Rev. 45 dias"
                defaultValue={grupoProduto.dscrev45 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscrev45}
                step="0.01"
              />

              {/* Campo: Dsc. Rev. 60 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscrev60"
                type="number"
                label="Desc. Rev. 60 dias"
                defaultValue={grupoProduto.dscrev60 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscrev60}
                step="0.01"
              />
               {/* Campo: Dsc. Revenda 30 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscrv30"
                type="number"
                label="Desc. Revenda 30 dias"
                defaultValue={grupoProduto.dscrv30 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscrv30}
                step="0.01"
              />
              {/* Campo: Dsc. Revenda 45 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscrv45"
                type="number"
                label="Desc. Revenda 45 dias"
                defaultValue={grupoProduto.dscrv45 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscrv45}
                step="0.01"
              />
              {/* Campo: Dsc. Revenda 60 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscrv60"
                type="number"
                label="Desc. Revenda 60 dias"
                defaultValue={grupoProduto.dscrv60 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscrv60}
                step="0.01"
              />
               {/* Campo: Dsc. Balcão 30 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscbv30"
                type="number"
                label="Desc. Balcão 30 dias"
                defaultValue={grupoProduto.dscbv30 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscbv30}
                step="0.01"
              />
              {/* Campo: Dsc. Balcão 45 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscbv45"
                type="number"
                label="Desc. Balcão 45 dias"
                defaultValue={grupoProduto.dscbv45 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscbv45}
                step="0.01"
              />
              {/* Campo: Dsc. Balcão 60 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscbv60"
                type="number"
                label="Desc. Balcão 60 dias"
                defaultValue={grupoProduto.dscbv60 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscbv60}
                step="0.01"
              />
              {/* Campo: Dsc. Prazo 30 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscpv30"
                type="number"
                label="Desc. Prazo 30 dias"
                defaultValue={grupoProduto.dscpv30 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscpv30}
                step="0.01"
              />
              {/* Campo: Dsc. Prazo 45 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscpv45"
                type="number"
                label="Desc. Prazo 45 dias"
                defaultValue={grupoProduto.dscpv45 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscpv45}
                step="0.01"
              />
              {/* Campo: Dsc. Prazo 60 (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="dscpv60"
                type="number"
                label="Desc. Prazo 60 dias"
                defaultValue={grupoProduto.dscpv60 ?? ''}
                onChange={handleNumberInputChange}
                error={error?.dscpv60}
                step="0.01"
              />


              {/* Campo: Com. GPP (Decimal? @db.Decimal(3, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="comgpp"
                type="number"
                label="Comissão GPP"
                defaultValue={grupoProduto.comgpp ?? ''}
                onChange={handleNumberInputChange}
                error={error?.comgpp}
                step="0.01"
              />

              {/* Campo: Com. GPP TMK (Decimal? @db.Decimal(3, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="comgpptmk"
                type="number"
                label="Comissão GPP Telemarketing"
                defaultValue={grupoProduto.comgpptmk ?? ''}
                onChange={handleNumberInputChange}
                error={error?.comgpptmk}
                step="0.01"
              />

              {/* Campo: Com. GPP Ext. TMK (Decimal? @db.Decimal(3, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="comgppextmk"
                type="number"
                label="Comissão GPP Ext. Telemarketing"
                defaultValue={grupoProduto.comgppextmk ?? ''}
                onChange={handleNumberInputChange}
                error={error?.comgppextmk}
                step="0.01"
              />

              {/* Campo: Código Segmento (String? @db.VarChar(5) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="codseg"
                type="text"
                label="Código Segmento"
                defaultValue={grupoProduto.codseg || ''}
                onChange={handleInputChange}
                error={error?.codseg}
                maxLength={5}
              />

              {/* Campo: Dias Reposição (Int? @default(40) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="diasreposicao"
                type="number" // Use type="number"
                label="Dias Reposição"
                defaultValue={grupoProduto.diasreposicao ?? ''}
                onChange={handleNumberInputChange}
                error={error?.diasreposicao}
                step="1" // For integer inputs
              />

              {/* Campo: Código Comprador (String? @default("000") @db.VarChar(3) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="codcomprador"
                type="text"
                label="Código Comprador"
                defaultValue={grupoProduto.codcomprador || ''}
                onChange={handleInputChange}
                error={error?.codcomprador}
                maxLength={3}
              />

              {/* Campo: Ramo Negócio (String? @default("S") @db.VarChar(1) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="ramonegocio"
                type="text"
                label="Ramo Negócio"
                defaultValue={grupoProduto.ramonegocio || ''}
                onChange={handleInputChange}
                error={error?.ramonegocio}
                maxLength={1}
              />

              {/* Campo: GPP ID (Decimal? @db.Decimal - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="gpp_id"
                type="number"
                label="GPP ID"
                defaultValue={grupoProduto.gpp_id ?? ''}
                onChange={handleNumberInputChange}
                error={error?.gpp_id}
                step="0.01" // Assuming it can be decimal
              />

              {/* Campo: P. Comercial (Int? @default(0) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="p_comercial"
                type="number"
                label="P. Comercial"
                defaultValue={grupoProduto.p_comercial ?? ''}
                onChange={handleNumberInputChange}
                error={error?.p_comercial}
                step="1"
              />

              {/* Campo: V. Marketing (Decimal? @default(0) @db.Decimal(5, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="v_marketing"
                type="number"
                label="Valor Marketing"
                defaultValue={grupoProduto.v_marketing ?? ''}
                onChange={handleNumberInputChange}
                error={error?.v_marketing}
                step="0.01"
              />

              {/* Campo: Código GPC (String? @default("0000") @db.VarChar(4) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="codgpc"
                type="text"
                label="Código GPC"
                defaultValue={grupoProduto.codgpc || ''}
                onChange={handleInputChange}
                error={error?.codgpc}
                maxLength={4}
              />

              {/* Campo: Margem Min. Venda (Decimal? @default(10.00) @db.Decimal(7, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="margem_min_venda"
                type="number"
                label="Margem Mín. Venda"
                defaultValue={grupoProduto.margem_min_venda ?? ''}
                onChange={handleNumberInputChange}
                error={error?.margem_min_venda}
                step="0.01"
              />

              {/* Campo: Margem Med. Venda (Decimal? @default(10.00) @db.Decimal(7, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="margem_med_venda"
                type="number"
                label="Margem Média Venda"
                defaultValue={grupoProduto.margem_med_venda ?? ''}
                onChange={handleNumberInputChange}
                error={error?.margem_med_venda}
                step="0.01"
              />

              {/* Campo: Margem Ide. Venda (Decimal? @default(10.00) @db.Decimal(7, 2) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="margem_ide_venda"
                type="number"
                label="Margem Ideal Venda"
                defaultValue={grupoProduto.margem_ide_venda ?? ''}
                onChange={handleNumberInputChange}
                error={error?.margem_ide_venda}
                step="0.01"
              />

              {/* Campo: Bloquear Preço (String? @default("S") @db.VarChar(1) - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="bloquear_preco"
                type="text"
                label="Bloquear Preço (S/N)"
                defaultValue={grupoProduto.bloquear_preco || ''}
                onChange={handleInputChange}
                error={error?.bloquear_preco}
                maxLength={1}
              />

              {/* Campo: Cod. Grupo Pai (Decimal? @db.Decimal - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="codgrupai"
                type="number"
                label="Código Grupo Pai"
                defaultValue={grupoProduto.codgrupai ?? ''}
                onChange={handleNumberInputChange}
                error={error?.codgrupai}
                step="0.01" // Assuming it can be decimal
              />

              {/* Campo: Cod. Grupo Produto (Decimal? @db.Decimal - OPTIONAL) */}
              <FormInput
                autoComplete="off"
                name="codgrupoprod"
                type="number"
                label="Código Grupo Produto"
                defaultValue={grupoProduto.codgrupoprod ?? ''}
                onChange={handleNumberInputChange}
                error={error?.codgrupoprod}
                step="0.01" // Assuming it can be decimal
              />

              {/* Campo: DSCBALCAO (Decimal? @db.Decimal(5, 2) - OPTIONAL, note capitalização) */}
              <FormInput
                autoComplete="off"
                name="DSCBALCAO"
                type="number"
                label="DSCBALCAO (Capitalizado)"
                defaultValue={grupoProduto.DSCBALCAO ?? ''}
                onChange={handleNumberInputChange}
                error={error?.DSCBALCAO}
                step="0.01"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalFormCadastrarGrupoProduto;