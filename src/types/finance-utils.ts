import { format, parseISO, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  Account, Category, FixedExpense, IncomeEntry, MonthlyBudget,
  ExpenseEntry, CreditCardBill, Transfer,
} from './finance';

// ============================================================
// FORMATTING
// ============================================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatMonth(month: string): string {
  // 'yyyy-MM' → 'Março 2026'
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ============================================================
// CREDIT CARD BILL MONTH
// An expense on date D with a card that closes on day C:
//   - If D.day <= C → bill falls in D's month
//   - If D.day >  C → bill falls in the NEXT month
// ============================================================

export function getBillMonth(purchaseDate: string, closingDay: number): string {
  const d = parseISO(purchaseDate);
  if (d.getDate() <= closingDay) {
    return format(d, 'yyyy-MM');
  } else {
    return format(addMonths(d, 1), 'yyyy-MM');
  }
}

// Returns the bill month for an expense given all accounts
export function getExpenseBillMonth(
  expense: ExpenseEntry,
  accounts: Account[],
): string {
  const account = accounts.find(a => a.id === expense.accountId);
  if (account?.type === 'credit' && account.closingDay != null) {
    return getBillMonth(expense.date, account.closingDay);
  }
  // Debit/cash: bill month = purchase month
  return format(parseISO(expense.date), 'yyyy-MM');
}

// ============================================================
// MONTH FILTERING HELPERS
// ============================================================

export function getMonthExpenses(
  expenses: ExpenseEntry[],
  accounts: Account[],
  monthKey: string,
): ExpenseEntry[] {
  return expenses.filter(e => getExpenseBillMonth(e, accounts) === monthKey);
}

export function isDebit(expense: ExpenseEntry, accounts: Account[]): boolean {
  const account = accounts.find(a => a.id === expense.accountId);
  return account?.type === 'checking';
}

export function isCredit(expense: ExpenseEntry, accounts: Account[]): boolean {
  const account = accounts.find(a => a.id === expense.accountId);
  return account?.type === 'credit';
}

// ============================================================
// BUDGET HELPERS
// ============================================================

/** Returns a Set of category IDs that have a budget ceiling this month */
export function getBudgetCategoryIds(budgets: MonthlyBudget[]): Set<string> {
  return new Set(budgets.map(b => b.categoryId));
}

/** Sum of expenses (any status) in a specific budget category */
export function getBudgetCategorySpent(
  categoryId: string,
  expenses: ExpenseEntry[],
): number {
  return expenses
    .filter(e => e.categoryId === categoryId)
    .reduce((s, e) => s + e.amount, 0);
}

/** Sum of PAID debit expenses in a specific budget category */
export function getBudgetCategorySpentReal(
  categoryId: string,
  expenses: ExpenseEntry[],
  accounts: Account[],
): number {
  return expenses
    .filter(e =>
      e.categoryId === categoryId &&
      isDebit(e, accounts) &&
      e.status === 'paid'
    )
    .reduce((s, e) => s + e.amount, 0);
}

// Split expenses into budget-linked vs loose
export function splitByBudget(
  expenses: ExpenseEntry[],
  budgetCategoryIds: Set<string>,
): { linked: ExpenseEntry[]; loose: ExpenseEntry[] } {
  const linked: ExpenseEntry[] = [];
  const loose: ExpenseEntry[] = [];
  expenses.forEach(e => {
    if (budgetCategoryIds.has(e.categoryId)) {
      linked.push(e);
    } else {
      loose.push(e);
    }
  });
  return { linked, loose };
}

// ============================================================
// CREDIT CARD BILL TOTAL
// The total for a bill = sum of card expenses for that month + previous_balance
// ============================================================

export function getBillTotal(
  cardId: string,
  billMonth: string,
  expenses: ExpenseEntry[],
  accounts: Account[],
  bills: CreditCardBill[],
): number {
  const expensesTotal = expenses
    .filter(e => e.accountId === cardId && getExpenseBillMonth(e, accounts) === billMonth)
    .reduce((s, e) => s + e.amount, 0);

  const bill = bills.find(b => b.accountId === cardId && b.month === billMonth);
  const previousBalance = bill?.previousBalance ?? 0;

  return expensesTotal + previousBalance;
}

// ============================================================
// ORÇAMENTO CALCULATION
// "How much of what I'll receive this month is already committed?"
//
// disponivel = totalIncome + carryover
//            - fixedExpenses (all, estimated)
//            - budgetCeilings (full ceiling, NOT actual spending)
//              → if actual spending > ceiling, use actual (overspend visible)
//            - looseDebitExpenses (non-budget debit, paid OR pending)
//            - cardBillsTotal (all card expenses for this bill month)
// ============================================================

