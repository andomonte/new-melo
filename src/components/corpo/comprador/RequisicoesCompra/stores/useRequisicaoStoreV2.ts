// Store refatorado para requisições de compra com tipos unificados e estado consistente
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { 
  RequisitionDTO, 
  RequisitionItem, 
  CartItem, 
  NovaRequisicaoForm,
  Fornecedor, 
  Comprador, 
  Filial,
  RequisitionStatus
} from '@/types/compras';

interface Produto {
  codprod: string;
  descr: string;
  marca?: string;
  referencia?: string;
  aplicacao?: string;
  estoque?: number;
  prcompra?: number;
  prvenda?: number;
  multiplo?: number;
  localizacao?: string;
}

interface TipoRequisicao {
  id: string;
  nome: string;
}

// Estado do store
interface RequisicaoStoreState {
  // === Dados Base ===
  tipos: TipoRequisicao[];
  filiais: Filial[];
  compradores: Comprador[];
  
  // === Requisição Atual ===
  currentRequisition: RequisitionDTO | null;
  
  // === Formulário ===
  formData: NovaRequisicaoForm;
  formErrors: Record<string, string>;
  isFormValid: boolean;
  
  // === Carrinho de Itens ===
  cartItems: CartItem[];
  totalCarrinho: number;
  cartErrors: Record<number, string>;
  
  // === Estados de Loading ===
  loading: {
    dados: boolean;
    fornecedores: boolean;
    produtos: boolean;
    cart: boolean;
    saving: boolean;
  };
  
  // === Cache (sem persistir) ===
  fornecedoresCache: Map<string, { data: Fornecedor[]; timestamp: number }>;
  produtosCache: Map<string, { data: Produto[]; timestamp: number }>;
  
  // === Configurações ===
  cacheTimeout: number; // 5 minutos
}

// Actions do store
interface RequisicaoStoreActions {
  // === Dados Base ===
  setTipos: (tipos: TipoRequisicao[]) => void;
  setFiliais: (filiais: Filial[]) => void;
  setCompradores: (compradores: Comprador[]) => void;
  
  // === Requisição ===
  setCurrentRequisition: (requisition: RequisitionDTO | null) => void;
  loadRequisition: (id: number, versao: number) => Promise<void>;
  
  // === Formulário ===
  updateFormData: (data: Partial<NovaRequisicaoForm>) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  setFormError: (field: string, error: string) => void;
  clearFormErrors: () => void;
  
