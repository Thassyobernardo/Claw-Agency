
import { useState } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";

interface TransactionRow {
  date: string;
  description: string;
  amount: string;
}

export default function ManualTransactionEntry() {
  const [rows, setRows] = useState<TransactionRow[]>([{ date: "", description: "", amount: "" }]);
  const [loading, setLoading] = useState(false);

  const addRow = () => setRows([...rows, { date: "", description: "", amount: "" }]);
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index));

  const updateRow = (index: number, field: keyof TransactionRow, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const validRows = rows.filter(r => r.date && r.description && r.amount);
      if (validRows.length === 0) {
        alert("Please fill at least one transaction row.");
        return;
      }
      const response = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRows),
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Success! ${data.count} transactions saved and AI classification started.`);
        setRows([{ date: "", description: "", amount: "" }]);
      } else {
        alert(`Error: ${data.error || "Failed to save transactions"}`);
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Quick Manual Entry</h3>
          <p className="text-sm text-slate-500">Add transactions manually. Our AI will classify them for you.</p>
        </div>
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition">
          <Plus size={18} /> Add Row
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-3 items-center">
            <input
              type="date"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition"
              value={row.date}
              onChange={(e) => updateRow(i, "date", e.target.value)}
            />
            <input
              type="text"
              placeholder="Ex: BP Sydney - Fuel"
              className="flex-[2] px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition"
              value={row.description}
              onChange={(e) => updateRow(i, "description", e.target.value)}
            />
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition"
                value={row.amount}
                onChange={(e) => updateRow(i, "amount", e.target.value)}
              />
            </div>
            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} className="p-2 text-slate-300 hover:text-red-500 transition">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full mt-8 flex items-center justify-center gap-2 bg-green-600 py-4 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        Save & Classify with AI
      </button>
    </div>
  );
}
