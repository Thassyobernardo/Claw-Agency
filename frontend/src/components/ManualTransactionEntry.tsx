import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, Info } from "lucide-react";

interface TransactionRow {
  date: string;
  description: string;
  amount: string;
  categoryCode: string;
  quantity: string;
}

const CATEGORIES = [
  { code: "", label: "Auto-classify with AI" },
  { code: "electricity", label: "Electricity (kWh)" },
  { code: "fuel_diesel", label: "Diesel (L)" },
  { code: "fuel_petrol", label: "Petrol (L)" },
  { code: "fuel_lpg", label: "LPG (L)" },
  { code: "natural_gas", label: "Natural Gas (MJ)" },
  { code: "air_travel", label: "Air Travel (km)" },
  { code: "road_freight", label: "Road Freight (km)" },
  { code: "waste", label: "Waste (tonne)" },
  { code: "water", label: "Water (AUD)" },
];

export default function ManualTransactionEntry() {
  const [rows, setRows] = useState<TransactionRow[]>([{ date: "", description: "", amount: "", categoryCode: "", quantity: "" }]);
  const [loading, setLoading] = useState(false);

  const addRow = () => setRows([...rows, { date: "", description: "", amount: "", categoryCode: "", quantity: "" }]);
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
        alert("Please fill at least Date, Description, and Amount for one row.");
        setLoading(false);
        return;
      }
      
      const payload = validRows.map(r => ({
        date: r.date,
        description: r.description,
        amount: parseFloat(r.amount) || 0,
        categoryCode: r.categoryCode || undefined,
        quantity: r.quantity ? parseFloat(r.quantity) : undefined,
      }));

      const response = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Success! ${data.count} transactions saved.`);
        setRows([{ date: "", description: "", amount: "", categoryCode: "", quantity: "" }]);
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
          <h3 className="text-lg font-bold text-slate-800">Advanced Manual Entry</h3>
          <p className="text-sm text-slate-500">Provide physical quantities for accurate NGA factor calculation, or leave category empty for AI classification.</p>
        </div>
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition">
          <Plus size={18} /> Add Row
        </button>
      </div>

      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap lg:flex-nowrap gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input
              type="date"
              className="w-full lg:w-40 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition"
              value={row.date}
              onChange={(e) => updateRow(i, "date", e.target.value)}
            />
            <input
              type="text"
              placeholder="Ex: BP Sydney - Fuel"
              className="w-full lg:flex-[2] px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition"
              value={row.description}
              onChange={(e) => updateRow(i, "description", e.target.value)}
            />
            <div className="relative w-full lg:w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition"
                value={row.amount}
                onChange={(e) => updateRow(i, "amount", e.target.value)}
              />
            </div>
            
            {/* New Category & Quantity fields */}
            <select 
              className="w-full lg:w-48 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition bg-white text-slate-700"
              value={row.categoryCode}
              onChange={(e) => updateRow(i, "categoryCode", e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            
            <input
              type="number"
              placeholder={row.categoryCode ? "Physical Qty" : "Qty (optional)"}
              disabled={!row.categoryCode}
              className="w-full lg:w-32 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-green-600 transition disabled:bg-slate-100 disabled:text-slate-400"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
            />

            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} className="p-2 text-slate-300 hover:text-red-500 transition">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
        <Info size={14} className="text-blue-500" />
        <span>If you specify a Category and Quantity, the transaction will be immediately classified with the exact physical unit (e.g., Litres, kWh). Otherwise, our AI will use the dollar amount to estimate emissions.</span>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full mt-6 flex items-center justify-center gap-2 bg-green-600 py-4 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        Save Transactions
      </button>
    </div>
  );
}
