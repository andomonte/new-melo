// src/utils/gerarChaveAcesso.ts

export function gerarChaveDeAcessoPlaceholder(fatura: any, cnpj: string): string {
  const uf = '13'; // Ex: Amazonas
  const dataEmissao = new Date(fatura.data);
  const ano = String(dataEmissao.getFullYear()).slice(-2);
  const mes = String(dataEmissao.getMonth() + 1).padStart(2, '0');
  const modelo = '55';
  const serie = String(fatura.serie || '1').padStart(3, '0');
  const numeroNFe = String(fatura.nroform || '1').padStart(9, '0');
  const tipoEmissao = '1';
  const codigoNumerico = '12345678'; // Placeholder
  const dv = '9'; // Dígito verificador (não calculado aqui)

  const chave =
    uf +
    ano +
    mes +
    cnpj.padStart(14, '0') +
    modelo +
    serie +
    numeroNFe +
    tipoEmissao +
    codigoNumerico +
    dv;

  return chave;
}
