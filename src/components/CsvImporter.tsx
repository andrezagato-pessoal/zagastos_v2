import { useState, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface CsvImporterProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// CSV parsing helpers
// ---------------------------------------------------------------------------
function parseAmount(s: string): number {
  return parseFloat(s.replace(',', '.').trim()) || 0;
}

function parseCsvLine(line: string): string[] {
  return line.split(';').map(c => c.trim());
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CsvImporter({ open, onClose }: CsvImporterProps) {
  const { accounts, categories } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await runImport(text);
    // Reset file input so the same file can be re-selected if needed
    e.target.value = '';
  };

  const runImport = async (csvText: string) => {
    setStatus('running');
    setLog([]);

    const lines = csvText
      .split('\n')
      .map(l => l.replace(/\r/g, '').trim())
      .filter(Boolean);

    // Skip header row and footer separator
    const dataLines = lines.filter(
      l => !l.startsWith('Tipo;') && !l.startsWith('---') && !l.startsWith('Resumo')
    );

    // -----------------------------------------------------------------------
    // Build category lookup (name → id). Create missing ones.
    // -----------------------------------------------------------------------
    const catMap: Record<string, string> = {};  // lowercase name → id
    for (const cat of categories) {
      catMap[cat.name.toLowerCase().trim()] = cat.id;
    }

    const ensureCategory = async (name: string): Promise<string> => {
      const key = name.toLowerCase().trim();
      if (catMap[key]) return catMap[key];
      // Create it
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: name.trim(), icon: '📦', color: '#64748b' })
        .select('id')
        .single();
      if (error || !data) {
        addLog(`⚠️  Não foi possível criar categoria "${name}"`);
        return '';
      }
      catMap[key] = data.id;
      addLog(`  + Categoria criada: ${name}`);
      return data.id;
    };

    // -----------------------------------------------------------------------
    // Build account lookup (name → id)
    // -----------------------------------------------------------------------
    const accByName: Record<string, string> = {};
    for (const acc of accounts) {
      accByName[acc.name.toLowerCase().trim()] = acc.id;
    }
    // "Débito" maps to "Zag"
    const zagId = accByName['zag'] ?? '';

    const resolveAccount = (conta: string): string => {
      if (!conta || conta === 'Débito') return zagId;
      return accByName[conta.toLowerCase().trim()] ?? zagId;
    };

    // -----------------------------------------------------------------------
    // Detect month from first date found
    // -----------------------------------------------------------------------
    let monthKey = '';
    for (const line of dataLines) {
      const cols = parseCsvLine(line);
      if (cols[6] && /^\d{4}-\d{2}/.test(cols[6])) {
        monthKey = cols[6].substring(0, 7);
        break;
      }
    }
    if (!monthKey) {
      addLog('❌ Não foi possível detectar o mês no CSV.');
      setStatus('done');
      return;
    }
    addLog(`📅 Mês detectado: ${monthKey}`);

    // -----------------------------------------------------------------------
    // Process rows
    // -----------------------------------------------------------------------
    let incomeCount = 0, fixedCount = 0, expenseCount = 0, budgetCount = 0;

    for (const line of dataLines) {
      const cols = parseCsvLine(line);
      const [tipo, descricao, categoria, conta, valorStr, statusStr, dataStr] = cols;
      const amount = parseAmount(valorStr);
      if (!tipo || amount === 0) continue;

      // ---- Saldo Anterior ------------------------------------------------
      if (tipo === 'Saldo Anterior') {
        await supabase
          .from('app_settings')
          .update({ initial_balance: amount })
          .eq('id', 1);
        addLog(`💰 Saldo anterior: R$ ${amount}`);
        continue;
      }

      // ---- Ref. Orçamento ------------------------------------------------
      if (tipo === 'Ref. Orçamento') {
        const catId = await ensureCategory(categoria);
        if (!catId) continue;
        const { error } = await supabase.from('monthly_budgets').insert({
          month: monthKey,
          category_id: catId,
          description: descricao || categoria,
          amount,
        });
        if (!error) budgetCount++;
        continue;
      }

      // ---- Entrada -------------------------------------------------------
      if (tipo === 'Entrada') {
        const recebido = statusStr?.toLowerCase() === 'recebido';
        const { error } = await supabase.from('income_entries').insert({
          month: monthKey,
          description: descricao,
          estimated_amount: amount,
          actual_amount: recebido ? amount : null,
          status: recebido ? 'received' : 'pending',
          received_date: recebido ? `${monthKey}-01` : null,
        });
        if (!error) incomeCount++;
        continue;
      }

      // ---- Gasto Fixo ----------------------------------------------------
      if (tipo === 'Gasto Fixo') {
        const catId = categoria ? await ensureCategory(categoria) : null;
        const accId = resolveAccount(conta);
        const isPaid = statusStr?.toLowerCase() === 'pago';
        const date   = dataStr || `${monthKey}-01`;
        const { error } = await supabase.from('fixed_expenses').insert({
          month: monthKey,
          description: descricao,
          estimated_amount: amount,
          actual_amount: isPaid ? amount : null,
          category_id: catId || null,
          account_id: accId || null,
          due_date: date || null,
          status: isPaid ? 'paid' : 'pending',
          paid_date: isPaid ? date : null,
        });
        if (!error) fixedCount++;
        continue;
      }

      // ---- Avulso, Cartão, Orçamento* (expense entries) ------------------
      if (
        tipo === 'Avulso' ||
        tipo === 'Cartão' ||
        tipo.startsWith('Orçamento')
      ) {
        const catId = await ensureCategory(categoria);
        if (!catId) continue;
        const accId = resolveAccount(conta);
        if (!accId) { addLog(`⚠️  Conta não encontrada: "${conta}" — linha ignorada: ${descricao}`); continue; }
        const acc = accounts.find(a => a.id === accId);
        const isCredit = acc?.type === 'credit';
        const date = dataStr || `${monthKey}-01`;
        const { error } = await supabase.from('expense_entries').insert({
          description: descricao,
          amount,
          category_id: catId,
          account_id: accId,
          date,
          status: isCredit ? 'pending' : 'paid',
        });
        if (!error) expenseCount++;
        continue;
      }
    }

    addLog('');
    addLog(`✅ Importação concluída:`);
    addLog(`   ${incomeCount} entradas`);
    addLog(`   ${fixedCount} gastos fixos`);
    addLog(`   ${expenseCount} despesas avulsas`);
    addLog(`   ${budgetCount} orçamentos de categoria`);

    setStatus('done');
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Importar CSV</SheetTitle></SheetHeader>

        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Formato esperado: exportação ZaGastos (colunas Tipo;Descrição;Categoria;Conta;Valor;Status;Data).
            Débito → conta Zag. Categorias novas são criadas automaticamente.
          </p>

          {status === 'idle' && (
            <Button className="w-full h-12" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Escolher arquivo CSV
            </Button>
          )}

          {status === 'running' && (
            <p className="text-sm text-center text-muted-foreground animate-pulse">Importando...</p>
          )}

          {log.length > 0 && (
            <div className="bg-muted rounded-lg p-3 text-xs font-mono space-y-0.5 max-h-60 overflow-y-auto">
              {log.map((l, i) => <p key={i}>{l || '\u00a0'}</p>)}
            </div>
          )}

          {status === 'done' && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStatus('idle'); setLog([]); fileRef.current?.click(); }}>
                Importar outro arquivo
              </Button>
              <Button className="flex-1" onClick={onClose}>Fechar</Button>
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </SheetContent>
    </Sheet>
  );
}
