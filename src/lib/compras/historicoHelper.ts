/**
 * Helper para gerar detalhes estruturados de mudanças no histórico de requisições
 */

export interface ChangeDetail {
  tipo: 'ADICAO_ITEM' | 'REMOCAO_ITEM' | 'EDICAO_ITEM' | 'SUBSTITUICAO_ITEM' | 'EDICAO_REQUISICAO';
  descricao: string;
  dados: any;
}

export interface ProdutoInfo {
  codprod: string;
  descr?: string;
  ref?: string; // Referência do produto (importante para identificação)
  marca_nome?: string; // Nome da marca
  quantidade?: number;
  preco_unitario?: number;
  preco_total?: number;
}

/**
 * Gera comentário estruturado para adição de item
 */
export function gerarDetalhesAdicaoItem(produto: ProdutoInfo): string {
  const produtoIdentificacao = produto.ref ? `Ref: ${produto.ref}` : `Cód: ${produto.codprod}`;
  const produtoNome = produto.descr || produto.codprod;

  const detalhes: ChangeDetail = {
    tipo: 'ADICAO_ITEM',
    descricao: `Produto adicionado: ${produtoNome} (${produtoIdentificacao})`,
    dados: {
      codprod: produto.codprod,
      ref: produto.ref,
      descr: produto.descr,
      marca_nome: produto.marca_nome,
      quantidade: produto.quantidade,
      preco_unitario: produto.preco_unitario,
      preco_total: produto.preco_total
    }
  };

  // Descrição legível com referência em destaque
  const desc = `Produto **${produtoNome}** (${produtoIdentificacao}) foi **adicionado**\n` +
    (produto.marca_nome ? `• Marca: ${produto.marca_nome}\n` : '') +
    `• Quantidade: ${produto.quantidade || 0}\n` +
    `• Preço Unitário: R$ ${(produto.preco_unitario || 0).toFixed(2)}\n` +
    `• Total: R$ ${(produto.preco_total || 0).toFixed(2)}`;

  // Retornar JSON + descrição legível
  return JSON.stringify({
    ...detalhes,
    descricao_legivel: desc
  });
}

/**
 * Gera comentário estruturado para remoção de item
 */
export function gerarDetalhesRemocaoItem(produto: ProdutoInfo): string {
  const produtoIdentificacao = produto.ref ? `Ref: ${produto.ref}` : `Cód: ${produto.codprod}`;
  const produtoNome = produto.descr || produto.codprod;

  const detalhes: ChangeDetail = {
    tipo: 'REMOCAO_ITEM',
    descricao: `Produto removido: ${produtoNome} (${produtoIdentificacao})`,
    dados: {
      codprod: produto.codprod,
      ref: produto.ref,
      descr: produto.descr,
      marca_nome: produto.marca_nome,
      quantidade: produto.quantidade,
      preco_unitario: produto.preco_unitario,
      preco_total: produto.preco_total
    }
  };

  const desc = `Produto **${produtoNome}** (${produtoIdentificacao}) foi **removido**\n` +
    (produto.marca_nome ? `• Marca: ${produto.marca_nome}\n` : '') +
    `• Quantidade que tinha: ${produto.quantidade || 0}\n` +
    `• Preço Unitário: R$ ${(produto.preco_unitario || 0).toFixed(2)}\n` +
    `• Total: R$ ${(produto.preco_total || 0).toFixed(2)}`;

  return JSON.stringify({
    ...detalhes,
    descricao_legivel: desc
  });
}

/**
 * Gera comentário estruturado para edição de item
 */
