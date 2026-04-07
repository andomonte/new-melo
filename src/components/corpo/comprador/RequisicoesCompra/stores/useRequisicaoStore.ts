import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { 
  TipoRequisicao, 
  Fornecedor, 
  Filial, 
  Comprador,
  FormDataRequisicao,
  Produto,
  CartItem,
  RequisitionItem
} from '../types';

interface RequisicaoState {
  // Dados base
  tipos: TipoRequisicao[];
  filiais: Filial[];
  compradores: Comprador[];
  
  // Cache de fornecedores
  fornecedoresCache: Map<string, Fornecedor[]>;
  fornecedorSelecionado: Fornecedor | null;
  
  // Estado do formulário
  formData: FormDataRequisicao;
  
  // Estados de loading
  loading: boolean;
  loadingDados: boolean;
  
  // Product management
  produtosCache: Map<string, Produto[]>;
  produtoSelecionado: Produto | null;
  cartItems: CartItem[];
  totalCarrinho: number;
  requisitionId: number | null;
  requisitionVersion: number | null;
  
  // Estados de loading para produtos
  loadingProdutos: boolean;
  loadingCart: boolean;
  
  // Actions
  setTipos: (tipos: TipoRequisicao[]) => void;
  setFiliais: (filiais: Filial[]) => void;
  setCompradores: (compradores: Comprador[]) => void;
  
  // Fornecedor actions
  setFornecedoresCache: (key: string, fornecedores: Fornecedor[]) => void;
  getFornecedoresCache: (key: string) => Fornecedor[] | undefined;
  setFornecedorSelecionado: (fornecedor: Fornecedor | null) => void;
  
  // Form actions
  updateFormData: (data: Partial<FormDataRequisicao>) => void;
  resetFormData: () => void;
  
  // Loading actions
  setLoading: (loading: boolean) => void;
  setLoadingDados: (loading: boolean) => void;
  
  // Product actions
  setProdutosCache: (key: string, produtos: Produto[]) => void;
  getProdutosCache: (key: string) => Produto[] | undefined;
  setProdutoSelecionado: (produto: Produto | null) => void;
  
  // Cart actions
  addToCart: (produto: Produto, quantidade: number, preco?: number) => void;
  removeFromCart: (itemSeq: number) => void;
  updateCartItem: (itemSeq: number, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  calculateTotal: () => void;
  
  // Requisition management
  setRequisitionData: (id: number, version: number) => void;
  loadCartItems: (items: RequisitionItem[]) => void;
  
  // Product loading states
  setLoadingProdutos: (loading: boolean) => void;
  setLoadingCart: (loading: boolean) => void;
}

const initialFormData: FormDataRequisicao = {
  tipo: '',
  cod_fornecedor: '',
  cod_comprador: '',
  entrega_em: '',
  destinado_para: '',
  condicoes_pagto: '',
  observacao: '',
  previsao_chegada: ''
};

export const useRequisicaoStore = create<RequisicaoState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        tipos: [],
        filiais: [],
        compradores: [],
        fornecedoresCache: new Map(),
        fornecedorSelecionado: null,
        formData: initialFormData,
        loading: false,
        loadingDados: false,
        
        // Product state
        produtosCache: new Map(),
        produtoSelecionado: null,
        cartItems: [],
        totalCarrinho: 0,
        requisitionId: null,
        requisitionVersion: null,
        loadingProdutos: false,
        loadingCart: false,

        // Base data actions
        setTipos: (tipos) => set({ tipos }),
        setFiliais: (filiais) => set({ filiais }),
        setCompradores: (compradores) => set({ compradores }),

        // Supplier actions
        setFornecedoresCache: (key, fornecedores) => {
          const cache = new Map(get().fornecedoresCache);
          cache.set(key, fornecedores);
          set({ fornecedoresCache: cache });
        },
        
        getFornecedoresCache: (key) => {
          return get().fornecedoresCache.get(key);
        },
        
        setFornecedorSelecionado: (fornecedor) => 
          set({ fornecedorSelecionado: fornecedor }),

        // Form actions
        updateFormData: (data) => 
          set((state) => ({ 
            formData: { ...state.formData, ...data } 
          })),
          
