import React, { useState } from "react";
import {
  Bell,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Database,
  Loader2,
  Plus,
  Trash2,
  Layers
} from "lucide-react";
import { UserSettings, DEFAULT_CATEGORIES } from "../types";

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onTriggerTestNotification: (title: string, message: string) => void;
  onSeedSampleData?: () => Promise<void>;
  seedingLoading?: boolean;
}

export default function SettingsView({ settings, onUpdateSettings, onTriggerTestNotification, onSeedSampleData, seedingLoading = false }: SettingsViewProps) {
  const [newCatName, setNewCatName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    // Check matches in default list or existing custom list
    const isDefault = DEFAULT_CATEGORIES.some(
      (c) => c.toLowerCase() === name.toLowerCase()
    );
    const existingCustoms = settings.customCategories || [];
    const isCustom = existingCustoms.some(
      (c) => c.toLowerCase() === name.toLowerCase()
    );

    if (isDefault || isCustom) {
      setErrorMsg(`"${name}" already exists as a pantry category.`);
      return;
    }

    if (name.length > 25) {
      setErrorMsg("Category name is too long (maximum 25 characters).");
      return;
    }

    setErrorMsg("");
    const updatedCustoms = [...existingCustoms, name];
    onUpdateSettings({ customCategories: updatedCustoms });
    setNewCatName("");
  };

  const handleDeleteCustomCategory = (catToDelete: string) => {
    const existingCustoms = settings.customCategories || [];
    const updatedCustoms = existingCustoms.filter((c) => c !== catToDelete);
    onUpdateSettings({ customCategories: updatedCustoms });
  };
  
  const handleTogglePush = () => {
    onUpdateSettings({ pushNotificationsEnabled: !settings.pushNotificationsEnabled });
  };

  const handleToggleAlerts = () => {
    onUpdateSettings({ lowStockAlertsEnabled: !settings.lowStockAlertsEnabled });
  };

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(1, Math.min(30, parseInt(e.target.value) || 3));
    onUpdateSettings({ expiryReminderDays: val });
  };

  // Push notifications tester triggers
  const triggerSimulation = () => {
    onTriggerTestNotification(
      "🥫 Low Stock Alert!",
      "Heinz Tomato Ketchup has fallen below your local warning threshold of 2 bottles. Added to Shopping list."
    );
  };

  const triggerExpirySimulation = () => {
    onTriggerTestNotification(
      "⏰ Food Expiry Reminder",
      `Organic Whole Milk is set to expire in ${settings.expiryReminderDays} days! Open Gemini Suggestions to rescue it.`
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto rounded-xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl shadow-xl">
      <div>
        <h2 className="font-sans text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Bell className="h-5 w-5 text-emerald-400" />
          Kitchen Alert Settings
        </h2>
        <p className="font-sans text-xs text-zinc-400">
          Configure real-time sync, alerts thresholds, and customize shopping list generator behaviors.
        </p>
      </div>

      {/* Settings Grid */}
      <div className="space-y-5 pt-4 border-t border-white/5">
        {/* Toggle 1 */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <span className="font-sans text-sm font-semibold text-zinc-200 block">Mobile Push Notifications</span>
            <span className="font-sans text-xs text-zinc-500 block">
              Send ambient warnings before groceries expire. Styled push simulations will slide from header.
            </span>
          </div>
          <button
            onClick={handleTogglePush}
            className="text-zinc-400 hover:text-zinc-200 transition shrink-0"
          >
            {settings.pushNotificationsEnabled ? (
              <ToggleRight className="h-9 w-9 text-emerald-400" />
            ) : (
              <ToggleLeft className="h-9 w-9 text-zinc-700" />
            )}
          </button>
        </div>

        {/* Toggle 2 */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <span className="font-sans text-sm font-semibold text-zinc-200 block">Auto-generate Shopping Requirements</span>
            <span className="font-sans text-xs text-zinc-500 block">
              Instantly compile groceries directly to Shopping List when pantry stocks fall below set thresholds.
            </span>
          </div>
          <button
            onClick={handleToggleAlerts}
            className="text-zinc-400 hover:text-zinc-200 transition shrink-0"
          >
            {settings.lowStockAlertsEnabled ? (
              <ToggleRight className="h-9 w-9 text-emerald-400" />
            ) : (
              <ToggleLeft className="h-9 w-9 text-zinc-700" />
            )}
          </button>
        </div>

        {/* Numeric input: Threshold expiry */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <label className="block font-sans text-sm font-semibold text-zinc-200">
            Global Expiry Reminder Offset (Days)
          </label>
          <p className="font-sans text-xs text-zinc-500">
            Number of days before an item's expiration day to flag warning states and trigger advising notices.
          </p>
          <div className="flex items-center space-x-3 pt-1">
            <input
              type="number"
              min="1"
              max="30"
              value={settings.expiryReminderDays}
              onChange={handleDaysChange}
              className="w-20 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none transition"
            />
            <span className="font-sans text-xs text-zinc-400 font-medium">days before expiration</span>
          </div>
        </div>

        {/* Customizable Pantry Categories Section */}
        <div className="space-y-4 border-t border-white/5 pt-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            <span className="block font-sans text-sm font-semibold text-zinc-200">
              Pantry Categories Customizer
            </span>
          </div>
          <p className="font-sans text-xs text-zinc-500">
            Customize category tags beyond system defaults to align exactly with your kitchen shelves, cellar layout, or unique items collection.
          </p>

          {/* Form to add a new category */}
          <form onSubmit={handleAddCustomCategory} className="flex flex-col gap-2 pt-1">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., Baking Supplies, Spices, Cellar"
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                className="flex-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 font-sans text-xs text-zinc-100 placeholder-zinc-650 focus:border-emerald-500 focus:outline-none transition"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-4 py-1.5 font-sans text-xs font-bold text-white transition focus:outline-none"
              >
                <Plus className="h-3.5 w-3.5 animate-pulse" />
                Add
              </button>
            </div>
            {errorMsg && (
              <p className="font-sans text-[11px] text-red-400 flex items-center gap-1 mt-0.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMsg}
              </p>
            )}
          </form>

          {/* List of current categories */}
          <div className="space-y-2 mt-2">
            <span className="font-sans text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
              Active Category Inventory
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-52 overflow-y-auto pr-1">
              {/* Default Categories */}
              {DEFAULT_CATEGORIES.map((cat) => (
                <div
                  key={`def-${cat}`}
                  className="flex items-center justify-between rounded-lg bg-white/[0.01] border border-white/5 px-3 py-2 text-zinc-400 group backdrop-blur-sm"
                >
                  <span className="font-sans text-xs font-medium truncate">{cat}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[8px] text-zinc-500 border border-white/5">
                    System
                  </span>
                </div>
              ))}
              {/* Custom Categories */}
              {(settings.customCategories || []).map((cat) => (
                <div
                  key={`cust-${cat}`}
                  className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-emerald-300 group hover:border-emerald-500/40 transition duration-150 backdrop-blur-sm shadow-sm"
                >
                  <span className="font-sans text-xs font-semibold truncate text-emerald-300">{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomCategory(cat)}
                    className="text-zinc-500 hover:text-red-400 p-0.5 rounded transition hover:bg-red-500/10"
                    title={`Delete category "${cat}"`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Simulate Notifications Sandbox */}
        <div className="rounded-xl border border-dashed border-white/10 p-5 mt-6 bg-white/[0.01] space-y-4 backdrop-blur-md shadow-inner">
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-amber-550 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4" />
              Notifications Test Sandbox
            </h4>
            <p className="font-sans text-[11px] text-zinc-400 mt-1 leading-relaxed">
              Since standard web push registration might be restricted in framed iframe sandboxes, utilize these buttons to test our custom mobile notification animations!
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={triggerSimulation}
              disabled={!settings.pushNotificationsEnabled}
              className="rounded-lg bg-white/5 border border-white/10 hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-45 disabled:pointer-events-none px-4 py-2 font-sans text-xs text-zinc-300 transition backdrop-blur-sm"
            >
              Simulate Stock Warning
            </button>

            <button
              onClick={triggerExpirySimulation}
              disabled={!settings.pushNotificationsEnabled}
              className="rounded-lg bg-white/5 border border-white/10 hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-45 disabled:pointer-events-none px-4 py-2 font-sans text-xs text-zinc-300 transition backdrop-blur-sm"
            >
              Simulate Expiry Reminder
            </button>
          </div>
        </div>

        {/* Sandbox Dev Seeder Utility */}
        {onSeedSampleData && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 mt-6 space-y-4 backdrop-blur-md shadow-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    Sandbox Data Seeder
                  </h4>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 font-mono text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">
                    Demo Mode
                  </span>
                </div>
                <p className="font-sans text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Prepopulate this account with exactly <strong className="text-zinc-200">100 high-fidelity sample items</strong> randomly across all sections—30 pantry groceries, 20 shopping items, and 50 consumption logs. Perfect for exploring dynamic cost trends and testing AI recipe suggestion algorithms in seconds!
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-end">
              <button
                onClick={onSeedSampleData}
                disabled={seedingLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none px-5 py-2.5 font-sans text-xs font-bold text-white transition shadow-[0_4px_16px_rgba(16,185,129,0.25)] focus:outline-none"
              >
                {seedingLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Populating 100 Sample Items...
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    Populate 100 Sample Items
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security / Real-time Status indicators */}
        <div className="rounded-lg bg-white/[0.01] p-3.5 border border-white/5 flex items-center gap-3 text-zinc-400 shadow-inner backdrop-blur-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 animate-bounce" />
          <div className="font-sans text-[11px] leading-snug">
            <span className="font-semibold text-zinc-205 block">Zero-Trust Relational Sync Activated</span>
            All database read-write scopes are validated directly inside Firebase Firestore client security rules. Custom client alterations are checked on-the-fly.
          </div>
        </div>
      </div>
    </div>
  );
}
