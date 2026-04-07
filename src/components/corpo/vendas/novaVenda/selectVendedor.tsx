import * as React from 'react';
import { FaSearch } from 'react-icons/fa';
import { FaPerson } from 'react-icons/fa6';
import useFocusProd from './userFocus/prodUseFocus';
import api from '@/components/services/api';
import Carregamento from '@/utils/carregamento';
import { BiSolidError } from 'react-icons/bi';
import { PiSmileySadFill } from 'react-icons/pi';
import { Button } from '@/components/ui/button';

function createProduto(codigo: string, nome: string) {
  return {
    codigo,
    nome,
  };
}

interface ChildProps {
  readonly handleVendedor: (arg0: { codigo: string; nome: string }) => void;
}

const SelectVendedor: React.FC<ChildProps> = ({ handleVendedor }) => {
  const [pesquisa, setPesquisa] = React.useState('');
  const seachInputRef2 = useFocusProd<HTMLInputElement>();
  const [mensagem, setMensagem] = React.useState('');
  const [vendedor, setVendedor] = React.useState<
    {
      codigo: string;
      nome: string;
    }[]
  >([]);
  const [iconesInfo, setIconeInfo] = React.useState('');
  const [loadingVendedor, setLoadingVendedor] = React.useState(false);
  const [showVendedor, setShowVendedor] = React.useState(false);
  const [dentroProd, setDentroProd] = React.useState(false);

  const handleBuscarVendedor = async () => {
    await api
      .post('/api/dbOracle/buscarVendedorCod', {
        descricao: pesquisa,
      })
      .then((response) => {
        if (response.data.length) {
          const arrayVendedor: {
            codigo: string;
            nome: string;
          }[] = [];
          response.data.map((val: { CODVEND: string; NOME: string }) => {
            if (val.CODVEND) {
              const newPerfil = createProduto(
                val.CODVEND,
                val.NOME ? val.NOME : '',
              );

              arrayVendedor.push(newPerfil);
            }
            return 0;
          });

          setVendedor(arrayVendedor);
          setLoadingVendedor(false);
          setShowVendedor(true);
          setMensagem('');
        } else {
          setMensagem('Nenhum vendedor encontrado');
          setIconeInfo('none');
          setShowVendedor(false);
          setVendedor([]);
        }
      })
      .catch((error: string) => {
        console.log(error);
        setIconeInfo('falha');
        setMensagem(
          'Não conseguimos acessar o banco de dados, comunique a equipe técnica!!!',
        );
        setShowVendedor(false);
        setVendedor([]);
        setLoadingVendedor(false);
      });
  };

  React.useEffect(() => {
    //apontar focu produto e bloquio financeiro
    if (seachInputRef2.current) seachInputRef2.current.focus();
  }, [seachInputRef2]);

  return (
    <div
      className="relative z-10"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity">
        <div className=" fixed inset-1 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="w-[80%] transform overflow-hidden rounded-lg bg-white dark:bg-zinc-800 text-left shadow-xl transition-all  ">
              <div className=" text-primary border-b border-gray-100 font-bold flex justify-center px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <div className="w-full   flex items-center justify-center ">
                  <div className="relative h-10 w-full min-w-[200px]">
                    <div className="absolute top-2/4 right-3 grid h-5 w-5 -translate-y-2/4 place-items-center text-gray-500">
                      <FaSearch
                        size={20}
                        className={`text-gray-300 dark:text-gray-500`}
                      />
                    </div>
                    <input
                      className="peer h-full w-full rounded-[7px] 
                                border border-gray-300 dark:border-gray-400
                                 dark:focus:border-indigo-300
                                 dark:focus:border-t-transparent
                                 bg-transparent px-3 py-2.5 !pr-9 
                                 font-sans text-sm font-normal 
                                 text-gray-400
                                 focus:text-indigo-600  
                                 dark:text-gray-600 
                                 dark:focus:text-indigo-200 outline outline-0 
                                 transition-all   focus:border-2 
                                 focus:border-indigo-300 focus:border-t-transparent
                                 dark:border-t-transparent 
                                 
                                 border-t-transparent focus:outline-0 
                                 placeholder-shown:border-t  
                                 dark:placeholder-shown:border-gray-400
                                 placeholder-shonw:border-gray-400
                                 placeholder-shown:border-gray-300
                                 placeholder-shown:placeholder-gray-400 
                                 dark:placeholder-shown:placeholder-gray-500
                                  disabled:border-0 disabled:bg-gray-50"
                      ref={seachInputRef2}
                      value={pesquisa || ''}
                      onChange={(e) => {
                        const newE = e.target.value.toLocaleUpperCase();

                        setPesquisa(newE);

                        //              if (newE.length < 3) setProduto([]);
                        return 0;
                      }}
                      onFocus={() => {
                        setMensagem('');
                        setIconeInfo('');
                        setLoadingVendedor(false);
                        setDentroProd(true);
                        setPesquisa('');
                      }}
                      onBlur={() => {
                        setDentroProd(false);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key.toLowerCase() === 'enter' &&
                          pesquisa.length > 2
                        ) {
                          setMensagem('');
                          setIconeInfo('');
                          setLoadingVendedor(true);
                          setShowVendedor(false);
                          handleBuscarVendedor();
                          // handleBuscarPreco();
                        }

                        if (
                          event.key.toLowerCase() === 'enter' &&
                          pesquisa.length < 3
                        ) {
                          setMensagem('');
                          setIconeInfo('');
                          setLoadingVendedor(false);
                          setVendedor([]);
                        }
                      }}
                      disabled={false}
                      type="text"
                      placeholder={
                        dentroProd ? `Buscar Vendedor (codigo ou nome)` : '  '
                      }
                    />
                    <label
                      className="text-gray-400 
                                before:content[' '] after:content[' '] 
                              pointer-events-none absolute left-0 -top-1.5 
                              flex h-full w-full select-none text-[11px] font-normal 
                              leading-tight  transition-all 
                              before:pointer-events-none before:mt-[6.5px] 
                              before:mr-1 before:box-border before:block 
                              before:h-1.5 before:w-2.5 before:rounded-tl-md
                              before:border-t before:border-l 
                              before:border-gray-300 before:transition-all 
                              after:pointer-events-none after:mt-[6.5px] 
                              after:ml-1 after:box-border after:block 
                              after:h-1.5 after:w-2.5 after:flex-grow 
                              after:rounded-tr-md after:border-t after:border-r 
                              after:border-gray-300 after:transition-all 
                              dark:after:border-gray-500
                              peer-focus:after:border-t-2
                              peer-placeholder-shown:text-sm 
                              peer-placeholder-shown:leading-[3.75] 
                              peer-placeholder-shown:text-gray-400
                              dark:peer-placeholder-shown:text-gray-500 
                              peer-placeholder-shown:before:border-transparent 
                              peer-placeholder-shown:after:border-transparent 
                              peer-focus:text-[11px] peer-focus:leading-tight 
                              peer-focus:text-indigo-500
                              dark:peer-focus:text-indigo-200
                              peer-focus:before:border-t-1 
                              peer-focus:before:border-l-2 
                              peer-focus:before:border-indigo-300 
                              peer-focus:after:border-t-1 
                              peer-focus:after:border-r-2
                              peer-focus:after:border-indigo-300 
                              peer-disabled:text-transparent 
                              peer-disabled:before:border-transparent 
                              peer-disabled:after:border-transparent "
                    >
                      Vendedor
                    </label>
                  </div>
                  <div
                    className="w-32 ml-4"
                    onClick={() => {
                      handleVendedor({
                        codigo: 'nulo',
                        nome: 'fechar vendedor',
                      });
                    }}
                  >
                    {' '}
                    <Button
                      className={`bg-indigo-500 hover:bg-indigo-700 w-full text-[8px] md:text-[10px] 
                                font-bold   flex items-center `}
                    >
                      FECHAR
                    </Button>
                  </div>
                </div>
              </div>{' '}
              <div className=" w-full text-primary font-bold h-72 flex justify-center px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <div className="w-full text-primary font-bold   ">
                  <div className="w-full h-full">
                    {showVendedor && vendedor.length ? (
                      <div className="h-full w-full    flex justify-center items-start ">
                        {loadingVendedor ? (
                          <Carregamento />
                        ) : (
                          <div className="flex-grow w-full h-[100%]   overflow-auto ">
                            {vendedor.map((val, index) => (
                              <div
                                key={index}
                                className="w-full flex justify-start cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-primary font-bold  "
                                onClick={() => {
                                  handleVendedor(val);
                                }}
                              >
                                <div className=" text-primary font-bold flex justify-center px-2 py-3 sm:flex sm:flex-row-reverse sm:px-2">
                                  {val.codigo} - {val.nome}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full w-full   flex justify-center items-center ">
                        <div className="h-full w-full">
                          <div className="h-[calc(100%-3rem)]  flex justify-center items-center">
                            {mensagem.length ? (
                              <div>
                                <div>
                                  {iconesInfo === 'falha' ? (
                                    <div className="py-4 flex justify-center">
                                      <BiSolidError
                                        className=" dark:text-red-200 text-red-400"
                                        size={60}
                                      />{' '}
                                    </div>
                                  ) : null}
                                  {iconesInfo === 'none' ? (
                                    <div className="py-4 flex justify-center">
                                      <PiSmileySadFill
                                        className=" dark:text-yellow-200 text-yellow-300"
                                        size={60}
                                      />{' '}
                                    </div>
                                  ) : null}
                                </div>
                                <div>{mensagem}</div>
                              </div>
                            ) : (
                              <div>
                                {loadingVendedor ? (
                                  <Carregamento />
                                ) : (
                                  <div>
                                    <div>
                                      {iconesInfo === '' ? (
                                        <div className="py-4 flex justify-center">
                                          <FaPerson
                                            className=" dark:dark:text-indigo-300 text-indigo-600"
                                            size={60}
                                          />{' '}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div>
                                      <div className="text-center font-bold dark:text-indigo-300 text-indigo-600">
                                        PESQUISAR UM VENDEDOR
                                      </div>
                                      <div className=" font-bold text-indigo-600 dark:text-indigo-300">
                                        Digite pelo menos 3 digitos e pressione
                                        enter...
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>{' '}
              </div>{' '}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SelectVendedor;
