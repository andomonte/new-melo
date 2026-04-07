// Análise da chave de acesso rejeitada pela SEFAZ

const chave = '13250918053139000169550090000000011241729730';

console.log('🔍 Análise da chave de acesso rejeitada:\n');
console.log('Chave completa:', chave);
console.log('Comprimento:', chave.length, 'dígitos\n');

// Estrutura da chave: UF(2) + AAMM(6) + CNPJ(14) + Mod(2) + Serie(3) + NumNFe(9) + TpEmis(1) + cNF(8) + DV(1)
const partes = {
  UF: chave.substring(0, 2),           // 2 dígitos
  AAMM: chave.substring(2, 8),         // 6 dígitos (AAMMDD na verdade são só 4: AAMM)
  CNPJ: chave.substring(8, 22),        // 14 dígitos
  Modelo: chave.substring(22, 24),     // 2 dígitos
  Serie: chave.substring(24, 27),      // 3 dígitos
  NumNFe: chave.substring(27, 36),     // 9 dígitos
  TpEmis: chave.substring(36, 37),     // 1 dígito
  cNF: chave.substring(37, 45),        // 8 dígitos
  DV: chave.substring(45, 46),         // 1 dígito
};

console.log('📊 Componentes da chave:');
console.log('  UF (código):', partes.UF, '→ Amazonas');
console.log('  AAMM:', partes.AAMM);
console.log('  CNPJ:', partes.CNPJ);
console.log('  Modelo:', partes.Modelo, '→ NFe');
console.log('  Série:', partes.Serie, '→', parseInt(partes.Serie, 10));
console.log('  Número NFe:', partes.NumNFe, '→', parseInt(partes.NumNFe, 10));
console.log('  Tipo Emissão:', partes.TpEmis, '→ Normal');
console.log('  Código Numérico (cNF):', partes.cNF);
console.log('  Dígito Verificador:', partes.DV);

console.log('\n⚠️ IMPORTANTE:');
console.log('  A SEFAZ identifica duplicidade pelo conjunto:');
console.log('  UF + AAMM + CNPJ + Modelo + SÉRIE + NÚMERO');
console.log('\n  O cNF sozinho NÃO evita duplicidade!');
console.log('  É necessário mudar o NÚMERO da NFe quando houver duplicidade.');

console.log('\n📋 Identificação única da NFe para SEFAZ:');
console.log('  CNPJ:', partes.CNPJ);
console.log('  Mês/Ano:', partes.AAMM);
console.log('  Série:', parseInt(partes.Serie, 10));
console.log('  Número:', parseInt(partes.NumNFe, 10));
