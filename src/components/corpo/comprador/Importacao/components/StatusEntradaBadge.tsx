/**
 * Situação da DI depois de gerar as entradas. O status da DI continua o do Delphi
 * ('E' = entradas geradas), mas para o usuário a etiqueta mostra o que falta:
 * enquanto houver entrada com o preço não confirmado, "Falta confirmar preço (x de y)";
 * com todas confirmadas, "Concluída".
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';

export const StatusEntradaBadge: React.FC<{ total?: number | null; confirmadas?: number | null }> = ({
  total,
  confirmadas,
}) => {
  const t = Number(total) || 0;
  const c = Number(confirmadas) || 0;
  if (t === 0) return <Badge variant="default">Entrada Gerada</Badge>;
  if (c < t) {
    return (
      <Badge
        title={`${t} entrada(s) gerada(s), ${c} com preço confirmado. Abra a DI e confirme o preço de cada entrada.`}
        className="bg-amber-500 hover:bg-amber-500 text-white border-transparent whitespace-nowrap"
      >
        Falta confirmar preço ({t - c} de {t})
      </Badge>
    );
  }
  return (
    <Badge
      title={`${t} entrada(s) com preço confirmado.`}
      className="bg-green-600 hover:bg-green-600 text-white border-transparent"
    >
      Concluída
    </Badge>
  );
};