export interface OrcamentoResult {
  totalIncome: number;
  carryover: number;
  totalFixed: number;         // sum of estimated amounts for all fixed expenses
  totalBudgetCeilings: number; // sum of budget ceilings (or actual if overspent)
  budgetDetails: {
    budget: MonthlyBudget;
    ceiling: number;
    spent: number;
    effective: number;        // max(ceiling, spent)
    isOverspent: boolean;
  }[];
  totalLooseDebit: number;    // non-budget debit expenses (paid + pending)
  totalCardBills: number;     // all card expenses falling in this bill month
  disponivel: number;
}

export function calcOrcamento(
  incomes: IncomeEntry[],
  fixedExpenses: FixedExpense[],
  budgets: MonthlyBudget[],
  expenses: ExpenseEntry[],
  accounts: Account[],
  bills: CreditCardBill[],
  carryover: number,
): OrcamentoResult {
  const totalIncome = incomes.reduce((s, i) => s + i.estimatedAmount, 0);
  const totalFixed  = fixedExpenses.reduce((s, f) => s + f.estimatedAmount, 0);

  const budgetCatIds = getBudgetCategoryIds(budgets);

  // Budget details: use max(ceiling, actual_spent) so overspend is visible
  const budgetDetails = budgets.map(b => {
    const spent = getBudgetCategorySpent(b.categoryId, expenses);
    const effective = Math.max(b.amount, spent);
    return {
      budget: b,
      ceiling: b.amount,
      spent,
      effective,
      isOverspent: spent > b.amount,
    };
  });
  const totalBudgetCeilings = budgetDetails.reduce((s, d) => s + d.effective, 0);

  // Loose debit expenses: non-budget, debit account, any status
  const { loose } = splitByBudget(expenses, budgetCatIds);
  const looseDebit = loose.filter(e => isDebit(e, accounts));
  const totalLooseDebit = looseDebit.reduce((s, e) => s + e.amount, 0);

  // Card bill total: all card expenses (already filtered to this bill month by context)
  const cardExpenses = expenses.filter(e => isCredit(e, accounts));
  const totalCardBills = cardExpenses.reduce((s, e) => s + e.amount, 0)
    + bills.reduce((s, b) => s + b.previousBalance, 0);

  const disponivel = totalIncome + carryover - totalFixed - totalBudgetCeilings - totalLooseDebit - totalCardBills;

  return {
    totalIncome, carryover, totalFixed, totalBudgetCeilings,
    budgetDetails, totalLooseDebit, totalCardBills, disponivel,
  };
}

// ============================================================
// REAL CALCULATION
// "What does my bank account actually show?"
//
// saldoNaConta = receivedIncome + carryover
//              - fixedPaid (actual_amount or estimated)
//              - budgetSpentDebitPaid (paid debit expenses in budget categories)
//              - looseDebitPaid (paid non-budget debit expenses)
//              - billsPaid (paid CC bills, minus budget-category CC expenses to avoid double-count)
// ============================================================

export interface RealResult {
  receivedIncome: number;
  pendingIncome: number;
  carryover: number;
  fixedPaid: number;
  fixedPending: number;
  budgetSpentDebitPaid: number;   // paid debit in budget categories
  budgetSpentCardPaid: number;    // CC budget expenses counted when bill is paid
  looseDebitPaid: number;         // paid non-budget debit
  billsPaid: number;              // CC bills paid (net of budget CC to avoid double-count)
  totalOut: number;
  saldoNaConta: number;
}

