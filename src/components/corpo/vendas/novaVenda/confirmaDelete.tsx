import * as React from 'react';

interface ChildProps {
  readonly handleDelete: (arg0: boolean) => void;
}

const ConfirmaCompra: React.FC<ChildProps> = ({ handleDelete }) => {
  return (
    <div
      className="relative z-10"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
      ></div>
      <div className="flex justify-center items-center fixed inset-1 z-10 w-screen overflow-y-auto">
        <div className="w-[50%] bg-gray-100 rounded-lg dark:bg-slate-700">
          <div className="w-full font-bold  flex justify-center py-5">
            <div>QUER MESMO ESVAZIAR O CARRINHO?</div>
          </div>
          <div className=" mt-5  px-4 mb-3 sm:flex  sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              className=" w-36 ml-5 items-center text-xs sm:text-sm md:text-base  mt-3 inline-flex  bg-red-600 justify-center rounded-md  px-3 py-2  font-semibold text-gray-50 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-400 sm:mt-0 "
              onClick={() => {
                handleDelete(false);
              }}
            >
              Não
            </button>
            <button
              onClick={() => handleDelete(true)}
              type="button"
              className=" w-36 items-center text-xs sm:text-sm md:text-base  mt-3 inline-flex  bg-blue-600 justify-center rounded-md  px-3 py-2  font-semibold text-gray-50 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-blue-400 sm:mt-0 "
            >
              Sim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmaCompra;
