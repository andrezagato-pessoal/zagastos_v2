// ============================================================
// ZaGastos — Core Data Types
// ============================================================

export type AccountType = 'checking' | 'credit';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  closingDay?: number;  // credit only
  dueDay?: number;      // credit only
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

// ============================================================
// TEMPLATES (recurring definitions)
// ============================================================
export type TemplateType = 'expense' | 'income' | 'budget';

export interface Template {
  id: string;
  type: TemplateType;
  description: string;
  amount: number;
  categoryId?: string;   // null for income templates
  accountId?: string;    // null for budget templates
  dayOfMonth?: number;   // day (1-31) to use when importing to a month
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

// ============================================================
// MONTHLY FIXED EXPENSES
// Imported from template or manually added. Once imported, fully
// independent — changes to the template don't affect past months.
// ============================================================
export interface FixedExpense {
  id: string;
  templateId?: string;
  month: string;  // 'yyyy-MM'
  description: string;
  estimatedAmount: number;
  actualAmount?: number;  // set when paid; null = use estimatedAmount
  categoryId?: string;
  accountId?: string;
  dueDate?: string;       // ISO date, for sorting
  status: 'pending' | 'paid';
  paidDate?: string;
  createdAt: string;
}

// ============================================================
// INCOME ENTRIES
// ============================================================
export interface IncomeEntry {
  id: string;
  templateId?: string;
  month: string;  // 'yyyy-MM'
  description: string;
  estimatedAmount: number;
  actualAmount?: number;  // set when received
  accountId?: string;
  status: 'pending' | 'received';
  receivedDate?: string;
  createdAt: string;
}

// ============================================================
// MONTHLY BUDGETS (spending ceilings per category per month)
// ============================================================
export interface MonthlyBudget {
  id: string;
  templateId?: string;
  month: string;  // 'yyyy-MM'
  categoryId: string;
  description: string;
  amount: number;  // the ceiling
  createdAt: string;
}

// ============================================================
// EXPENSE ENTRIES (random / variable expenses)
// ============================================================
export interface ExpenseEntry {
  id: string;
  templateId?: string;  // set when created by importTemplate (CC recurring subscriptions)
  description: string;
  amount: number;
  categoryId: string;
  accountId: string;
  date: string;    // ISO date (purchase date)
  // For debit: 'pending' = not yet paid, 'paid' = already left account
  // For credit: always 'pending' at entry level; payment tracked at bill level
  status: 'pending' | 'paid';
  paidDate?: string;
  createdAt: string;
}

// ============================================================
// CREDIT CARD BILLS
// ============================================================
export interface CreditCardBill {
  id: string;
  accountId: string;
  month: string;  // bill month 'yyyy-MM'
  status: 'pending' | 'paid';
  paidAmount?: number;      // null = full amount
  previousBalance: number;  // remainder carried from prior partial payment
  paidDate?: string;
  createdAt: string;
}

// ============================================================
// TRANSFERS (lateral moves between checking accounts)
// Neutral to main dashboard — only affects per-account breakdown
// ============================================================
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;  // ISO date
  description?: string;
  createdAt: string;
}

// ============================================================
// APP SETTINGS (singleton)
// ============================================================
export interface AppSettings {
  initialBalance: number;  // seeds the very first month's carryover
}
