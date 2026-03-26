import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, getBudgetCategoryIds } from '@/types/finance-utils';
import { MonthSelector } from './MonthSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const COLORS = [
  'hsl(160, 45%, 40%)', 'hsl(35, 90%, 55%)', 'hsl(220, 60%, 55%)',
  'hsl(0, 72%, 55%)', 'hsl(280, 50%, 55%)', 'hsl(180, 50%, 45%)',
  'hsl(45, 80%, 50%)', 'hsl(330, 60%, 50%)', 'hsl(120, 40%, 45%)', 'hsl(200, 60%, 50%)',
];

export function Charts() {
  const { getMonthFixed, getMonthExpenses, getMonthBudgets, categories } = useFinance();
  const fixed = getMonthFixed();
  const expenses = getMonthExpenses();
  const budgets = getMonthBudgets();

  const fixedPaidTotal = fixed
    .filter(f => f.status === 'paid')
    .reduce((s, f) => s + (f.actualAmount ?? f.estimatedAmount), 0);

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // Build by-category spending map
  const byCategory: Record<string, number> = {};

  // Fixed expenses (paid only)
  fixed.filter(f => f.status === 'paid').forEach(f => {
    if (!f.categoryId) return;
    const amount = f.actualAmount ?? f.estimatedAmount;
    byCategory[f.categoryId] = (byCategory[f.categoryId] || 0) + amount;
  });

  // Variable expenses
  expenses.forEach(e => {
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.amount;
  });

  const pieData = Object.entries(byCategory)
    .map(([key, value]) => {
      const cat = categories.find(c => c.id === key);
      return { name: cat ? `${cat.icon} ${cat.name}` : key, value };
    })
    .sort((a, b) => b.value - a.value);

  // Budget vs actual for budget categories
  const budgetCatIds = getBudgetCategoryIds(budgets);
  const budgetRows = budgets.map(b => {
    const cat = categories.find(c => c.id === b.categoryId);
    const spent = expenses
      .filter(e => e.categoryId === b.categoryId)
      .reduce((s, e) => s + e.amount, 0);
    const isOverspent = spent > b.amount;
    return { name: cat ? `${cat.icon} ${cat.name}` : b.description, ceiling: b.amount, spent, isOverspent };
  });

  return (
    <div className="space-y-4">
      <MonthSelector />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Fixos (pago)</p>
            <p className="text-lg font-bold text-expense">{formatCurrency(fixedPaidTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Avulsos</p>
            <p className="text-lg font-bold text-expense">{formatCurrency(expenseTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs actual bars */}
      {budgetRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Orçamentos de Categoria</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {budgetRows.map((row, i) => {
              const pct = Math.min(100, (row.spent / row.ceiling) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{row.name}</span>
                    <span className={row.isOverspent ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                      {formatCurrency(row.spent)} / {formatCurrency(row.ceiling)}
                      {row.isOverspent && ' ⚠️'}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${row.isOverspent ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {pieData.length > 0 ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Gastos por Categoria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm">Sem dados para mostrar gráficos.</p>
        </div>
      )}
    </div>
  );
}
