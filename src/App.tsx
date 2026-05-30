import React, { useEffect, useState } from "react";
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import {
  Layers,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Settings,
  LogIn,
  LogOut,
  Bell,
  CheckCircle,
  AlertTriangle,
  Flame,
  UserCheck,
} from "lucide-react";
import { PantryItem, ShoppingItem, ConsumptionLog, UserSettings } from "./types";
import PantryList from "./components/PantryList";
import ShoppingList from "./components/ShoppingList";
import RecipeSuggester from "./components/RecipeSuggester";
import ConsumptionDashboard from "./components/ConsumptionDashboard";
import SettingsView from "./components/SettingsView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore Synchronized States
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [consumptionLogs, setConsumptionLogs] = useState<ConsumptionLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    userId: "",
    pushNotificationsEnabled: true,
    lowStockAlertsEnabled: true,
    expiryReminderDays: 3,
    updatedAt: new Date().toISOString(),
  });

  // UI Navigation & Alert states
  const [activeTab, setActiveTab] = useState<"pantry" | "shopping" | "recipes" | "trends" | "settings">("pantry");
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [seedingLoading, setSeedingLoading] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time Firestore Sync Engine
  useEffect(() => {
    if (!user) return;

    // 1. Sync UserSettings
    const settingsRef = doc(db, "userSettings", user.uid);
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as UserSettings);
      } else {
        // Construct default settings if not exists
        const defSettings = {
          userId: user.uid,
          pushNotificationsEnabled: true,
          lowStockAlertsEnabled: true,
          expiryReminderDays: 3,
          updatedAt: serverTimestamp(),
        };
        setDoc(settingsRef, defSettings).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `userSettings/${user.uid}`)
        );
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `userSettings/${user.uid}`);
    });

    // 2. Sync Pantry Items
    const pantryQuery = query(collection(db, "pantry"), where("userId", "==", user.uid));
    const unsubPantry = onSnapshot(pantryQuery, (snap) => {
      const items: PantryItem[] = [];
      snap.forEach((d) => items.push(d.data() as PantryItem));
      setPantryItems(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "pantry");
    });

    // 3. Sync Shopping List Items
    const shoppingQuery = query(collection(db, "shoppingList"), where("userId", "==", user.uid));
    const unsubShopping = onSnapshot(shoppingQuery, (snap) => {
      const items: ShoppingItem[] = [];
      snap.forEach((d) => items.push(d.data() as ShoppingItem));
      setShoppingItems(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "shoppingList");
    });

    // 4. Sync Consumption Logs
    const logsQuery = query(collection(db, "consumptionLogs"), where("userId", "==", user.uid));
    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      const logs: ConsumptionLog[] = [];
      snap.forEach((d) => logs.push(d.data() as ConsumptionLog));
      setConsumptionLogs(logs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "consumptionLogs");
    });

    return () => {
      unsubSettings();
      unsubPantry();
      unsubShopping();
      unsubLogs();
    };
  }, [user]);

  // Automated Shopping List generation logic trigger
  useEffect(() => {
    if (!user || !settings.lowStockAlertsEnabled || pantryItems.length === 0) return;

    // Check for low stock items that do not exist yet on shopping list
    pantryItems.forEach(async (item) => {
      if (item.quantity <= item.lowStockThreshold) {
        // Find if this product is already in our shopping list (case insensitive and unchecked)
        const exists = shoppingItems.some(
          (shop) => shop.name.toLowerCase() === item.name.toLowerCase() && !shop.checked
        );

        if (!exists) {
          const shopItemId = `auto_${item.id}`;
          try {
            const existingItem = shoppingItems.find((shop) => shop.id === shopItemId);

            if (existingItem) {
              // If it exists on the list (but is checked), we update it to unchecked state
              // rather than overwriting it via setDoc. This preserves the immutable createdAt field.
              await updateDoc(doc(db, "shoppingList", shopItemId), {
                checked: false,
                updatedAt: serverTimestamp(),
              });
            } else {
              const newItem = {
                id: shopItemId,
                name: item.name,
                quantity: 1, // standard restock increment
                unit: item.unit || "pcs",
                userId: user.uid,
                checked: false,
                autoGenerated: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              await setDoc(doc(db, "shoppingList", shopItemId), newItem);
            }

            // If user has push alerts active, slide down a notification!
            if (settings.pushNotificationsEnabled) {
              triggerToast(
                "🚨 Auto Reorder Activated",
                `Pantry stock of "${item.name}" fell below threshold. Created shopping list line.`
              );
            }
          } catch (e) {
            console.error("Auto shopping reorder sync failed:", e);
            handleFirestoreError(e, OperationType.WRITE, `shoppingList/${shopItemId}`);
          }
        }
      }
    });
  }, [pantryItems, shoppingItems, settings.lowStockAlertsEnabled, user]);

  // Toast banner manager
  const triggerToast = (title: string, body: string) => {
    setToast({ title, body });
    setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  // Google Login popup call
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("SSO Login popup cancelled:", err);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  // Pantry Mutations
  const handleAddPantryItem = async (
    item: Omit<PantryItem, "id" | "userId" | "createdAt" | "updatedAt">
  ) => {
    if (!user) return;
    const docId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem = {
      ...item,
      id: docId,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "pantry", docId), newItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pantry/${docId}`);
    }
  };

  const handleUpdatePantryQty = async (itemId: string, newQty: number) => {
    try {
      await updateDoc(doc(db, "pantry", itemId), {
        quantity: Math.max(0, newQty),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pantry/${itemId}`);
    }
  };

  const handleDeletePantryItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "pantry", itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `pantry/${itemId}`);
    }
  };

  const handleLogConsumption = async (
    itemName: string,
    quantity: number,
    action: "consumed" | "expired" | "wasted" | "purchased"
  ) => {
    if (!user) return;
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLog = {
      id: logId,
      userId: user.uid,
      itemName,
      quantity,
      action,
      createdAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "consumptionLogs", logId), newLog);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `consumptionLogs/${logId}`);
    }
  };

  // Shopping Mutations
  const handleAddShoppingItem = async (item: { name: string; quantity: number; unit: string }) => {
    if (!user) return;
    const shopId = `shop_${Date.now()}`;
    const newItem = {
      id: shopId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      userId: user.uid,
      checked: false,
      autoGenerated: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "shoppingList", shopId), newItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shoppingList/${shopId}`);
    }
  };

  const handleToggleShoppingChecked = async (itemId: string, checked: boolean) => {
    try {
      await updateDoc(doc(db, "shoppingList", itemId), {
        checked,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shoppingList/${itemId}`);
    }
  };

  const handleDeleteShoppingItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "shoppingList", itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shoppingList/${itemId}`);
    }
  };

  // Checkout Selected Basket -> Purchases are ported back into pantry and logged
  const handleCheckoutCheckedItems = async () => {
    if (!user) return;
    const checked = shoppingItems.filter((item) => item.checked);
    if (checked.length === 0) return;

    try {
      // Loop over and push to pantry or increment existing pantry item with same name
      for (const shop of checked) {
        const matchingPantry = pantryItems.find(
          (p) => p.name.toLowerCase() === shop.name.toLowerCase()
        );

        if (matchingPantry) {
          // Increment existing qty in pantry
          await updateDoc(doc(db, "pantry", matchingPantry.id), {
            quantity: matchingPantry.quantity + shop.quantity,
            updatedAt: serverTimestamp(),
          });
        } else {
          // Create new pantry document
          const newPantryId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newPantry = {
            id: newPantryId,
            name: shop.name,
            quantity: shop.quantity,
            unit: shop.unit,
            lowStockThreshold: 1,
            category: "Pantry",
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, "pantry", newPantryId), newPantry);
        }

        // Log transaction history as purchased
        await handleLogConsumption(shop.name, shop.quantity, "purchased");

        // Delete from shopping list list page
        await deleteDoc(doc(db, "shoppingList", shop.id));
      }

      triggerToast("🛍️ Shopping Cart Checked Out!", "Successfully restocked pantry with checked purchases.");
    } catch (err) {
      console.error(err);
    }
  };

  // Recipe Suggester missing ingredients helper
  const handleAddRecipeMissingToShoppingList = async (
    items: { name: string; quantity: number; unit: string }[]
  ) => {
    if (!user) return;
    try {
      for (const item of items) {
        const exists = shoppingItems.some(
          (s) => s.name.toLowerCase() === item.name.toLowerCase() && !s.checked
        );
        if (!exists) {
          await handleAddShoppingItem(item);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Settings Mutation
  const handleUpdateSettings = async (partialSettings: Partial<UserSettings>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "userSettings", user.uid), {
        ...partialSettings,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userSettings/${user.uid}`);
    }
  };

  // Sandbox Data Seeder
  const handleSeedSampleData = async () => {
    if (!user) return;
    setSeedingLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Queue deletion of existing pantry items
      pantryItems.forEach((item) => {
        batch.delete(doc(db, "pantry", item.id));
      });

      // 2. Queue deletion of existing shopping items
      shoppingItems.forEach((item) => {
        batch.delete(doc(db, "shoppingList", item.id));
      });

      const now = Date.now();

      // 3. Define 30 pristine custom pantry items
      const pantrySeeds = [
        // Dairy
        { id: "pantry_seed_dairy_1", name: "Organic Whole Milk", quantity: 2, unit: "cartons", category: "Dairy", lowStockThreshold: 1, expiryDate: new Date(now + 2 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_dairy_2", name: "Greek Yogurt Honey", quantity: 6, unit: "cups", category: "Dairy", lowStockThreshold: 2, expiryDate: new Date(now + 12 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_dairy_3", name: "Grass-fed Salted Butter", quantity: 3, unit: "blocks", category: "Dairy", lowStockThreshold: 1 },
        { id: "pantry_seed_dairy_4", name: "Sharp Cheddar Cheese", quantity: 0, unit: "pcs", category: "Dairy", lowStockThreshold: 1 },
        { id: "pantry_seed_dairy_5", name: "Half & Half Creamer", quantity: 1, unit: "bottles", category: "Dairy", lowStockThreshold: 1, expiryDate: new Date(now - 1 * 24 * 3600 * 1000).toISOString() },

        // Produce
        { id: "pantry_seed_produce_1", name: "Organic Bananas Bunch", quantity: 1, unit: "bunch", category: "Produce", lowStockThreshold: 1, expiryDate: new Date(now + 1 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_produce_2", name: "Fresh Baby Spinach", quantity: 1, unit: "bag", category: "Produce", lowStockThreshold: 1, expiryDate: new Date(now - 2 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_produce_3", name: "Avocados (Medium)", quantity: 4, unit: "pcs", category: "Produce", lowStockThreshold: 2, expiryDate: new Date(now + 3 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_produce_4", name: "Sweet Gala Apples", quantity: 8, unit: "pcs", category: "Produce", lowStockThreshold: 3, expiryDate: new Date(now + 15 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_produce_5", name: "Red Bell Peppers", quantity: 0, unit: "pcs", category: "Produce", lowStockThreshold: 2 },

        // Bakery
        { id: "pantry_seed_bakery_1", name: "Whole Wheat Bread", quantity: 1, unit: "loaves", category: "Bakery", lowStockThreshold: 1, expiryDate: new Date(now + 2 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_bakery_2", name: "Flour Tortilla Wraps", quantity: 12, unit: "pcs", category: "Bakery", lowStockThreshold: 4, expiryDate: new Date(now + 20 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_bakery_3", name: "Brioche Burger Buns", quantity: 2, unit: "pcs", category: "Bakery", lowStockThreshold: 4 },

        // Meat & Seafood
        { id: "pantry_seed_meat_1", name: "Boneless Chicken Breast", quantity: 2, unit: "lbs", category: "Meat & Seafood", lowStockThreshold: 1, expiryDate: new Date(now + 3 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_meat_2", name: "Norwegian Salmon Fillet", quantity: 1, unit: "lbs", category: "Meat & Seafood", lowStockThreshold: 1, expiryDate: new Date(now - 3 * 24 * 3600 * 1000).toISOString() },
        { id: "pantry_seed_meat_3", name: "Lean Ground Beef", quantity: 3, unit: "lbs", category: "Meat & Seafood", lowStockThreshold: 1 },

        // Pantry
        { id: "pantry_seed_dry_1", name: "Heinz Tomato Ketchup", quantity: 1, unit: "bottles", category: "Pantry", lowStockThreshold: 2 },
        { id: "pantry_seed_dry_2", name: "Barilla Penne Rigate", quantity: 5, unit: "boxes", category: "Pantry", lowStockThreshold: 1 },
        { id: "pantry_seed_dry_3", name: "Jasmine Rice Bag", quantity: 1, unit: "bags", category: "Pantry", lowStockThreshold: 1 },
        { id: "pantry_seed_dry_4", name: "Canned Tomato Sauce", quantity: 0, unit: "cans", category: "Pantry", lowStockThreshold: 2 },
        { id: "pantry_seed_dry_5", name: "Extra Virgin Olive Oil", quantity: 1, unit: "bottles", category: "Pantry", lowStockThreshold: 1 },

        // Beverages
        { id: "pantry_seed_bever_1", name: "Sparkling Lemon Water", quantity: 12, unit: "cans", category: "Beverages", lowStockThreshold: 6 },
        { id: "pantry_seed_bever_2", name: "Whole Bean Dark Roast", quantity: 2, unit: "bags", category: "Beverages", lowStockThreshold: 1 },
        { id: "pantry_seed_bever_3", name: "Matcha Green Tea", quantity: 1, unit: "boxes", category: "Beverages", lowStockThreshold: 1 },

        // Frozen
        { id: "pantry_seed_frozen_1", name: "Frozen Wild Blueberry", quantity: 3, unit: "bags", category: "Frozen", lowStockThreshold: 1 },
        { id: "pantry_seed_frozen_2", name: "Crust Frozen Cheese Pizza", quantity: 1, unit: "pcs", category: "Frozen", lowStockThreshold: 1 },

        // Household
        { id: "pantry_seed_house_1", name: "Eco Dishwashing Liquid", quantity: 2, unit: "bottles", category: "Household", lowStockThreshold: 1 },
        { id: "pantry_seed_house_2", name: "Paper Towels Multi-roll", quantity: 1, unit: "packs", category: "Household", lowStockThreshold: 2 },
        { id: "pantry_seed_house_3", name: "Lavender Detergent Pods", quantity: 45, unit: "pods", category: "Household", lowStockThreshold: 10 },
        { id: "pantry_seed_house_4", name: "Multi-surface Cleaner", quantity: 1, unit: "bottles", category: "Household", lowStockThreshold: 1 }
      ];

      pantrySeeds.forEach((item) => {
        const docRef = doc(db, "pantry", item.id);
        batch.set(docRef, {
          ...item,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // 4. Define 20 Shopping list items (10 Checked, 10 Unchecked)
      const shoppingSeeds = [
        // Checked (historically bought)
        { id: "shop_seed_1", name: "Greek Yogurt Honey", quantity: 4, unit: "cups", checked: true, autoGenerated: false },
        { id: "shop_seed_2", name: "Grass-fed Salted Butter", quantity: 2, unit: "blocks", checked: true, autoGenerated: false },
        { id: "shop_seed_3", name: "Whole Wheat Bread", quantity: 1, unit: "loaves", checked: true, autoGenerated: false },
        { id: "shop_seed_4", name: "Sweet Gala Apples", quantity: 6, unit: "pcs", checked: true, autoGenerated: false },
        { id: "shop_seed_5", name: "Heinz Tomato Ketchup", quantity: 1, unit: "bottles", checked: true, autoGenerated: true },
        { id: "shop_seed_6", name: "Eco Dishwashing Liquid", quantity: 1, unit: "bottles", checked: true, autoGenerated: false },
        { id: "shop_seed_7", name: "Barilla Penne Rigate", quantity: 3, unit: "boxes", checked: true, autoGenerated: false },
        { id: "shop_seed_8", name: "Jasmine Rice Bag", quantity: 1, unit: "bags", checked: true, autoGenerated: false },
        { id: "shop_seed_9", name: "Whole Bean Dark Roast", quantity: 1, unit: "bags", checked: true, autoGenerated: true },
        { id: "shop_seed_10", name: "Frozen Wild Blueberry", quantity: 2, unit: "bags", checked: true, autoGenerated: false },

        // Unchecked (active requirements)
        { id: "shop_seed_11", name: "Sharp Cheddar Cheese", quantity: 2, unit: "blocks", checked: false, autoGenerated: true },
        { id: "shop_seed_12", name: "Red Bell Peppers", quantity: 3, unit: "pcs", checked: false, autoGenerated: true },
        { id: "shop_seed_13", name: "Brioche Burger Buns", quantity: 1, unit: "pcs", checked: false, autoGenerated: true },
        { id: "shop_seed_14", name: "Paper Towels Multi-roll", quantity: 1, unit: "packs", checked: false, autoGenerated: true },
        { id: "shop_seed_15", name: "Canned Tomato Sauce", quantity: 3, unit: "cans", checked: false, autoGenerated: true },
        { id: "shop_seed_16", name: "Fresh Strawberries Box", quantity: 2, unit: "boxes", checked: false, autoGenerated: false },
        { id: "shop_seed_17", name: "Whole Organic Garlic", quantity: 3, unit: "pcs", checked: false, autoGenerated: false },
        { id: "shop_seed_18", name: "Spaghetti Pasta Barilla", quantity: 2, unit: "boxes", checked: false, autoGenerated: false },
        { id: "shop_seed_19", name: "All-purpose Flour", quantity: 1, unit: "bags", checked: false, autoGenerated: false },
        { id: "shop_seed_20", name: "Grade-A Organic Large Eggs", quantity: 1, unit: "cartons", checked: false, autoGenerated: false }
      ];

      shoppingSeeds.forEach((item) => {
        const docRef = doc(db, "shoppingList", item.id);
        batch.set(docRef, {
          ...item,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // 5. Define 50 Consumption Logs (with realistic items, diverse categories, and actions)
      const logsBase = [
        { name: "Organic Whole Milk", action: "consumed", qty: 2 },
        { name: "Organic Whole Milk", action: "expired", qty: 1 },
        { name: "Organic Whole Milk", action: "purchased", qty: 3 },
        { name: "Greek Yogurt Honey", action: "consumed", qty: 4 },
        { name: "Greek Yogurt Honey", action: "purchased", qty: 6 },
        { name: "Sweet Gala Apples", action: "consumed", qty: 5 },
        { name: "Sweet Gala Apples", action: "expired", qty: 2 },
        { name: "Organic Bananas Bunch", action: "consumed", qty: 4 },
        { name: "Organic Bananas Bunch", action: "expired", qty: 3 },
        { name: "Fresh Baby Spinach", action: "consumed", qty: 1 },
        { name: "Fresh Baby Spinach", action: "expired", qty: 1 },
        { name: "Fresh Baby Spinach", action: "wasted", qty: 1 },
        { name: "Avocados (Medium)", action: "consumed", qty: 3 },
        { name: "Avocados (Medium)", action: "wasted", qty: 1 },
        { name: "Whole Wheat Bread", action: "consumed", qty: 2 },
        { name: "Whole Wheat Bread", action: "expired", qty: 1 },
        { name: "Whole Wheat Bread", action: "purchased", qty: 2 },
        { name: "Brioche Burger Buns", action: "consumed", qty: 4 },
        { name: "Brioche Burger Buns", action: "expired", qty: 2 },
        { name: "Boneless Chicken Breast", action: "consumed", qty: 3 },
        { name: "Boneless Chicken Breast", action: "purchased", qty: 4 },
        { name: "Norwegian Salmon Fillet", action: "consumed", qty: 2 },
        { name: "Norwegian Salmon Fillet", action: "expired", qty: 1 },
        { name: "Norwegian Salmon Fillet", action: "wasted", qty: 1 },
        { name: "Lean Ground Beef", action: "consumed", qty: 2 },
        { name: "Lean Ground Beef", action: "purchased", qty: 3 },
        { name: "Heinz Tomato Ketchup", action: "consumed", qty: 1 },
        { name: "Heinz Tomato Ketchup", action: "purchased", qty: 2 },
        { name: "Barilla Penne Rigate", action: "consumed", qty: 3 },
        { name: "Barilla Penne Rigate", action: "purchased", qty: 4 },
        { name: "Jasmine Rice Bag", action: "consumed", qty: 1 },
        { name: "Jasmine Rice Bag", action: "purchased", qty: 1 },
        { name: "Sparkling Lemon Water", action: "consumed", qty: 24 },
        { name: "Sparkling Lemon Water", action: "purchased", qty: 12 },
        { name: "Whole Bean Dark Roast", action: "consumed", qty: 1 },
        { name: "Whole Bean Dark Roast", action: "purchased", qty: 2 },
        { name: "Frozen Wild Blueberry", action: "consumed", qty: 2 },
        { name: "Frozen Wild Blueberry", action: "purchased", qty: 2 },
        { name: "Crust Frozen Cheese Pizza", action: "consumed", qty: 2 },
        { name: "Lavender Detergent Pods", action: "consumed", qty: 15 },
        { name: "Lavender Detergent Pods", action: "purchased", qty: 45 },
        { name: "Grass-fed Salted Butter", action: "consumed", qty: 2 },
        { name: "Sharp Cheddar Cheese", action: "consumed", qty: 1 },
        { name: "Red Bell Peppers", action: "consumed", qty: 2 },
        { name: "Red Bell Peppers", action: "expired", qty: 1 },
        { name: "Fresh Strawberries Box", action: "consumed", qty: 1 },
        { name: "Fresh Strawberries Box", action: "wasted", qty: 1 },
        { name: "Whole Organic Garlic", action: "consumed", qty: 2 },
        { name: "Grade-A Organic Large Eggs", action: "consumed", qty: 12 },
        { name: "Greek Yogurt Honey", action: "purchased", qty: 4 }
      ];

      logsBase.forEach((log, index) => {
        const logId = `log_seed_${index}_${Math.random().toString(36).substring(2, 6)}`;
        const docRef = doc(db, "consumptionLogs", logId);

        batch.set(docRef, {
          id: logId,
          userId: user.uid,
          itemName: log.name,
          quantity: log.qty,
          action: log.action as any,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      triggerToast("✅ Database Populated Successfully", `Seeded 30 pantry items, 20 shopping requirements, and 50 consumption events (100 total) under ${user.displayName || user.email}!`);
    } catch (err: any) {
      console.error(err);
      triggerToast("❌ Seeding Failure", err.message || "An error occurred during seeding. Verify firebase connection.");
    } finally {
      setSeedingLoading(false);
    }
  };

  // Compute reactive counts for Navigation badges
  const expiredCount = pantryItems.filter((i) => {
    if (!i.expiryDate) return false;
    return new Date(i.expiryDate).getTime() < Date.now();
  }).length;

  const lowStockCount = pantryItems.filter((i) => i.quantity <= i.lowStockThreshold).length;

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="text-center space-y-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-550 border-t-transparent" />
          <p className="font-mono text-xs text-zinc-400">Synchronizing Intellikitchen parameters...</p>
        </div>
      </div>
    );
  }

  // Welcome Portal
  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 selection:bg-emerald-500/30">
        {/* Ambient Grid overlay backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#09090b_1px,transparent_1px),linear-gradient(to_bottom,#09090b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />

        <div className="relative w-full max-w-xl text-center z-10">
          {/* Main Hero Header */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-555/5 px-4.5 py-1.5 text-xs text-emerald-400 font-semibold mb-6">
            <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse fill-emerald-500/20" />
            Zero-Waste Smart Inventory Manager
          </div>

          <h1 className="font-sans text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Intelikitchen Dashboard
          </h1>

          <p className="mt-4 font-sans text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Unify your pantry inventory, synchronize grocery requirements dynamically, identify barcode UPC products instantly, and rescue expiring assets with server-side Gemini AI.
          </p>

          {/* Core Feature Bento bullet showcases */}
          <div className="grid gap-3.5 grid-cols-2 mt-8 text-left max-w-lg mx-auto text-xs text-zinc-400">
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/80 p-4">
              <span className="font-sans font-bold text-zinc-200 block mb-1">🔄 Real-time Cloud Sync</span>
              Synchronized cross-device Firestore engine. Stock alterations propagate instantly.
            </div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/80 p-4">
              <span className="font-sans font-bold text-zinc-200 block mb-1">🤖 AI Zero-Waste Chef</span>
              Suggests custom meal recipes focusing heavily on inventory items wrapping up expiry limits.
            </div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/80 p-4">
              <span className="font-sans font-bold text-zinc-200 block mb-1">📸 Barcode Scan Engine</span>
              Parse UPC grocery codes using live device camera streams to identify items dynamically.
            </div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/80 p-4">
              <span className="font-sans font-bold text-zinc-200 block mb-1">📈 Analytics & Habits</span>
              Identify food cost ratios, overall salvage statistics, and optimize grocery purchases.
            </div>
          </div>

          {/* Social login action */}
          <div className="mt-8 border-t border-zinc-900 pt-6">
            <button
              onClick={handleLogin}
              className="mx-auto flex items-center justify-center gap-3.5 rounded-xl bg-zinc-100 px-6 py-3.5 font-sans text-sm text-zinc-900 font-bold hover:bg-white active:scale-[0.98] transition shadow-[0_4px_24px_rgba(255,255,255,0.1)] outline-none"
            >
              <LogIn className="h-5 w-5 fill-zinc-900" />
              Sign in with Google SSO
            </button>
            <p className="mt-3 font-sans text-[10px] text-zinc-650">
              Secured on cool-photon Firebase Authentication nodes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Layout
  return (
    <div className="relative min-h-screen bg-[#07070a] text-zinc-100 font-sans flex flex-col justify-between selection:bg-emerald-500/30 overflow-hidden">
      {/* Absolute blurring glowing visual anchors for extreme glassmorphism depth */}
      <div className="absolute top-1/4 left-10 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse duration-[6000ms]" />
      <div className="absolute top-1/2 right-12 w-[400px] h-[400px] rounded-full bg-teal-500/5 blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[160px] pointer-events-none -z-10 animate-pulse duration-[8000ms]" />

      {/* 1. Descending Alert Notification Simulator */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-slideDown pointer-events-none">
          <div className="flex items-start gap-3 rounded-2xl bg-zinc-950/75 border border-white/10 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.67)] backdrop-blur-xl pointer-events-auto">
            <Bell className="mt-0.5 h-5 w-5 text-amber-500 animate-bounce shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-zinc-100 flex items-center justify-between">
                <span>{toast.title}</span>
                <span className="font-mono text-[9px] text-zinc-500 uppercase">Interactive simulation ● now</span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{toast.body}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Main Header navigation rail */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07070a]/65 backdrop-blur-xl shadow-lg">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/10 border border-emerald-500/20 shadow-[0_0_12px_#10b98133]">
                <Flame className="h-5 w-5 text-emerald-400 fill-emerald-400/20 animate-pulse" />
              </div>
              <div>
                <h1 className="font-sans text-sm font-black tracking-tight text-white uppercase sm:text-base">
                  Intelikitchen
                </h1>
                <p className="font-mono text-[9px] text-emerald-400/80 uppercase tracking-widest font-bold">
                  Cloud Inventory Tracker
                </p>
              </div>
            </div>

            {/* Profile Sign-out user details */}
            <div className="flex items-center space-x-4">
              <div className="hidden items-center space-x-2 rounded-full border border-white/5 bg-white/5 backdrop-blur-md py-1 pl-1.5 pr-3 sm:flex">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="pfp" className="h-5 w-5 rounded-full border border-zinc-800" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300 font-bold uppercase border border-white/5">
                    {user.email?.slice(0, 1)}
                  </div>
                )}
                <span className="font-sans text-[11px] text-zinc-300 font-semibold truncate max-w-[120px]">
                  {user.displayName || user.email}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-rose-400 transition"
                title="Log out of system"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Categories Tab selector bar */}
        <nav className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5 backdrop-blur-md shadow-lg">
            <button
              onClick={() => setActiveTab("pantry")}
              className={`flex items-center gap-1.5 rounded-lg px-4.5 py-2.5 font-sans text-xs font-semibold tracking-wide transition-all ${
                activeTab === "pantry"
                  ? "bg-white/10 text-emerald-400 font-bold border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-sm"
                  : "text-zinc-405 hover:text-zinc-200 hover:bg-white/[0.02]"
              }`}
            >
              <Layers className="h-4 w-4" />
              Pantry Inventory
              {(expiredCount > 0 || lowStockCount > 0) && (
                <span className="h-2 w-2 rounded-full bg-amber-500 inline-block animate-ping shrink-0" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("shopping")}
              className={`flex items-center gap-1.5 rounded-lg px-4.5 py-2.5 font-sans text-xs font-semibold tracking-wide transition-all relative ${
                activeTab === "shopping"
                  ? "bg-white/10 text-emerald-400 font-bold border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-sm"
                  : "text-zinc-405 hover:text-zinc-200 hover:bg-white/[0.02]"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Shopping List
              {shoppingItems.filter((i) => !i.checked).length > 0 && (
                <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400 font-bold">
                  {shoppingItems.filter((i) => !i.checked).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("recipes")}
              className={`flex items-center gap-1.5 rounded-lg px-4.5 py-2.5 font-sans text-xs font-semibold tracking-wide transition-all ${
                activeTab === "recipes"
                  ? "bg-white/10 text-emerald-400 font-bold border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-sm"
                  : "text-zinc-405 hover:text-zinc-200 hover:bg-white/[0.02]"
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-400 fill-amber-400/15 animate-pulse" />
              AI Recipe Suggestion
            </button>

            <button
              onClick={() => setActiveTab("trends")}
              className={`flex items-center gap-1.5 rounded-lg px-4.5 py-2.5 font-sans text-xs font-semibold tracking-wide transition-all ${
                activeTab === "trends"
                  ? "bg-white/10 text-emerald-400 font-bold border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-sm"
                  : "text-zinc-405 hover:text-zinc-200 hover:bg-white/[0.02]"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Cost & Waste Report
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 rounded-lg px-4.5 py-2.5 font-sans text-xs font-semibold tracking-wide transition-all ${
                activeTab === "settings"
                  ? "bg-white/10 text-emerald-400 font-bold border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-sm"
                  : "text-zinc-450 hover:text-zinc-200 hover:bg-white/[0.02]"
              }`}
            >
              <Settings className="h-4 w-4" />
              Alert thresholds
            </button>
          </div>
        </nav>

        {/* Main dynamic core layout workspace */}
        <main className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          {activeTab === "pantry" && (
            <PantryList
              items={pantryItems}
              onAddItem={handleAddPantryItem}
              onUpdateQty={handleUpdatePantryQty}
              onDeleteItem={handleDeletePantryItem}
              onLogAction={handleLogConsumption}
              customCategories={settings.customCategories}
            />
          )}

          {activeTab === "shopping" && (
            <ShoppingList
              items={shoppingItems}
              onAddItem={handleAddShoppingItem}
              onToggleChecked={handleToggleShoppingChecked}
              onDeleteItem={handleDeleteShoppingItem}
              onCheckoutChecked={handleCheckoutCheckedItems}
            />
          )}

          {activeTab === "recipes" && (
            <RecipeSuggester
              pantryItems={pantryItems}
              onAddMissingToShoppingList={handleAddRecipeMissingToShoppingList}
            />
          )}

          {activeTab === "trends" && <ConsumptionDashboard logs={consumptionLogs} />}

          {activeTab === "settings" && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onTriggerTestNotification={triggerToast}
              onSeedSampleData={handleSeedSampleData}
              seedingLoading={seedingLoading}
            />
          )}
        </main>
      </div>

      {/* Humble Footer indicators */}
      <footer className="mx-auto max-w-6xl w-full px-4 py-8 sm:px-6 text-center border-t border-white/5 mt-12 bg-white/[0.01] backdrop-blur-sm rounded-t-xl">
        <p className="font-sans text-[10px] text-zinc-500 leading-snug">
          Intelikitchen Sync Engine ● Cloud Run Container Node
        </p>
        <p className="font-mono text-[9px] text-zinc-700 mt-1.5">
          API User-Agent header: aistudio-build | Database version Enterprise Spark Edition
        </p>
      </footer>
    </div>
  );
}
