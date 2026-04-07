import React from 'react';
import ModalFormulario from '@/components/common/modalform';
import SelectInput from '@/components/common/SelectInput2';
import { DefaultButton } from '@/components/common/Buttons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (statusVenda: {
    tipodoc: string;
    cobranca: string;
    insc07: string;
  }) => void;
  statusVenda: {
    tipodoc: string;
    cobranca: string;
    insc07: string;
  };
  setStatusVenda: React.Dispatch<
    React.SetStateAction<{
      tipodoc: string;
      cobranca: string;
      insc07: string;
    }>
  >;
}

export default function ModalStatusVenda({
  isOpen,
  onClose,
  onConfirm,
  statusVenda,
  setStatusVenda,
}: Props) {
  if (!isOpen) return null;
  return (
    <ModalFormulario
      onClose={onClose}
      titulo="Status da Venda"
      handleSubmit={() => onConfirm(statusVenda)}
      handleClear={onClose}
      tabs={[]}
      activeTab="dados"
      setActiveTab={() => {}}
      footer={
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => onConfirm(statusVenda)}

            className="px-4 py-2 rounded bg-blue-900 text-white hover:bg-blue-900"
          >
            Continuar
          </button>
        </div>
      }
      renderTabContent={() => (
        <div className="space-y-4">
          <SelectInput
            label="Tipo Documentação"
            name="tipodoc"
            value={statusVenda.tipodoc}
            onValueChange={(value) =>
              setStatusVenda((prev) => ({ ...prev, tipodoc: value }))
            }
            options={[
              { value: 'F', label: 'FAG' },
              { value: 'N', label: 'NOTA FISCAL' },
            ]}
          />
          <SelectInput
            label="Gerar Cobrança"
            name="cobranca"
            value={statusVenda.cobranca}
            onValueChange={(value) =>
              setStatusVenda((prev) => ({ ...prev, cobranca: value }))
            }
            options={[
              { value: 'S', label: 'SIM' },
              { value: 'N', label: 'NÃO' },
            ]}
          />
          <SelectInput
            label="Inscrição Estadual (AM)"
            name="insc07"
            value={statusVenda.insc07}
            onValueChange={(value) =>
              setStatusVenda((prev) => ({ ...prev, insc07: value }))
            }
            options={[
              { value: 'N', label: 'INSC. ESTADUAL 04' },
              { value: 'S', label: 'INSC. ESTADUAL 07' },
            ]}
          />
        </div>
      )}
    />
  );
}
