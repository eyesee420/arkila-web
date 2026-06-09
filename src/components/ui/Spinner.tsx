import { Loader2 } from 'lucide-react';

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={size} className="animate-spin text-blue-600" />
    </div>
  );
}
