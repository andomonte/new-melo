interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: string; // 👈 novo
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  width = 'w-11/12 md:w-1/2 lg:w-1/3', // 👈 padrão antigo se não passar
}: ModalProps) {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={handleOverlayClick}>
      <div
        className={`bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 rounded-lg shadow-lg ${width} p-6 transition-colors duration-300`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 text-2xl"
          >
            &times;
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}
