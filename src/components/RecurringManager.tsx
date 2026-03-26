import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Template } from '@/types/finance';
import { formatCurrency } from '@/types/finance-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Trash2, Tags, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryManager } from './CategoryManager';
import { ScrollableCategoryGrid } from './ScrollableCategoryGrid';
import { AccountManager } from './AccountManager';

export function RecurringManager() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, categories } = useFinance();
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<Template | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const expenses = templates.filter(t => t.type === 'expense');
  const incomes  = templates.filter(t => t.type === 'income');
  const budgets  = templates.filter(t => t.type === 'budget');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Template Mensal</h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowAccounts(true)}>
            <Wallet className="h-4 w-4 mr-1" /> Contas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowCategories(true)}>
            <Tags className="h-4 w-4 mr-1" /> Categorias
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      {/* Incomes */}
      {incomes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Entradas Recorrentes</h3>
          <div className="space-y-2">
            {incomes.map(item => (
              <TemplateRow key={item.id} item={item} categories={categories}
                onEdit={() => setEditingItem(item)}
                onToggle={(checked) => updateTemplate(item.id, { active: checked })}
                onDelete={() => deleteTemplate(item.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Budgets */}
      {budgets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Orçamentos de Categoria</h3>
          <div className="space-y-2">
            {budgets.map(item => (
              <TemplateRow key={item.id} item={item} categories={categories}
                onEdit={() => setEditingItem(item)}
                onToggle={(checked) => updateTemplate(item.id, { active: checked })}
                onDelete={() => deleteTemplate(item.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Expenses */}
      <div>
        {(incomes.length > 0 || budgets.length > 0) && (
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Despesas Recorrentes</h3>
        )}
        {expenses.length === 0 && incomes.length === 0 && budgets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-3xl mb-2">🔄</p>
            <p className="text-sm">Nenhum item no template.</p>
            <p className="text-xs">Adicione aluguel, salário, Netflix, etc.</p>
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma despesa fixa no template.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map(item => (
              <TemplateRow key={item.id} item={item} categories={categories}
                onEdit={() => setEditingItem(item)}
                onToggle={(checked) => updateTemplate(item.id, { active: checked })}
                onDelete={() => deleteTemplate(item.id)} />
            ))}
          </div>
        )}
      </div>

      <AddTemplateSheet open={showAdd} onClose={() => setShowAdd(false)} />
      {editingItem && <EditTemplateSheet item={editingItem} onClose={() => setEditingItem(null)} />}
      <CategoryManager open={showCategories} onClose={() => setShowCategories(false)} />
      <AccountManager open={showAccounts} onClose={() => setShowAccounts(false)} />
    </div>
  );
}

// ============================================================
// Template row
// ============================================================
function TemplateRow({ item, categories, onEdit, onToggle, onDelete }: {
  item: Template;
  categories: import('@/types/finance').Category[];
  onEdit: () => void;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const cat = categories.find(c => c.id === item.categoryId);
  const isBudget = item.type === 'budget';
  return (
    <Card className={cn('flex items-center gap-3 p-3', !item.active && 'opacity-50')}>
      <span className="text-xl">{item.type === 'income' ? '💰' : (cat?.icon || '📦')}</span>
      <button className="flex-1 min-w-0 text-left" onClick={onEdit}>
        <p className="text-sm font-medium truncate">
          {isBudget ? `📊 ${cat?.name || item.description}` : item.description}
        </p>
        <p className="text-xs text-muted-foreground">
          {isBudget ? 'Orçamento de categoria' : (cat && !isBudget ? cat.name : '')}
        </p>
      </button>
      <p className={cn('text-sm font-bold whitespace-nowrap', item.type === 'income' ? 'text-income' : 'text-expense')}>
        {formatCurrency(item.amount)}
      </p>
      <Switch checked={item.active} onCheckedChange={onToggle} />
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

// ============================================================
// Add template sheet
// ============================================================
function AddTemplateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTemplate, categories, accounts } = useFinance();
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [accountId, setAccountId]     = useState('');
  const [dayOfMonth, setDayOfMonth]   = useState('');
  const [type, setType]               = useState<'expense' | 'income' | 'budget'>('expense');

  const checkingAccounts = accounts.filter(a => a.type === 'checking' && a.active);
  const creditAccounts   = accounts.filter(a => a.type === 'credit'   && a.active);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!numAmount) return;
    if (type === 'budget' && !categoryId) return;
    if (type === 'expense' && (!description || !categoryId)) return;
    if (type === 'income' && !description) return;

    const cat = categories.find(c => c.id === categoryId);
    const day = dayOfMonth ? parseInt(dayOfMonth) : undefined;
    await addTemplate({
      type,
      description: type === 'budget' ? (cat?.name || categoryId) : description,
      amount: numAmount,
      categoryId: (type === 'expense' || type === 'budget') ? categoryId : undefined,
      accountId: type !== 'budget' ? (accountId || undefined) : undefined,
      dayOfMonth: day && day >= 1 && day <= 31 ? day : undefined,
      active: true,
      sortOrder: 0,
    });

    setAmount('');
    setDescription('');
    setCategoryId('');
    setAccountId('');
    setDayOfMonth('');
    setType('expense');
    onClose();
  };

  const isBudget = type === 'budget';
  const isIncome = type === 'income';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Novo Item no Template</SheetTitle></SheetHeader>
        <div className="space-y-4 pt-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button variant={type === 'expense' ? 'default' : 'outline'} className="flex-1"
              onClick={() => setType('expense')}>💸 Despesa</Button>
            <Button variant={type === 'income' ? 'default' : 'outline'} className="flex-1"
              onClick={() => setType('income')}>💰 Entrada</Button>
            <Button variant={type === 'budget' ? 'default' : 'outline'} className="flex-1"
              onClick={() => setType('budget')}>📊 Orçamento</Button>
          </div>

          <div>
            <Label>{isBudget ? 'Teto do Orçamento (R$)' : 'Valor Estimado (R$)'}</Label>
            <Input type="number" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={e => setAmount(e.target.value)} className="text-xl font-bold h-12 mt-1" />
          </div>

          {!isBudget && (
            <div>
              <Label>Descrição</Label>
              <Input placeholder={isIncome ? 'Ex: Salário' : 'Ex: Aluguel'}
                value={description} onChange={e => setDescription(e.target.value)} className="mt-1" />
            </div>
          )}

          {/* Day of month — expense and income only */}
          {!isBudget && (
            <div>
              <Label>Dia do mês (para importação)</Label>
              <Input type="number" inputMode="numeric" min="1" max="31"
                placeholder="Ex: 5  (deixe vazio se não tiver dia fixo)"
                value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className="mt-1" />
            </div>
          )}

          {(type === 'expense' || isBudget) && (
            <div>
              <Label>{isBudget ? 'Categoria do Orçamento' : 'Categoria'}</Label>
              <ScrollableCategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
            </div>
          )}

          {/* Account selector (expense + income only) */}
          {!isBudget && (
            <div>
              <Label>Conta / Cartão (opcional)</Label>
              <div className="space-y-2 mt-1">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setAccountId('')}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      !accountId ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border')}>
                    Qualquer
                  </button>
                  {checkingAccounts.map(acc => (
                    <button key={acc.id} onClick={() => setAccountId(acc.id)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                        accountId === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border')}
                      style={accountId === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                      {acc.name}
                    </button>
                  ))}
                </div>
                {type === 'expense' && creditAccounts.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cartão de crédito</p>
                    <div className="flex gap-2 flex-wrap">
                      {creditAccounts.map(acc => (
                        <button key={acc.id} onClick={() => setAccountId(acc.id)}
                          className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                            accountId === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border')}
                          style={accountId === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                          💳 {acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full h-12 text-base"
            disabled={!amount || (!isBudget && !description) || ((type === 'expense' || isBudget) && !categoryId)}>
            Adicionar ao Template
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Edit template sheet
// ============================================================
function EditTemplateSheet({ item, onClose }: { item: Template; onClose: () => void }) {
  const { updateTemplate, categories, accounts } = useFinance();
  const [amount, setAmount]           = useState(String(item.amount));
  const [description, setDescription] = useState(item.description);
  const [categoryId, setCategoryId]   = useState(item.categoryId ?? '');
  const [accountId, setAccountId]     = useState(item.accountId ?? '');
  const [dayOfMonth, setDayOfMonth]   = useState(item.dayOfMonth ? String(item.dayOfMonth) : '');

  const isBudget = item.type === 'budget';
  const checkingAccounts = accounts.filter(a => a.type === 'checking' && a.active);
  const creditAccounts   = accounts.filter(a => a.type === 'credit'   && a.active);

  const handleSubmit = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!numAmount) return;

    const cat = categories.find(c => c.id === categoryId);
    const day = dayOfMonth ? parseInt(dayOfMonth) : undefined;
    updateTemplate(item.id, {
      amount: numAmount,
      description: isBudget ? (cat?.name || description) : description,
      categoryId: categoryId || undefined,
      accountId: !isBudget ? (accountId || undefined) : undefined,
      dayOfMonth: day && day >= 1 && day <= 31 ? day : undefined,
    });
    onClose();
  };

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isBudget ? 'Editar Orçamento de Categoria' : 'Editar Item do Template'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>{isBudget ? 'Teto do Orçamento (R$)' : 'Valor Estimado (R$)'}</Label>
            <Input type="number" inputMode="decimal" value={amount}
              onChange={e => setAmount(e.target.value)} className="text-xl font-bold h-12 mt-1" />
          </div>

          {!isBudget && (
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" />
            </div>
          )}

          {/* Day of month — expense and income only */}
          {!isBudget && (
            <div>
              <Label>Dia do mês (para importação)</Label>
              <Input type="number" inputMode="numeric" min="1" max="31"
                placeholder="Ex: 5  (deixe vazio se não tiver dia fixo)"
                value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className="mt-1" />
            </div>
          )}

          {(item.type === 'expense' || isBudget) && (
            <div>
              <Label>Categoria</Label>
              <ScrollableCategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
            </div>
          )}

          {!isBudget && (
            <div>
              <Label>Conta / Cartão (opcional)</Label>
              <div className="space-y-2 mt-1">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setAccountId('')}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      !accountId ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border')}>
                    Qualquer
                  </button>
                  {checkingAccounts.map(acc => (
                    <button key={acc.id} onClick={() => setAccountId(acc.id)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                        accountId === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border')}
                      style={accountId === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                      {acc.name}
                    </button>
                  ))}
                </div>
                {item.type === 'expense' && creditAccounts.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cartão de crédito</p>
                    <div className="flex gap-2 flex-wrap">
                      {creditAccounts.map(acc => (
                        <button key={acc.id} onClick={() => setAccountId(acc.id)}
                          className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                            accountId === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border')}
                          style={accountId === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                          💳 {acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full h-12 text-base"
            disabled={!amount || (!isBudget && !description)}>
            Salvar Alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
