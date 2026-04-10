import { Category } from '@/types/finance';
import { cn } from '@/lib/utils';

interface ScrollableCategoryGridProps {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ScrollableCategoryGrid({ categories, selectedId, onSelect }: ScrollableCategoryGridProps) {
  return (
    <div className="max-h-[200px] overflow-y-auto mt-1">
      <div className="grid grid-cols-5 gap-1.5">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-colors text-[10px]',
              selectedId === cat.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
            )}
          >
            <span className="text-base">{cat.icon}</span>
            <span className="truncate w-full text-center leading-tight">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
