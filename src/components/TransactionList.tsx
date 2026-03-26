import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { ExpenseEntry } from '@/types/finance';
import { formatCurrency, getBudgetCategoryIds } from '@/types/finance-utils';
import { MonthSelector } from './MonthSelector';
import { EditTransaction } from './EditTransaction';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function TransactionList() {
  const { getMonthExpenses, getMonthBudgets, deleteExpense, categories, accounts } = useFinance();
  const budgets = getMonthBudgets();
  const budgetCatIds = getBudgetCategoryIds(budgets);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'debit' | account.id

  const expenses = getMonthExpenses()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const filteredExpenses = expenses.filter(ex => {
    if (filter === 'all') return true;
    if (filter === 'debit') {
      const acc = accounts.find(a => a.id === ex.accountId);
      return acc?.type === 'checking';
    }
    return ex.accountId === filter;
  });

  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.active);

  return (
    <div className="space-y-4">
      <MonthSelector />
      <h2 className="text-lg font-semibold">Gastos Avulsos</h2>

      {/* Filter chips */}
      {creditAccounts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border')}>
            Todos
          </button>
          <button onClick={() => setFilter('debit')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === 'debit' ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border')}>
            💵 Débito
          </button>
          {creditAccounts.map(acc => (
            <button key={acc.id} onClick={() => setFilter(acc.id)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                filter === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border')}
              style={filter === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
              {acc.name}
            </button>
          ))}
        </div>
      )}

      {filteredExpenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-3xl mb-2">💸</p>
          <p className="text-sm">Nenhum gasto avulso neste mês.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map(ex => {
            const cat = categories.find(c => c.id === ex.categoryId);
            const acc = accounts.find(a => a.id === ex.accountId);
            const isLinked = budgetCatIds.has(ex.categoryId);
            const isCredit = acc?.type === 'credit';
            const isPending = ex.status === 'pending';

            return (
              <Card key={ex.id}
                className={cn(
                  'flex items-center gap-3 p-3 cursor-pointer active:scale-[0.98] transition-transform',
                  isCredit && 'border-[1.5px]',
                  isPending && !isCredit && 'opacity-70 border-dashed'
                )}
                style={isCredit && acc ? { borderColor: `${acc.color}40`, backgroundColor: `${acc.color}08` } : {}}
                onClick={() => setEditingExpense(ex)}
              >
                <span className="text-xl">{cat?.icon || '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ex.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(ex.date), 'dd MMM', { locale: ptBR })}
                    {' · '}{cat?.name}
                    {acc && <span> · <span style={isCredit ? { color: acc.color } : {}}>{acc.name}</span></span>}
                    {isLinked && ' · 📊'}
                    {isPending && !isCredit && ' · ⏳ pendente'}
                  </p>
                </div>
                <p className="text-sm font-bold text-expense whitespace-nowrap">
                  -{formatCurrency(ex.amount)}
                </p>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteExpense(ex.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {editingExpense && (
        <EditTransaction open={!!editingExpense} onClose={() => setEditingExpense(null)} expense={editingExpense} />
      )}
    </div>
  );
}
