import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  formatCurrency, calcOrcamento, calcReal,
  exportMonthToCsv,
} from '@/types/finance-utils';
import { MonthSelector } from './MonthSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Check, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FixedExpense } from '@/types/finance';
import { CsvImporter } from './CsvImporter';

export function Dashboard() {
  const {
    getMonthFixed, getMonthIncome, getMonthBudgets, getMonthExpenses, getMonthBills,
    markFixedPaid, deleteFixedExpense,
    updateMonthlyBudget, deleteMonthlyBudget,
    addIncome, deleteIncome, markIncomeReceived,
    importTemplate, getCarryover,
    categories, accounts, currentMonth,
    getCardExpenses, toggleBillPaid, creditCardBills,
  } = useFinance();

  const fixed = getMonthFixed();
  const incomes = getMonthIncome();
  const budgets = getMonthBudgets();
  const expenses = getMonthExpenses();
  const carryover = getCarryover();
  const monthKey = format(currentMonth, 'yyyy-MM');
  const nextMonthKey = format(addMonths(currentMonth, 1), 'yyyy-MM');

  const creditAccounts = accounts.filter(a => a.type === 'credit' && a.active);

  // Bill data (current month)
  const monthBills = getMonthBills();
  const billRows = monthBills.map(bill => {
    const account = creditAccounts.find(a => a.id === bill.accountId);
    const billExpenses = getCardExpenses(bill.accountId, monthKey);
    const expTotal = billExpenses.reduce((s, e) => s + e.amount, 0);
    const total = expTotal + bill.previousBalance;
    return { bill, account, expenses: billExpenses, total };
  }).filter(b => b.total > 0 || b.bill.status === 'paid');

  const totalCardBills = billRows.reduce((s, b) => s + b.total, 0);

  const paidBillsForCalc = creditCardBills
    .filter(b => b.month === monthKey && b.status === 'paid')
    .map(b => {
      const expenses = getCardExpenses(b.accountId, monthKey);
      const total = expenses.reduce((s, e) => s + e.amount, 0) + b.previousBalance;
      return { ...b, paidAmount: b.paidAmount ?? total };
    });

  const orcamento = calcOrcamento(incomes, fixed, budgets, expenses, accounts, creditCardBills.filter(b => b.month === monthKey), carryover);
  const real = calcReal(incomes, fixed, budgets, expenses, accounts, paidBillsForCalc, carryover);

  const disponivelParaAvulsos = orcamento.totalIncome + carryover - orcamento.totalFixed - orcamento.totalBudgetCeilings - totalCardBills;

  const [summaryTab, setSummaryTab] = useState<'orcamento' | 'real'>('orcamento');
  const [showDetails, setShowDetails] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const isReal = summaryTab === 'real';

  // CC recurring subscriptions (expense_entries created from templates)
  const ccTemplateExpenses = expenses.filter(e => {
    if (!e.templateId) return false;
    const acc = accounts.find(a => a.id === e.accountId);
    return acc?.type === 'credit';
  });

  const displayedFixed = isReal ? fixed.filter(f => f.status === 'paid') : fixed;
  const displayedIncomes = isReal ? incomes.filter(i => i.status === 'received') : incomes;
  const fixedPaidCount = fixed.filter(f => f.status === 'paid').length;

  // Sort fixed: pending first (by date), then paid (by date)
  const sortedFixed = [...displayedFixed].sort((a, b) => {
    const aPaid = a.status === 'paid' ? 1 : 0;
    const bPaid = b.status === 'paid' ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.description.localeCompare(b.description);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex-1"><MonthSelector /></div>
        <Button
          variant="outline" size="icon" className="shrink-0"
          onClick={() => exportMonthToCsv(monthKey, incomes, fixed, budgets, expenses, accounts, categories, paidBillsForCalc, carryover)}
          title="Exportar CSV"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Financial Summary */}
      <Card className="bg-primary text-primary-foreground">
        <Tabs value={summaryTab} onValueChange={(v) => setSummaryTab(v as 'orcamento' | 'real')} className="w-full">
          <TabsList className="w-full bg-primary-foreground/10 mx-3 mt-3 mb-0 max-w-[calc(100%-1.5rem)]">
            <TabsTrigger value="orcamento" className="flex-1 text-primary-foreground/70 data-[state=active]:text-primary-foreground data-[state=active]:bg-primary-foreground/20">Orçamento</TabsTrigger>
            <TabsTrigger value="real" className="flex-1 text-primary-foreground/70 data-[state=active]:text-primary-foreground data-[state=active]:bg-primary-foreground/20">Real</TabsTrigger>
          </TabsList>

          {/* ── ORÇAMENTO ── */}
          <TabsContent value="orcamento" className="mt-0">
            <CardContent className="p-5 pt-3 space-y-2">

              {/* Modo simples */}
              <div className="flex justify-between text-sm">
                <span className="opacity-80">Entradas</span>
                <span className="font-bold">{formatCurrency(orcamento.totalIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-80">(-) Compromissos</span>
                <span className="font-bold">
                  {formatCurrency(orcamento.totalFixed + orcamento.totalBudgetCeilings + totalCardBills)}
                </span>
              </div>

              {/* Modo expandido */}
              {showDetails && (
                <div className="pl-3 border-l border-primary-foreground/20 space-y-1.5 py-1">
                  <div className="flex justify-between text-xs opacity-80">
                    <span>Gastos Fixos</span>
                    <span>{formatCurrency(orcamento.totalFixed)}</span>
                  </div>
                  <div className="flex justify-between text-xs opacity-80">
                    <span>Orçamentos</span>
                    <span>{formatCurrency(orcamento.totalBudgetCeilings)}</span>
                  </div>
                  {totalCardBills > 0 && (
                    <div className="flex justify-between text-xs opacity-80">
                      <span>Faturas de Cartão</span>
                      <span>{formatCurrency(totalCardBills)}</span>
                    </div>
                  )}
                  {orcamento.totalLooseDebit > 0 && (
                    <div className="flex justify-between text-xs opacity-80">
                      <span>Gastos no débito</span>
                      <span>{formatCurrency(orcamento.totalLooseDebit)}</span>
                    </div>
                  )}
                </div>
              )}

              {carryover !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="opacity-80">{carryover > 0 ? '(+)' : '(-)'} Mês anterior</span>
                  <span className="font-bold">{formatCurrency(Math.abs(carryover))}</span>
                </div>
              )}

              <div className="border-t border-primary-foreground/20 pt-2 flex justify-between">
                <span className="font-bold">Disponível</span>
                <span className={cn('font-bold text-lg', orcamento.disponivel < 0 && 'text-destructive-foreground opacity-80')}>
                  {formatCurrency(orcamento.disponivel)}
                </span>
              </div>

              {/* Botão ver detalhes */}
              <button
                onClick={() => setShowDetails(v => !v)}
                className="w-full text-center text-xs opacity-50 hover:opacity-80 pt-1 transition-opacity"
              >
                {showDetails ? '▲ ocultar detalhes' : '▼ ver detalhes'}
              </button>
            </CardContent>
          </TabsContent>

          {/* ── REAL ── */}
          <TabsContent value="real" className="mt-0">
            <CardContent className="p-5 pt-3 space-y-2">

              {/* Modo simples */}
              <div className="flex justify-between text-sm">
                <span className="opacity-80">Recebido</span>
                <span className="font-bold">{formatCurrency(real.receivedIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-80">(-) Compromissos pagos</span>
                <span className="font-bold">
                  {formatCurrency(real.fixedPaid + real.budgetSpentDebitPaid + real.looseDebitPaid + real.billsPaid + real.budgetSpentCardPaid)}
                </span>
              </div>

              {/* Modo expandido */}
              {showDetails && (
                <div className="pl-3 border-l border-primary-foreground/20 space-y-1.5 py-1">
                  {real.fixedPaid > 0 && (
                    <div className="flex justify-between text-xs opacity-80">
                      <span>Fixos pagos</span>
                      <span>{formatCurrency(real.fixedPaid)}</span>
                    </div>
                  )}
                  {(real.budgetSpentDebitPaid + real.looseDebitPaid) > 0 && (
                    <div className="flex justify-between text-xs opacity-80">
                      <span>Gastos no débito</span>
                      <span>{formatCurrency(real.budgetSpentDebitPaid + real.looseDebitPaid)}</span>
                    </div>
                  )}
                  {(real.billsPaid + real.budgetSpentCardPaid) > 0 && (
                    <div className="flex justify-between text-xs opacity-80">
                      <span>Faturas pagas</span>
                      <span>{formatCurrency(real.billsPaid + real.budgetSpentCardPaid)}</span>
                    </div>
                  )}
                </div>
              )}

              {carryover !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="opacity-80">{carryover > 0 ? '(+)' : '(-)'} Mês anterior</span>
                  <span className="font-bold">{formatCurrency(Math.abs(carryover))}</span>
                </div>
              )}

              <div className="border-t border-primary-foreground/20 pt-2 flex justify-between">
                <span className="font-bold">Saldo na conta</span>
                <span className={cn('font-bold text-lg', real.saldoNaConta < 0 && 'text-destructive-foreground opacity-80')}>
                  {formatCurrency(real.saldoNaConta)}
                </span>
              </div>

              {/* Pendências — só no modo expandido */}
              {showDetails && (real.fixedPending > 0 || real.pendingIncome > 0 || billRows.some(b => b.bill.status === 'pending' && b.total > 0)) && (
                <div className="border-t border-primary-foreground/10 pt-2 space-y-1">
                  {real.fixedPending > 0 && (
                    <div className="flex justify-between text-xs opacity-70">
                      <span>Ainda a pagar (fixos)</span>
                      <span>{formatCurrency(real.fixedPending)}</span>
                    </div>
                  )}
                  {billRows.filter(b => b.bill.status === 'pending' && b.total > 0).map(b => (
                    <div key={b.bill.id} className="flex justify-between text-xs opacity-70">
                      <span>Fatura {b.account?.name} (pendente)</span>
                      <span>{formatCurrency(b.total)}</span>
                    </div>
                  ))}
                  {real.pendingIncome > 0 && (
                    <div className="flex justify-between text-xs opacity-70">
                      <span>Ainda a receber</span>
                      <span>{formatCurrency(real.pendingIncome)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botão ver detalhes */}
              <button
                onClick={() => setShowDetails(v => !v)}
                className="w-full text-center text-xs opacity-50 hover:opacity-80 pt-1 transition-opacity"
              >
                {showDetails ? '▲ ocultar detalhes' : '▼ ver detalhes'}
              </button>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Credit Card Bills */}
      {(billRows.length > 0 || creditAccounts.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Faturas de Cartão</h2>
          <div className="space-y-2">
            {creditAccounts.map(account => {
              const billRow = billRows.find(b => b.account?.id === account.id);
              const isPaid = billRow?.bill.status === 'paid';

              // ── PRÓXIMA FATURA (fatura atual paga) ──────────────────────
              if (isPaid) {
                const nextExpenses = getCardExpenses(account.id, nextMonthKey);
                const nextTotal = nextExpenses.reduce((s, e) => s + e.amount, 0);
                const nextBill = creditCardBills.find(b => b.accountId === account.id && b.month === nextMonthKey);
                const nextPrevBalance = nextBill?.previousBalance ?? 0;
                const nextGrandTotal = nextTotal + nextPrevBalance;

                return (
                  <Card
                    key={account.id}
                    className="p-3 border-dashed border-muted-foreground/30 bg-muted/30"
                    style={{ borderLeftWidth: 3, borderLeftColor: account.color }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Paid checkmark — clicável para desmarcar */}
                      <button onClick={() => toggleBillPaid(account.id, monthKey, billRow!.total)} className="shrink-0">
                        <div className="h-6 w-6 rounded-full bg-income border-income border-2 flex items-center justify-center transition-colors">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground">
                          💳 Próxima fatura — {account.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vence dia {account.dueDay} · {nextExpenses.length} gasto{nextExpenses.length !== 1 ? 's' : ''} no próximo ciclo
                          {nextPrevBalance > 0 && ` · saldo anterior ${formatCurrency(nextPrevBalance)}`}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-muted-foreground">
                        {nextGrandTotal > 0 ? formatCurrency(nextGrandTotal) : '—'}
                      </p>
                    </div>
                  </Card>
                );
              }

              // ── FATURA PENDENTE (comportamento normal) ───────────────────
              if (!billRow) return null;
              const { bill, expenses: billExp, total } = billRow;
              const displayAmount = bill.paidAmount ? bill.paidAmount : total;

              return (
                <Card
                  key={account.id}
                  className="p-3 border-border"
                  style={{ borderLeftWidth: 3, borderLeftColor: account.color }}
                >
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleBillPaid(account.id, monthKey, total)} className="shrink-0">
                      <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center transition-colors" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">💳 Fatura {account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence dia {account.dueDay} · {billExp.length} gasto{billExp.length !== 1 ? 's' : ''}
                        {bill.previousBalance > 0 && ` · saldo anterior ${formatCurrency(bill.previousBalance)}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-expense">
                      {formatCurrency(displayAmount)}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget Categories */}
      {budgets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Orçamentos por Categoria</h2>
          <div className="space-y-2">
            {orcamento.budgetDetails.map(({ budget, ceiling, spent, isOverspent }) => {
              const cat = categories.find(c => c.id === budget.categoryId);
              const pct = ceiling > 0 ? Math.min((spent / ceiling) * 100, 100) : 0;
              const diff = spent - ceiling;
              return (
                <Card key={budget.id} className={cn('p-3', isOverspent && 'border-expense/40')}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{cat?.icon || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cat?.name || budget.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-sm font-bold', isOverspent ? 'text-expense' : 'text-foreground')}>
                          {formatCurrency(spent)}
                        </span>
                        <span className="text-xs text-muted-foreground">/ {formatCurrency(ceiling)}</span>
                        {isOverspent && <span className="text-xs font-medium text-expense">+{formatCurrency(diff)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        const v = prompt('Novo teto do orçamento:', String(ceiling));
                        if (v) {
                          const num = parseFloat(v.replace(',', '.'));
                          if (num > 0) updateMonthlyBudget(budget.id, { amount: num });
                        }
                      }}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-expense"
                        onClick={() => deleteMonthlyBudget(budget.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={pct} className={cn('h-2', isOverspent && '[&>div]:bg-expense')} />
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Fixed Expenses */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {isReal
            ? `Gastos Fixos Pagos (${displayedFixed.length})`
            : `Gastos Fixos do Mês (${fixedPaidCount}/${fixed.length}${ccTemplateExpenses.length > 0 ? ` + ${ccTemplateExpenses.length} no cartão` : ''})`}
        </h2>
        {displayedFixed.length === 0 && ccTemplateExpenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-3xl mb-2">{isReal ? '✅' : '📋'}</p>
            <p className="text-sm">{isReal ? 'Nenhum gasto fixo pago ainda.' : 'Nenhum gasto fixo importado.'}</p>
            {!isReal && <p className="text-xs">Use o botão abaixo para importar do template.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedFixed.map(item => (
              <FixedExpenseRow
                key={item.id}
                item={item}
                categories={categories}
                onTogglePaid={() => markFixedPaid(item.id)}
                onUpdateActual={(amount) => markFixedPaid(item.id, amount)}
                onDelete={() => deleteFixedExpense(item.id)}
              />
            ))}
            {/* CC recurring subscriptions (paid via bill, no toggle) */}
            {ccTemplateExpenses
              .sort((a, b) => a.description.localeCompare(b.description))
              .map(item => {
                const cat = categories.find(c => c.id === item.categoryId);
                const acc = accounts.find(a => a.id === item.accountId);
                const billPaid = creditCardBills.some(b => b.accountId === item.accountId && b.month === monthKey && b.status === 'paid');
                return (
                  <div key={item.id}
                    className={cn('flex items-center gap-3 p-3 rounded-lg border',
                      billPaid ? 'border-income/30 bg-income/5 opacity-60' : 'border-border')}
                    style={acc ? { borderLeftWidth: 3, borderLeftColor: acc.color } : {}}>
                    <span className="text-lg shrink-0">💳</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', billPaid && 'line-through')}>{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name}{acc && <span> · <span style={{ color: acc.color }}>{acc.name}</span></span>}
                        {billPaid ? ' · fatura paga' : ' · pago via fatura'}
                      </p>
                    </div>
                    <p className={cn('text-sm font-bold shrink-0', billPaid ? 'text-income' : 'text-expense')}>
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </div>


      {/* Income */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {isReal
              ? `Recebidas — ${formatCurrency(displayedIncomes.reduce((s, i) => s + (i.actualAmount ?? i.estimatedAmount), 0))}`
              : `Entradas — ${formatCurrency(orcamento.totalIncome)}`}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setShowAddIncome(true)}>
            <Plus className="h-4 w-4 mr-1" /> Entrada
          </Button>
        </div>
        {displayedIncomes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {isReal ? 'Nenhuma entrada recebida ainda.' : 'Nenhuma entrada. Importe do template ou adicione manualmente.'}
          </p>
        ) : (
          <div className="space-y-1">
            {displayedIncomes.map(inc => (
              <Card key={inc.id} className={cn('flex items-center gap-3 p-3', inc.status === 'received' && 'bg-income/5 border-income/30')}>
                <button onClick={() => markIncomeReceived(inc.id)} className="shrink-0">
                  <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    inc.status === 'received' ? 'bg-income border-income' : 'border-muted-foreground/40')}>
                    {inc.status === 'received' && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm truncate', inc.status === 'received' && 'line-through opacity-60')}>{inc.description}</p>
                  {inc.actualAmount && inc.actualAmount !== inc.estimatedAmount && (
                    <p className="text-xs text-muted-foreground">Estimado: {formatCurrency(inc.estimatedAmount)}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-income">
                  {formatCurrency(inc.status === 'received' ? (inc.actualAmount ?? inc.estimatedAmount) : inc.estimatedAmount)}
                </p>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteIncome(inc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Import template */}
      <Button onClick={importTemplate} variant="outline" className="w-full gap-2">
        <Download className="h-4 w-4" /> Importar Template do Mês
      </Button>

      <Button onClick={() => setShowCsvImport(true)} variant="outline" className="w-full gap-2 text-muted-foreground">
        <Upload className="h-4 w-4" /> Importar CSV
      </Button>

      <AddIncomeSheet open={showAddIncome} onClose={() => setShowAddIncome(false)} />
      <CsvImporter open={showCsvImport} onClose={() => setShowCsvImport(false)} />
    </div>
  );
}

// ============================================================
// Fixed Expense Row
// ============================================================
function FixedExpenseRow({
  item, categories, onTogglePaid, onUpdateActual, onDelete,
}: {
  item: FixedExpense;
  categories: import('@/types/finance').Category[];
  onTogglePaid: () => void;
  onUpdateActual: (amount: number) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const cat = categories.find(c => c.id === item.categoryId);
  const actualDisplay = item.status === 'paid' ? (item.actualAmount ?? item.estimatedAmount) : null;
  const diff = actualDisplay !== null ? actualDisplay - item.estimatedAmount : null;

  const handleSaveActual = () => {
    const val = parseFloat(editValue.replace(',', '.'));
    if (val > 0) onUpdateActual(val);
    setEditing(false);
    setEditValue('');
  };

  return (
    <Card className={cn('p-3',
      item.status === 'pending' && 'border-pending/40 bg-pending/5',
      item.status === 'paid' && 'border-income/30 bg-income/5'
    )}>
      <div className="flex items-center gap-3">
        <button onClick={onTogglePaid} className="shrink-0">
          <div className={cn('h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors',
            item.status === 'paid' ? 'bg-income border-income' : 'border-muted-foreground/40')}>
            {item.status === 'paid' && <Check className="h-3.5 w-3.5 text-white" />}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{cat?.icon}</span>
            <p className={cn('text-sm font-medium truncate', item.status === 'paid' && 'line-through opacity-60')}>
              {item.description}
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0 mt-0.5">
            {item.dueDate && (
              <span style={{ fontSize: '0.68rem' }} className="text-muted-foreground leading-tight whitespace-nowrap">
                {format(parseISO(item.dueDate), 'dd MMM', { locale: ptBR })} ·
              </span>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Estimado: {formatCurrency(item.estimatedAmount)}
            </span>
            {diff !== null && diff !== 0 && (
              <span className={cn('text-xs font-medium whitespace-nowrap', diff > 0 ? 'text-expense' : 'text-income')}>
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {item.status === 'paid'
            ? <p className="text-sm font-bold text-income">{formatCurrency(actualDisplay!)}</p>
            : <p className="text-sm font-bold text-pending">{formatCurrency(item.estimatedAmount)}</p>
          }
        </div>
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { setEditing(!editing); setEditValue(String(item.actualAmount ?? item.estimatedAmount)); }}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-expense" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {editing && (
        <div className="flex gap-2 mt-2 pl-9">
          <Input type="number" inputMode="decimal" placeholder="Valor pago" value={editValue}
            onChange={e => setEditValue(e.target.value)} className="h-8 text-sm flex-1" autoFocus />
          <Button size="sm" className="h-8" onClick={handleSaveActual}>Salvar</Button>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Add Income Sheet (quick add inside dashboard)
// ============================================================
function AddIncomeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addIncome, currentMonth } = useFinance();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || !description) return;
    addIncome({
      description,
      estimatedAmount: num,
      month: format(currentMonth, 'yyyy-MM'),
      status: 'pending',
    });
    setAmount('');
    setDescription('');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader><SheetTitle>Nova Entrada</SheetTitle></SheetHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={e => setAmount(e.target.value)} className="text-xl font-bold h-12 mt-1" autoFocus />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input placeholder="Ex: Salário, Freelance" value={description}
              onChange={e => setDescription(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleSubmit} className="w-full h-12 text-base" disabled={!amount || !description}>
            Adicionar Entrada
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}