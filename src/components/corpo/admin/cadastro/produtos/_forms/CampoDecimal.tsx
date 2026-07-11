import React, { useState } from 'react';
import FormInput from '@/components/common/FormInput';

interface CampoDecimalProps {
  name: string;
  label?: string;
  value: number | null | undefined;
  onChangeValue: (valor: number) => void;
  /** dígitos inteiros da máscara (ex.: 99.99 -> 2; 9999.99 -> 4) */
  intDigits?: number;
  /** casas decimais (ex.: 99.99 -> 2; 99.999999 -> 6) */
  decDigits?: number;
  error?: string;
  required?: boolean;
}

/**
 * Campo numérico com MÁSCARA POSICIONAL igual ao Delphi (TMaskEdit): os
 * dígitos entram da ESQUERDA para a DIREITA — os primeiros preenchem a parte
 * inteira e os seguintes as casas decimais; posições não preenchidas viram 0.
 *
 * Ex. (99.99 -> intDigits=2, decDigits=2):
 *   digitar "015"  -> 01.50 (valor 1.5)
 *   digitar "1080" -> 10.80
 * Ex. (9999.99 -> intDigits=4, decDigits=2):
 *   digitar "001000" -> 0010.00 (valor 10)
 *
 * Enquanto o campo NÃO está em foco mostra o número formatado (value.toFixed).
 * Ao focar, esvazia para digitar de novo (comportamento de sobrescrita da
 * máscara). Ao sair, mostra o número final.
 */
const CampoDecimal: React.FC<CampoDecimalProps> = ({
  name,
  label,
  value,
  onChangeValue,
  intDigits = 2,
  decDigits = 2,
  error,
  required,
}) => {
  const N = intDigits + decDigits;
  const [focado, setFocado] = useState(false);
  const [buffer, setBuffer] = useState('');

  // valor a partir dos dígitos digitados (padEnd -> posições vazias viram 0)
  const valorDoBuffer = (buf: string): number => {
    const s = buf.padEnd(N, '0').slice(0, N);
    return parseFloat(`${s.slice(0, intDigits)}.${s.slice(intDigits)}`);
  };

  // exibição enquanto digita (posicional, mostrando o ponto quando entra nas casas)
  const exibeDigitando = (buf: string): string => {
    const i = buf.slice(0, intDigits);
    const d = buf.slice(intDigits);
    return buf.length > intDigits || d ? `${i}.${d}` : i;
  };

  const display = focado
    ? exibeDigitando(buffer)
    : Number(value ?? 0).toFixed(decDigits);

  return (
    <FormInput
      name={name}
      label={label}
      type="text"
      inputMode="numeric"
      required={required}
      error={error}
      value={display}
      onFocus={() => {
        setFocado(true);
        setBuffer('');
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, N);
        setBuffer(digits);
        onChangeValue(valorDoBuffer(digits));
      }}
      onBlur={() => setFocado(false)}
    />
  );
};

export default CampoDecimal;
