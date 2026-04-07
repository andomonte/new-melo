import * as React from 'react';
import { FaSearch } from 'react-icons/fa';
import useFocusProd from './userFocus/prodUseFocus';
import api from '@/components/services/api';
import Carregamento from '@/utils/carregamento';
import { BiSolidError } from 'react-icons/bi';
import { PiSmileySadFill } from 'react-icons/pi';
import { FaTruck } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

function createProduto(codigo: string, nome: string) {
  return { codigo, nome };
}

interface ChildProps {
  readonly handleLocal: (arg0: { codigo: string; nome: string }) => void;
}

const SelectLocal: React.FC<ChildProps> = ({ handleLocal }) => {
  const [pesquisa, setPesquisa] = React.useState('');
  const seachInputRef = useFocusProd<HTMLInputElement>();
  const [mensagem, setMensagem] = React.useState('');
  const [local, setLocal] = React.useState<{ codigo: string; nome: string }[]>(
    [],
  );
  const [iconesInfo, setIconeInfo] = React.useState('');
  const [loadingEntrega, setLoadingEntrega] = React.useState(false);
  const [showEntrega, setShowEntrega] = React.useState(false);
  const [dentroProd, setDentroProd] = React.useState(false);

  // paginação / infinite scroll
  const [page, setPage] = React.useState(0);
  const [pageSize] = React.useState(30); // ajuste fino aqui (30/50 fica leve)
  const [total, setTotal] = React.useState<number | null>(null);
  const [hasMore, setHasMore] = React.useState(false);

  const listaRef = React.useRef<HTMLDivElement | null>(null);

  const loadClientes = React.useCallback(
    async (reset = false) => {
      if (!pesquisa || pesquisa.length < 3) return;

      setLoadingEntrega(true);
      setIconeInfo('');
      setMensagem('');

      try {
        // calcula offset com base na página atual
        const nextPage = reset ? 0 : page;
        const offset = nextPage * pageSize;
        //        const response = await api.post('/api/vendas/dbOracle/buscarCliente', {

        const response = await api.post(
          '/api/vendas/postgreslq/buscarCliente',
          {
            descricao: pesquisa,
            // passamos os dois formatos para cobrir diferentes implementações
            limit: pageSize,
            offset,
            page: nextPage + 1,
            perPage: pageSize,
          },
        );

        const payload = response?.data ?? {};
        const listaRaw = Array.isArray(payload.data) ? payload.data : [];
        const totalSrv: number =
          typeof payload.total === 'number' ? payload.total : listaRaw.length;

        const chunk = listaRaw
          .filter((v: any) => v?.CODCLI)
          .map((v: any) =>
            createProduto(String(v.CODCLI), v.NOME ? String(v.NOME) : ''),
          );

        if (reset) {
          setLocal(chunk);
          setTotal(totalSrv);
          setPage(1); // próxima chamada buscará a página 1
          setShowEntrega(true);
        } else {
          setLocal((prev) => [...prev, ...chunk]);
          setPage((prev) => prev + 1);
        }

        const acumulado = (reset ? 0 : local.length) + chunk.length;
        setHasMore(acumulado < totalSrv);

        if ((reset && chunk.length === 0) || (!reset && acumulado === 0)) {
          setMensagem('Nenhum cliente encontrado');
          setIconeInfo('none');
          setShowEntrega(false);
        }
      } catch (err) {
        console.log(err);
        setIconeInfo('falha');
        setMensagem(
          'Não conseguimos acessar o banco de dados, comunique a equipe técnica!!!',
        );
        setShowEntrega(false);
        setLocal([]);
        setTotal(null);
        setHasMore(false);
        setPage(0);
      } finally {
        setLoadingEntrega(false);
      }
    },
    [page, pageSize, pesquisa, local.length],
  );

  // Infinite scroll: quando chega perto do fim, carrega mais
  const handleScroll = React.useCallback(() => {
    const el = listaRef.current;
    if (!el || loadingEntrega || !hasMore) return;

    const threshold = 120; // px do final
    const nearBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;

    if (nearBottom) {
      // carrega próxima página
      loadClientes(false);
    }
  }, [hasMore, loadingEntrega, loadClientes]);

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
                                 dark:focus:border-pink-300
                                 dark:focus:border-t-transparent
                                 bg-transparent px-3 py-2.5 !pr-9 
                                 font-sans text-sm font-normal 
                                 text-gray-400
                                 focus:text-pink-600  
                                 dark:text-gray-600 
                                 dark:focus:text-pink-200 outline outline-0 
                                 transition-all   focus:border-2 
                                 focus:border-pink-300 focus:border-t-transparent
                                 dark:border-t-transparent 
                                 
                                 border-t-transparent focus:outline-0 
                                 placeholder-shown:border-t  
                                 dark:placeholder-shown:border-gray-400
                                 placeholder-shonw:border-gray-400
                                 placeholder-shown:border-gray-300
                                 placeholder-shown:placeholder-gray-400 
                                 dark:placeholder-shown:placeholder-gray-500
                                  disabled:border-0 disabled:bg-gray-50"
                      ref={seachInputRef}
                      value={pesquisa || ''}
                      onChange={(e) => {
                        const newE = e.target.value.toUpperCase();
                        setPesquisa(newE);
                        return 0;
                      }}
                      onFocus={() => {
                        setMensagem('');
                        setIconeInfo('');
                        setLoadingEntrega(false);
                        setDentroProd(true);
                        setPesquisa('');
                      }}
                      onBlur={() => {
                        setDentroProd(false);
                      }}
                      onKeyDown={(event) => {
                        const isEnter = event.key.toLowerCase() === 'enter';
                        if (isEnter && pesquisa.length > 2) {
                          // reset e primeira carga
                          setShowEntrega(false);
                          setLocal([]);
                          setTotal(null);
                          setHasMore(false);
                          setPage(0);
                          loadClientes(true);
                        }
                        if (isEnter && pesquisa.length < 3) {
                          setMensagem('');
                          setIconeInfo('');
                          setLoadingEntrega(false);
                          setLocal([]);
                          setTotal(null);
                          setHasMore(false);
                        }
                      }}
                      disabled={false}
                      type="text"
                      placeholder={
                        dentroProd
                          ? `Cliente para entrega (Cod, Nome, CNPJ)`
                          : '  '
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
                              peer-focus:text-pink-500
                              dark:peer-focus:text-pink-200
                              peer-focus:before:border-t-1 
                              peer-focus:before:border-l-2 
                              peer-focus:before:border-pink-300 
                              peer-focus:after:border-t-1 
                              peer-focus:after:border-r-2
                              peer-focus:after:border-pink-300 
                              peer-disabled:text-transparent 
                              peer-disabled:before:border-transparent 
                              peer-disabled:after:border-transparent "
                    >
                      Cliente para entrega
                    </label>
                  </div>
                  <div
                    className="w-32 ml-4"
                    onClick={() => {
                      handleLocal({ codigo: 'nulo', nome: 'fechar Local' });
                    }}
                  >
                    <Button
                      className={`bg-pink-500 hover:bg-pink-700 w-full text-[8px] md:text-[10px] 
                                font-bold   flex items-center `}
                    >
                      FECHAR
                    </Button>
                  </div>
                </div>
              </div>
              <div className=" w-full text-primary font-bold h-72 flex justify-center px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <div className="w-full text-primary font-bold">
                  <div className="w-full h-full">
                    {showEntrega && local.length ? (
                      <div className="h-full w-full flex justify-center items-start">
                        <div
                          ref={listaRef}
                          onScroll={handleScroll}
                          className="flex-grow w-full h-[100%] overflow-auto"
                        >
                          {local.map((val, index) => (
                            <div
                              key={`${val.codigo}-${index}`}
                              className="w-full flex justify-start cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-primary font-bold"
                              onClick={() => {
                                handleLocal(val);
                              }}
                            >
                              <div className="text-primary font-bold flex justify-center px-2 py-3 sm:flex sm:flex-row-reverse sm:px-2">
                                {val.codigo} - {val.nome}
                              </div>
                            </div>
                          ))}

                          {/* Rodapé da lista: loader e/ou botão carregar mais */}
                          <div className="w-full flex justify-center items-center py-3">
                            {loadingEntrega ? (
                              <Carregamento />
                            ) : hasMore ? (
                              <Button
                                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs"
                                onClick={() => loadClientes(false)}
                              >
                                Carregar mais
                              </Button>
                            ) : total !== null ? (
                              <div className="text-xs text-gray-500">
                                Exibindo {local.length} de {total}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full w-full flex justify-center items-center">
                        <div className="h-full w-full">
                          <div className="h-[calc(100%-3rem)] flex justify-center items-center">
                            {mensagem.length ? (
                              <div>
                                <div>
                                  {iconesInfo === 'falha' ? (
                                    <div className="py-4 flex justify-center">
                                      <BiSolidError
                                        className=" dark:text-red-200 text-red-400"
                                        size={60}
                                      />
                                    </div>
                                  ) : null}
                                  {iconesInfo === 'none' ? (
                                    <div className="py-4 flex justify-center">
                                      <PiSmileySadFill
                                        className=" dark:text-yellow-200 text-yellow-300"
                                        size={60}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                                <div>{mensagem}</div>
                              </div>
                            ) : (
                              <div>
                                {loadingEntrega ? (
                                  <Carregamento />
                                ) : (
                                  <div>
                                    <div>
                                      {iconesInfo === '' ? (
                                        <div className="py-4 flex justify-center">
                                          <FaTruck
                                            className=" dark:dark:text-pink-300 text-pink-600"
                                            size={60}
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                    <div>
                                      <div className="text-center font-bold dark:text-pink-300 text-pink-600">
                                        PESQUISAR UM CLIENTE PARA ENTREGA
                                      </div>
                                      <div className=" font-bold text-pink-600 dark:text-pink-300">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectLocal;
