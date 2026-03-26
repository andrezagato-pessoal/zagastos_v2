import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Category } from '@/types/finance';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus, Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_OPTIONS = [
  '🍕', '🚗', '🏡', '🎮', '💊', '📚', '🛒', '📺', '🐾', '🔧', '👕', '📦',
  '💰', '🎵', '✈️', '🏋️', '💡', '🎁', '☕', '🍔', '🛍️', '📱', '🏥', '🎓',
  '🚌', '⚡', '💧', '🔥', '🏦', '🎬', '🎯', '🌍', '💳', '🧹', '👶', '💼',
  '⛽', '🛁', '🏫', '🎪', '🎂', '🌿', '🐶', '💉', '🧴', '🧺',
];

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

export function CategoryManager({ open, onClose }: CategoryManagerProps) {
  const { categories, addCategory, updateCategory, deleteCategory,
          fixedExpenses, expenseEntries, monthlyBudgets, templates } = useFinance();

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [editingId, setEditingId] = useState<string | null>(null);

  const isCategoryInUse = (id: string) =>
    fixedExpenses.some(f => f.categoryId === id) ||
    expenseEntries.some(e => e.categoryId === id) ||
    monthlyBudgets.some(b => b.categoryId === id) ||
    templates.some(t => t.categoryId === id);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addCategory(newName.trim(), newIcon, '#6366f1');
    setNewName('');
    setNewIcon('📦');
  };

  const handleDelete = (id: string) => {
    deleteCategory(id); // context already shows toast if in use
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gerenciar Categorias</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Add new */}
          <div className="space-y-2">
            <Label>Nova Categoria</Label>
            <div className="flex gap-2">
              <Input placeholder="Nome da categoria" value={newName}
                onChange={e => setNewName(e.target.value)} className="flex-1" />
              <Button onClick={handleAdd} size="sm" disabled={!newName.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ícone</Label>
              <div className="max-h-[120px] overflow-y-auto mt-1">
                <div className="grid grid-cols-10 gap-1">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button key={emoji} onClick={() => setNewIcon(emoji)}
                      className={cn('text-xl p-1 rounded-md transition-colors',
                        newIcon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted')}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="space-y-1">
            <Label>Categorias Atuais</Label>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {categories.map(cat => (
                editingId === cat.id
                  ? <EditRow key={cat.id} cat={cat}
                      onSave={(name, icon) => {
                        updateCategory(cat.id, { name, icon });
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)} />
                  : <ViewRow key={cat.id} cat={cat}
                      inUse={isCategoryInUse(cat.id)}
                      onEdit={() => setEditingId(cat.id)}
                      onDelete={() => handleDelete(cat.id)} />
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ----------------------------------------------------------------
// View row
// ----------------------------------------------------------------
function ViewRow({ cat, inUse, onEdit, onDelete }: {
  cat: Category;
  inUse: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50">
      <span className="text-lg">{cat.icon}</span>
      <span className="text-sm font-medium flex-1">{cat.name}</span>
      {inUse && (
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">em uso</span>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={onDelete}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ----------------------------------------------------------------
// Edit row (inline)
// ----------------------------------------------------------------
function EditRow({ cat, onSave, onCancel }: {
  cat: Category;
  onSave: (name: string, icon: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(cat.name);
  const [icon, setIcon] = useState(cat.icon);

  return (
    <div className="border rounded-lg p-2 space-y-2 bg-muted/30">
      <div className="flex gap-2">
        <span className="text-2xl">{icon}</span>
        <Input value={name} onChange={e => setName(e.target.value)} className="flex-1 h-9" autoFocus />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => onSave(name.trim(), icon)}
          disabled={!name.trim()}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-[100px] overflow-y-auto">
        <div className="grid grid-cols-10 gap-1">
          {EMOJI_OPTIONS.map(emoji => (
            <button key={emoji} onClick={() => setIcon(emoji)}
              className={cn('text-lg p-1 rounded-md transition-colors',
                icon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted')}>
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
