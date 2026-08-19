import Transferencia from '@/components/corpo/transferencia/Transferencia';

export default function PageSidebar() {
  return (
    <div className="h-full w-full flex flex-col bg-muted/40 text-black dark:text-gray-50">
      <div className="h-full w-full flex flex-col overflow-hidden">
        <Transferencia />
      </div>
    </div>
  );
}
