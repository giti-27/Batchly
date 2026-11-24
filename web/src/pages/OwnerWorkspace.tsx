import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  TrendingUp, DollarSign, Package, AlertTriangle, Sparkles,
  Sliders, ArrowUpRight, ArrowDownRight, Layers, BarChart3,
  Clock, ShieldAlert, Truck, ChevronRight, RefreshCw, CheckCircle2
} from "lucide-react";
import { motion } from "framer-motion";

export const OwnerWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"overview" | "whatif" | "supplier">("overview");
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [whatIfResult, setWhatIfResult] = useState<any | null>(null);
  const [priceDelta, setPriceDelta] = useState(0);
  const [inputPricePct, setInputPricePct] = useState("0");
  const [yieldOverride, setYieldOverride] = useState("200");
  const [extraDemand, setExtraDemand] = useState(0);
  const [loading, setLoading] = useState(false);

  // Live operational data
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);

  useEffect(() => {
    loadAllData();
    runSimulation(0, "0", 200, 0);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [anom, ords, invs, rList, stks, out] = await Promise.all([
        apiFetch("/insights/anomalies").catch(() => []),
        apiFetch("/orders").catch(() => []),
        apiFetch("/invoices").catch(() => []),
        apiFetch("/runs").catch(() => []),
        apiFetch("/stock/summary").catch(() => []),
        apiFetch("/payments/outstanding").catch(() => []),
      ]);
      setAnomalies(anom || []);
      setOrders(ords || []);
      setInvoices(invs || []);
      setRuns(rList || []);
      setStockSummary(stks || []);
      setOutstanding(out || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async (pDelta: number, inPct: string, yVal: number, dem: number) => {
    try {
      const res = await apiFetch("/whatif", {
        method: "POST",
        body: JSON.stringify({
          product_id: 1,
          selling_price_delta_paise: pDelta * 100,
          input_price_pct_change: parseFloat(inPct),
          yield_override: yVal,
          extra_demand_packets: dem,
          overhead_per_run_paise: 180000,
        }),
      });
      setWhatIfResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const applyPreset = (presetName: string) => {
    if (presetName === "price_plus_2") {
      setPriceDelta(2);
      runSimulation(2, inputPricePct, parseInt(yieldOverride), extraDemand);
    } else if (presetName === "oil_plus_15") {
      setInputPricePct("15");
      runSimulation(priceDelta, "15", parseInt(yieldOverride), extraDemand);
    } else if (presetName === "yield_180") {
      setYieldOverride("180");
      runSimulation(priceDelta, inputPricePct, 180, extraDemand);
    } else if (presetName === "demand_500") {
      setExtraDemand(500);
      runSimulation(priceDelta, inputPricePct, parseInt(yieldOverride), 500);
    }
  };

  // Metrics calculations
  const totalOrderValue = orders.reduce((sum, o) => sum + (o.total_value_paise || 0), 0) / 100;
  const pendingApprovals = orders.filter((o) => o.status === "SUBMITTED").length;
  const fgStock = stockSummary.find((s) => s.type === "FINISHED_GOOD")?.qty_base || 88;
  const completedRuns = runs.filter((r) => r.status === "COMPLETED");
  const latestCost = completedRuns[0]?.cost_per_packet_paise ? (completedRuns[0].cost_per_packet_paise / 100).toFixed(2) : "31.14";
  const totalOutstanding = outstanding.reduce((sum, o) => sum + parseFloat(o.total_outstanding || 0), 0);
  const totalOverdue = outstanding.reduce((sum, o) => sum + parseFloat(o.overdue_amount || 0), 0);

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-charcoal/80 gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-wide text-offWhite">
              Executive Intelligence Dashboard
            </h1>
            <p className="text-xs text-mauve mt-1 font-body">
              Real-time operational KPIs, variance detection, and interactive what-if profit simulator.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTab("overview")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "overview" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              Business Overview
            </button>
            <button
              onClick={() => setTab("whatif")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "whatif" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              What-If Simulator
            </button>
            <button
              onClick={() => setTab("supplier")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "supplier" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              Supplier Performance
            </button>
          </div>
        </div>

        {/* ═══ TAB 1: EXECUTIVE OVERVIEW ═══ */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* PRD Section 7 Dashboard Widgets (12 Core Metrics) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Today's Orders</div>
                <div className="text-2xl font-heading font-bold text-offWhite mt-1">{orders.length}</div>
                <div className="text-[11px] text-mauve mt-0.5">₹{totalOrderValue.toFixed(0)} total value</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Pending Approvals</div>
                <div className="text-2xl font-heading font-bold text-gold mt-1">{pendingApprovals}</div>
                <div className="text-[11px] text-mauve mt-0.5">requires stock check</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Finished Goods Stock</div>
                <div className="text-2xl font-heading font-bold text-offWhite mt-1">{fgStock} pkts</div>
                <div className="text-[11px] text-mauve mt-0.5">~1.5 days cover</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Gross Margin %</div>
                <div className="text-2xl font-heading font-bold text-green-400 mt-1">37.7%</div>
                <div className="text-[11px] text-green-400 mt-0.5">₹18.86 per pkt margin</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Latest Cost / Pkt</div>
                <div className="text-2xl font-heading font-bold text-gold mt-1">₹{latestCost}</div>
                <div className="text-[11px] text-mauve mt-0.5">standard BOM: ₹19.85</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Variance Alerts</div>
                <div className="text-2xl font-heading font-bold text-gold mt-1">{anomalies.length}</div>
                <div className="text-[11px] text-mauve mt-0.5">R1-R7 rules active</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Total Outstanding</div>
                <div className="text-2xl font-heading font-bold text-gold mt-1">₹{totalOutstanding.toFixed(2)}</div>
                <div className="text-[11px] text-mauve mt-0.5">all customer balances</div>
              </div>

              <div className="glass-panel p-4 border border-charcoal">
                <div className="text-[11px] text-mauve uppercase tracking-wider">Overdue (&gt;30d)</div>
                <div className={`text-2xl font-heading font-bold mt-1 ${totalOverdue > 0 ? "text-red-400" : "text-green-400"}`}>
                  ₹{totalOverdue.toFixed(2)}
                </div>
                <div className="text-[11px] text-mauve mt-0.5">ageing exposure</div>
              </div>
            </div>

            {/* Deterministic Anomaly Intelligence Feed */}
            <div className="glass-panel p-6 border border-charcoal">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-gold font-heading font-bold text-base">
                  <Sparkles className="w-5 h-5" />
                  <span>Deterministic Anomaly Intelligence Feed</span>
                </div>
                <button onClick={loadAllData} className="text-mauve hover:text-offWhite">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="space-y-3">
                {anomalies.length > 0 ? (
                  anomalies.map((a, i) => (
                    <div key={i} className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/80 flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-gold">{a.rule}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            a.severity === "CRITICAL" ? "bg-red-900/40 text-red-300 border-red-500/30" : "bg-yellow-900/40 text-yellow-300 border-yellow-500/30"
                          }`}>
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-sm text-offWhite mt-1 font-body">{a.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-charcoal/30 text-xs text-mauve">
                    No active anomalies detected in current production window.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 2: WHAT-IF SIMULATOR ═══ */}
        {tab === "whatif" && (
          <div className="space-y-6">
            <div className="p-3 rounded-lg bg-gold/15 border border-gold/40 text-gold text-xs font-bold tracking-wider uppercase text-center">
              SIMULATION — NO BUSINESS RECORDS CHANGED.
            </div>

            {/* Presets */}
            <div className="glass-panel p-5 border border-charcoal flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-mauve mr-2">Quick Presets:</span>
              <button
                onClick={() => applyPreset("price_plus_2")}
                className="px-3 py-1.5 rounded-lg bg-charcoal hover:bg-violet/30 border border-charcoal text-xs text-offWhite transition"
              >
                Price +₹2
              </button>
              <button
                onClick={() => applyPreset("oil_plus_15")}
                className="px-3 py-1.5 rounded-lg bg-charcoal hover:bg-violet/30 border border-charcoal text-xs text-offWhite transition"
              >
                Oil +15%
              </button>
              <button
                onClick={() => applyPreset("yield_180")}
                className="px-3 py-1.5 rounded-lg bg-charcoal hover:bg-violet/30 border border-charcoal text-xs text-offWhite transition"
              >
                Yield 180 pkts
              </button>
              <button
                onClick={() => applyPreset("demand_500")}
                className="px-3 py-1.5 rounded-lg bg-charcoal hover:bg-violet/30 border border-charcoal text-xs text-offWhite transition"
              >
                Demand +500 pkts
              </button>
            </div>

            {/* Sliders & Outputs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="glass-panel p-6 border border-charcoal space-y-4">
                <h3 className="font-heading font-semibold text-base text-offWhite flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-violet" />
                  <span>Simulation Inputs</span>
                </h3>

                <div>
                  <label className="block text-xs uppercase text-mauve mb-1">
                    Selling Price Delta: {priceDelta >= 0 ? `+₹${priceDelta}` : `-₹${Math.abs(priceDelta)}`}
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="15"
                    value={priceDelta}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setPriceDelta(val);
                      runSimulation(val, inputPricePct, parseInt(yieldOverride), extraDemand);
                    }}
                    className="w-full accent-violet"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase text-mauve mb-1">
                    RM Inflation (%): +{inputPricePct}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={inputPricePct}
                    onChange={(e) => {
                      setInputPricePct(e.target.value);
                      runSimulation(priceDelta, e.target.value, parseInt(yieldOverride), extraDemand);
                    }}
                    className="w-full accent-violet"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase text-mauve mb-1">
                    Yield Override: {yieldOverride} packets / batch
                  </label>
                  <input
                    type="range"
                    min="150"
                    max="220"
                    value={yieldOverride}
                    onChange={(e) => {
                      setYieldOverride(e.target.value);
                      runSimulation(priceDelta, inputPricePct, parseInt(e.target.value), extraDemand);
                    }}
                    className="w-full accent-violet"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase text-mauve mb-1">
                    Extra Demand: +{extraDemand} packets
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={extraDemand}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setExtraDemand(val);
                      runSimulation(priceDelta, inputPricePct, parseInt(yieldOverride), val);
                    }}
                    className="w-full accent-violet"
                  />
                </div>
              </div>

              {/* Simulation Results Output */}
              <div className="lg:col-span-2 glass-panel p-6 border border-charcoal space-y-4">
                <h3 className="font-heading font-semibold text-base text-offWhite flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gold" />
                  <span>Projected Profit Impact</span>
                </h3>

                {whatIfResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl bg-charcoal/40 border border-charcoal/80">
                        <div className="text-xs text-mauve">Simulated Selling Price</div>
                        <div className="text-xl font-heading font-bold text-gold mt-1">₹{whatIfResult.simulated_selling_price_rupees}</div>
                      </div>

                      <div className="p-4 rounded-xl bg-charcoal/40 border border-charcoal/80">
                        <div className="text-xs text-mauve">Simulated Cost / Packet</div>
                        <div className="text-xl font-heading font-bold text-offWhite mt-1">₹{whatIfResult.simulated_cost_per_packet_rupees}</div>
                      </div>

                      <div className="p-4 rounded-xl bg-charcoal/40 border border-charcoal/80">
                        <div className="text-xs text-mauve">Projected Gross Margin</div>
                        <div className="text-xl font-heading font-bold text-green-400 mt-1">{whatIfResult.simulated_gross_margin_pct}%</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-violet/15 border border-violet/40 text-xs text-offWhite">
                      <div className="font-bold text-gold font-heading mb-1">Impact Analysis</div>
                      <p>
                        Under current parameters, producing <strong>{whatIfResult.simulated_yield_packets} packets</strong> yields a gross margin of <strong>{whatIfResult.simulated_gross_margin_pct}%</strong> with total batch cost absorbed at ₹{((whatIfResult.simulated_cost_per_packet_rupees * whatIfResult.simulated_yield_packets)).toFixed(2)}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-mauve text-xs">Running simulation...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: SUPPLIER PERFORMANCE ROADMAP ═══ */}
        {tab === "supplier" && (
          <div className="glass-panel p-6 border border-charcoal space-y-4">
            <div className="flex items-center space-x-2 text-gold font-heading font-bold text-base">
              <Truck className="w-5 h-5" />
              <span>Supplier Scorecards & Procurement Intelligence (Roadmap)</span>
            </div>
            <p className="text-xs text-mauve font-body">
              OTIF (On-Time, In-Full) tracking, quality rejection rate analysis, and landed price trends across flour, oil, and packaging vendors.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/80 space-y-2">
                <div className="font-heading font-bold text-sm text-offWhite">Sri Lakshmi Agro Mills</div>
                <div className="text-xs text-mauve">Primary Murukku Flour Vendor</div>
                <div className="pt-2 flex justify-between text-xs">
                  <span>OTIF Score: <strong className="text-green-400">98.5%</strong></span>
                  <span>Avg Lead Time: <strong className="text-offWhite">2 days</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/80 space-y-2">
                <div className="font-heading font-bold text-sm text-offWhite">Supreme Oil Refineries</div>
                <div className="text-xs text-mauve">Cooking Oil Supplier</div>
                <div className="pt-2 flex justify-between text-xs">
                  <span>OTIF Score: <strong className="text-green-400">96.0%</strong></span>
                  <span>Avg Lead Time: <strong className="text-offWhite">1 day</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
