import React, { useState } from "react";
import { Sparkles, Clock, CircleAlert, CheckCircle2, ShoppingBasket, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";
import { PantryItem, RecipeSuggestion } from "../types";

interface RecipeSuggesterProps {
  pantryItems: PantryItem[];
  onAddMissingToShoppingList: (items: { name: string; quantity: number; unit: string }[]) => void;
}

export default function RecipeSuggester({ pantryItems, onAddMissingToShoppingList }: RecipeSuggesterProps) {
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter items expiring in the next 4 days to highlight
  const expiringSoonItems = pantryItems.filter((item) => {
    if (!item.expiryDate) return false;
    const expires = new Date(item.expiryDate);
    const now = new Date();
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 4;
  });

  const generateRecipes = async () => {
    if (pantryItems.length === 0) {
      setError("Please add some items to your pantry first so Gemini can suggest recipes based on your stock.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch suggestions");
      }

      setRecipes(data.recipes || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while consulting the AI Chef.");
    } finally {
      setLoading(false);
    }
  };

  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  const handlePushToShoppingList = (recipe: RecipeSuggestion) => {
    if (recipe.additionalIngredientsNeeded.length === 0) return;

    const listItems = recipe.additionalIngredientsNeeded.map((ing) => {
      // Clean up standard ingredients parsing if possible
      return {
        name: ing,
        quantity: 1,
        unit: "pcs",
      };
    });

    onAddMissingToShoppingList(listItems);
    setAddedFeedback(`Appended ${listItems.length} missing ingredients to your grocery list!`);
    setTimeout(() => {
      setAddedFeedback(null);
    }, 4000);
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl shadow-lg relative">
      {/* Non-blocking feedback banner */}
      {addedFeedback && (
        <div className="absolute top-4 right-4 z-50 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 font-sans text-xs text-emerald-400 font-semibold animate-fadeIn shadow-lg backdrop-blur-md flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {addedFeedback}
        </div>
      )}

      {/* Upper Status Bar */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400 fill-amber-400/20" />
            Zero-Waste Recipe Suggestions
          </h2>
          <p className="font-sans text-xs text-zinc-400">
            Suggests delicious meals using ingredients that are expiring soon to reduce food waste.
          </p>
        </div>

        <button
          onClick={generateRecipes}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 font-sans text-xs font-semibold text-zinc-100 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition whitespace-nowrap shadow-[0_4px_16px_rgba(16,185,129,0.25)]"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              AI Chef is thinking...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Suggest Expiring Meals
            </>
          )}
        </button>
      </div>

      {expiringSoonItems.length > 0 && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-amber-300 backdrop-blur-sm">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="font-sans text-xs">
            <span className="font-semibold text-amber-200">Alert:</span> You have{" "}
            <span className="font-bold underline text-amber-200">{expiringSoonItems.length} items expiring soon</span> (
            {expiringSoonItems.map((i) => i.name).join(", ")}). Use the suggesting tool to rescue this food, save
            money, and minimize waste!
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/25 bg-red-500/5 p-4 text-center">
          <p className="font-sans text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid gap-6 md:grid-cols-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4 shadow-md backdrop-blur-sm">
              <div className="h-4 w-3/4 rounded bg-white/5" />
              <div className="h-3 w-1/4 rounded bg-white/5" />
              <div className="space-y-2 pt-2">
                <div className="h-2 rounded bg-white/5" />
                <div className="h-2 rounded bg-white/5" />
                <div className="h-2 w-5/6 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggestion Cards */}
      {!loading && recipes.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          {recipes.map((recipe, index) => (
            <div
              key={index}
              className="flex flex-col justify-between rounded-xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-md hover:border-white/10 hover:bg-white/[0.05] hover:scale-[1.01] transition-all duration-200 shadow-lg"
            >
              <div>
                {/* Score and Time Header */}
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-1 border border-white/5 rounded-lg bg-white/5 px-2 py-1 font-sans text-[11px] text-zinc-350">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{recipe.estimatedTime}</span>
                  </div>

                  {/* Circular/Text Gauge for Waste Impact */}
                  <div className="flex items-center space-x-1.5" title="Gemini Waste Rescue Score">
                    <span className="font-sans text-[10px] text-zinc-500 uppercase font-semibold">Rescue:</span>
                    <span
                      className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                        recipe.wasteImpactScore > 80
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                          : recipe.wasteImpactScore > 50
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          : "bg-white/5 text-zinc-400 border border-white/5"
                      }`}
                    >
                      {recipe.wasteImpactScore}%
                    </span>
                  </div>
                </div>

                {/* Recipe Title */}
                <h3 className="mb-4 font-sans text-base font-bold tracking-tight text-zinc-100 line-clamp-1">
                  {recipe.title}
                </h3>

                {/* Ingredients available */}
                <div className="mb-4 space-y-2">
                  <span className="font-sans text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                    Rescued from Pantry
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {recipe.ingredientsUsed.map((ing, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 font-sans text-xs text-teal-400"
                      >
                        <CheckCircle2 className="h-3 w-3 text-teal-400" />
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Ingredients Needed */}
                <div className="mb-4 space-y-2">
                  <span className="font-sans text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                    Additionally Needed
                  </span>
                  {recipe.additionalIngredientsNeeded.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {recipe.additionalIngredientsNeeded.map((ing, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-sans text-xs text-amber-400"
                        >
                          <ShoppingBasket className="h-3 w-3 text-amber-400" />
                          {ing}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="font-sans text-xs text-emerald-400 italic block">None! Fully stocked. 🎉</span>
                  )}
                </div>

                {/* Instructions index */}
                <div className="mb-5 border-t border-white/5 pt-3 space-y-1.5">
                  <span className="font-sans text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                    Quick Steps
                  </span>
                  <ol className="list-decimal pl-4 font-sans text-xs text-zinc-400 space-y-1">
                    {recipe.instructions.slice(0, 3).map((step, i) => (
                      <li key={i} className="line-clamp-1">
                        {step}
                      </li>
                    ))}
                    {recipe.instructions.length > 3 && (
                      <li className="list-none font-mono text-[10px] text-zinc-500 italic">
                        +{recipe.instructions.length - 3} more steps
                      </li>
                    )}
                  </ol>
                </div>
              </div>

              {/* Action purchase */}
              {recipe.additionalIngredientsNeeded.length > 0 && (
                <button
                  onClick={() => handlePushToShoppingList(recipe)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 py-2 font-sans text-xs font-semibold text-zinc-350 hover:border-emerald-500 hover:text-emerald-400 hover:bg-white/10 transition backdrop-blur-sm shadow-sm"
                >
                  Add Missing to Shopping List
                  <ArrowRight className="h-3.5 w-3.5 animate-pulse" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md py-16 text-center text-zinc-500 shadow-md">
          <Sparkles className="mb-2 h-10 w-10 text-zinc-700 animate-pulse" />
          <p className="font-sans text-sm font-semibold text-zinc-450">No recipes generated yet.</p>
          <p className="font-sans text-xs max-w-xs mt-1 text-zinc-600">
            Press the "Suggest Expiring Meals" button above, and Gemini will analyze your stock to form 3 customizable zero-waste dishes.
          </p>
        </div>
      )}
    </div>
  );
}