        resetFormData: () => 
          set({ 
            formData: initialFormData,
            fornecedorSelecionado: null 
          }),

        // Loading actions
        setLoading: (loadingState) => set({ loading: loadingState }),
        setLoadingDados: (loadingState) => set({ loadingDados: loadingState }),
        
        // Product actions
        setProdutosCache: (key, produtos) => {
          const cache = new Map(get().produtosCache);
          cache.set(key, produtos);
          set({ produtosCache: cache });
        },
        
        getProdutosCache: (key) => {
          return get().produtosCache.get(key);
        },
        
        setProdutoSelecionado: (produto) => 
          set({ produtoSelecionado: produto }),
        
        // Cart actions
        addToCart: (produto, quantidade, preco) => {
          const { cartItems, requisitionId, requisitionVersion } = get();
          
          if (!requisitionId || !requisitionVersion) {
            console.error('Requisition ID and version required to add items');
            return;
          }
          
          const nextSeq = Math.max(0, ...cartItems.map(item => item.item_seq)) + 1;
          const precoUnitario = preco ?? produto.prcompra ?? 0;
          
          const newItem: CartItem = {
            req_id: requisitionId,
            req_versao: requisitionVersion,
            item_seq: nextSeq,
            codprod: produto.codprod,
            produto,
            quantidade,
            preco_unitario: precoUnitario,
            preco_total: quantidade * precoUnitario,
            status: 'pending'
          };
          
          const updatedItems = [...cartItems, newItem];
          set({ cartItems: updatedItems });
          get().calculateTotal();
        },
        
        removeFromCart: (itemSeq) => {
          const { cartItems } = get();
          const updatedItems = cartItems.filter(item => item.item_seq !== itemSeq);
          set({ cartItems: updatedItems });
          get().calculateTotal();
        },
        
        updateCartItem: (itemSeq, updates) => {
          const { cartItems } = get();
          const updatedItems = cartItems.map(item => {
            if (item.item_seq === itemSeq) {
              const updatedItem = { ...item, ...updates };
              if (updates.quantidade || updates.preco_unitario) {
                updatedItem.preco_total = updatedItem.quantidade * updatedItem.preco_unitario;
              }
              return updatedItem;
            }
            return item;
          });
          set({ cartItems: updatedItems });
          get().calculateTotal();
        },
        
        clearCart: () => {
          set({ 
            cartItems: [], 
            totalCarrinho: 0,
            produtoSelecionado: null 
          });
        },
        
        calculateTotal: () => {
          const { cartItems } = get();
          const total = cartItems.reduce((sum, item) => {
            const itemTotal = Number(item.preco_total) || 0;
            return sum + itemTotal;
          }, 0);
          set({ totalCarrinho: Number(total) });
        },
        
        // Requisition management
        setRequisitionData: (id, version) => {
          set({ 
            requisitionId: id, 
            requisitionVersion: version 
          });
        },
        
        loadCartItems: (items) => {
          const cartItems: CartItem[] = items.map(item => ({
            ...item,
            quantidade_sugerida: item.quantidade_sugerida,
            base_indicacao: item.base_indicacao,
            produto: {
              codprod: item.codprod,
              descr: item.produto?.descr || '',
              marca: item.produto?.marca || '',
              estoque: item.produto?.estoque || 0,
              prcompra: item.preco_unitario,
              prvenda: item.produto?.prvenda || 0,
              multiplo: item.produto?.multiplo || (item as any).multiplo_compra || 1,
              multiploCompra: (item as any).multiplo_compra || item.produto?.multiploCompra || item.produto?.multiplo || 1,
            } as Produto
          }));

          set({ cartItems });
          get().calculateTotal();
        },
        
        // Product loading states
        setLoadingProdutos: (loading) => set({ loadingProdutos: loading }),
        setLoadingCart: (loading) => set({ loadingCart: loading }),
      }),
      {
        name: 'requisicao-store',
        partialize: (state) => ({
          tipos: state.tipos,
          filiais: state.filiais,
          compradores: state.compradores,
          // Não persistir cache de fornecedores para manter dados atualizados
        }),
      }
    ),
    {
      name: 'requisicao-store',
    }
  )
);