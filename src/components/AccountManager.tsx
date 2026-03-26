import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Account } from '@/types/finance';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

interface AccountManagerProps {
  open: boolean;
  onClose: () => void;
}

export function AccountManager({ open, onClose }: AccountManagerProps) {
  const { accounts, addAccount, updateAccount, deleteAccount } = useFinance();
  const [showAdd, setShowAdd] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const checkingAccounts = accounts.filter(a => a.type === 'checking');
  const creditAccounts   = accounts.filter(a => a.type === 'credit');

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Contas e Cartões</SheetTitle></SheetHeader>

        <div className="space-y-4 pt-4">
          <Button size="sm" onClick={() => setShowAdd(true)} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Nova Conta / Cartão
          </Button>

          {/* Checking accounts */}
          {checkingAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Débito / Pix</p>
              <div className="space-y-2">
                {checkingAccounts.map(acc => (
                  <AccountRow key={acc.id} account={acc}
                    onEdit={() => setEditingAccount(acc)}
                    onToggle={(checked) => updateAccount(acc.id, { active: checked })}
                    onDelete={() => deleteAccount(acc.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Credit accounts */}
          {creditAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Cartão de Crédito</p>
              <div className="space-y-2">
                {creditAccounts.map(acc => (
                  <AccountRow key={acc.id} account={acc}
                    onEdit={() => setEditingAccount(acc)}
                    onToggle={(checked) => updateAccount(acc.id, { active: checked })}
                    onDelete={() => deleteAccount(acc.id)} />
                ))}
              </div>
            </div>
          )}

          {accounts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-2xl mb-2">🏦</p>
              <p className="text-sm">Nenhuma conta cadastrada.</p>
            </div>
          )}
        </div>
      </SheetContent>

      <AddAccountSheet open={showAdd} onClose={() => setShowAdd(false)} />
      {editingAccount && <EditAccountSheet account={editingAccount} onClose={() => setEditingAccount(null)} />}
    </Sheet>
  );
}

// ============================================================
// Account row
// ============================================================
function AccountRow({ account, onEdit, onToggle, onDelete }: {
  account: Account;
  onEdit: () => void;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const isCredit = account.type === 'credit';
  return (
    <Card className={cn('flex items-center gap-3 p-3', !account.active && 'opacity-50')}>
      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
      <button className="flex-1 min-w-0 text-left" onClick={onEdit}>
        <p className="text-sm font-medium truncate">{isCredit ? `💳 ${account.name}` : account.name}</p>
        {isCredit && account.closingDay && (
          <p className="text-xs text-muted-foreground">
            Fecha dia {account.closingDay} · Vence dia {account.dueDay}
          </p>
        )}
      </button>
      <Switch checked={account.active} onCheckedChange={onToggle} />
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

// ============================================================
// Add account sheet
// ============================================================
function AddAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addAccount } = useFinance();
  const [name, setName]           = useState('');
  const [type, setType]           = useState<'checking' | 'credit'>('checking');
  const [color, setColor]         = useState(PRESET_COLORS[0]);
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay]       = useState('');

  const isCredit = type === 'credit';

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (isCredit && (!closingDay || !dueDay)) return;
    await addAccount({
      name: name.trim(),
      type,
      color,
      closingDay: isCredit ? parseInt(closingDay) : undefined,
      dueDay: isCredit ? parseInt(dueDay) : undefined,
      active: true,
      sortOrder: 0,
    });
    setName('');
    setType('checking');
    setColor(PRESET_COLORS[0]);
    setClosingDay('');
    setDueDay('');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Nova Conta / Cartão</SheetTitle></SheetHeader>
        <div className="space-y-4 pt-4">

          {/* Type toggle */}
          <div className="flex gap-2">
            <Button variant={type === 'checking' ? 'default' : 'outline'} className="flex-1"
              onClick={() => setType('checking')}>💵 Débito / Pix</Button>
            <Button variant={type === 'credit' ? 'default' : 'outline'} className="flex-1"
              onClick={() => setType('credit')}>💳 Crédito</Button>
          </div>

          <div>
            <Label>Nome</Label>
            <Input placeholder={isCredit ? 'Ex: Nu André' : 'Ex: Conta Zag'} value={name}
              onChange={e => setName(e.target.value)} className="mt-1" />
          </div>

          {/* Color picker */}
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Credit-only fields */}
          {isCredit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dia de fechamento</Label>
                <Input type="number" min="1" max="31" placeholder="Ex: 16" value={closingDay}
                  onChange={e => setClosingDay(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="31" placeholder="Ex: 23" value={dueDay}
                  onChange={e => setDueDay(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full h-12 text-base"
            disabled={!name.trim() || (isCredit && (!closingDay || !dueDay))}>
            Adicionar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Edit account sheet
// ============================================================
function EditAccountSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const { updateAccount } = useFinance();
  const [name, setName]           = useState(account.name);
  const [color, setColor]         = useState(account.color);
  const [closingDay, setClosingDay] = useState(String(account.closingDay ?? ''));
  const [dueDay, setDueDay]       = useState(String(account.dueDay ?? ''));

  const isCredit = account.type === 'credit';

  const handleSubmit = () => {
    if (!name.trim()) return;
    updateAccount(account.id, {
      name: name.trim(),
      color,
      closingDay: isCredit && closingDay ? parseInt(closingDay) : undefined,
      dueDay: isCredit && dueDay ? parseInt(dueDay) : undefined,
    });
    onClose();
  };

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar {isCredit ? 'Cartão' : 'Conta'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">

          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {isCredit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dia de fechamento</Label>
                <Input type="number" min="1" max="31" value={closingDay}
                  onChange={e => setClosingDay(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="31" value={dueDay}
                  onChange={e => setDueDay(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full h-12 text-base" disabled={!name.trim()}>
            Salvar Alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
