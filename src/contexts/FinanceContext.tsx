import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { format, parseISO, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Account, Category, Template, FixedExpense, IncomeEntry,
  MonthlyBudget, ExpenseEntry, CreditCardBill, Transfer, AppSettings,
} from '@/types/finance';
import {
  getMonthExpenses, getExpenseBillMonth, getBillTotal, calcCarryover,
} from '@/types/finance-utils';

// ============================================================
// Context shape
// ============================================================
interface FinanceContextType {
  // State
  accounts: Account[];
  categories: Category[];
  templates: Template[];
  fixedExpenses: FixedExpense[];
  incomeEntries: IncomeEntry[];
  monthlyBudgets: MonthlyBudget[];
  expenseEntries: ExpenseEntry[];
  creditCardBills: CreditCardBill[];
  transfers: Transfer[];
  settings: AppSettings;
  currentMonth: Date;
  loading: boolean;

  // Navigation
  setCurrentMonth: (date: Date) => void;

  // Derived (for current month)
  getMonthFixed: () => FixedExpense[];
  getMonthIncome: () => IncomeEntry[];
  getMonthBudgets: () => MonthlyBudget[];
  getMonthExpenses: () => ExpenseEntry[];
  getMonthBills: () => CreditCardBill[];
  getMonthTransfers: () => Transfer[];
  getCarryover: () => number;

  // Templates
  addTemplate: (t: Omit<Template, 'id' | 'createdAt'>) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  importTemplate: () => Promise<void>;

  // Fixed expenses
  addFixedExpense: (item: Omit<FixedExpense, 'id' | 'createdAt'>) => Promise<void>;
  updateFixedExpense: (id: string, updates: Partial<FixedExpense>) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
  markFixedPaid: (id: string, actualAmount?: number) => Promise<void>;

