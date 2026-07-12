import React from 'react';
import { Input } from '@/components/ui/input';

interface InputMoedaProps {
  value: number | string | null | undefined;
  onChangeValue: (valor: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

function paraNumero(v: number | string | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const f = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(f) ? 0 : f;
}

export function formataMoedaBR(v: number | string | null | undefined): string {
  return paraNumero(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Campo de MOEDA com formatação automática ao digitar (estilo calculadora):
 * os dígitos preenchem os centavos da direita para a esquerda.
 *   digitar "1"          -> 0,01
 *   digitar "1550"       -> 15,50
 *   digitar "5632214521" -> 56.322.145,21
 *
 * Mantém o valor numérico "cru" (float) via onChangeValue; a exibição usa
 * separador de milhar e 2 casas (pt-BR). Ao focar, seleciona tudo para
 * sobrescrever.
 */
const InputMoeda: React.FC<InputMoedaProps> = ({
  value,
  onChangeValue,
  className,
  disabled,
  placeholder,
}) => {
  return (
    <Input
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={formataMoedaBR(value)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChangeValue(digits ? parseInt(digits, 10) / 100 : 0);
      }}
    />
  );
};

export default InputMoeda;
