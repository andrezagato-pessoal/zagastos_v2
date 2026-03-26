import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ScrollableCategoryGrid } from './ScrollableCategoryGrid';
import { cn } from '@/lib/utils';

interface AddTransactionProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransaction({ open, onClose }: AddTransactionProps) {
  const { addExpense, categories, accounts } = useFinance();
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [date, setDate]               = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accountId, setAccountId]     = useState('');
  const [isPending, setIsPending]     = useState(false);

  const activeAccounts  = accounts.filter(a => a.active);
  const checkingAccounts = activeAccounts.filter(a => a.type === 'checking');
  const creditAccounts   = activeAccounts.filter(a => a.type === 'credit');
  const selectedAccount  = accounts.find(a => a.id === accountId);
  const isCredit = selectedAccount?.type === 'credit';

  const handleSubmit = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!numAmount || !description || !categoryId || !accountId) return;

    addExpense({
      description,
      amount: numAmount,
      categoryId,
      accountId,
      date,
      // Credit card entries are always 'pending' at entry level (bill tracks payment)
      status: isCredit ? 'pending' : (isPending ? 'pending' : 'paid'),
    });

    setAmount('');
    setDescription('');
    setCategoryId('');
    setAccountId('');
    setIsPending(false);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Novo Gasto Avulso</SheetTitle></SheetHeader>

        <div className="space-y-4 pt-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={e => setAmount(e.target.value)} className="text-2xl font-bold h-14 mt-1" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Input placeholder="Ex: Jantar fora" value={description}
              onChange={e => setDescription(e.target.value)} className="mt-1" />
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
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                          accountId === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border'
                        )}
                        style={accountId === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}
                      >
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
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                          accountId === acc.id ? 'text-white border-transparent' : 'bg-background text-foreground border-border'
                        )}
                        style={accountId === acc.id ? { backgroundColor: acc.color, borderColor: acc.color } : {}}
                      >
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
              <Label className="flex-1 text-sm">Marcar como pendente (ainda não paguei)</Label>
              <button
                onClick={() => setIsPending(!isPending)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  isPending ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-background text-foreground border-border'
                )}
              >
                {isPending ? '⏳ Pendente' : '✅ Pago'}
              </button>
            </div>
          )}
          {accountId && isCredit && (
            <p className="text-xs text-muted-foreground">💳 Gasto de cartão — pagamento rastreado na fatura</p>
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
            Adicionar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