  // Income
  addIncome: (item: Omit<IncomeEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateIncome: (id: string, updates: Partial<IncomeEntry>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  markIncomeReceived: (id: string, actualAmount?: number) => Promise<void>;

  // Budgets
  addMonthlyBudget: (item: Omit<MonthlyBudget, 'id' | 'createdAt'>) => Promise<void>;
  updateMonthlyBudget: (id: string, updates: Partial<MonthlyBudget>) => Promise<void>;
  deleteMonthlyBudget: (id: string) => Promise<void>;

  // Expense entries
  addExpense: (item: Omit<ExpenseEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<ExpenseEntry>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Credit card bills
  toggleBillPaid: (accountId: string, month: string, paidAmount?: number) => Promise<void>;
  getCardExpenses: (accountId: string, billMonth: string) => ExpenseEntry[];
  computedBillTotal: (accountId: string, billMonth: string) => number;

  // Transfers
  addTransfer: (t: Omit<Transfer, 'id' | 'createdAt'>) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;

  // Accounts
  addAccount: (a: Omit<Account, 'id' | 'createdAt'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Categories
  addCategory: (name: string, icon: string, color: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<boolean>;

  // Settings
  updateInitialBalance: (value: number) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

// ============================================================
// Mappers: DB row → TypeScript interface
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAccount(r: any): Account {
  return {
    id: r.id, name: r.name, type: r.type, color: r.color,
    closingDay: r.closing_day ?? undefined,
    dueDay: r.due_day ?? undefined,
    active: r.active, sortOrder: r.sort_order, createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategory(r: any): Category {
  return { id: r.id, name: r.name, icon: r.icon, color: r.color, createdAt: r.created_at };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(r: any): Template {
  return {
    id: r.id, type: r.type, description: r.description, amount: Number(r.amount),
    categoryId: r.category_id ?? undefined,
    accountId: r.account_id ?? undefined,
    dayOfMonth: r.day_of_month ?? undefined,
    active: r.active, sortOrder: r.sort_order, createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFixedExpense(r: any): FixedExpense {
  return {
    id: r.id, templateId: r.template_id ?? undefined, month: r.month,
    description: r.description, estimatedAmount: Number(r.estimated_amount),
    actualAmount: r.actual_amount != null ? Number(r.actual_amount) : undefined,
    categoryId: r.category_id ?? undefined, accountId: r.account_id ?? undefined,
    dueDate: r.due_date ?? undefined, status: r.status,
    paidDate: r.paid_date ?? undefined, createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIncomeEntry(r: any): IncomeEntry {
  return {
    id: r.id, templateId: r.template_id ?? undefined, month: r.month,
    description: r.description, estimatedAmount: Number(r.estimated_amount),
    actualAmount: r.actual_amount != null ? Number(r.actual_amount) : undefined,
    accountId: r.account_id ?? undefined, status: r.status,
    receivedDate: r.received_date ?? undefined, createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMonthlyBudget(r: any): MonthlyBudget {
  return {
    id: r.id, templateId: r.template_id ?? undefined, month: r.month,
    categoryId: r.category_id, description: r.description,
    amount: Number(r.amount), createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapExpenseEntry(r: any): ExpenseEntry {
  return {
    id: r.id,
    templateId: r.template_id ?? undefined,
    description: r.description, amount: Number(r.amount),
    categoryId: r.category_id, accountId: r.account_id,
    date: r.date, status: r.status,
    paidDate: r.paid_date ?? undefined, createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCreditCardBill(r: any): CreditCardBill {
  return {
    id: r.id, accountId: r.account_id, month: r.month, status: r.status,
    paidAmount: r.paid_amount != null ? Number(r.paid_amount) : undefined,
    previousBalance: Number(r.previous_balance ?? 0),
    paidDate: r.paid_date ?? undefined, createdAt: r.created_at,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransfer(r: any): Transfer {
  return {
    id: r.id, fromAccountId: r.from_account_id, toAccountId: r.to_account_id,
    amount: Number(r.amount), date: r.date,
    description: r.description ?? undefined, createdAt: r.created_at,
  };
}

// ============================================================
// Provider
// ============================================================
export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [templates, setTemplates]         = useState<Template[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [creditCardBills, setCreditCardBills] = useState<CreditCardBill[]>([]);
  const [transfers, setTransfers]         = useState<Transfer[]>([]);
  const [settings, setSettings]           = useState<AppSettings>({ initialBalance: 0 });
  const [currentMonth, setCurrentMonth]   = useState(new Date());
  const [loading, setLoading]             = useState(true);

  const monthKey = format(currentMonth, 'yyyy-MM');

  // PostgREST returns at most 1000 rows per request — page through large tables.
  const fetchAll = async (table: string): Promise<{ data: unknown[] | null }> => {
    const PAGE = 1000;
    const all: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table as 'expense_entries')
        .select('*')
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) return { data: null };
      all.push(...(data ?? []));
      if (!data || data.length < PAGE) return { data: all };
    }
  };

  // ----------------------------------------------------------
  // Initial data load
  // ----------------------------------------------------------
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const [
        accR, catR, tplR, fixR, incR, budR, expR, billR, trnR, setR,
      ] = await Promise.all([
        supabase.from('accounts').select('*').order('sort_order'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('templates').select('*').order('sort_order'),
        fetchAll('fixed_expenses'),
        fetchAll('income_entries'),
        fetchAll('monthly_budgets'),
        fetchAll('expense_entries'),
        fetchAll('credit_card_bills'),
        fetchAll('transfers'),
        supabase.from('app_settings').select('*').eq('id', 1).single(),
      ]);

      if (accR.data)  setAccounts(accR.data.map(mapAccount));
      if (catR.data)  setCategories(catR.data.map(mapCategory));
      if (tplR.data)  setTemplates(tplR.data.map(mapTemplate));
      if (fixR.data)  setFixedExpenses(fixR.data.map(mapFixedExpense));
      if (incR.data)  setIncomeEntries(incR.data.map(mapIncomeEntry));
      if (budR.data)  setMonthlyBudgets(budR.data.map(mapMonthlyBudget));
      if (expR.data)  setExpenseEntries(expR.data.map(mapExpenseEntry));
      if (billR.data) setCreditCardBills(billR.data.map(mapCreditCardBill));
      if (trnR.data)  setTransfers(trnR.data.map(mapTransfer));
      if (setR.data)  setSettings({ initialBalance: Number(setR.data.initial_balance) });

      setLoading(false);
    }
    loadAll();
  }, []);

  // ----------------------------------------------------------
  // Realtime subscriptions
  // ----------------------------------------------------------
  useEffect(() => {
    const reload = (table: string, setter: (data: unknown[]) => void, mapper: (r: unknown) => unknown) => () => {
      fetchAll(table).then(({ data }) => {
        if (data) setter(data.map(mapper));
      });
    };

    const channel = supabase.channel('zagastos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' },
        reload('accounts', setAccounts as (d: unknown[]) => void, mapAccount))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' },
        reload('categories', setCategories as (d: unknown[]) => void, mapCategory))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'templates' },
        reload('templates', setTemplates as (d: unknown[]) => void, mapTemplate))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_expenses' },
        reload('fixed_expenses', setFixedExpenses as (d: unknown[]) => void, mapFixedExpense))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' },
        reload('income_entries', setIncomeEntries as (d: unknown[]) => void, mapIncomeEntry))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_budgets' },
        reload('monthly_budgets', setMonthlyBudgets as (d: unknown[]) => void, mapMonthlyBudget))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_entries' },
        reload('expense_entries', setExpenseEntries as (d: unknown[]) => void, mapExpenseEntry))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_card_bills' },
        reload('credit_card_bills', setCreditCardBills as (d: unknown[]) => void, mapCreditCardBill))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' },
        reload('transfers', setTransfers as (d: unknown[]) => void, mapTransfer))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ----------------------------------------------------------
  // Derived: current month slices
  // ----------------------------------------------------------
  const getMonthFixed = useCallback(() =>
    fixedExpenses.filter(f => f.month === monthKey),
    [fixedExpenses, monthKey]);

  const getMonthIncome = useCallback(() =>
    incomeEntries.filter(i => i.month === monthKey),
    [incomeEntries, monthKey]);

  const getMonthBudgets = useCallback(() =>
    monthlyBudgets.filter(b => b.month === monthKey),
    [monthlyBudgets, monthKey]);

  const getMonthExpensesForMonth = useCallback(() =>
    getMonthExpenses(expenseEntries, accounts, monthKey),
    [expenseEntries, accounts, monthKey]);

  const getMonthBills = useCallback((): CreditCardBill[] => {
    const creditAccounts = accounts.filter(a => a.type === 'credit' && a.active);
    return creditAccounts.map(card => {
      const existing = creditCardBills.find(b => b.accountId === card.id && b.month === monthKey);
      if (existing) return existing;
      // Virtual bill (not yet in DB)
      return {
        id: `virtual-${card.id}-${monthKey}`,
        accountId: card.id,
        month: monthKey,
        status: 'pending' as const,
        previousBalance: 0,
        createdAt: new Date().toISOString(),
      };
    });
  }, [accounts, creditCardBills, monthKey]);

  const getMonthTransfers = useCallback(() => {
    return transfers.filter(t => format(parseISO(t.date), 'yyyy-MM') === monthKey);
  }, [transfers, monthKey]);

  // ----------------------------------------------------------
  // Carryover (auto-computed from previous month's Real balance)
  // ----------------------------------------------------------
  const getCarryover = useCallback((): number => {
    const prevDate = addMonths(currentMonth, -1);
    const prevKey  = format(prevDate, 'yyyy-MM');
    return calcCarryover(
      prevKey,
      incomeEntries, fixedExpenses, monthlyBudgets, expenseEntries, accounts, creditCardBills,
      settings.initialBalance,
    );
  }, [currentMonth, incomeEntries, fixedExpenses, monthlyBudgets, expenseEntries, accounts, creditCardBills, settings.initialBalance]);

  // ----------------------------------------------------------
  // Card helpers
  // ----------------------------------------------------------
  const getCardExpenses = useCallback((accountId: string, billMonth: string): ExpenseEntry[] => {
    return expenseEntries.filter(e =>
      e.accountId === accountId &&
      getExpenseBillMonth(e, accounts) === billMonth
    );
  }, [expenseEntries, accounts]);

  const computedBillTotal = useCallback((accountId: string, billMonth: string): number => {
    return getBillTotal(accountId, billMonth, expenseEntries, accounts, creditCardBills);
  }, [expenseEntries, accounts, creditCardBills]);

  // ----------------------------------------------------------
  // TEMPLATES
  // ----------------------------------------------------------
  const addTemplate = async (t: Omit<Template, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('templates').insert({
      type: t.type, description: t.description, amount: t.amount,
      category_id: t.categoryId ?? null, account_id: t.accountId ?? null,
      day_of_month: t.dayOfMonth ?? null,
      active: t.active, sort_order: t.sortOrder,
    });
    if (error) { toast.error('Erro ao adicionar template.'); }
  };

  const updateTemplate = async (id: string, updates: Partial<Template>) => {
    const db: Record<string, unknown> = {};
    if (updates.description !== undefined) db.description  = updates.description;
    if (updates.amount      !== undefined) db.amount       = updates.amount;
    if (updates.categoryId  !== undefined) db.category_id  = updates.categoryId ?? null;
    if (updates.accountId   !== undefined) db.account_id   = updates.accountId ?? null;
    if (updates.dayOfMonth  !== undefined) db.day_of_month = updates.dayOfMonth ?? null;
    if (updates.active      !== undefined) db.active       = updates.active;
    if (updates.sortOrder   !== undefined) db.sort_order   = updates.sortOrder;
    const { error } = await supabase.from('templates').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar template.'); }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover template.'); }
  };

  const importTemplate = async () => {
    const active = templates.filter(t => t.active);
    let added = 0;

    for (const t of active) {
      if (t.type === 'expense') {
        const acc = accounts.find(a => a.id === t.accountId);
        const isCC = acc?.type === 'credit';

        if (isCC) {
          // CC subscription → expense_entry (flows into card bill, not fixed_expenses)
          // Duplicate check: skip if an entry for this template already exists in this bill month
          const alreadyExists = expenseEntries.some(
            e => e.templateId === t.id &&
              getExpenseBillMonth(e, accounts) === monthKey
          );
          if (!alreadyExists) {
            const date = t.dayOfMonth
              ? `${monthKey}-${String(t.dayOfMonth).padStart(2, '0')}`
              : `${monthKey}-01`;
            const { error } = await supabase.from('expense_entries').insert({
              template_id: t.id, description: t.description, amount: t.amount,
              category_id: t.categoryId ?? null, account_id: t.accountId,
              date, status: 'pending',
            });
            if (!error) added++;
          }
        } else {
          // Debit/checking → fixed_expense as before
          const dueDate = t.dayOfMonth
            ? `${monthKey}-${String(t.dayOfMonth).padStart(2, '0')}`
            : null;
          const { error } = await supabase.from('fixed_expenses').insert({
            template_id: t.id, month: monthKey, description: t.description,
            estimated_amount: t.amount, category_id: t.categoryId ?? null,
            account_id: t.accountId ?? null, due_date: dueDate, status: 'pending',
          });
          if (!error) added++;
          // Unique constraint (template_id, month) silently skips duplicates
        }
      }
      if (t.type === 'income') {
        await supabase.from('income_entries').insert({
          template_id: t.id, month: monthKey, description: t.description,
          estimated_amount: t.amount, account_id: t.accountId ?? null, status: 'pending',
        });
        added++;
      }
      if (t.type === 'budget') {
        const cat = categories.find(c => c.id === t.categoryId);
        await supabase.from('monthly_budgets').insert({
          template_id: t.id, month: monthKey,
          category_id: t.categoryId, description: cat?.name ?? t.description,
          amount: t.amount,
        });
        added++;
      }
    }

    if (added === 0) {
      toast.info('Todos os itens do template já foram importados para este mês.');
    } else {
      toast.success(`${added} item(s) importado(s) do template.`);
    }
  };

  // ----------------------------------------------------------
  // FIXED EXPENSES
  // ----------------------------------------------------------
  const addFixedExpense = async (item: Omit<FixedExpense, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('fixed_expenses').insert({
      template_id: item.templateId ?? null, month: item.month,
      description: item.description, estimated_amount: item.estimatedAmount,
      actual_amount: item.actualAmount ?? null, category_id: item.categoryId ?? null,
      account_id: item.accountId ?? null, due_date: item.dueDate ?? null,
      status: item.status, paid_date: item.paidDate ?? null,
    });
    if (error) { toast.error('Erro ao adicionar gasto fixo.'); }
  };

  const updateFixedExpense = async (id: string, updates: Partial<FixedExpense>) => {
    const db: Record<string, unknown> = {};
    if (updates.description     !== undefined) db.description      = updates.description;
    if (updates.estimatedAmount !== undefined) db.estimated_amount = updates.estimatedAmount;
    if (updates.actualAmount    !== undefined) db.actual_amount    = updates.actualAmount ?? null;
    if (updates.categoryId      !== undefined) db.category_id      = updates.categoryId ?? null;
    if (updates.accountId       !== undefined) db.account_id       = updates.accountId ?? null;
    if (updates.dueDate         !== undefined) db.due_date         = updates.dueDate ?? null;
    if (updates.status          !== undefined) db.status           = updates.status;
    if (updates.paidDate        !== undefined) db.paid_date        = updates.paidDate ?? null;
    const { error } = await supabase.from('fixed_expenses').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar gasto fixo.'); }
  };

  const deleteFixedExpense = async (id: string) => {
    const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover gasto fixo.'); }
  };

  const markFixedPaid = async (id: string, actualAmount?: number) => {
    const item = fixedExpenses.find(f => f.id === id);
    if (!item) return;
    const newStatus = item.status === 'paid' ? 'pending' : 'paid';
    const db: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'paid') {
      if (actualAmount !== undefined) db.actual_amount = actualAmount;
      db.paid_date = new Date().toISOString().slice(0, 10);
    } else {
      db.actual_amount = null;
      db.paid_date = null;
    }
    const { error } = await supabase.from('fixed_expenses').update(db).eq('id', id);
    if (error) { toast.error('Erro ao marcar gasto fixo.'); }
  };

  // ----------------------------------------------------------
  // INCOME
  // ----------------------------------------------------------
  const addIncome = async (item: Omit<IncomeEntry, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('income_entries').insert({
      template_id: item.templateId ?? null, month: item.month,
      description: item.description, estimated_amount: item.estimatedAmount,
      actual_amount: item.actualAmount ?? null, account_id: item.accountId ?? null,
      status: item.status, received_date: item.receivedDate ?? null,
    });
    if (error) { toast.error('Erro ao adicionar entrada.'); }
  };

  const updateIncome = async (id: string, updates: Partial<IncomeEntry>) => {
    const db: Record<string, unknown> = {};
    if (updates.description     !== undefined) db.description      = updates.description;
    if (updates.estimatedAmount !== undefined) db.estimated_amount = updates.estimatedAmount;
    if (updates.actualAmount    !== undefined) db.actual_amount    = updates.actualAmount ?? null;
    if (updates.accountId       !== undefined) db.account_id       = updates.accountId ?? null;
    if (updates.status          !== undefined) db.status           = updates.status;
    if (updates.receivedDate    !== undefined) db.received_date    = updates.receivedDate ?? null;
    const { error } = await supabase.from('income_entries').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar entrada.'); }
  };

  const deleteIncome = async (id: string) => {
    const { error } = await supabase.from('income_entries').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover entrada.'); }
  };

  const markIncomeReceived = async (id: string, actualAmount?: number) => {
    const item = incomeEntries.find(i => i.id === id);
    if (!item) return;
    const newStatus = item.status === 'received' ? 'pending' : 'received';
    const db: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'received') {
      if (actualAmount !== undefined) db.actual_amount = actualAmount;
      db.received_date = new Date().toISOString().slice(0, 10);
    } else {
      db.actual_amount = null;
      db.received_date = null;
    }
    const { error } = await supabase.from('income_entries').update(db).eq('id', id);
    if (error) { toast.error('Erro ao marcar entrada.'); }
  };

  // ----------------------------------------------------------
  // MONTHLY BUDGETS
  // ----------------------------------------------------------
  const addMonthlyBudget = async (item: Omit<MonthlyBudget, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('monthly_budgets').insert({
      template_id: item.templateId ?? null, month: item.month,
      category_id: item.categoryId, description: item.description, amount: item.amount,
    });
    if (error) { toast.error('Erro ao adicionar orçamento.'); }
  };

  const updateMonthlyBudget = async (id: string, updates: Partial<MonthlyBudget>) => {
    const db: Record<string, unknown> = {};
    if (updates.description !== undefined) db.description = updates.description;
    if (updates.amount      !== undefined) db.amount      = updates.amount;
    if (updates.categoryId  !== undefined) db.category_id = updates.categoryId;
    const { error } = await supabase.from('monthly_budgets').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar orçamento.'); }
  };

  const deleteMonthlyBudget = async (id: string) => {
    const { error } = await supabase.from('monthly_budgets').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover orçamento.'); }
  };

  // ----------------------------------------------------------
  // EXPENSE ENTRIES
  // ----------------------------------------------------------
  const addExpense = async (item: Omit<ExpenseEntry, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('expense_entries').insert({
      description: item.description, amount: item.amount,
      category_id: item.categoryId, account_id: item.accountId,
      date: item.date, status: item.status, paid_date: item.paidDate ?? null,
    });
    if (error) { toast.error('Erro ao adicionar gasto.'); }
  };

  const updateExpense = async (id: string, updates: Partial<ExpenseEntry>) => {
    const db: Record<string, unknown> = {};
    if (updates.description !== undefined) db.description = updates.description;
    if (updates.amount      !== undefined) db.amount      = updates.amount;
    if (updates.categoryId  !== undefined) db.category_id = updates.categoryId;
    if (updates.accountId   !== undefined) db.account_id  = updates.accountId;
    if (updates.date        !== undefined) db.date        = updates.date;
    if (updates.status      !== undefined) db.status      = updates.status;
    if (updates.paidDate    !== undefined) db.paid_date   = updates.paidDate ?? null;
    const { error } = await supabase.from('expense_entries').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar gasto.'); }
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from('expense_entries').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover gasto.'); }
  };

  // ----------------------------------------------------------
  // CREDIT CARD BILLS
  // ----------------------------------------------------------
  const toggleBillPaid = async (accountId: string, month: string, paidAmount?: number) => {
    const existing = creditCardBills.find(b => b.accountId === accountId && b.month === month);
    const total = computedBillTotal(accountId, month);

    if (existing && existing.status === 'paid') {
      // Unpay: clear previous_balance on next month's bill that was set from this
      await supabase.from('credit_card_bills')
        .update({ status: 'pending', paid_amount: null, paid_date: null })
        .eq('id', existing.id);

      // Clear the previous_balance we set on next month's bill
      const nextMonthKey = format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
      const nextBill = creditCardBills.find(b => b.accountId === accountId && b.month === nextMonthKey);
      if (nextBill && nextBill.previousBalance > 0) {
        await supabase.from('credit_card_bills')
          .update({ previous_balance: 0 })
          .eq('id', nextBill.id);
      }
      return;
    }

    const effectivePaid = paidAmount ?? total;
    const remainder = Math.max(0, total - effectivePaid);

    if (existing) {
      await supabase.from('credit_card_bills')
        .update({ status: 'paid', paid_amount: effectivePaid, paid_date: new Date().toISOString().slice(0, 10) })
        .eq('id', existing.id);
    } else {
      await supabase.from('credit_card_bills').insert({
        account_id: accountId, month, status: 'paid',
        paid_amount: effectivePaid, paid_date: new Date().toISOString().slice(0, 10),
        previous_balance: 0,
      });
    }

    // Carry remainder to next month
    if (remainder > 0) {
      const nextMonthKey = format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
      const nextBill = creditCardBills.find(b => b.accountId === accountId && b.month === nextMonthKey);
      if (nextBill) {
        await supabase.from('credit_card_bills')
          .update({ previous_balance: remainder })
          .eq('id', nextBill.id);
      } else {
        await supabase.from('credit_card_bills').insert({
          account_id: accountId, month: nextMonthKey, status: 'pending',
          previous_balance: remainder,
        });
      }
      toast.info(`Saldo anterior de ${remainder.toFixed(2)} levado para o próximo mês.`);
    }
  };

  // ----------------------------------------------------------
  // TRANSFERS
  // ----------------------------------------------------------
  const addTransfer = async (t: Omit<Transfer, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('transfers').insert({
      from_account_id: t.fromAccountId, to_account_id: t.toAccountId,
      amount: t.amount, date: t.date, description: t.description ?? null,
    });
    if (error) { toast.error('Erro ao registrar transferência.'); }
  };

  const deleteTransfer = async (id: string) => {
    const { error } = await supabase.from('transfers').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover transferência.'); }
  };

  // ----------------------------------------------------------
  // ACCOUNTS
  // ----------------------------------------------------------
  const addAccount = async (a: Omit<Account, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('accounts').insert({
      name: a.name, type: a.type, color: a.color,
      closing_day: a.closingDay ?? null, due_day: a.dueDay ?? null,
      active: a.active, sort_order: a.sortOrder,
    });
    if (error) { toast.error('Erro ao adicionar conta.'); }
  };

  const updateAccount = async (id: string, updates: Partial<Account>) => {
    const db: Record<string, unknown> = {};
    if (updates.name        !== undefined) db.name        = updates.name;
    if (updates.color       !== undefined) db.color       = updates.color;
    if (updates.closingDay  !== undefined) db.closing_day = updates.closingDay ?? null;
    if (updates.dueDay      !== undefined) db.due_day     = updates.dueDay ?? null;
    if (updates.active      !== undefined) db.active      = updates.active;
    if (updates.sortOrder   !== undefined) db.sort_order  = updates.sortOrder;
    const { error } = await supabase.from('accounts').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar conta.'); }
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) { toast.error('Conta em uso. Remova os itens associados primeiro.'); }
  };

  // ----------------------------------------------------------
  // CATEGORIES
  // ----------------------------------------------------------
  const addCategory = async (name: string, icon: string, color: string) => {
    const { error } = await supabase.from('categories').insert({ name, icon, color });
    if (error) { toast.error('Erro ao adicionar categoria.'); return; }
    toast.success(`Categoria "${name}" adicionada.`);
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const db: Record<string, unknown> = {};
    if (updates.name  !== undefined) db.name  = updates.name;
    if (updates.icon  !== undefined) db.icon  = updates.icon;
    if (updates.color !== undefined) db.color = updates.color;
    const { error } = await supabase.from('categories').update(db).eq('id', id);
    if (error) { toast.error('Erro ao atualizar categoria.'); }
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    const inUse =
      expenseEntries.some(e => e.categoryId === id) ||
      fixedExpenses.some(f => f.categoryId === id)  ||
      monthlyBudgets.some(b => b.categoryId === id) ||
      templates.some(t => t.categoryId === id);

    if (inUse) {
      toast.error('Categoria em uso. Remova os itens associados primeiro.');
      return false;
    }
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover categoria.'); return false; }
    toast.success('Categoria removida.');
    return true;
  };

  // ----------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------
  const updateInitialBalance = async (value: number) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ initial_balance: value, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) { toast.error('Erro ao atualizar saldo inicial.'); return; }
    setSettings({ initialBalance: value });
  };

  // ----------------------------------------------------------
  // Context value
  // ----------------------------------------------------------
  return (
    <FinanceContext.Provider value={{
      accounts, categories, templates, fixedExpenses, incomeEntries,
      monthlyBudgets, expenseEntries, creditCardBills, transfers, settings,
      currentMonth, setCurrentMonth, loading,
      getMonthFixed, getMonthIncome, getMonthBudgets,
      getMonthExpenses: getMonthExpensesForMonth,
      getMonthBills, getMonthTransfers, getCarryover,
      addTemplate, updateTemplate, deleteTemplate, importTemplate,
      addFixedExpense, updateFixedExpense, deleteFixedExpense, markFixedPaid,
      addIncome, updateIncome, deleteIncome, markIncomeReceived,
      addMonthlyBudget, updateMonthlyBudget, deleteMonthlyBudget,
      addExpense, updateExpense, deleteExpense,
      toggleBillPaid, getCardExpenses, computedBillTotal,
      addTransfer, deleteTransfer,
      addAccount, updateAccount, deleteAccount,
      addCategory, updateCategory, deleteCategory,
      updateInitialBalance,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
