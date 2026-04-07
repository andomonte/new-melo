import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import FormInput from '@/components/common/FormInput';
import 'react-datepicker/dist/react-datepicker.css';

// ModalPrazoParcelas.tsx
interface ModalPrazoParcelasProps {
  onClose: () => void;
  onConfirm: (
    parcelas: { id: number; dataVencimento: Date; dias: number }[],
  ) => void;
  // Adicione a nova propriedade aqui, para receber os dados
  dadosIniciais?: { id: number; dataVencimento: Date; dias: number }[];
}

// Lista de feriados nacionais (exemplo - pode ser expandida)
const feriadosNacionais = [
  '2025-09-07',
  '2025-10-12',
  '2025-11-02',
  '2025-11-15',
  '2025-12-25',
];

const isFeriado = (data: Date) => {
  const dataString = format(data, 'yyyy-MM-dd');
  return feriadosNacionais.includes(dataString);
};

const getProximoDiaUtil = (data: Date) => {
  const novaData = new Date(data.getTime());
  while (
    novaData.getDay() === 0 ||
    novaData.getDay() === 6 ||
    isFeriado(novaData)
  ) {
    novaData.setDate(novaData.getDate() + 1);
  }
  return novaData;
};

const ModalPrazoParcelas: React.FC<ModalPrazoParcelasProps> = ({
  onClose,
  onConfirm,
  dadosIniciais,
}) => {
  const [prazo, setPrazo] = useState<number | ''>(30);
  const [quantidade, setQuantidade] = useState<number | ''>(
    dadosIniciais ? dadosIniciais.length : '',
  );
  const [parcelas, setParcelas] = useState(dadosIniciais || []);
  const [isAddButtonDisabled, setIsAddButtonDisabled] = useState(true);

  useEffect(() => {
    setIsAddButtonDisabled(
      !prazo || prazo <= 0 || !quantidade || quantidade <= 0,
    );
  }, [prazo, quantidade]);

  const handleAddParcela = () => {
    if (prazo && quantidade) {
      const novasParcelas = [];
      let diasAcumulados = 0;
      const dataBase = new Date();

      for (let i = 0; i < quantidade; i++) {
        diasAcumulados += prazo;
        const dataVencimento = new Date(dataBase.getTime());
        dataVencimento.setDate(dataVencimento.getDate() + diasAcumulados);
        const dataVencimentoUtil = getProximoDiaUtil(dataVencimento);

        novasParcelas.push({
          id: i + 1,
          dataVencimento: dataVencimentoUtil,
          dias: diasAcumulados,
        });
      }
      setParcelas(novasParcelas);
    }
  };

  const handleUpdateDate = (id: number, newDate: Date | null) => {
    if (newDate && isValid(newDate)) {
      const novaDataUtil = getProximoDiaUtil(newDate);

      // Crie a data base (hoje) para o cálculo
      const dataBase = new Date();

      // Calcule a diferença em milissegundos
      const diferencaEmMilissegundos =
        novaDataUtil.getTime() - dataBase.getTime();

      // Converta para dias
      const novosDias = Math.ceil(
        diferencaEmMilissegundos / (1000 * 60 * 60 * 24),
      );

      setParcelas((prevParcelas) =>
        prevParcelas.map((parcela) =>
          parcela.id === id
            ? { ...parcela, dataVencimento: novaDataUtil, dias: novosDias } // Atualiza a data e os dias
            : parcela,
        ),
      );
    }
  };

  const handleRemoveParcela = (id: number) => {
    setParcelas(parcelas.filter((parcela) => parcela.id !== id));
  };

  const handleConfirm = () => {
    onConfirm(parcelas);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center px-4">
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-4xl flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-4 py-3 border-b dark:border-gray-700">
          <h4 className="text-xl font-bold text-[#347AB6]">PRAZO E PARCELAS</h4>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-100 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="flex-grow overflow-y-auto px-6 py-6 text-gray-800 dark:text-gray-100">
          <div className="bg-white dark:bg-zinc-700 rounded-lg p-6 shadow space-y-6 max-w-4xl mx-auto">
            {/* Campo de Prazo e Quantidade */}
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium">
                  INTERVALO DE DIAS ENTRE AS PARCELAS{' '}
                </label>
                <div className="mt-1">
                  <FormInput
                    name="prazo"
                    type="text"
                    placeholder="Ex: 30"
                    value={prazo}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPrazo(value ? parseInt(value) : '');
                    }}
                    pattern="[0-9]*"
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium">
                  QUANTIDADE (VEZES)
                </label>
                <div className="mt-1">
                  <FormInput
                    name="quantidade"
                    type="text"
                    placeholder="Ex: 2"
                    value={quantidade}
                    onChange={(e) => {
                      const value = e.target.value;
                      setQuantidade(value ? parseInt(value) : '');
                    }}
                    pattern="[0-9]*"
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleAddParcela}
                disabled={isAddButtonDisabled}
                className={`bg-[#347AB6] text-white font-bold py-2 px-4 rounded-lg transition duration-300 ${
                  isAddButtonDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#2e6ea5]'
                }`}
              >
                + Adicionar
              </button>
            </div>

            {/* Lista de Parcelas */}
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {parcelas.map((parcela) => (
                <div
                  key={parcela.id}
                  className="p-4 rounded-lg border dark:border-gray-600 flex justify-between items-center"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">
                      PARCELA {parcela.id} - {parcela.dias} DIAS
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar
                        size={16}
                        className="text-gray-500 dark:text-gray-400"
                      />
                      <DatePicker
                        selected={parcela.dataVencimento}
                        onChange={(date) => handleUpdateDate(parcela.id, date)}
                        dateFormat="dd/MM/yyyy"
                        locale={ptBR}
                        className="bg-transparent text-gray-800 dark:text-gray-100 outline-none border-b border-gray-400 dark:border-gray-500 focus:border-blue-500 w-32"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveParcela(parcela.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>

            {/* Botão Confirmar */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={parcelas.length === 0}
                className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 ${
                  parcelas.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalPrazoParcelas;
