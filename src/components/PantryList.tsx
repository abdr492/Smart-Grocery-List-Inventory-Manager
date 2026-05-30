import React, { useState } from "react";
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  BookmarkCheck,
  RotateCw,
  Barcode,
  Sparkles,
  Layers,
  ChevronDown,
  Info,
  Flame
} from "lucide-react";
import { PantryItem, DEFAULT_CATEGORIES } from "../types";
import BarcodeScanner from "./BarcodeScanner";

interface PantryListProps {
  items: PantryItem[];
  onAddItem: (item: Omit<PantryItem, "id" | "userId" | "createdAt" | "updatedAt">) => void;
  onUpdateQty: (itemId: string, newQty: number) => void;
  onDeleteItem: (itemId: string) => void;
  onLogAction: (itemName: string, quantity: number, action: "consumed" | "expired" | "wasted" | "purchased") => void;
  customCategories?: string[];
}

const UNITS = ["pcs", "g", "ml", "cans", "bottles", "box", "items"];

// Helper function to automatically convert units to keep the UI clean (e.g. g -> kg, ml -> L)
const convertPantryUnit = (quantity: number, unit: string) => {
  const normUnit = (unit || "").toLowerCase().trim();
  if (normUnit === "g" && quantity >= 1000) {
    return {
      quantity: (quantity / 1000).toFixed(1).replace(/\.0$/, ""),
      unit: "kg"
    };
  }
  if (normUnit === "ml" && quantity >= 1000) {
    return {
      quantity: (quantity / 1000).toFixed(1).replace(/\.0$/, ""),
      unit: "L"
    };
  }
  if (normUnit === "kg" && quantity > 0 && quantity < 1) {
    return {
      quantity: Math.round(quantity * 1000),
      unit: "g"
    };
  }
  if ((normUnit === "l" || normUnit === "liters" || normUnit === "liter") && quantity > 0 && quantity < 1) {
    return {
      quantity: Math.round(quantity * 1000),
      unit: "ml"
    };
  }
  return { quantity, unit };
};