export function gerarDetalhesEdicaoItem(
  produto: ProdutoInfo,
  camposAlterados: {
    quantidade?: { anterior: number; novo: number };
    preco_unitario?: { anterior: number; novo: number };
    observacao?: { anterior: string; novo: string };
  }
): string {
  const mudancas: string[] = [];

  if (camposAlterados.quantidade) {
    mudancas.push(
      `• Quantidade: ${camposAlterados.quantidade.anterior} → **${camposAlterados.quantidade.novo}**`
    );
  }

  if (camposAlterados.preco_unitario) {
    mudancas.push(
      `• Preço Unitário: R$ ${camposAlterados.preco_unitario.anterior.toFixed(2)} → **R$ ${camposAlterados.preco_unitario.novo.toFixed(2)}**`
    );
  }

  if (camposAlterados.observacao) {
    mudancas.push(
      `• Observação alterada`
    );
  }

  const produtoIdentificacao = produto.ref ? `Ref: ${produto.ref}` : `Cód: ${produto.codprod}`;
  const produtoNome = produto.descr || produto.codprod;

  const desc = `Produto **${produtoNome}** (${produtoIdentificacao}) teve alterações:\n` +
    (produto.marca_nome ? `Marca: ${produto.marca_nome}\n` : '') +
    mudancas.join('\n');

  const detalhes: ChangeDetail = {
    tipo: 'EDICAO_ITEM',
    descricao: `Item editado: ${produtoNome} (${produtoIdentificacao})`,
    dados: {
      codprod: produto.codprod,
      ref: produto.ref,
      descr: produto.descr,
      marca_nome: produto.marca_nome,
      alteracoes: camposAlterados
    }
  };

  return JSON.stringify({
    ...detalhes,
    descricao_legivel: desc
  });
}

/**
 * Gera comentário estruturado para substituição de item
 */
export function gerarDetalhesSubstituicaoItem(
  produtoOriginal: ProdutoInfo,
  produtoNovo: ProdutoInfo
): string {
  const originalIdentificacao = produtoOriginal.ref ? `Ref: ${produtoOriginal.ref}` : `Cód: ${produtoOriginal.codprod}`;
  const originalNome = produtoOriginal.descr || produtoOriginal.codprod;

  const novoIdentificacao = produtoNovo.ref ? `Ref: ${produtoNovo.ref}` : `Cód: ${produtoNovo.codprod}`;
  const novoNome = produtoNovo.descr || produtoNovo.codprod;

  const desc = `Produto **${originalNome}** (${originalIdentificacao}) foi **substituído** por:\n` +
    (produtoOriginal.marca_nome ? `• Marca original: ${produtoOriginal.marca_nome}\n` : '') +
    `\n**Novo Produto:**\n` +
    `• ${novoNome} (${novoIdentificacao})\n` +
    (produtoNovo.marca_nome ? `• Marca: ${produtoNovo.marca_nome}\n` : '') +
    `• Quantidade: ${produtoNovo.quantidade || 0}\n` +
    `• Preço Unitário: R$ ${(produtoNovo.preco_unitario || 0).toFixed(2)}\n` +
    `• Total: R$ ${(produtoNovo.preco_total || 0).toFixed(2)}`;

  const detalhes: ChangeDetail = {
    tipo: 'SUBSTITUICAO_ITEM',
    descricao: `Substituição: ${originalIdentificacao} → ${novoIdentificacao}`,
    dados: {
      original: {
        codprod: produtoOriginal.codprod,
        ref: produtoOriginal.ref,
        descr: produtoOriginal.descr,
        marca_nome: produtoOriginal.marca_nome,
        quantidade: produtoOriginal.quantidade,
        preco_unitario: produtoOriginal.preco_unitario
      },
      novo: {
        codprod: produtoNovo.codprod,
        ref: produtoNovo.ref,
        descr: produtoNovo.descr,
        marca_nome: produtoNovo.marca_nome,
        quantidade: produtoNovo.quantidade,
        preco_unitario: produtoNovo.preco_unitario
      }
    }
  };

  return JSON.stringify({
    ...detalhes,
    descricao_legivel: desc
  });
}

/**
 * Gera comentário estruturado para edição de campos da requisição
 */