export function calcReal(
  incomes: IncomeEntry[],
  fixedExpenses: FixedExpense[],
  budgets: MonthlyBudget[],
  expenses: ExpenseEntry[],
  accounts: Account[],
  bills: CreditCardBill[],
  carryover: number,
): RealResult {
  const receivedIncome = incomes
    .filter(i => i.status === 'received')
    .reduce((s, i) => s + (i.actualAmount ?? i.estimatedAmount), 0);

  const pendingIncome = incomes
    .filter(i => i.status === 'pending')
    .reduce((s, i) => s + i.estimatedAmount, 0);

  const fixedPaid = fixedExpenses
    .filter(f => f.status === 'paid')
    .reduce((s, f) => s + (f.actualAmount ?? f.estimatedAmount), 0);

  const fixedPending = fixedExpenses
    .filter(f => f.status === 'pending')
    .reduce((s, f) => s + f.estimatedAmount, 0);

  const budgetCatIds = getBudgetCategoryIds(budgets);
  const { linked, loose } = splitByBudget(expenses, budgetCatIds);

  // Paid debit in budget categories
  const budgetSpentDebitPaid = linked
    .filter(e => isDebit(e, accounts) && e.status === 'paid')
    .reduce((s, e) => s + e.amount, 0);

  // Paid non-budget debit
  const looseDebitPaid = loose
    .filter(e => isDebit(e, accounts) && e.status === 'paid')
    .reduce((s, e) => s + e.amount, 0);

  // CC budget expenses (all — debit or credit, any status)
  // These are counted when the CC bill is paid, not individually
  const budgetCCExpenses = linked.filter(e => isCredit(e, accounts));
  const budgetCCTotal = budgetCCExpenses.reduce((s, e) => s + e.amount, 0);

  // Paid CC bills: subtract budget CC expenses to avoid double-counting
  // (budget CC spend is accounted for via budgetSpentCardPaid below)
  const paidBills = bills.filter(b => b.status === 'paid');
  const totalPaidBillAmount = paidBills.reduce((s, b) => {
    // Use paid_amount if set, otherwise compute from expenses
    // Note: this function receives pre-computed bill amounts from context
    return s + (b.paidAmount ?? 0);
  }, 0);

  // Of the paid bills, how much was budget-category CC expenses?
  // Only count budget CC expenses for cards whose bill is paid
  const paidCardIds = new Set(paidBills.map(b => b.accountId));
  const budgetSpentCardPaid = budgetCCExpenses
    .filter(e => paidCardIds.has(e.accountId))
    .reduce((s, e) => s + e.amount, 0);

  // Net bill payment = paid bill total - budget CC expenses (already counted above)
  const billsPaid = Math.max(0, totalPaidBillAmount - budgetSpentCardPaid);

  const totalOut = fixedPaid + budgetSpentDebitPaid + budgetSpentCardPaid + looseDebitPaid + billsPaid;
  const saldoNaConta = receivedIncome + carryover - totalOut;

  return {
    receivedIncome, pendingIncome, carryover,
    fixedPaid, fixedPending,
    budgetSpentDebitPaid, budgetSpentCardPaid,
    looseDebitPaid, billsPaid,
    totalOut, saldoNaConta,
  };
}

// ============================================================
// CARRYOVER
// The carryover for month M = saldoNaConta computed from month M-1.
// If there is no month M-1 data at all, falls back to app initialBalance.
// ============================================================

export function calcCarryover(
  prevMonthKey: string,
  allIncomes: IncomeEntry[],
  allFixedExpenses: FixedExpense[],
  allBudgets: MonthlyBudget[],
  allExpenses: ExpenseEntry[],
  allAccounts: Account[],
  allBills: CreditCardBill[],
  initialBalance: number,
  /** Recursion depth guard — only go 1 level back */
  depth = 0,
): number {
  const prevIncomes  = allIncomes.filter(i => i.month === prevMonthKey);
  const prevFixed    = allFixedExpenses.filter(f => f.month === prevMonthKey);
  const prevBudgets  = allBudgets.filter(b => b.month === prevMonthKey);
  const prevExpenses = getMonthExpenses(allExpenses, allAccounts, prevMonthKey);
  // Only bills for the previous month — NOT all-time paid bills (that was the bug)
  const prevBills    = allBills.filter(b => b.month === prevMonthKey);

  const hasAnyData = prevIncomes.length > 0 || prevFixed.length > 0 || prevExpenses.length > 0;
  if (!hasAnyData && depth === 0) {
    return initialBalance;
  }

  // Compute the previous month's own carryover (one level back only)
  let prevCarryover = 0;
  if (depth === 0) {
    const [prevYear, prevMon] = prevMonthKey.split('-').map(Number);
    const twoMonthsBack = new Date(prevYear, prevMon - 2, 1);
    const twoMonthsBackKey = format(twoMonthsBack, 'yyyy-MM');
    prevCarryover = calcCarryover(
      twoMonthsBackKey,
      allIncomes, allFixedExpenses, allBudgets, allExpenses, allAccounts, allBills,
      initialBalance,
      1,
    );
  }

  // Enrich prevBills with paidAmount computed from expenses (for bills where paidAmount is null)
  const enrichedBills = prevBills.map(b => {
    if (b.paidAmount != null) return b;
    const total = getBillTotal(b.accountId, prevMonthKey, allExpenses, allAccounts, allBills);
    return { ...b, paidAmount: total };
  });

  const { saldoNaConta } = calcReal(
    prevIncomes, prevFixed, prevBudgets, prevExpenses, allAccounts, enrichedBills, prevCarryover,
  );
  return saldoNaConta;
}

// ============================================================
// PER-ACCOUNT BALANCE (drill-down view)
// Only meaningful for checking accounts where ALL transactions are tagged.
// ============================================================

