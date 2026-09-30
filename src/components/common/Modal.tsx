interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: string;
  /** Classe do corpo do modal. Default rola o conteúdo (overflow-y-auto).
   *  Use "overflow-visible" quando houver combobox/dropdown que precisa
   *  transbordar — nesse caso o conteúdo precisa se virar para caber, porque a
   *  caixa é limitada a 92vh (ex.: a parte que cresce usa flex-1 min-h-0). */
  bodyClassName?: string;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  width = 'w-[94%] max-w-7xl',
  bodyClassName = 'overflow-y-auto max-h-[85vh]',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      {/* max-h + flex-col: a caixa nunca passa da viewport, então o cabeçalho
          (e o ✕) continuam visíveis por mais conteúdo que o corpo tenha. */}
      <div
        className={`bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 rounded-lg shadow-xl ${width} max-h-[92vh] flex flex-col p-5 transition-colors duration-300`}
      >
        <div className="shrink-0 flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-100 uppercase tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-100 text-lg transition-colors"
          >
            ✕
          </button>
        </div>
        <div className={`flex-1 min-h-0 space-y-3 ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
