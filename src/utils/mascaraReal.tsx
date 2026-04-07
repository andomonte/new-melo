export default function mascaraPreço(preço: number) {
  const formatted = new Intl.NumberFormat('pt-br', {
    style: 'currency',
    currency: 'BRL',
  }).format(preço);
  return formatted;
}
