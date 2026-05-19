interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: string;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  width = 'w-[94%] max-w-7xl',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className={`bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 rounded-lg shadow-xl ${width} p-5 transition-colors duration-300`}
      >
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-zinc-700">
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
        <div className="space-y-3 overflow-visible max-h-[85vh]">{children}</div>
      </div>
    </div>
  );
}