export function calcAccountBalance(
  accountId: string,
  monthKey: string,
  allIncomes: IncomeEntry[],
  allFixedExpenses: FixedExpense[],
  allExpenses: ExpenseEntry[],
  allBills: CreditCardBill[],
  allTransfers: Transfer[],
  allAccounts: Account[],
): number {
  const inc = allIncomes
    .filter(i => i.month === monthKey && i.accountId === accountId && i.status === 'received')
    .reduce((s, i) => s + (i.actualAmount ?? i.estimatedAmount), 0);

  const fixedOut = allFixedExpenses
    .filter(f => f.month === monthKey && f.accountId === accountId && f.status === 'paid')
    .reduce((s, f) => s + (f.actualAmount ?? f.estimatedAmount), 0);

  const expOut = allExpenses
    .filter(e => {
      const account = allAccounts.find(a => a.id === e.accountId);
      if (account?.type !== 'checking') return false;
      if (e.accountId !== accountId) return false;
      const billMonth = getExpenseBillMonth(e, allAccounts);
      return billMonth === monthKey && e.status === 'paid';
    })
    .reduce((s, e) => s + e.amount, 0);

  const billsOut = allBills
    .filter(b => b.accountId === accountId && b.month === monthKey && b.status === 'paid')
    .reduce((s, b) => s + (b.paidAmount ?? 0), 0);

  const transfersIn = allTransfers
    .filter(t => {
      const d = parseISO(t.date);
      return t.toAccountId === accountId && format(d, 'yyyy-MM') === monthKey;
    })
    .reduce((s, t) => s + t.amount, 0);

  const transfersOut = allTransfers
    .filter(t => {
      const d = parseISO(t.date);
      return t.fromAccountId === accountId && format(d, 'yyyy-MM') === monthKey;
    })
    .reduce((s, t) => s + t.amount, 0);

  return inc - fixedOut - expOut - billsOut + transfersIn - transfersOut;
}

// ============================================================
// CSV EXPORT
// ============================================================

export function exportMonthToCsv(
  monthKey: string,
  incomes: IncomeEntry[],
  fixedExpenses: FixedExpense[],
  budgets: MonthlyBudget[],
  expenses: ExpenseEntry[],
  accounts: Account[],
  categories: Category[],
  bills: CreditCardBill[],
  carryover: number,
) {
  const catName  = (id?: string) => categories.find(c => c.id === id)?.name ?? id ?? '';
  const accName  = (id?: string) => accounts.find(a => a.id === id)?.name ?? 'N/A';
  const sep = ';';
  const lines: string[] = [];

  lines.push(['Tipo', 'Descrição', 'Categoria', 'Conta', 'Estimado', 'Real', 'Status', 'Data'].join(sep));
  lines.push(['Saldo Anterior', 'Mês anterior', '', '', carryover.toFixed(2), '', '', ''].join(sep));

  incomes.forEach(i => {
    lines.push([
      'Entrada', i.description, '', accName(i.accountId),
      i.estimatedAmount.toFixed(2),
      (i.actualAmount ?? '').toString(),
      i.status === 'received' ? 'Recebido' : 'Pendente', '',
    ].join(sep));
  });

  fixedExpenses.forEach(f => {
    lines.push([
      'Fixo', f.description, catName(f.categoryId), accName(f.accountId),
      f.estimatedAmount.toFixed(2),
      (f.actualAmount ?? '').toString(),
      f.status === 'paid' ? 'Pago' : 'Pendente',
      f.dueDate ?? '',
    ].join(sep));
  });

  const budgetCatIds = getBudgetCategoryIds(budgets);
  expenses.forEach(e => {
    const inBudget = budgetCatIds.has(e.categoryId);
    const tipo = inBudget ? `Orçamento ${catName(e.categoryId)}` : (isCredit(e, accounts) ? 'Cartão' : 'Avulso');
    lines.push([
      tipo, e.description, catName(e.categoryId), accName(e.accountId),
      '', e.amount.toFixed(2),
      e.status === 'paid' ? 'Pago' : 'Pendente',
      e.date,
    ].join(sep));
  });

  if (budgets.length > 0) {
    lines.push('');
    lines.push(['--- Tetos de Orçamento ---', '', '', '', '', '', '', ''].join(sep));
    budgets.forEach(b => {
      const spent = getBudgetCategorySpent(b.categoryId, expenses);
      lines.push([
        'Teto', b.description, catName(b.categoryId), '',
        b.amount.toFixed(2), spent.toFixed(2),
        spent > b.amount ? 'ESTOURADO' : 'OK', '',
      ].join(sep));
    });
  }

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zagastos-${monthKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
