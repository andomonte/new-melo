import * as React from 'react';
export type Payment = {
  codigo: string;
  descrição: string;
  marca: string;
  estoque: string;
  preço: string;
  ref: string;
  quantidade: string;
  descriçãoEditada: string;
  totalItem: string;
  precoItemEditado: string;
  tipoPreço: string;
  desconto: number;
  origem: string;
};
import ConfirmaCompra from './confirmaCompra';
import MascaraReal from '@/utils/mascaraReal';
import { FaPlus, FaMinus } from 'react-icons/fa';
import { MdDeleteForever } from 'react-icons/md';

interface ChildProps {
  data2: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string;
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string;
    tipoPreço: string;
    desconto: number;
    origem: string;
  }[];
  readonly produtoSelecionado: (arg0: string) => void;
  readonly telaSelecionada: (arg0: string) => void;
  readonly handleCarrinho: (arg0: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string;
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string;
    tipoPreço: string;
    desconto: number;
    origem: string;
  }) => void;
  tela: string;
  cliente: string;
}

const DataTablecolumns: React.FC<ChildProps> = ({
  data2,
  produtoSelecionado,
  cliente,
  handleCarrinho,
}) => {
  const quantT = data2.map((val) => val.quantidade);
  const [quant, setQuant] = React.useState(quantT);
  const [openConfirma, setOpenConfirma] = React.useState(false);
  const [indexItem, setIndexItem] = React.useState(0);
  //const [columns, setColumns] = React.useState(columnsT);

  /*   React.useEffect(() => {
    if (quant) {
      const novoArr = data2?.map((val) => val);
      data2?.map((val, index) => {
        const newValor = Number(
          Number(quant[index]) * Number(val.preço),
        ).toFixed(2);

        if (
          val?.codigo &&
          (val?.descrição || val.descrição === '') &&
          (val?.estoque || val.estoque === '') &&
          (val?.preço || val.preço === '')
        ) {
          novoArr[index].codigo = val?.codigo;
          novoArr[index].descrição = val?.descrição;
          novoArr[index].estoque = val?.estoque;
          novoArr[index].preço = val?.preço;
          novoArr[index].ref = val?.ref;
          novoArr[index].quantidade = quant[index];
          novoArr[index].totalItem = String(newValor);
          novoArr[index].precoItemEditado = String(newValor);
          novoArr[index].descriçãoEditada = val.descriçãoEditada
            ? val.descriçãoEditada
            : val.descrição;
        }
        return 0;
      });
      const newCar = data2.filter(
        (val) => val.quantidade !== '0' && val.quantidade !== '',
      );

      handleCarrinho(newCar);
    }
  }, [quant, data2, handleCarrinho]); */

  const handleAtualizarQuant = (indexQuant: number, novoQuant: string) => {
    if (novoQuant) {
      const novoArr = data2?.map((val) => val);
      data2?.map((val, index) => {
        let newValor = Number(
          Number(data2[index].quantidade) * Number(val.precoItemEditado),
        ).toFixed(2);
        if (
          val?.codigo &&
          (val?.descrição || val.descrição === '') &&
          (val?.estoque || val.estoque === '') &&
          (val?.preço || val.preço === '')
        ) {
          if (index === indexQuant) {
            newValor = Number(
              Number(novoQuant) * Number(val.precoItemEditado),
            ).toFixed(2);
            novoArr[index].codigo = val?.codigo;
            novoArr[index].descrição = val?.descrição;
            novoArr[index].estoque = val?.estoque;
            novoArr[index].preço = val?.preço;
            novoArr[index].ref = val?.ref;
            novoArr[index].quantidade = novoQuant;
            novoArr[index].totalItem = String(newValor);
            novoArr[index].precoItemEditado = val?.preço;
            novoArr[index].descriçãoEditada = val.descriçãoEditada
              ? val.descriçãoEditada
              : val.descrição;
          } else {
            novoArr[index].codigo = val?.codigo;
            novoArr[index].descrição = val?.descrição;
            novoArr[index].estoque = val?.estoque;
            novoArr[index].preço = val?.preço;
            novoArr[index].ref = val?.ref;
            novoArr[index].quantidade = val?.quantidade;
            novoArr[index].totalItem = val?.totalItem;
            novoArr[index].precoItemEditado = val?.precoItemEditado;
            novoArr[index].descriçãoEditada = val.descriçãoEditada
              ? val.descriçãoEditada
              : val.descrição;
          }
        }
        return 0;
      });
      // BUGFIX: usar novoArr (atualizado) em vez de data2 (original)
      handleCarrinho(novoArr[indexQuant]);
    }
  };
  const handleAtualizar = (novoCar: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string;
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string;
    tipoPreço: string;
    desconto: number;
    origem: string;
  }) => {
    if (novoCar.codigo) {
      const novoArr = data2?.map((val) => val);
      data2?.map((val, index) => {
        if (val.codigo === novoCar?.codigo && val.marca === novoCar?.marca) {
          novoArr[index].codigo = novoCar.codigo;
          novoArr[index].descrição = novoCar.descrição;
          novoArr[index].estoque = novoCar.estoque;
          novoArr[index].preço = novoCar.preço;
          novoArr[index].ref = novoCar.ref;
          novoArr[index].quantidade = novoCar.quantidade;
          novoArr[index].totalItem = novoCar.totalItem;
          novoArr[index].precoItemEditado = novoCar.precoItemEditado;
          novoArr[index].descriçãoEditada = novoCar.descriçãoEditada;
        }
        return 0;
      });

      //atualizara quantidade da tela do produto
      const quantT = data2.map((val) => val.quantidade);
      setQuant(quantT);
      // BUGFIX: usar novoArr (atualizado) em vez de data2 (original)
      handleCarrinho(novoArr[indexItem]);
      //------------------------------------------------
    }
  };

  const handleDialog = (novoValor: boolean) => {
    setOpenConfirma(novoValor);
  };

  const handleCarrinho2 = (novoCar: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string;
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string;
    tipoPreço: string;
    desconto: number;
    origem: string;
  }) => {
    handleAtualizar(novoCar);
  };

  return (
    <div className="w-[100%] h-full  ">
      <div className=" h-[85%] border-b border-t border-gray-300 w-[100%] flex justify-center items-center ">
        <div className=" w-[98%]  h-[98%]">
          <div className="flex flex-col w-full h-[100%]  dark:border-gray-800">
            <div className="flex-grow w-full h-[100%]   overflow-auto">
              {data2?.length ? (
                data2.map((row, index) => (
                  <div key={index} className=" py-1  w-full h-flex">
                    {/*box 1 - 2 box um a direita e outro a esquerda  */}
                    <div
                      className="  sm:flex h-auto  rounded-lg w-[99%]  
                                     hover:bg-muted/50 overflow-hidden
                                     border border-gray-300"
                    >
                      {/*box da direita - dados da pesquisa de produto  */}
                      <div className="py-2 rounded-lg w-full sm:w-[50%] md:w-[60%] lg:w-[65%] xl:w-[70%] ">
                        <div className="px-6  h-auto ">
                          <div className="flex w-full  font-bold text-base ">
                            <div className="flex w-[100%] justify-start font-bold  text-base ">
                              {data2[index].codigo} -{' '}
                              {data2[index].descriçãoEditada.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <div className="px-6 h-auto">
                          <div className="flex w-full space-x-6  ">
                            <div className="flex space-x-1 text-green-700 dark:text-green-300 justify-start text-base ">
                              <div className="text-sm flex items-center text-gray-400">
                                marca:
                              </div>
                              <div>{data2[index].marca}</div>
                            </div>
                            <div className="flex space-x-1 text-slate-800 justify-start text-base ">
                              <div className="text-sm px-1 flex items-center text-gray-400">
                                estoque:
                              </div>
                              <div className="text-primary">
                                {data2[index].estoque}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="px-6  h-auto ">
                          <div className="flex w-full  font-bold text-base ">
                            <div className="flex w-full space-x-6  ">
                              <div
                                className="flex w-auto space-x-1 text-base 
                                        text-slate-800"
                              >
                                <div className="text-sm min-w-28 flex items-center text-gray-400">
                                  preço {data2[index].tipoPreço.toLowerCase()}:
                                </div>
                                <div className="flex items-center text-blue-500 dark:text-gray-400">
                                  {MascaraReal(Number(data2[index].preço))}
                                </div>
                              </div>
                              <div
                                className="flex space-x-1 text-base 
                                        text-green-400 dark:text-green-300"
                              >
                                <div
                                  className={`flex cursor-pointer hover:text-green-600 text-sm  items-center `}
                                  onClick={() => {
                                    setIndexItem(index);
                                    produtoSelecionado(String(index));
                                    setOpenConfirma(true);
                                  }}
                                >
                                  Editar
                                </div>
                              </div>
                            </div>

                            <div className="flex w-[100%] justify-end  text-sm">
                              <div className="w-[30%] min-w-32"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex  items-center rounded-lg w-[5%] ">
                        <div className="   w-full   ">
                          <div className=" h-full flex items-center  ">
                            <div className="flex w-full   font-bold text-base ">
                              <div className="h-4 flex w-[100%] justify-center font-bold  text-sm "></div>
                            </div>
                          </div>
                          <div className=" h-auto flex justify-center">
                            <div className=" w-[100%] h-8 flex justify-center items-center  rounded-md  min-w-32  ">
                              <div className=" h-full w-[100%] flex justify-center">
                                <div className=" flex items-center   ">
                                  <button
                                    id="decreaseButton"
                                    type="button"
                                    onClick={() => {
                                      setQuant((oldArray) => {
                                        const newArray = [...oldArray];
                                        newArray[index - 1] = '0';
                                        return newArray;
                                      });
                                      handleAtualizarQuant(index, '0');
                                    }}
                                  >
                                    <MdDeleteForever
                                      size={30}
                                      className=" flex dark:hover:text-red-600 hover:text-red-600   text-red-400 dark:text-red-300"
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/*box da esquerda - botão add e sub da quantidade  */}
                      <div className="  flex items-center rounded-lg w-full sm:w-[50%] md:w-[40%] lg:w-[35%] xl:w-[30%]  ">
                        {' '}
                        <div className="  flex items-center rounded-lg w-[45%] min-w-32  ">
                          <div
                            className={`${
                              cliente ? 'flex flex-col' : 'hidden'
                            }  w-[100%]  justify-start  ml-6  sm:mb-0 sm:justify-center sm:ml-0  
                              text-sm `}
                          >
                            <div className="flex w-full  font-bold text-base ">
                              <div
                                className="flex w-[100%] justify-center font-bold  text-sm
                                            dark:text-gray-300"
                              >
                                Quantidade
                              </div>
                            </div>
                            <div className=" w-[100%] mr-6 sm:mr-3   ">
                              <div className=" w-[100%] flex">
                                <button
                                  id="decreaseButton"
                                  className="mr-1   rounded bg-gray-600  dark:bg-gray-400 dark:hover:bg-gray-600 hover:bg-gray-400 p-1.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none active:bg-gray-700  active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                                  type="button"
                                  onClick={() => {
                                    let qytF = Number(quant[index]);

                                    if (Number(qytF) - 1 >= 0) {
                                      qytF -= 1;
                                      setQuant((oldArray) => {
                                        const newArray = [...oldArray];
                                        newArray[index] = String(qytF);
                                        return newArray;
                                      });
                                      handleAtualizarQuant(index, String(qytF));
                                    } else {
                                      setQuant((oldArray) => {
                                        const newArray = [...oldArray];
                                        newArray[index] = '0';
                                        return newArray;
                                      });
                                      handleAtualizarQuant(index, '0');
                                    }
                                  }}
                                >
                                  <FaMinus className="w-4 h-4" />
                                </button>
                                <input
                                  id="amountInput"
                                  type="number"
                                  value={data2[index].quantidade}
                                  className="text-base  lg:text-lg  
                                  leading-6  w-full bg-transparent
                                   placeholder:text-slate-400 border border-slate-200 
                                   rounded-md uppercase text-center 
                                   [&::-webkit-outer-spin-button]:appearance-none 
                                   [&::-webkit-inner-spin-button]:appearance-none
                                   focus:outline-none"
                                  onChange={(e) => {
                                    setQuant((oldArray) => {
                                      const newArray = [...oldArray];
                                      newArray[index] = e.target.value;
                                      return newArray;
                                    });
                                    handleAtualizarQuant(index, e.target.value);

                                    //                                handleQty(Number(e.target.value));
                                  }}
                                  onBlur={() => {
                                    /* if (
                                      e.target.value !== '0' &&
                                      e.target.value !== ''
                                    )
                                    //  quantidade(quant); */
                                  }}
                                />
                                <button
                                  id="increaseButton"
                                  className=" ml-1  rounded bg-gray-600 dark:bg-gray-400 dark:hover:bg-gray-600 hover:bg-gray-600 p-1.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow  focus:shadow-none active:bg-gray-700  active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
                                  type="button"
                                  onClick={() => {
                                    let qytF = Number(quant[index]);
                                    if (qytF) {
                                      qytF += 1;
                                      setQuant((oldArray) => {
                                        const newArray = [...oldArray];
                                        newArray[index] = String(qytF);
                                        return newArray;
                                      });
                                      handleAtualizarQuant(index, String(qytF));
                                    } else {
                                      setQuant((oldArray) => {
                                        const newArray = [...oldArray];
                                        newArray[index] = '1';
                                        return newArray;
                                      });
                                      handleAtualizarQuant(index, String('1'));
                                    }
                                  }}
                                >
                                  <FaPlus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className=" min-w-32 flex items-center rounded-lg w-[50%] ">
                          <div className="   w-full   ">
                            <div className="px-6 h-full flex items-center  ">
                              <div className="flex w-full   font-bold text-base dark:text-gray-300 ">
                                <div className="flex w-[100%] justify-center font-bold  text-sm ">
                                  Subtotal
                                </div>
                              </div>
                            </div>
                            <div className="px-6 h-auto">
                              <div className=" w-[100%] border border-green-300 h-8 flex justify-center items-center  rounded-md mr-6 sm:mr-3 min-w-32  ">
                                <div className=" h-full w-[100%] flex justify-center">
                                  <div className=" flex items-center font-bold text-lg text-green-600 dark:text-gray-200">
                                    {MascaraReal(
                                      Number(data2[index].precoItemEditado),
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="w-full h-full flex justify-center items-center dark:text-green-200 text-green-600 font-bold ">
                  O CARRINHO ESTÁ VAZIO
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div>
        {openConfirma ? (
          <ConfirmaCompra
            handleDialogo={handleDialog}
            data2={data2}
            cliente={cliente}
            indexItem={indexItem}
            handleCarrinho2={handleCarrinho2}
          />
        ) : null}
      </div>
    </div>
  );
};
export default DataTablecolumns;
