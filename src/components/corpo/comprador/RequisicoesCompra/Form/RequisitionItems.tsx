import React, { useState, ChangeEvent } from 'react';
import SearchInput from '@/components/common/SearchInput2';
import FormInput from '@/components/common/FormInput';
import { DefaultButton, AuxButton } from '@/components/common/Buttons';
import { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Trash2 } from 'lucide-react';

interface RequisitionItemsProps {
  headerData: Partial<RequisitionDTO>;
  onBack: () => void;
  onSubmit: () => void;
}

export default function RequisitionItems({
  headerData,
  onBack,
  onSubmit,
}: RequisitionItemsProps) {
  const { toast } = useToast();
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const handleSearchProduct = async () => {
    if (!productSearch.trim()) return;
    setLoadingSearch(true);
    try {
      const response = await fetch('/api/dbOracle/produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: productSearch, PRVENDA: '0' }),
      });
      if (!response.ok) throw new Error('Falha na busca de produtos');
      const products = await response.json();
      setSearchedProducts(products);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os produtos.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSearch(false);
    }
  };

  const addProductToRequisition = (productToAdd: any) => {
    if (items.some((item) => item.CODPROD === productToAdd.CODPROD)) {
      toast({
        title: 'Atenção',
        description: 'Este produto já foi adicionado.',
      });
      return;
    }
    setItems((prev) => [
      ...prev,
      { ...productToAdd, QTD: 1, PRCOMPRA: productToAdd.PRECOVENDA },
    ]);
  };

  const removeProductFromRequisition = (productCode: string) => {
    setItems((prev) => prev.filter((item) => item.CODPROD !== productCode));
  };

  const handleItemChange = (
    productCode: string,
    field: 'QTD' | 'PRCOMPRA',
    value: string | number,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.CODPROD === productCode ? { ...item, [field]: value } : item,
      ),
    );
  };

  return (
    // Container principal flexível
    <div className="p-2 sm:p-4 space-y-4 flex flex-col h-full">
      {/* SEÇÃO DE BUSCA DE PRODUTOS */}
      <fieldset className="border p-2 sm:p-4 rounded-lg shadow-md">
        <legend className="px-2 font-bold text-gray-700 dark:text-gray-300">
          Localizar Produtos
        </legend>
        {/* Layout do formulário de busca responsivo */}
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <SearchInput
            placeholder="Buscar por Referência, Código ou Descrição..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchProduct()}
          />
          <DefaultButton
            text="Buscar"
            onClick={handleSearchProduct}
            disabled={loadingSearch}
            className="h-10 w-full sm:w-auto" // Botão ocupa largura total no mobile
          />
        </div>
        {/* Container da tabela com scroll horizontal */}
        <div className="mt-4 h-56 overflow-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-100 dark:bg-zinc-800 z-10">
              <TableRow>
                <TableHead className="min-w-[120px]">Referência</TableHead>
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                {/* Coluna Estoque some em telas muito pequenas */}
                <TableHead className="text-center hidden sm:table-cell">
                  Estoque
                </TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSearch ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : searchedProducts.length > 0 ? (
                searchedProducts.map((p) => (
                  <TableRow
                    key={p.CODPROD}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    <TableCell>{p.REF}</TableCell>
                    <TableCell className="truncate max-w-xs">
                      {p.DESCR}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      {p.QTDDISPONIVEL || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => addProductToRequisition(p)}
                        title="Adicionar Item"
                        className="text-green-500 hover:text-green-700"
                      >
                        <PlusCircle size={20} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </fieldset>

      {/* SEÇÃO DE ITENS SELECIONADOS */}
      <fieldset className="border p-2 sm:p-4 rounded-lg shadow-md flex-grow flex flex-col min-h-[200px]">
        <legend className="px-2 font-bold text-gray-700 dark:text-gray-300">
          Produtos Selecionados
        </legend>
        {/* Container da tabela com scroll horizontal e crescimento flexível */}
        <div className="flex-grow overflow-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-100 dark:bg-zinc-800 z-10">
              <TableRow>
                <TableHead className="min-w-[120px]">Referência</TableHead>
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead className="min-w-[100px]">Qtde.</TableHead>
                <TableHead className="min-w-[120px]">Pr. Unitário</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow
                    key={item.CODPROD}
                    className="hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    <TableCell>{item.REF}</TableCell>
                    <TableCell className="truncate max-w-xs">
                      {item.DESCR}
                    </TableCell>
                    <TableCell>
                      <FormInput
                        type="number"
                        name={`qtd-${item.CODPROD}`}
                        defaultValue={item.QTD}
                        onChange={(e) =>
                          handleItemChange(
                            item.CODPROD,
                            'QTD',
                            parseInt(e.target.value),
                          )
                        }
                        className="h-9 w-full"
                      />
                    </TableCell>
                    <TableCell>
                      <FormInput
                        type="number"
                        name={`price-${item.CODPROD}`}
                        defaultValue={item.PRCOMPRA}
                        onChange={(e) =>
                          handleItemChange(
                            item.CODPROD,
                            'PRCOMPRA',
                            parseFloat(e.target.value),
                          )
                        }
                        className="h-9 w-full"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() =>
                          removeProductFromRequisition(item.CODPROD)
                        }
                        title="Remover Item"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={20} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Nenhum item adicionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </fieldset>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex justify-between pt-4">
        <AuxButton text="Voltar" onClick={onBack} />
        <div className="flex gap-2">
          <DefaultButton
            text="Concluir Requisição"
            onClick={onSubmit}
            variant="primary"
          />
        </div>
      </div>
    </div>
  );
}
