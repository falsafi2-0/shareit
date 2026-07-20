import { ArrowLeftRight, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-4 md:px-8">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Zap className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">ShareIt</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeftRight className="h-4 w-4" />
        <span className="hidden sm:inline">P2P File Transfer</span>
      </div>
    </header>
  );
}
