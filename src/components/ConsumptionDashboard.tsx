import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, Trash2, CheckCircle, Percent, BarChart3, HelpCircle } from "lucide-react";
import { ConsumptionLog, parseFirestoreDate } from "../types";

interface ConsumptionDashboardProps {
  logs: ConsumptionLog[];
}

const COLORS = {
  consumed: "#10b981", // green
  expired: "#ef4444", // red
  wasted: "#f59e0b", // amber
  purchased: "#3b82f6", // blue
};

export default function ConsumptionDashboard({ logs }: ConsumptionDashboardProps) {
  // Aggregate data for Pie Chart (Actions Breakdown)
  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + log.quantity;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: "Consumed", value: actionCounts.consumed || 0, color: COLORS.consumed },
    { name: "Expired & Tossed", value: actionCounts.expired || 0, color: COLORS.expired },
    { name: "Avoidable Waste", value: actionCounts.wasted || 0, color: COLORS.wasted },
    { name: "New Purchases", value: actionCounts.purchased || 0, color: COLORS.purchased },
  ].filter((item) => item.value > 0);

  // Aggregate data for Trends over time (group by date)
  const logsByDate = logs.reduce((acc, log) => {
    const dateStr = log.createdAt ? parseFirestoreDate(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Unknown";
    if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, consumed: 0, expired: 0, purchased: 0 };
    }
    if (log.action === "consumed") acc[dateStr].consumed += log.quantity;
    if (log.action === "expired" || log.action === "wasted") acc[dateStr].expired += log.quantity;
    if (log.action === "purchased") acc[dateStr].purchased += log.quantity;
    return acc;
  }, {} as Record<string, { date: string; consumed: number; expired: number; purchased: number }>);

  const trendData = Object.values(logsByDate).slice(-7); // take last 7 logged days

  // Compute stats
  const totalConsumed = actionCounts.consumed || 0;
  const totalWasted = (actionCounts.expired || 0) + (actionCounts.wasted || 0);
  const totalPurchased = actionCounts.purchased || 0;
  const grandTotal = totalConsumed + totalWasted;
  const salvageRate = grandTotal > 0 ? Math.round((totalConsumed / grandTotal) * 100) : 100;

  // Render bento cards
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-sans text-xs font-semibold">Items Saved & Eaten</span>
            <CheckCircle className="h-4 w-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-zinc-100">{totalConsumed}</div>
          <p className="font-sans text-[10px] text-emerald-450 mt-1">Successfully consumed</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-sans text-xs font-semibold">Spoiled & Expired</span>
            <Trash2 className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-zinc-100">{totalWasted}</div>
          <p className="font-sans text-[10px] text-rose-400 mt-1">Avoidable food loss</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-sans text-xs font-semibold">Food Rescue Index</span>
            <Percent className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-zinc-100">{salvageRate}%</div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full"
              style={{ width: `${salvageRate}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="font-sans text-xs font-semibold">Logged Purchases</span>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-zinc-100">{totalPurchased}</div>
          <p className="font-sans text-[10px] text-blue-400 mt-1">Items added via shop/scanner</p>
        </div>
      </div>

      {/* Recharts Graphs Area */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Timeline Trends */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5 md:col-span-8 flex flex-col justify-between backdrop-blur-xl shadow-lg">
          <div className="mb-4">
            <h3 className="font-sans text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              Kitchen Consumption Timeline
            </h3>
            <p className="font-sans text-[11px] text-zinc-400">Track intake volume vs checkout waste patterns.</p>
          </div>

          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorConsumed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpired" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#8a8a93" fontSize={10} tickLine={false} />
                  <YAxis stroke="#8a8a93" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(10, 10, 12, 0.72)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: "12px", backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                    itemStyle={{ fontSize: "11px", color: "#f4f4f5" }}
                    labelStyle={{ fontSize: "11px", fontWeight: "bold", color: "#a1a1aa" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumed"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConsumed)"
                    name="Eaten"
                  />
                  <Area
                    type="monotone"
                    dataKey="expired"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExpired)"
                    name="Spoiled/Wasted"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-zinc-600 font-mono text-xs">
                Not enough historical logging coordinates. Consumed or log pantry items to draw the telemetry!
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Share */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5 md:col-span-4 flex flex-col justify-between backdrop-blur-xl shadow-lg">
          <div>
            <h3 className="font-sans text-sm font-semibold text-zinc-100">Groceries Status Ratio</h3>
            <p className="font-sans text-[11px] text-zinc-400">Ratio analysis of stocked assets utilization.</p>
          </div>

          <div className="my-2 flex h-48 items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(10, 10, 12, 0.72)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: "12px", backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                    itemStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-zinc-650 font-mono text-xs">
                No logs compiled.
              </div>
            )}
          </div>

          {/* Simple custom legends */}
          <div className="space-y-1.5">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 text-zinc-400">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
                <span className="font-mono font-bold text-zinc-200">{item.value} units</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* spending optimizer intelligence reports */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-md shadow-lg">
        <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2.5">
          <HelpCircle className="h-4 w-4" />
          Consumption Optimizer Insights
        </h4>

        <div className="font-sans text-xs text-zinc-450 leading-relaxed space-y-3">
          {salvageRate >= 80 ? (
            <p>
              🌟 <strong className="text-zinc-200">Outstanding kitchen efficiency!</strong> Your food rescue rate is at{" "}
              <strong className="text-emerald-400">{salvageRate}%</strong>, indicating that you consume almost everything you buy before it expires. This maintains low grocery expenses and avoids redundant shopping cycles.
            </p>
          ) : salvageRate >= 50 ? (
            <p>
              ⚠️ <strong className="text-zinc-200">Moderate Waste Detected.</strong> Your food rescue rate is at{" "}
              <strong className="text-amber-400">{salvageRate}%</strong>. This signals that a portion of bought stock is spoiled. Try checking the "Recipe Suggestions" tab before shopping to find meals that digest expiring products dynamically!
            </p>
          ) : (
            <p>
              🚨 <strong className="text-zinc-200">High Food Spoilage Alert.</strong> Your food rescue rate of{" "}
              <strong className="text-red-400">{salvageRate}%</strong> indicates that a significant amount of items in your kitchen spoil before consumption. Consider shopping more frequently but in smaller volumes (e.g. baking and dairy), and make sure threshold alerts are enabled in settings.
            </p>
          )}

          <div className="grid gap-3 pt-2 sm:grid-cols-2 text-zinc-500">
            <div className="rounded-lg border border-white/5 bg-white/5 p-2.5 shadow-inner">
              <span className="font-sans font-semibold text-zinc-300 block mb-1">💡 Shopping Tip</span>
              Review your auto-grocery thresholds in the Settings menu to align requirements with your true weekly consumption parameters.
            </div>
            <div className="rounded-lg border border-white/5 bg-white/5 p-2.5 shadow-inner">
              <span className="font-sans font-semibold text-zinc-300 block mb-1">⚖️ Spoilage Risk</span>
              Pantry and Dairy categories regularly represent 70% of household food waste. Keep them arranged by expiring order using the sorting options!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
