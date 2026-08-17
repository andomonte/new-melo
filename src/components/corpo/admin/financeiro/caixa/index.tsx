import Caixa from '@/components/corpo/caixa/Caixa';

export default function PageSidebar() {
  return (
    <div className="h-full w-full flex flex-col bg-muted/40 text-black dark:text-gray-50">
      <div className="h-full w-full flex flex-col overflow-hidden">
        <Caixa />
      </div>
    </div>
  );
}
