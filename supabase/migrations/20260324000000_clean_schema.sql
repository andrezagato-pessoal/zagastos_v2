-- ============================================================
-- ZaGastos — Clean Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ACCOUNTS (checking + credit cards)
-- ============================================================
CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('checking', 'credit')),
  color       text NOT NULL DEFAULT '#6366f1',
  closing_day int,   -- credit only: day of month bill closes
  due_day     int,   -- credit only: day of month bill is due
  active      bool NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  icon       text NOT NULL,
  color      text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TEMPLATES (recurring definitions — expense / income / budget)
-- ============================================================
CREATE TABLE templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('expense', 'income', 'budget')),
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL CHECK (amount >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,  -- null for income
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,    -- null for budget
  active      bool NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FIXED EXPENSES (imported from template or manually added per month)
-- ============================================================
CREATE TABLE fixed_expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid REFERENCES templates(id) ON DELETE SET NULL,
  month            text NOT NULL,  -- 'yyyy-MM'
  description      text NOT NULL,
  estimated_amount numeric(12,2) NOT NULL CHECK (estimated_amount >= 0),
  actual_amount    numeric(12,2) CHECK (actual_amount >= 0),  -- set when paid
  category_id      uuid REFERENCES categories(id) ON DELETE SET NULL,
  account_id       uuid REFERENCES accounts(id) ON DELETE SET NULL,
  due_date         date,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_date        date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, month)  -- prevents duplicate imports; null template_id is excluded from this
);

-- ============================================================
-- INCOME ENTRIES (imported from template or ad-hoc per month)
-- ============================================================
CREATE TABLE income_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid REFERENCES templates(id) ON DELETE SET NULL,
  month            text NOT NULL,  -- 'yyyy-MM'
  description      text NOT NULL,
  estimated_amount numeric(12,2) NOT NULL CHECK (estimated_amount >= 0),
  actual_amount    numeric(12,2) CHECK (actual_amount >= 0),  -- set when received
  account_id       uuid REFERENCES accounts(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_date    date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, month)
);

-- ============================================================
-- MONTHLY BUDGETS (spending ceilings per category per month)
-- ============================================================
CREATE TABLE monthly_budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  month       text NOT NULL,  -- 'yyyy-MM'
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, month),
  UNIQUE (category_id, month)  -- one budget per category per month
);

-- ============================================================
-- EXPENSE ENTRIES (random / variable expenses)
-- ============================================================
CREATE TABLE expense_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  date        date NOT NULL,
  -- For debit: pending = not yet paid (e.g. agreed to pay later), paid = money already left account
  -- For credit: always leave as 'pending'; payment is tracked at bill level
  status      text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid')),
  paid_date   date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CREDIT CARD BILLS (one record per card per month)
-- ============================================================
CREATE TABLE credit_card_bills (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month            text NOT NULL,  -- bill month 'yyyy-MM'
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_amount      numeric(12,2) CHECK (paid_amount >= 0),  -- null = full amount
  previous_balance numeric(12,2) NOT NULL DEFAULT 0,        -- remainder from prior partial payment
  paid_date        date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, month)
);

-- ============================================================
-- TRANSFERS (lateral moves between checking accounts)
-- Neutral to main dashboard — only affects per-account breakdown
-- ============================================================
CREATE TABLE transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  date            date NOT NULL,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);

-- ============================================================
-- APP SETTINGS (singleton row)
-- ============================================================
CREATE TABLE app_settings (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforces singleton
  initial_balance numeric(12,2) NOT NULL DEFAULT 0,          -- seeds month-1 carryover
  updated_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings (id, initial_balance) VALUES (1, 0);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public access (shared household app, no per-user isolation)
-- ============================================================
ALTER TABLE accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'accounts','categories','templates','fixed_expenses','income_entries',
    'monthly_budgets','expense_entries','credit_card_bills','transfers','app_settings'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "public_all" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE templates;
ALTER PUBLICATION supabase_realtime ADD TABLE fixed_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE income_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE monthly_budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE credit_card_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE transfers;

-- ============================================================
-- SEED DATA — Accounts
-- ============================================================
INSERT INTO accounts (name, type, color, sort_order) VALUES
  ('Zag',      'checking', '#10b981', 0),
  ('Andre',    'checking', '#3b82f6', 1),
  ('Bia',      'checking', '#ec4899', 2),
  ('Conjunta', 'checking', '#f59e0b', 3);

INSERT INTO accounts (name, type, color, closing_day, due_day, sort_order) VALUES
  ('Nu André', 'credit', '#8b5cf6', 16, 23, 4),
  ('Nu Bia',   'credit', '#f43f5e', 24,  1, 5);

-- ============================================================
-- SEED DATA — Categories
-- ============================================================
INSERT INTO categories (name, icon, color) VALUES
  ('Alimentação',  '🍕', '#f59e0b'),
  ('Transporte',   '🚗', '#3b82f6'),
  ('Moradia',      '🏡', '#10b981'),
  ('Lazer',        '🎮', '#8b5cf6'),
  ('Saúde',        '💊', '#ef4444'),
  ('Educação',     '📚', '#06b6d4'),
  ('Compras',      '🛒', '#f97316'),
  ('Assinaturas',  '📺', '#6366f1'),
  ('Pets',         '🐾', '#84cc16'),
  ('Serviços',     '🔧', '#64748b'),
  ('Vestuário',    '👕', '#ec4899'),
  ('Combustível',  '⛽', '#eab308'),
  ('Outros',       '📦', '#94a3b8');
