import React, { useState } from "react";
import { CheckSquare, Square, Trash2, Plus, Sparkles, ShoppingBag, ShoppingCart, RefreshCw, Layers, CheckCircle2 } from "lucide-react";
import { ShoppingItem } from "../types";

interface ShoppingListProps {
  items: ShoppingItem[];
  onAddItem: (item: { name: string; quantity: number; unit: string }) => void;
  onToggleChecked: (itemId: string, checked: boolean) => void;
  onDeleteItem: (itemId: string) => void;
  onCheckoutChecked: () => void;
}

export default function ShoppingList({ items, onAddItem, onToggleChecked, onDeleteItem, onCheckoutChecked }: ShoppingListProps) {
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState("pcs");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    onAddItem({
      name: itemName.trim(),
      quantity: itemQty,
      unit: itemUnit,
    });

    setItemName("");
    setItemQty(1);
  };

  const checkedItems = items.filter((item) => item.checked);
  const uncheckedItems = items.filter((item) => !item.checked);

  return (
    <div className="space-y-6">
      {/* Upper control layout */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-400" />
            Active Grocery Shopping List
          </h2>
          <p className="font-sans text-xs text-zinc-400">
            Keep track of required household ingredients. Items can be auto-generated when pantry stock is depleted.
          </p>
        </div>

        {checkedItems.length > 0 && (
          <button
            onClick={onCheckoutChecked}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-sans text-xs font-semibold text-zinc-100 hover:bg-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.25)] active:scale-[0.98] transition whitespace-nowrap align-middle"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            Purchase Checked Items ({checkedItems.length})
          </button>
        )}
      </div>

      {/* Manual fast entry form */}
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-12 rounded-xl bg-white/[0.02] p-4 border border-white/5 backdrop-blur-md shadow-lg">
        <div className="sm:col-span-6">
          <label className="block mb-1.5 font-sans text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            Quick Add Grocery Item
          </label>
          <input
            type="text"
            required
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Greek Yogurt, Eggs carton..."
            className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-200 placeholder:text-zinc-650 focus:border-emerald-500 focus:outline-none focus:bg-white/[0.04] transition"
          />
        </div>

        <div className="sm:col-span-4">
          <label className="block mb-1.5 font-sans text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            Quantity
          </label>
          <div className="flex space-x-1.5">
            <input
              type="number"
              min="1"
              required
              value={itemQty}
              onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
              className="w-16 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 font-sans text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none transition"
            />
            <select
              value={itemUnit}
              onChange={(e) => setItemUnit(e.target.value)}
              className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 font-sans text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none transition"
            >
              <option value="pcs" className="bg-zinc-950 text-zinc-200">pcs</option>
              <option value="g" className="bg-zinc-950 text-zinc-200">g</option>
              <option value="ml" className="bg-zinc-950 text-zinc-200">ml</option>
              <option value="cans" className="bg-zinc-950 text-zinc-200">cans</option>
              <option value="bottles" className="bg-zinc-950 text-zinc-200">bottles</option>
              <option value="box" className="bg-zinc-950 text-zinc-200">box</option>
            </select>
          </div>
        </div>

        <div className="sm:col-span-2 flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-white/10 border border-white/10 text-zinc-200 py-1.5 font-sans text-xs font-semibold hover:bg-white/20 hover:border-emerald-500 hover:text-emerald-400 transition"
          >
            Add Item
          </button>
        </div>
      </form>

      {/* Shopping List view */}
      {items.length > 0 ? (
        <div className="space-y-4">
          {/* Unchecked items group */}
          {uncheckedItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Needs Purchase</h3>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md divide-y divide-white/5 shadow-md">
                {uncheckedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition">
                    <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleChecked(item.id, true)}
                        className="text-zinc-500 hover:text-emerald-400 transition shrink-0"
                      >
                        <Square className="h-5 w-5" />
                      </button>

                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-zinc-200 truncate">{item.name}</p>
                        <p className="font-mono text-xs text-zinc-505 mt-0.5">
                          Amount: {item.quantity} {item.unit}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {item.autoGenerated && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-900/30 px-2.5 py-0.5 font-sans text-[10px] text-purple-400 font-bold shrink-0 animate-pulse">
                          <Sparkles className="h-3 w-3" />
                          Low Stock Alert
                        </span>
                      )}
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-zinc-600 hover:text-red-400 transition p-1 rounded hover:bg-white/5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checked items group */}
          {checkedItems.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                In Shopping Cart ({checkedItems.length})
              </h3>
              <div className="rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-sm divide-y divide-white/5 shadow-inner">
                {checkedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3.5 bg-white/[0.01]">
                    <div className="flex items-center space-x-3.5 flex-1 min-w-0 opacity-55">
                      <button
                        onClick={() => onToggleChecked(item.id, false)}
                        className="text-emerald-500 transition shrink-0"
                      >
                        <CheckSquare className="h-5 w-5" />
                      </button>

                      <div className="min-w-0 line-through">
                        <p className="font-sans text-sm font-semibold text-zinc-405 truncate">{item.name}</p>
                        <p className="font-mono text-xs text-zinc-600 mt-0.5">
                          Amount: {item.quantity} {item.unit}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-zinc-650 hover:text-red-400 transition p-1 rounded hover:bg-white/5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md py-16 text-center text-zinc-500 shadow-md">
          <ShoppingCart className="mb-2 h-10 w-10 text-zinc-700" />
          <p className="font-sans text-sm font-semibold text-zinc-400">Shopping list is empty.</p>
          <p className="font-sans text-xs text-zinc-600 max-w-xs mt-1">
            Excellent! You have all necessary cooking items. Add custom items manually above or lower your pantry stocks to triggers auto-generation.
          </p>
        </div>
      )}
    </div>
  );
}
