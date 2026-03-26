import { useState, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { ExpenseEntry } from '@/types/finance';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollableCategoryGrid } from './ScrollableCategoryGrid';
import { cn } from '@/lib/utils';

interface EditTransactionProps {
  open: boolean;
  onClose: () => void;
  expense: ExpenseEntry;
}

export function EditTransaction({ open, onClose, expense }: EditTransactionProps) {
  const { updateExpense, categories, accounts } = useFinance();
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [date, setDate]               = useState('');
  const [accountId, setAccountId]     = useState('');
  const [isPending, setIsPending]     = useState(false);

  useEffect(() => {
    if (open && expense) {
      setAmount(String(expense.amount));
      setDescription(expense.description);
      setCategoryId(expense.categoryId);
      setDate(expense.date);
      setAccountId(expense.accountId);
      setIsPending(expense.status === 'pending');
    }
  }, [open, expense]);

  const activeAccounts   = accounts.filter(a => a.active);
  const checkingAccounts = activeAccounts.filter(a => a.type === 'checking');
  const creditAccounts   = activeAccounts.filter(a => a.type === 'credit');
  const selectedAccount  = accounts.find(a => a.id === accountId);
  const isCredit = selectedAccount?.type === 'credit';

  const handleSubmit = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!numAmount || !description || !categoryId || !accountId) return;
    updateExpense(expense.id, {
      description,
      amount: numAmount,
      categoryId,
      accountId,
      date,
      status: isCredit ? 'pending' : (isPending ? 'pending' : 'paid'),
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Editar Gasto Avulso</SheetTitle></SheetHeader>

        <div className="space-y-4 pt-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={e => setAmount(e.target.value)} className="text-2xl font-bold h-14 mt-1" autoFocus />
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" />
          </div>

          {/* Account selector */}
          <div>
            <Label>Conta / Cartão</Label>
            <div className="space-y-2 mt-1">
              {checkingAccounts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Débito / Pix</p>
                  <div className="flex gap-2 flex-wrap">
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
                </div>
              )}
              {creditAccounts.length > 0 && (
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

          {/* Pending toggle (debit only) */}
          {accountId && !isCredit && (
            <div className="flex items-center gap-3">
              <Label className="flex-1 text-sm">Pendente (ainda não paguei)</Label>
              <button onClick={() => setIsPending(!isPending)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  isPending ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-background text-foreground border-border')}>
                {isPending ? '⏳ Pendente' : '✅ Pago'}
              </button>
            </div>
          )}

          <div>
            <Label>Categoria</Label>
            <ScrollableCategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
          </div>

          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
          </div>

          <Button onClick={handleSubmit} className="w-full h-12 text-base"
            disabled={!amount || !description || !categoryId || !accountId}>
            Salvar Alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
