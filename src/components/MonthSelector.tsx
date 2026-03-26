import { useFinance } from '@/contexts/FinanceContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export function MonthSelector() {
  const { currentMonth, setCurrentMonth } = useFinance();

  return (
    <div className="flex items-center justify-between px-1">
      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <h2 className="text-lg font-semibold capitalize">
        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
      </h2>
      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
