// Mapeia campos para suas respectivas abas
export const campoParaAba: { [key: string]: string } = {
  // Dados Cadastrais
  codtransp: 'dadosCadastrais',
  nome: 'dadosCadastrais',
  nomefant: 'dadosCadastrais',
  cpfcgc: 'dadosCadastrais',
  tipo: 'dadosCadastrais',
  ender: 'dadosCadastrais',
  numero: 'dadosCadastrais',
  complemento: 'dadosCadastrais',
  bairro: 'dadosCadastrais',
  cidade: 'dadosCadastrais',
  uf: 'dadosCadastrais',
  cep: 'dadosCadastrais',
  codpais: 'dadosCadastrais',
  referencia: 'dadosCadastrais',
  tipoemp: 'dadosCadastrais',
  contatos: 'dadosCadastrais',
  iest: 'dadosCadastrais',
  isuframa: 'dadosCadastrais',
  imun: 'dadosCadastrais',

  // Dados Financeiros
  cc: 'dadosFinanceiros',
  banco: 'dadosFinanceiros',
  n_agencia: 'dadosFinanceiros',
  cod_ident: 'dadosFinanceiros',

  // Cálculo Frete
  frete_minimo: 'calculoFrete',
  seguro_advalor: 'calculoFrete',
  pedagio: 'calculoFrete',
  gris: 'calculoFrete',
  ademe: 'calculoFrete',
  despacho: 'calculoFrete',
  taxa_portuario: 'calculoFrete',
  aliquota_icms: 'calculoFrete',
  peso_minimo: 'calculoFrete',
  taxa_coleta_sp: 'calculoFrete',
  taxa_entrega: 'calculoFrete',
};
