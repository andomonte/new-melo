// Teste rápido do gerador de preview NFe
// Execute: node scripts/testar-preview-nfe.js

import { gerarPreviewNF } from '../src/utils/gerarPreviewNF.js';

// Dados de teste
const faturaTest = {
  cliente: {
    nome: 'CLIENTE TESTE LTDA',
    cpfcgc: '12.345.678/0001-90',
    endereco: 'RUA TESTE, 123',
    cidade: 'MANAUS',
    uf: 'AM',
    cep: '69000-000'
  },
  vendedor: { nome: 'VENDEDOR TESTE' },
  data: '2025-01-15',
  totalnf: 1000.00,
  totalprod: 900.00,
  desconto: 0,
  acrescimo: 0,
  totalfrete: 100.00,
  obs: 'Teste de geração de preview'
};

const produtosTest = [
  {
    codigo: '001',
    descricao: 'PRODUTO TESTE 1',
    qtd: 2,
    valor: 250.00,
    total: 500.00
  },
  {
    codigo: '002', 
    descricao: 'PRODUTO TESTE 2',
    qtd: 1,
    valor: 400.00,
    total: 400.00
  }
];

const vendaTest = {
  nrovenda: '123456'
};

const dadosEmpresaTest = {
  nomecontribuinte: 'MELO PEÇAS LTDA',
  cnpj: '98.765.432/0001-12',
  endereco: 'AV EMPRESARIAL, 456',
  cidade: 'MANAUS',
  uf: 'AM',
  cep: '69001-000'
};

async function testarPreview() {
  try {
    console.log('🧪 Testando gerador de preview NFe...');
    
    const doc = await gerarPreviewNF(faturaTest, produtosTest, vendaTest, dadosEmpresaTest);
    
    console.log('✅ Preview gerado com sucesso!');
    console.log('📄 Documento jsPDF criado, pronto para usar');
    
    // Salvar PDF de teste
    const pdfBlob = doc.output('blob');
    console.log('📊 Tamanho do PDF:', (pdfBlob.size / 1024).toFixed(2), 'KB');
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    return false;
  }
}

// Executar teste
testarPreview();