import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";
import { Camera, RefreshCw, X, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  onProductFound: (product: {
    name: string;
    category: string;
    unit: string;
    barcode: string;
    shelfLifeDays: number;
  }) => void;
  onClose: () => void;
}

const PRESET_BARCODES = [
  { code: "011110038456", name: "Organic Whole Milk", category: "Dairy", unit: "pcs" },
  { code: "049000028904", name: "Coca Cola Sliced Can", category: "Beverages", unit: "cans" },
  { code: "021130070123", name: "Fresh White Sliced Bread", category: "Bakery", unit: "pcs" },
  { code: "021000015525", name: "Heinz Tomato Ketchup", category: "Pantry", unit: "bottles" },
  { code: "037000234567", name: "Dawn Ultra Dishwashing Liquid", category: "Household", unit: "pcs" },
];

export default function BarcodeScanner({ onProductFound, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isQuaggaSupported, setIsQuaggaSupported] = useState(true);

  // Initialize and clean up Quagga
  useEffect(() => {
    let active = true;

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setIsQuaggaSupported(false);
      return;
    }

    const initScanner = async () => {
      setLoading(true);
      setError(null);
      try {
        await Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: scannerRef.current || undefined,
              constraints: {
                width: 640,
                height: 480,
                facingMode: "environment", // Back camera
              },
            },
            decoder: {
              readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "upc_reader",
                "upc_e_reader",
              ],
            },
            locate: true,
          },
          (err) => {
            if (err) {
              console.warn("Quagga initialization warning (handled):", err);
              if (active) {
                setError(
                  "Could not launch camera. Ensure camera permissions are allowed or choose a fast testing preset barcode."
                );
              }
              setLoading(false);
              return;
            }
            if (active) {
              Quagga.start();
              setLoading(false);
            }
          }
        );

        Quagga.onDetected((data) => {
          if (data && data.codeResult && data.codeResult.code) {
            const code = data.codeResult.code;
            console.log("Barcode detected:", code);
            // Stop scanning to prevent multiple triggers
            Quagga.stop();
            handleLookup(code);
          }
        });
      } catch (e: any) {
        console.warn("Camera access warning (handled):", e);
        if (active) {
          setError("Failed to initialize camera feedback. Please utilize presets below.");
        }
        setLoading(false);
      }
    };

    initScanner();

    return () => {
      active = false;
      try {
        Quagga.stop();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const handleLookup = async (barcode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/lookup/${barcode}`);
      if (!res.ok) {
        throw new Error("Product lookup failed");
      }
      const data = await res.json();
      onProductFound({
        name: data.name,
        category: data.category,
        unit: data.unit,
        barcode: barcode,
        shelfLifeDays: data.shelfLifeDays || 14,
      });
    } catch (err: any) {
      setError(err.message || "Product identification failed. Please fill manual parameters.");
    } finally {
      setLoading(false);
    }
  };

  const submitManualCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleLookup(manualCode.trim());
    }
  };

  return (
    <div id="barcode_scanner_modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-emerald-400" />
            <h3 className="font-sans text-lg font-semibold tracking-tight text-zinc-100">
              Smart Barcode Scanner
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative mb-6 flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden min-h-[240px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/70 space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="font-mono text-xs text-zinc-400">Querying Retail Database...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-15 flex flex-col items-center justify-center p-4 bg-zinc-950 text-center">
              <AlertCircle className="mb-2 h-8 w-8 text-amber-500" />
              <p className="font-sans text-xs text-zinc-300 max-w-xs">{error}</p>
            </div>
          )}

          {/* Web camera mounting */}
          <div
            ref={scannerRef}
            className="w-full h-full max-w-xs overflow-hidden rounded-lg [&_video]:w-full [&_video]:h-auto [&_canvas]:hidden select-none"
          />

          {/* Scanning pulsing laser indicator */}
          {!error && !loading && (
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_#10b981] animate-bounce" />
          )}

          {!isQuaggaSupported && (
            <div className="p-4 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
              <p className="font-sans text-xs text-zinc-400">
                Camera access requires HTTPS or secure environments. Use the Quick Presets below to test.
              </p>
            </div>
          )}
        </div>

        {/* Quick presets for developers and UI review */}
        <div className="mb-6">
          <p className="mb-2 font-sans text-xs font-semibold text-zinc-400 flex items-center justify-between">
            <span>⚡ Click to Simulation Scan (Fast Testing Presets)</span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-left">
            {PRESET_BARCODES.map((preset) => (
              <button
                key={preset.code}
                onClick={() => handleLookup(preset.code)}
                className="flex flex-col items-start rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-left hover:border-emerald-500/50 hover:bg-zinc-850 transition"
              >
                <span className="font-sans text-xs font-semibold text-emerald-400 truncate w-full">
                  {preset.name}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">{preset.code}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Barcode input */}
        <form onSubmit={submitManualCode} className="border-t border-zinc-900 pt-4">
          <label className="block mb-1.5 font-sans text-xs font-medium text-zinc-400">
            Manual Barcode Entry (UPC/EAN)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. 012000000133"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 font-sans text-xs text-zinc-100 font-semibold hover:bg-emerald-505 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Identify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
