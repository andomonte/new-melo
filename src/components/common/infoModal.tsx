import { ReactElement } from 'react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactElement;
  content: string;
}

export default function infoModal({
  isOpen,
  onClose,
  icon,
  content,
}: CustomModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white text-zinc-700 dark:text-zinc-100 dark:bg-zinc-700 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-lg flex flex-col">
        {/* Cabeçalho */}

        {/* Corpo com scroll */}
        <div className="overflow-y-auto p-6 flex-1">
          <div className="flex items-center justify-center text-center">
            {icon && <div className="mr-3">{icon}</div>}
            <p className=" text-base">{content}</p>
          </div>
        </div>

        {/* Rodapé fixo */}
        <div className="p-4 border-t sticky bottom-0 bg-white dark:text-zinc-100 dark:bg-zinc-700 z-10 text-right rounded-b-2xl">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
