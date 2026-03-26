import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AddIncomeEntryProps {
  open: boolean;
  onClose: () => void;
}

export function AddIncomeEntry({ open, onClose }: AddIncomeEntryProps) {
  const { addIncome, accounts, currentMonth } = useFinance();
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId]     = useState('');

  const checkingAccounts = accounts.filter(a => a.type === 'checking' && a.active);

  const handleSubmit = () => {
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || !description) return;
    addIncome({
      description,
      estimatedAmount: num,
      month: format(currentMonth, 'yyyy-MM'),
      status: 'pending',
      accountId: accountId || undefined,
    });
    setAmount('');
    setDescription('');
    setAccountId('');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader><SheetTitle>Nova Entrada Avulsa</SheetTitle></SheetHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={e => setAmount(e.target.value)} className="text-2xl font-bold h-14 mt-1" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input placeholder="Ex: Freelance, Venda, Reembolso" value={description}
              onChange={e => setDescription(e.target.value)} className="mt-1" />
          </div>
          {checkingAccounts.length > 0 && (
            <div>
              <Label>Conta (opcional)</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                <button
                  onClick={() => setAccountId('')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    !accountId ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border'
                  )}
                >
                  Qualquer
                </button>
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
          <Button onClick={handleSubmit} className="w-full h-12 text-base" disabled={!amount || !description}>
            Adicionar Entrada
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
