import * as React from 'react';

interface ChildProps {
  readonly handleInfoCliente: (arg0: boolean) => void;
  clienteSelect: {
    codigo: string;
    nome: string;
    documento: string;
    nomeFantasia: string;
    saldo: number;
    status: string;
    desconto: number;
    ipi: string;
    icms: string;
    zona: string;
    claspgto: string;
    uf: string;
    tipo: string;
    limiteAtraso: number;
    diasAtrasado: number;
  };
}

const InformeCliente: React.FC<ChildProps> = ({
  clienteSelect,
  handleInfoCliente,
}) => {
  return (
    <div
      className="relative z-10 "
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
      ></div>
      <div className="flex justify-center items-center fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="py-8 w-[90%] md:w-[50%] bg-gray-100 rounded-lg dark:bg-slate-700">
          <div className="py-6 w-full font-bold  flex justify-center ">
            <div>Cliente com Pendencias</div>
          </div>
          <div className="w-full   flex justify-center mt-0">
            <div>O cliente {clienteSelect?.nome}</div>
          </div>
          <div
            className={`${
              clienteSelect?.diasAtrasado ? 'flex' : 'hidden'
            } w-full  justify-center py-2`}
          >
            <div className="flex">
              possui Título(s) com
              <div className="font-bold px-1 text-red-500 dark:text-red-200">
                {clienteSelect?.diasAtrasado} dias
              </div>
              em atraso
            </div>
          </div>
          <div
            className={`${
              clienteSelect?.saldo <= 0 ? 'flex' : 'hidden'
            } w-full  justify-center`}
          >
            <div className="flex">
              {clienteSelect?.diasAtrasado ? 'e' : 'possue'} saldo insuficiente
              de
              <div className="font-bold px-1 text-red-500 dark:text-red-200">
                {clienteSelect?.saldo}
              </div>
              Reais
            </div>
          </div>

          <div className="w-ful flex justify-center mt-16  px-4 mb-3  ">
            <button
              type="button"
              className=" w-36 items-center text-xs sm:text-sm md:text-base  mt-3 inline-flex  bg-red-600 justify-center rounded-md  px-3 py-2  font-semibold text-gray-50 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-400 sm:mt-0 "
              onClick={() => {
                handleInfoCliente(false);
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InformeCliente;
