import { useState } from "react";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { Dashboard } from "@/components/Dashboard";
import { TransactionList } from "@/components/TransactionList";
import { RecurringManager } from "@/components/RecurringManager";
import { Charts } from "@/components/Charts";
import { BottomNav, TabId } from "@/components/BottomNav";
import { AddTransaction } from "@/components/AddTransaction";
import { AddIncomeEntry } from "@/components/AddIncomeEntry";
import { Plus, Wallet, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <FinanceProvider>
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">💰 ZaGastos</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-4">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "expenses" && <TransactionList />}
          {activeTab === "recurring" && <RecurringManager />}
          {activeTab === "charts" && <Charts />}
        </main>

        {/* FAB overlay */}
        {fabOpen && <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setFabOpen(false)} />}

        {/* FAB options */}
        <div
          className={cn(
            "fixed bottom-40 right-4 z-50 flex flex-col gap-3 transition-all mb-[env(safe-area-inset-bottom)]",
            fabOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
          )}
        >
          <button
            onClick={() => {
              setFabOpen(false);
              setShowAddIncome(true);
            }}
            className="flex items-center gap-2 bg-income text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium"
          >
            <Wallet className="h-4 w-4" /> Entrada Avulsa
          </button>
          <button
            onClick={() => {
              setFabOpen(false);
              setShowAdd(true);
            }}
            className="flex items-center gap-2 bg-expense text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium"
          >
            <ShoppingBag className="h-4 w-4" /> Gasto Avulso
          </button>
        </div>

        <Button
          onClick={() => setFabOpen(!fabOpen)}
          className={cn(
            "fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50 transition-transform mb-[env(safe-area-inset-bottom)]",
            fabOpen && "rotate-45",
          )}
          size="icon"
        >
          <Plus className="h-7 w-7" />
        </Button>

        <AddTransaction open={showAdd} onClose={() => setShowAdd(false)} />
        <AddIncomeEntry open={showAddIncome} onClose={() => setShowAddIncome(false)} />
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </FinanceProvider>
  );
};

export default Index;
