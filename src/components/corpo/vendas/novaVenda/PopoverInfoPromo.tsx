import React, { useEffect, useRef, useState } from 'react';

interface PopoverInfoPromoProps {
  promocao: any;
  position: { x: number; y: number };
  onClose: () => void;
}

const PopoverInfoPromo: React.FC<PopoverInfoPromoProps> = ({
  promocao,
  position,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [finalPos, setFinalPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    if (popoverRef.current) {
      const { offsetHeight, offsetWidth } = popoverRef.current;
      const fitsAbove = position.y - offsetHeight > 0;
      const top = fitsAbove ? position.y - offsetHeight - 8 : position.y + 8;
      const left = position.x - offsetWidth / 2;

      setFinalPos({ top, left });
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const {
    qtde_minima_item,
    qtde_maxima_item,
    valor_desconto_item,
    tipo_desconto_item,
    qtd_total_item,
    qtdfaturado,
    qtdvendido,
  } = promocao;
  const valorDesconto =
    Number(valor_desconto_item) % 2 === 0
      ? Number(valor_desconto_item).toFixed(0)
      : Number(valor_desconto_item).toFixed(2);
  const valorDescontoFormatado =
    tipo_desconto_item === 'PERC'
      ? `${valorDesconto} %`
      : `R$ ${Number(valor_desconto_item).toFixed(2)}`;

  const totalFaturado = Number(qtdfaturado ?? 0);
  const totalVendido = Number(qtdvendido ?? 0);
  const totalDisponivel =
    Number(qtd_total_item ?? 0) - (totalFaturado + totalVendido);

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 text-foreground border border-border rounded-md shadow-md p-4 w-64 bg-white dark:bg-zinc-800"
      style={{
        top: finalPos.top,
        left: finalPos.left,
      }}
    >
      <div className="text-sm space-y-2">
        <p>
          <strong>Mínimo por Cliente:</strong> {qtde_minima_item}
        </p>
        <p>
          <strong>Máximo por Cliente:</strong> {qtde_maxima_item}
        </p>
        <p>
          <strong>Desconto:</strong> {valorDescontoFormatado}
        </p>
        <p>
          <strong>Qtd Disponível:</strong> {totalDisponivel}
        </p>
      </div>
    </div>
  );
};

export default PopoverInfoPromo;
