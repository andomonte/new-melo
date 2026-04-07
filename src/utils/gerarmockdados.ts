// =================================================================================
// DADOS MOCKADOS PARA GERAR PREVIEW DE NOTAS FISCAIS
// =================================================================================

/**
 * @typedef {import('./gerarPreviewNF').Fatura} Fatura
 * @typedef {import('./gerarPreviewNF').Produto} Produto
 * @typedef {import('./gerarPreviewNF').Venda} Venda
 * @typedef {import('./gerarPreviewNF').DadosEmpresa} DadosEmpresa
 */

/**
 * Gera um número aleatório dentro de um intervalo.
 * @param {number} min - O valor mínimo.
 * @param {number} max - O valor máximo.
 * @returns {number} - O número aleatório gerado.
 */
const getRandomNumber = (min: number, max: number) => Math.random() * (max - min) + min;

/**
 * Gera uma lista de produtos aleatórios para uma nota.
 * @param {number} count - A quantidade de produtos a serem gerados.
 * @returns {Produto[]} - Um array de produtos.
 */
const gerarProdutosMock = (count: number) => {
  const produtos = [];
  const nomesProdutos = [
    'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
     'Mouse Gamer RGB',
    'Teclado Mecânico',
    'Monitor 4K 27"',
    'Headset Surround 7.1',
    'SSD NVMe 1TB',
    'Placa de Vídeo RTX 4070',
    'Memória RAM DDR5 16GB',
    'Gabinete ATX',
    'Fonte 750W 80 Plus Gold',
    'Webcam Full HD',
  ];

  for (let i = 0; i < count; i++) {
    const qtd = Math.floor(getRandomNumber(1, 5));
    const prunit = getRandomNumber(50, 1500);
    const total_item = qtd * prunit;

    produtos.push({
      codprod: Math.floor(getRandomNumber(1000, 9999)),
      descr: nomesProdutos[Math.floor(Math.random() * nomesProdutos.length)],
      ncm: '8471.60.53',
      cst: '0102',
      unimed: 'UN',
      qtd: qtd,
      prunit: prunit.toFixed(2),
      total_item: total_item.toFixed(2),
    });
  }
  return produtos;
};

/**
 * Dados da empresa emitente (fixo para todos os mocks).
 * @type {DadosEmpresa}
 */
export const dadosEmpresaMock = {
  nomefantasia: 'TecMaster Soluções',
  logradouro: 'Av. Djalma Batista',
  numero: '1234',
  municipio: 'MANAUS',
  uf: 'AM',
  cep: '69050-010',
  telefone: '(92) 3211-5678',
  inscricaoestadual: '06.301.628-9',
  cgc: '04.293.228/0001-46',
  iest_subst: '06.301.628-9',
  inscricaomunicipal: '123456-7',
  nomecontribuinte: 'TECMASTER SOLUCOES EM INFORMATICA LTDA',
};

/**
 * Gera 30 conjuntos de dados de notas fiscais.
 * @returns {Array<{fatura: Fatura, produtos: Produto[], venda: Venda}>}
 */
const gerarNotasMock = () => {
  const notas = [];
  const nomesClientes = [
    'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
     'João da Silva',
    'Maria Oliveira',
    'Pedro Santos',
    'Ana Souza',
    'Carlos Pereira',
    'Global Services LTDA',
    'Amazon Tech ME',
    'Norte Varejo S/A',
  ];
  const bairros = ['Centro', 'Adrianópolis', 'Ponta Negra', 'Aleixo'];
  const vendedores = ['Marcos', 'Juliana', 'Ricardo'];

  for (let i = 0; i < 30; i++) {
    const produtos = gerarProdutosMock(Math.floor(getRandomNumber(2, 6)));
    const totalprod = produtos.reduce(
      (acc, p) => acc + Number(p.total_item),
      0,
    );
    const vlrfrete = totalprod > 1000 ? 0 : getRandomNumber(20, 50);
    const totalnf = totalprod + vlrfrete;
    const baseicms = totalprod;
    const valor_icms = baseicms * 0.18; // Exemplo de cálculo

    const fatura = {
      nroform: 2000 + i,
      serie: '1',
      natureza: 'VENDA DE MERCADORIA ADQUIRIDA DE TERCEIROS',
      nomefant: nomesClientes[i % nomesClientes.length],
      cpfcgc:
        i % 3 === 0
          ? `${getRandomNumber(100, 999)}.${getRandomNumber(100, 999)}.${getRandomNumber(100, 999)}-${getRandomNumber(10, 99)}`
          : `0${getRandomNumber(1, 9)}.${getRandomNumber(100, 999)}.${getRandomNumber(100, 999)}/0001-${getRandomNumber(10, 99)}`,
      data: new Date(
        Date.now() - Math.floor(getRandomNumber(1, 365)) * 24 * 60 * 60 * 1000,
      ).toISOString(),
      ender: 'Rua das Acácias',
      numero: Math.floor(getRandomNumber(100, 2000)),
      bairro: bairros[i % bairros.length],
      cep: '69055-021',
      cidade: 'MANAUS',
      fone: `(92) 9${getRandomNumber(8000, 9999)}-${getRandomNumber(1000, 9999)}`,
      uf: 'AM',
      iest: 'ISENTO',
      baseicms: baseicms,
      valor_icms: valor_icms,
      baseicms_subst: 0,
      vlrfrete: vlrfrete,
      vlrseg: 0,
      vlrdesp: 0,
      totalprod: totalprod,
      valor_pis: 0,
      valor_cofins: 0,
      valor_ipi: 0,
      totalnf: totalnf,
      destfrete: i % 4 === 0 ? '0' : '1', // 0-Emitente, 1-Destinatário
      cfop2: '5102',
      nomevendedor: vendedores[i % vendedores.length],
    };

    const venda = {
      transp:
        i % 4 === 0 ? 'TRANSPORTADORA AMAZONLOG LTDA' : 'CLIENTE RETIRA',
      nrovenda: 9000 + i,
      obs: `Cliente solicitou entrega urgente. Venda #${9000 + i}`,
    };

    notas.push({ fatura, produtos, venda });
  }

  return notas;
};

/**
 * Array com 30 conjuntos de dados de notas fiscais para teste.
 * Cada item contém: { fatura, produtos, venda }
 */
export const mockNotas = gerarNotasMock();