export function gerarDetalhesEdicaoRequisicao(
  camposAlterados: {
    fornecedor?: { anterior: string; novo: string };
    comprador?: { anterior: string; novo: string };
    local_entrega?: { anterior: number; novo: number };
    destino?: { anterior: number; novo: number };
    previsao_chegada?: { anterior: string; novo: string };
    condicoes_pagamento?: { anterior: string; novo: string };
    observacao?: { anterior: string; novo: string };
  }
): string {
  const mudancas: string[] = [];

  if (camposAlterados.fornecedor) {
    mudancas.push(
      `• Fornecedor: ${camposAlterados.fornecedor.anterior} → **${camposAlterados.fornecedor.novo}**`
    );
  }

  if (camposAlterados.comprador) {
    mudancas.push(
      `• Comprador: ${camposAlterados.comprador.anterior} → **${camposAlterados.comprador.novo}**`
    );
  }

  if (camposAlterados.local_entrega) {
    mudancas.push(
      `• Local de Entrega: ID ${camposAlterados.local_entrega.anterior} → **ID ${camposAlterados.local_entrega.novo}**`
    );
  }

  if (camposAlterados.destino) {
    mudancas.push(
      `• Destino: ID ${camposAlterados.destino.anterior} → **ID ${camposAlterados.destino.novo}**`
    );
  }

  if (camposAlterados.previsao_chegada) {
    mudancas.push(
      `• Previsão de Chegada: ${camposAlterados.previsao_chegada.anterior} → **${camposAlterados.previsao_chegada.novo}**`
    );
  }

  if (camposAlterados.condicoes_pagamento) {
    mudancas.push(
      `• Condições de Pagamento: ${camposAlterados.condicoes_pagamento.anterior} → **${camposAlterados.condicoes_pagamento.novo}**`
    );
  }

  if (camposAlterados.observacao) {
    mudancas.push(
      `• Observação foi alterada`
    );
  }

  const desc = `**Campos da requisição alterados:**\n` + mudancas.join('\n');

  const detalhes: ChangeDetail = {
    tipo: 'EDICAO_REQUISICAO',
    descricao: `Requisição editada`,
    dados: {
      alteracoes: camposAlterados
    }
  };

  return JSON.stringify({
    ...detalhes,
    descricao_legivel: desc
  });
}

/**
 * Gera comentário estruturado para adição de múltiplos itens em lote
 */
export function gerarDetalhesAdicaoItensEmLote(produtos: ProdutoInfo[]): string {
  const totalItens = produtos.length;
  const totalValor = produtos.reduce((sum, p) => sum + (p.preco_total || 0), 0);

  // Listar até 5 itens na descrição legível, depois resumir
  const itensListados = produtos.slice(0, 5).map(p => {
    const identificacao = p.ref ? `Ref: ${p.ref}` : `Cód: ${p.codprod}`;
    return `• ${p.descr || p.codprod} (${identificacao}) - Qtd: ${p.quantidade || 0} - R$ ${(p.preco_total || 0).toFixed(2)}`;
  });

  const itensRestantes = totalItens - 5;
  if (itensRestantes > 0) {
    itensListados.push(`• ... e mais ${itensRestantes} item(ns)`);
  }

  const desc = `**${totalItens} produto(s) adicionado(s)**\n` +
    `Total: R$ ${totalValor.toFixed(2)}\n\n` +
    itensListados.join('\n');

  const detalhes = {
    tipo: 'ADICAO_ITENS_LOTE',
    descricao: `${totalItens} produto(s) adicionado(s) em lote`,
    dados: {
      total_itens: totalItens,
      total_valor: totalValor,
      itens: produtos.map(p => ({
        codprod: p.codprod,
        ref: p.ref,
        descr: p.descr,
        marca_nome: p.marca_nome,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario,
        preco_total: p.preco_total
      }))
    },
    descricao_legivel: desc
  };

  return JSON.stringify(detalhes);
}

/**
 * Parse de comentário JSON para exibição
 */
export function parseComentarioHistorico(comments: string | null): {
  tipo?: string;
  descricao_legivel?: string;
  dados?: any;
} | null {
  if (!comments) return null;

  try {
    const parsed = JSON.parse(comments);
    return parsed;
  } catch (error) {
    // Se não for JSON, retornar como texto simples
    return null;
  }
}
