import React, { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import FormInput from '@/components/common/FormInput';
import axios from 'axios';


interface Props {
  codvendas: string[]; // AGORA É ARRAY
  isOpen: boolean;
  onClose: () => void;
}

export default function TelaDadosFaturaModal({ codvendas, isOpen, onClose }: Props) {
  const [dadosFaturas, setDadosFaturas] = useState<any[]>([]);
  const [mostrarNotaModal, setMostrarNotaModal] = useState(false);

  useEffect(() => {
    if (codvendas?.length) {
      axios
        .get(`/api/faturamento/detalhes-venda?codvenda=${codvendas.join(',')}`)
        .then((res) => setDadosFaturas(res.data))
        .catch((err) => console.error('Erro ao carregar dados das faturas:', err));
    }
  }, [codvendas]);

  const handleChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked ?? false;

    setDadosFaturas((prev) => {
      const copia = [...prev];
      copia[index][name] = type === 'checkbox' ? checked : value;
      return copia;
    });
  };

  const handleSubmit = () => {
    console.log('Salvar faturas:', dadosFaturas);
    setMostrarNotaModal(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title={`Dados das Faturas (${codvendas.length})`} width="w-full md:w-[95vw]">
        <div className="space-y-10 max-h-[75vh] overflow-auto text-white">
          {dadosFaturas.map((dados, index) => (
            <div key={dados.codvenda} className="bg-zinc-800 p-4 rounded-md shadow-lg">
              <h2 className="text-lg font-bold text-blue-300 mb-2">Fatura Nº {dados.nrovenda}</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <FormInput name="cliente" type="text" label="Cliente" value={dados.dbclien?.nome ?? ''} readOnly />
                <FormInput name="cnpj" type="text" label="CNPJ" value={dados.dbclien?.cpfcgc ?? ''} readOnly />
                <FormInput name="uf" type="text" label="UF" value={dados.dbclien?.uf ?? ''} readOnly />
                <FormInput name="ie" type="text" label="IE" value={dados.dbclien?.iest ?? ''} readOnly />
                <FormInput name="ipi" type="text" label="IPI" value={dados.dbclien?.ipi ?? ''} readOnly />
                <FormInput name="cfop" type="text" label="CFOP" value={dados.dbitvenda?.[0]?.cfop ?? ''} readOnly />
                <FormInput name="total" type="text" label="Total Produtos" value={dados.total ?? ''} readOnly />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput name="vendedor" label="Vendedor" value={dados.codvend ?? ''} onChange={(e) => handleChange(index, e)} type="text" />
                <FormInput name="transportadora" label="Transportadora" value={dados.transp ?? ''} onChange={(e) => handleChange(index, e)} type="text" />
                <FormInput name="data" type="date" label="Data" value={dados.data?.split('T')[0] ?? ''} onChange={(e) => handleChange(index, e)} />
                <FormInput name="pedido" label="Pedido" value={dados.nrovenda ?? ''} onChange={(e) => handleChange(index, e)} type="text" />
                <FormInput name="mensagemNF" label="Mensagem NF" value={dados.numeroserie ?? ''} onChange={(e) => handleChange(index, e)} type="text" />
                <FormInput name="observacao" label="Observações" value={dados.obs ?? ''} onChange={(e) => handleChange(index, e)} type="text" />

                <div>
                  <label className="block text-sm font-medium mb-1">Modalidade de Transporte</label>
                  <select
                    name="modalidade"
                    value={dados.modalidadeTransporte ?? ''}
                    onChange={(e) => handleChange(index, e)}
                    className="w-full bg-zinc-700 p-2 rounded"
                  >
                    <option value="">Selecionar...</option>
                    <option value="0">0 - CIF</option>
                    <option value="1">1 - FOB</option>
                    <option value="2">2 - Terceiros</option>
                    <option value="3">3 - Próprio Remetente</option>
                    <option value="4">4 - Próprio Destinatário</option>
                    <option value="9">9 - Sem Transporte</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-4">
            <button onClick={onClose} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md">Cancelar</button>
            <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md">Salvar Todas</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