  // === Carrinho ===
  addToCart: (produto: Produto, quantidade: number, precoUnitario?: number) => void;
  removeFromCart: (seq: number) => void;
  updateCartItem: (seq: number, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  loadCartFromRequisition: (items: RequisitionItem[]) => void;
  validateCart: () => boolean;
  setCartError: (seq: number, error: string) => void;
  clearCartErrors: () => void;
  
  // === Cache ===
  setCachedFornecedores: (key: string, fornecedores: Fornecedor[]) => void;
  getCachedFornecedores: (key: string) => Fornecedor[] | null;
  setCachedProdutos: (key: string, produtos: Produto[]) => void;
  getCachedProdutos: (key: string) => Produto[] | null;
  clearExpiredCache: () => void;
  
  // === Loading ===
  setLoading: (key: keyof RequisicaoStoreState['loading'], value: boolean) => void;
  
  // === Utils ===
  calculateTotal: () => void;
  reset: () => void;
  canEdit: () => boolean;
}

type RequisicaoStore = RequisicaoStoreState & RequisicaoStoreActions;

// Estado inicial
const initialFormData: NovaRequisicaoForm = {
  tipo: '',
  fornecedor: null,
  comprador_codigo: '',
  comprador_nome: '',
  entrega_em: '',
  destinado_para: '',
  previsao_chegada: '',
  condicoes_pagamento: '',
  observacao: ''
};

const initialState: RequisicaoStoreState = {
  // Dados base
  tipos: [],
  filiais: [],
  compradores: [],
  
  // Requisição atual
  currentRequisition: null,
  
  // Formulário
  formData: initialFormData,
  formErrors: {},
  isFormValid: false,
  
  // Carrinho
  cartItems: [],
  totalCarrinho: 0,
  cartErrors: {},
  
  // Loading
  loading: {
    dados: false,
    fornecedores: false,
    produtos: false,
    cart: false,
    saving: false
  },
  
  // Cache
  fornecedoresCache: new Map(),
  produtosCache: new Map(),
  cacheTimeout: 5 * 60 * 1000 // 5 minutos
};

// Store principal
export const useRequisicaoStore = create<RequisicaoStore>()(subscribeWithSelector(devtools(
  (set, get) => ({
    ...initialState,
    
    // === Dados Base ===
    setTipos: (tipos) => set({ tipos }),
    setFiliais: (filiais) => set({ filiais }),
    setCompradores: (compradores) => set({ compradores }),
    
    // === Requisição ===
    setCurrentRequisition: (requisition) => {
      set({ currentRequisition: requisition });
      
      // Se mudou de requisição, limpar carrinho
      if (requisition?.id !== get().currentRequisition?.id) {
        get().clearCart();
      }
    },
    
    loadRequisition: async (id, versao) => {
      try {
        get().setLoading('dados', true);
        
        // TODO: Implementar busca da requisição
        // const response = await api.get(`/api/requisicoesCompra/${id}/${versao}`);
        // get().setCurrentRequisition(response.data);
        
        console.log(`Loading requisition ${id}/${versao}`);
      } catch (error) {
        console.error('Erro ao carregar requisição:', error);
      } finally {
        get().setLoading('dados', false);
      }
    },
    
    // === Formulário ===
    updateFormData: (data) => {
      set((state) => ({
        formData: { ...state.formData, ...data }
      }));
      get().validateForm();
    },
    
    validateForm: () => {
      const { formData } = get();
      const errors: Record<string, string> = {};
      
      // Validações obrigatórias
      if (!formData.tipo) {
        errors.tipo = 'Tipo é obrigatório';
      }
      
      if (!formData.fornecedor) {
        errors.fornecedor = 'Fornecedor é obrigatório';
      }
      
      if (!formData.comprador_codigo) {
        errors.comprador_codigo = 'Comprador é obrigatório';
      }
      
      if (!formData.entrega_em) {
        errors.entrega_em = 'Local de entrega é obrigatório';
      }
      
      if (!formData.destinado_para) {
        errors.destinado_para = 'Destino é obrigatório';
      }
      
      const isValid = Object.keys(errors).length === 0;
      
      set({ 
        formErrors: errors, 
        isFormValid: isValid 
      });
      
      return isValid;
    },
    
    resetForm: () => {
      set({ 
        formData: initialFormData, 
        formErrors: {}, 
        isFormValid: false 
      });
    },
    
    setFormError: (field, error) => {
      set((state) => ({
        formErrors: { ...state.formErrors, [field]: error }
      }));
    },
    
    clearFormErrors: () => {
      set({ formErrors: {}, isFormValid: get().validateForm() });
    },
    
    // === Carrinho ===
    addToCart: (produto, quantidade, precoUnitario) => {
      const { cartItems, currentRequisition } = get();
      
      if (!currentRequisition) {
        console.error('Nenhuma requisição ativa para adicionar itens');
        return;
      }
      
      // Verificar se produto já existe no carrinho
      const existingItem = cartItems.find(item => item.codprod === produto.codprod);
      
      if (existingItem) {
        // Atualizar quantidade do item existente
        get().updateCartItem(existingItem.seq || 0, {
          quantidade: existingItem.quantidade + quantidade
        });
        return;
      }
      
      // Gerar próximo sequence
      const nextSeq = cartItems.length > 0 
        ? Math.max(...cartItems.map(item => item.seq || 0)) + 1 
        : 1;
      
      const preco = precoUnitario || produto.prcompra || 0;
      
      const newItem: CartItem = {
        codprod: produto.codprod,
        descricao: produto.descr,
        marca: produto.marca,
        referencia: produto.referencia,
        quantidade,
        precoUnitario: preco,
        precoTotal: quantidade * preco,
        seq: nextSeq
      };
      
      set((state) => ({
        cartItems: [...state.cartItems, newItem]
      }));
      
      get().calculateTotal();
      get().validateCart();
    },
    
    removeFromCart: (seq) => {
      set((state) => ({
        cartItems: state.cartItems.filter(item => item.seq !== seq)
      }));
      
      get().calculateTotal();
      get().clearCartErrors();
    },
    
    updateCartItem: (seq, updates) => {
      set((state) => ({
        cartItems: state.cartItems.map(item => {
          if (item.seq === seq) {
            const updatedItem = { ...item, ...updates };
            
            // Recalcular preço total se quantidade ou preço unitário mudaram
            if ('quantidade' in updates || 'precoUnitario' in updates) {
              updatedItem.precoTotal = updatedItem.quantidade * updatedItem.precoUnitario;
            }
            
            return updatedItem;
          }
          return item;
        })
      }));
      
      get().calculateTotal();
      get().validateCart();
    },
    
    clearCart: () => {
      set({ 
        cartItems: [], 
        totalCarrinho: 0, 
        cartErrors: {} 
      });
    },
    
    loadCartFromRequisition: (items) => {
      const cartItems: CartItem[] = items.map((item, index) => ({
        codprod: item.codprod,
        descricao: item.descricao || '',
        marca: item.marca,
        referencia: item.referencia,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        precoTotal: item.precoTotal,
        seq: item.itemSeq || index + 1
      }));
      
      set({ cartItems });
      get().calculateTotal();
    },
    
    validateCart: () => {
      const { cartItems } = get();
      const errors: Record<number, string> = {};
      
      cartItems.forEach(item => {
        if (item.quantidade <= 0) {
          errors[item.seq || 0] = 'Quantidade deve ser maior que zero';
        }
        
        if (item.precoUnitario <= 0) {
          errors[item.seq || 0] = 'Preço unitário deve ser maior que zero';
        }
      });
      
      set({ cartErrors: errors });
      
      return Object.keys(errors).length === 0;
    },
    
    setCartError: (seq, error) => {
      set((state) => ({
        cartErrors: { ...state.cartErrors, [seq]: error }
      }));
    },
    
    clearCartErrors: () => {
      set({ cartErrors: {} });
    },
    
    // === Cache ===
    setCachedFornecedores: (key, fornecedores) => {
      const cache = new Map(get().fornecedoresCache);
      cache.set(key, {
        data: fornecedores,
        timestamp: Date.now()
      });
      set({ fornecedoresCache: cache });
    },
    
    getCachedFornecedores: (key) => {
      const cached = get().fornecedoresCache.get(key);
      if (!cached) return null;
      
      const isExpired = Date.now() - cached.timestamp > get().cacheTimeout;
      if (isExpired) {
        // Remove do cache se expirado
        const cache = new Map(get().fornecedoresCache);
        cache.delete(key);
        set({ fornecedoresCache: cache });
        return null;
      }
      
      return cached.data;
    },
    
    setCachedProdutos: (key, produtos) => {
      const cache = new Map(get().produtosCache);
      cache.set(key, {
        data: produtos,
        timestamp: Date.now()
      });
      set({ produtosCache: cache });
    },
    
    getCachedProdutos: (key) => {
      const cached = get().produtosCache.get(key);
      if (!cached) return null;
      
      const isExpired = Date.now() - cached.timestamp > get().cacheTimeout;
      if (isExpired) {
        const cache = new Map(get().produtosCache);
        cache.delete(key);
        set({ produtosCache: cache });
        return null;
      }
      
      return cached.data;
    },
    
    clearExpiredCache: () => {
      const now = Date.now();
      const timeout = get().cacheTimeout;
      
      // Limpar cache de fornecedores expirado
      const fornecedoresCache = new Map(get().fornecedoresCache);
      for (const [key, value] of fornecedoresCache.entries()) {
        if (now - value.timestamp > timeout) {
          fornecedoresCache.delete(key);
        }
      }
      
      // Limpar cache de produtos expirado
      const produtosCache = new Map(get().produtosCache);
      for (const [key, value] of produtosCache.entries()) {
        if (now - value.timestamp > timeout) {
          produtosCache.delete(key);
        }
      }
      
      set({ 
        fornecedoresCache, 
        produtosCache 
      });
    },
    
    // === Loading ===
    setLoading: (key, value) => {
      set((state) => ({
        loading: { ...state.loading, [key]: value }
      }));
    },
    
    // === Utils ===
    calculateTotal: () => {
      const { cartItems } = get();
      const total = cartItems.reduce((sum, item) => {
        return sum + (item.precoTotal || 0);
      }, 0);
      
      set({ totalCarrinho: Number(total.toFixed(2)) });
    },
    
    reset: () => {
      set({
        ...initialState,
        // Manter dados base carregados
        tipos: get().tipos,
        filiais: get().filiais,
        compradores: get().compradores
      });
    },
    
    canEdit: () => {
      const { currentRequisition } = get();
      if (!currentRequisition) return true;
      
      const status = currentRequisition.statusRequisicao as RequisitionStatus;
      return status === RequisitionStatus.DRAFT || status === RequisitionStatus.REJECTED;
    }
  }),
  {
    name: 'requisicao-store-v2'
  }
)));

// Subscription para limpeza automática de cache
setInterval(() => {
  try {
    useRequisicaoStore.getState().clearExpiredCache();
  } catch (error) {
    console.warn('Erro ao limpar cache expirado:', error);
  }
}, 60000); // Limpar a cada minuto

// Hook para usar apenas os dados base
export const useRequisicaoBaseData = () => {
  return useRequisicaoStore((state) => ({
    tipos: state.tipos,
    filiais: state.filiais,
    compradores: state.compradores,
    loading: state.loading.dados,
    setTipos: state.setTipos,
    setFiliais: state.setFiliais,
    setCompradores: state.setCompradores
  }));
};

// Hook para usar apenas o formulário
export const useRequisicaoForm = () => {
  return useRequisicaoStore((state) => ({
    formData: state.formData,
    formErrors: state.formErrors,
    isFormValid: state.isFormValid,
    updateFormData: state.updateFormData,
    validateForm: state.validateForm,
    resetForm: state.resetForm,
    setFormError: state.setFormError,
    clearFormErrors: state.clearFormErrors
  }));
};

// Hook para usar apenas o carrinho
export const useRequisicaoCart = () => {
  return useRequisicaoStore((state) => ({
    cartItems: state.cartItems,
    totalCarrinho: state.totalCarrinho,
    cartErrors: state.cartErrors,
    loading: state.loading.cart,
    addToCart: state.addToCart,
    removeFromCart: state.removeFromCart,
    updateCartItem: state.updateCartItem,
    clearCart: state.clearCart,
    validateCart: state.validateCart,
    setCartError: state.setCartError,
    clearCartErrors: state.clearCartErrors
  }));
};

// Hook para cache
export const useRequisicaoCache = () => {
  return useRequisicaoStore((state) => ({
    setCachedFornecedores: state.setCachedFornecedores,
    getCachedFornecedores: state.getCachedFornecedores,
    setCachedProdutos: state.setCachedProdutos,
    getCachedProdutos: state.getCachedProdutos,
    clearExpiredCache: state.clearExpiredCache
  }));
};