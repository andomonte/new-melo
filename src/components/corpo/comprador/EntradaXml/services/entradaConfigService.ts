// Serviços para configuração de entrada NFe

export interface PedidoCompraDisponivel {
  id: string;
  codigoRequisicao: string;
  filial: string;
  codCredor: string;
  fornecedor: string;
  quantidadeDisponivel: number;
  valorUnitario: number;
  dataPrevisao: string;
  multiplo: number;
  descricaoMarca: string;
  precoCompra: number;
  dolar: number;
}

export interface ProdutoInfo {
  id: string;
  referencia: string;
  descricao: string;
  codigoBarras?: string;
  marca: string;
  estoque: number;
  tipo: string;
  localizacao?: string;
}

// Buscar pedidos disponíveis para um produto
export const buscarPedidosDisponiveis = async (produtoId: string): Promise<PedidoCompraDisponivel[]> => {
  try {
    const response = await fetch(`/api/entrada-xml/pedidos-disponiveis/${produtoId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao buscar pedidos disponíveis');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Erro ao buscar pedidos disponíveis:', error);
    return [];
  }
};

// Buscar produto por referência ou código de barras
export const buscarProdutos = async (searchTerm: string): Promise<ProdutoInfo[]> => {
  try {
    const response = await fetch(`/api/entrada-xml/produtos/search?search=${encodeURIComponent(searchTerm)}`);
    
    if (!response.ok) {
      throw new Error('Falha ao buscar produtos');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return [];
  }
};

// Salvar dados de confirmação da NFe
export const salvarDadosConfirmacao = async (nfeId: string, dados: any) => {
  try {
    const response = await fetch('/api/entrada-xml/confirmar-dados', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nfeId, ...dados }),
    });

    if (!response.ok) {
      throw new Error('Falha ao salvar dados de confirmação');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao salvar dados de confirmação:', error);
    throw error;
  }
};

// Salvar associações de itens
export const salvarAssociacoes = async (nfeId: string, associacoes: any[]) => {
  try {
    const response = await fetch('/api/entrada-xml/associar-itens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nfeId, associatedItems: associacoes }),
    });

    if (!response.ok) {
      throw new Error('Falha ao salvar associações');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao salvar associações:', error);
    throw error;
  }
};

// Gerar entrada final
export const gerarEntradaFinal = async (nfeId: string, dadosCompletos: any) => {
  try {
    const response = await fetch('/api/entrada-xml/gerar-entrada', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nfeId, dadosCompletos }),
    });

    if (!response.ok) {
      throw new Error('Falha ao gerar entrada');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao gerar entrada:', error);
    throw error;
  }
};