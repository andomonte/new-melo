function padLeft(value, length, char = '0') {
  const str = String(value);
  return str.padStart(length, char);
}

function padRight(value, length, char = ' ') {
  return value.padEnd(length, char);
}

function formatDataDDMMAA(data) {
  const dia = padLeft(data.getDate(), 2);
  const mes = padLeft(data.getMonth() + 1, 2);
  const ano = String(data.getFullYear()).slice(-2);
  return `${dia}${mes}${ano}`;
}

function gerarHeaderBradesco(sequencial, dataGeracao, convenio) {
  let linha = '';
  
  // 001-001
  linha += '0';
  console.log('Pos 001:', linha.length);

  // 002-002
  linha += '1';
  console.log('Pos 002:', linha.length);

  // 003-009
  linha += 'REMESSA';
  console.log('Pos 009:', linha.length);

  // 010-011
  linha += '01';
  console.log('Pos 011:', linha.length);

  // 012-026
  linha += padRight('COBRANCA', 15);
  console.log('Pos 026:', linha.length);

  // 027-046
  linha += padLeft(convenio, 20, '0');
  console.log('Pos 046:', linha.length);

  // 047-076
  linha += padRight('MELO COMERCIO', 30);
  console.log('Pos 076:', linha.length);

  // 077-079
  linha += '237';
  console.log('Pos 079:', linha.length);

  // 080-094
  linha += padRight('BRADESCO', 15);
  console.log('Pos 094:', linha.length);

  // 095-100
  linha += formatDataDDMMAA(dataGeracao);
  console.log('Pos 100:', linha.length);

  // 101-108
  linha += padRight('', 8);
  console.log('Pos 108:', linha.length);

  // 109-110
  linha += 'MX';
  console.log('Pos 110:', linha.length);

  // 111-117
  linha += padLeft(sequencial, 7);
  console.log('Pos 117:', linha.length);

  // 118-394
  linha += padRight('', 277);
  console.log('Pos 394:', linha.length);

  // 395-400
  linha += '000001';
  console.log('Pos 400:', linha.length);

  return linha;
}

const linha = gerarHeaderBradesco(1, new Date(), '00000000000000197033');
console.log('Tamanho final:', linha.length);
console.log('Linha:', linha);