export default function PantryList({ items, onAddItem, onUpdateQty, onDeleteItem, onLogAction, customCategories = [] }: PantryListProps) {
  const categoriesList = [...DEFAULT_CATEGORIES, ...customCategories];
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"expiry" | "quantity" | "name">("expiry");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formQty, setFormQty] = useState<number>(1);
  const [formUnit, setFormUnit] = useState("pcs");
  const [formExpiry, setFormExpiry] = useState("");
  const [formThreshold, setFormThreshold] = useState<number>(2);
  const [formCategory, setFormCategory] = useState("Pantry");
  const [formBarcode, setFormBarcode] = useState("");

  const handleProductFoundFromScanner = (product: {
    name: string;
    category: string;
    unit: string;
    barcode: string;
    shelfLifeDays: number;
  }) => {
    setFormName(product.name);
    setFormCategory(categoriesList.includes(product.category) ? product.category : "Pantry");
    setFormUnit(UNITS.includes(product.unit) ? product.unit : "pcs");
    setFormBarcode(product.barcode);

    // Calculate expiry date automatically based on average shelf life
    if (product.shelfLifeDays) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + product.shelfLifeDays);
      setFormExpiry(expDate.toISOString().split("T")[0]);
    }
    setShowScanner(false);
    setShowAddForm(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    onAddItem({
      name: formName.trim(),
      quantity: Math.max(0, formQty),
      unit: formUnit,
      expiryDate: formExpiry ? new Date(formExpiry).toISOString() : undefined,
      lowStockThreshold: Math.max(0, formThreshold),
      category: formCategory,
      barcode: formBarcode || undefined,
    });

    // Logging the purchase action
    onLogAction(formName.trim(), formQty, "purchased");

    // Reset Form
    setFormName("");
    setFormQty(1);
    setFormExpiry("");
    setFormThreshold(2);
    setFormBarcode("");
    setShowAddForm(false);
  };

  const consumeItem = (item: PantryItem, amount: number) => {
    const deduct = Math.min(item.quantity, amount);
    if (deduct <= 0) return;

    const remaining = item.quantity - deduct;
    onUpdateQty(item.id, remaining);
    onLogAction(item.name, deduct, "consumed");

    if (remaining === 0) {
      // Prompt deletion or leave at zero
      onDeleteItem(item.id);
    }
  };

  const wasteItem = (item: PantryItem) => {
    if (item.quantity <= 0) return;
    onLogAction(item.name, item.quantity, "expired");
    onDeleteItem(item.id);
  };

  // Filter & Sort
  const filteredItems = items
    .filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === "All" || item.category === selectedCategory;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "quantity") return b.quantity - a.quantity;
      // Filter by Expiry date (items without expiry go to back)
      if (sortBy === "expiry") {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Upper Options Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute top-2.5 left-3 h-4.5 w-4.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pantry stock..."
            className="w-full rounded-lg border border-white/5 bg-white/[0.02] backdrop-blur-md py-2 pl-10 pr-4 font-sans text-xs text-zinc-200 placeholder:text-zinc-650 focus:border-emerald-500 focus:outline-none focus:bg-white/[0.04] transition"
          />
        </div>

        {/* Action button grouping */}
        <div className="flex items-center space-x-2">
          {/* Barcode scanner launcher */}
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] backdrop-blur-sm px-3.5 py-2 font-sans text-xs font-semibold text-zinc-300 hover:border-emerald-500 hover:text-emerald-400 hover:bg-white/[0.06] transition"
          >
            <Barcode className="h-4 w-4" />
            Scanner Input
          </button>

          {/* Add Manual Item launcher */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 bg-emerald-600/90 border border-emerald-500/20 px-3.5 py-2 font-sans text-xs font-semibold text-zinc-100 rounded-lg hover:bg-emerald-600 hover:border-emerald-400 transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Add Manual
          </button>
        </div>
      </div>

      {/* Manual Input Dropdown Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-5 space-y-4 animate-fadeIn shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
          <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Add Kitchen Asset
          </h3>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block mb-1.5 font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Item Description
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Pack of apples, cheddar cheese..."
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block mb-1.5 font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Quantity
              </label>
              <div className="flex space-x-1">
                <input
                  type="number"
                  min="1"
                  required
                  value={formQty}
                  onChange={(e) => setFormQty(parseInt(e.target.value) || 1)}
                  className="w-20 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
                />
                 <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u} className="bg-zinc-950 text-zinc-100">
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block mb-1.5 font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Category
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat} className="bg-zinc-950 text-zinc-100">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5 font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Expiry Date
              </label>
              <input
                type="date"
                value={formExpiry}
                onChange={(e) => setFormExpiry(e.target.value)}
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-white/5">
            <div>
              <label className="block mb-1.5 font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Low Stock Warning Threshold (Auto Shopping triggering)
              </label>
              <input
                type="number"
                min="0"
                value={formThreshold}
                onChange={(e) => setFormThreshold(parseInt(e.target.value) || 0)}
                className="w-32 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block mb-1.5 font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Optional UPC Barcode (Scanned value)
              </label>
              <input
                type="text"
                value={formBarcode}
                onChange={(e) => setFormBarcode(e.target.value)}
                placeholder="Optional code"
                className="w-full max-w-xs rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-white/5 px-4 py-2 font-sans text-xs text-zinc-400 hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2 font-sans text-xs font-semibold text-zinc-100 hover:bg-emerald-500 transition active:scale-[0.98]"
            >
              Add Item
            </button>
          </div>
        </form>
      )}

      {/* Categories Horizontal Scroller and Sorter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        {/* Categories Scroller */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto py-1">
          {["All", ...categoriesList].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 font-sans text-[11px] font-semibold transition whitespace-nowrap backdrop-blur-sm ${
                selectedCategory === cat
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
                  : "bg-white/[0.03] border border-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="font-sans text-[10px] uppercase tracking-wider font-bold text-zinc-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 font-sans text-xs font-semibold text-zinc-300 focus:outline-none transition backdrop-blur-md"
          >
            <option value="expiry" className="bg-zinc-950 text-zinc-300">📅 Expire Date First</option>
            <option value="quantity" className="bg-zinc-950 text-zinc-300">⚖️ Volume (High to Low)</option>
            <option value="name" className="bg-zinc-950 text-zinc-300">🔤 Item Name</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            // Compute status indicators
            const isLow = item.quantity <= item.lowStockThreshold;

            let isExpired = false;
            let isExpiringSoon = false;
            let daysLeft = 0;

            if (item.expiryDate) {
              const expires = new Date(item.expiryDate);
              const now = new Date();
              daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              if (daysLeft < 0) {
                isExpired = true;
              } else if (daysLeft <= 3) {
                isExpiringSoon = true;
              }
            }

            return (
              <div
                key={item.id}
                className={`relative flex flex-col justify-between rounded-xl border p-4.5 backdrop-blur-md transition-all hover:scale-[1.01] duration-200 shadow-lg ${
                  isExpired
                    ? "border-red-500/20 bg-red-950/10 hover:border-red-500/35 hover:bg-red-950/20"
                    : isExpiringSoon
                    ? "border-amber-500/20 bg-amber-950/10 hover:border-amber-500/35 hover:bg-amber-950/20"
                    : isLow
                    ? "border-red-500/30 bg-white/[0.02] hover:border-red-500/45 hover:bg-white/[0.04] shadow-[0_4px_16px_rgba(239,68,68,0.06)]"
                    : "border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                }`}
              >
                {/* Upper Details */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      {/* Category Pill */}
                      <span className="font-sans text-[9px] uppercase tracking-wider font-bold bg-white/5 text-zinc-400 px-2 py-0.5 rounded border border-white/5 inline-block mb-1.5">
                        {item.category}
                      </span>
                      <h4 className="font-sans text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
                        {item.name}
                      </h4>
                    </div>

                    {/* Expiry Label or low alerts */}
                    <div className="text-right">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-950/35 border border-red-900/50 px-2 py-0.5 font-sans text-[10px] text-red-400 font-bold">
                          Expired
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-950/20 border border-amber-900/50 px-2 py-0.5 font-sans text-[10px] text-amber-400 font-bold">
                          {daysLeft === 0 ? "Expires Today" : `Expires in ${daysLeft}d`}
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-red-500/10 border border-red-500/25 px-2.5 py-0.5 font-sans text-[10px] text-red-400 font-bold animate-pulse">
                          <Flame className="h-3.5 w-3.5 text-red-500 fill-red-500/25" />
                          Low Stock
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Quantity Count and bar */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-baseline space-x-1.5">
                      {(() => {
                        const converted = convertPantryUnit(item.quantity, item.unit);
                        const isConverted = String(converted.quantity) !== String(item.quantity) || converted.unit !== item.unit;
                        return (
                          <>
                            <span 
                              className={`font-mono text-xl font-bold ${isConverted && isLow ? "text-red-400" : isConverted ? "text-emerald-400" : "text-zinc-100"}`}
                              title={isConverted ? `Auto-converted from: ${item.quantity} ${item.unit}` : undefined}
                            >
                              {converted.quantity}
                            </span>
                            <span 
                              className={`font-sans text-xs ${isConverted && isLow ? "text-red-450 font-semibold" : isConverted ? "text-emerald-500 font-semibold" : "text-zinc-550"}`}
                              title={isConverted ? `Auto-converted from: ${item.quantity} ${item.unit}` : undefined}
                            >
                              {converted.unit}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    {isLow && (
                      <span className="flex items-center gap-1 font-sans text-[10px] font-black text-red-400 bg-red-500/5 border border-red-555/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                        Refill Required
                      </span>
                    )}
                  </div>

                  {/* Date details */}
                  {item.expiryDate && (
                    <div className="mt-2.5 flex items-center space-x-1 font-sans text-[11px] text-zinc-500">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Expires {new Date(item.expiryDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Barcode display */}
                  {item.barcode && (
                    <div className="mt-1 flex items-center space-x-1 font-mono text-[10px] text-zinc-600">
                      <Barcode className="h-3 w-3 shrink-0" />
                      <span>UPC: {item.barcode}</span>
                    </div>
                  )}
                </div>

                {/* Control Actions buttons area */}
                <div className="mt-5 border-t border-zinc-900 pt-3 flex items-center justify-between gap-1.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => consumeItem(item, 1)}
                      className="inline-flex items-center justify-center rounded px-2.5 py-1 font-sans text-[10px] font-bold text-emerald-400 border border-emerald-950 hover:bg-emerald-950/20 transition"
                      title="Mark 1 unit as eaten"
                    >
                      Eat 1
                    </button>
                    <button
                      onClick={() => consumeItem(item, item.quantity)}
                      className="inline-flex items-center justify-center rounded px-2.5 py-1 font-sans text-[10px] font-bold text-teal-400 border border-teal-950 hover:bg-teal-950/20 transition"
                      title="Mark all as eaten"
                    >
                      Eat All
                    </button>
                  </div>

                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => wasteItem(item)}
                      className="rounded p-1.5 text-zinc-650 hover:bg-red-950/20 hover:text-red-400 transition"
                      title="Discard as wasted food"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-850 bg-zinc-950/10 py-16 text-center text-zinc-500">
          <Layers className="mb-2 h-10 w-10 text-zinc-820" />
          <p className="font-sans text-sm font-semibold">Pantry inventory empty.</p>
          <p className="font-sans text-xs text-zinc-600 max-w-xs mt-1">
            No items in stock. Click "Scanner Input" or "Add Manual" above to catalog your kicthen items.
          </p>
        </div>
      )}

      {/* Barcode Scanner Modal overlay */}
      {showScanner && (
        <BarcodeScanner
          onProductFound={handleProductFoundFromScanner}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
