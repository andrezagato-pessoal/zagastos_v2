import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { CreditCard } from '@/types/finance';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Trash2, CreditCard as CreditCardIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_OPTIONS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#6366F1', // indigo
];

export function CreditCardManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { creditCards, addCreditCard, updateCreditCard, deleteCreditCard } = useFinance();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cartões de Crédito</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 pt-4">
          {creditCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCardIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum cartão cadastrado.</p>
            </div>
          ) : (
            creditCards.map(card => (
              <Card key={card.id} className="flex items-center gap-3 p-3">
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{card.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteCreditCard(card.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))
          )}
          <Button onClick={() => setShowAdd(true)} variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Adicionar Cartão
          </Button>
        </div>

        {showAdd && <AddCardSheet open={showAdd} onClose={() => setShowAdd(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function AddCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCreditCard } = useFinance();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [closingDay, setClosingDay] = useState('16');
  const [dueDay, setDueDay] = useState('23');

  const handleSubmit = () => {
    if (!name) return;
    addCreditCard({
      name,
      color,
      closingDay: parseInt(closingDay) || 1,
      dueDay: parseInt(dueDay) || 10,
      active: true,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto z-[60]">
        <SheetHeader>
          <SheetTitle>Novo Cartão</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Nome</Label>
            <Input placeholder="Ex: André, Bianca" value={name} onChange={e => setName(e.target.value)} className="mt-1" autoFocus />
          </div>

          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-1">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('h-8 w-8 rounded-full border-2 transition-all', color === c ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Dia fechamento</Label>
              <Input type="number" min="1" max="31" value={closingDay} onChange={e => setClosingDay(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label>Dia vencimento</Label>
              <Input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} className="mt-1" />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full h-12 text-base" disabled={!name}>
            Adicionar Cartão
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
