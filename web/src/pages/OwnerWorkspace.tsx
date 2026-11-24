import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  TrendingUp, DollarSign, Package, AlertTriangle, Sparkles,
  Sliders, ArrowUpRight, ArrowDownRight, Layers, BarChart3
} from "lucide-react";

export const OwnerWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"dashboard" | "whatif">("dashboard");
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [whatIfResult, setWhatIfResult] = useState<any | null>(null);
  const [priceDelta, setPriceDelta] = useState(0);
  const [inputPricePct, setInputPricePct] = useState("0");
  const [yieldOverride, setYieldOverride] = useState("200");
  const [extraDemand, setExtraDemand] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
    runSimulation(0, "0", 200, 0);
  }, []);

  const loadDashboard = async () => {
    try {
      const anom = await apiFetch("/insights/anomalies");
      setAnomalies(anom);
    } catch (err) {
      console.error(err);
    }
  };

  const runSimulation = async (pDelta: number, inPct: string, yVal: number, dem: number) => {
    setLoading(true);
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
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between pb-6 border-b border-charcoal/80 mb-6">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-wide text-offWhite">
              Executive Intelligence Dashboard
            </h1>
            <p className="text-xs text-mauve mt-1">High-level financial KPIs, operational variance signals, and what-if projection engine.</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setTab("dashboard")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "dashboard" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              Overview & Alerts
            </button>
            <button
              onClick={() => setTab("whatif")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "whatif" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              What-If Simulator
            </button>
          </div>
        </div>

        {/* Tab 1: Dashboard Overview */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 border border-charcoal">
                <div className="flex justify-between items-center text-xs text-mauve">
                  <span>Gross Margin %</span>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-2xl font-heading font-bold text-gold mt-2">37.7%</div>
                <div className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
                  <span>₹18.86 per packet margin</span>
                </div>
              </div>

              <div className="glass-panel p-5 border border-charcoal">
                <div className="flex justify-between items-center text-xs text-mauve">
                  <span>FG Stock Cover</span>
                  <Package className="w-4 h-4 text-violet" />
                </div>
                <div className="text-2xl font-heading font-bold text-offWhite mt-2">88 pkts</div>
                <div className="text-[11px] text-mauve mt-1">~1.5 days cover at current demand</div>
              </div>

              <div className="glass-panel p-5 border border-charcoal">
                <div className="flex justify-between items-center text-xs text-mauve">
                  <span>Latest Cost / Packet</span>
                  <DollarSign className="w-4 h-4 text-gold" />
                </div>
                <div className="text-2xl font-heading font-bold text-gold mt-2">₹31.14</div>
                <div className="text-[11px] text-mauve mt-1">Standard BOM baseline: ₹19.85</div>
              </div>

              <div className="glass-panel p-5 border border-charcoal">
                <div className="flex justify-between items-center text-xs text-mauve">
                  <span>Active Variance Alerts</span>
                  <AlertTriangle className="w-4 h-4 text-gold" />
                </div>
                <div className="text-2xl font-heading font-bold text-gold mt-2">{anomalies.length}</div>
                <div className="text-[11px] text-mauve mt-1">R1-R3 rules triggered</div>
              </div>
            </div>

            {/* Top Operational Insights & Anomaly Signals */}
            <div className="glass-panel p-6 border border-charcoal">
              <h2 className="font-heading font-bold text-lg text-offWhite mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold" />
                <span>Deterministic Anomaly Intelligence Feed</span>
              </h2>

              <div className="space-y-3">
                {anomalies.length > 0 ? (
                  anomalies.map((a, i) => (
                    <div key={i} className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/80 flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-gold">{a.rule}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-500/30">
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-sm text-offWhite mt-1">{a.message}</p>
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

        {/* Tab 2: What-If Simulator */}
        {tab === "whatif" && (
          <div className="space-y-6">
            {/* Simulation Warning Banner (PRD Section 8.5) */}
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

            {/* Simulator Controls & Output */}
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
                    Raw Material Inflation (%): +{inputPricePct}%
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
                    className="w-full accent-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase text-mauve mb-1">
                    Simulated Yield (Packets): {yieldOverride}
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
                    Additional Demand (Packets): +{extraDemand}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="100"
                    value={extraDemand}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setExtraDemand(val);
                      runSimulation(priceDelta, inputPricePct, parseInt(yieldOverride), val);
                    }}
                    className="w-full accent-gold"
                  />
                </div>
              </div>

              {/* Baseline vs Scenario Output */}
              {whatIfResult && (
                <div className="lg:col-span-2 glass-panel p-6 border border-charcoal space-y-6">
                  <h3 className="font-heading font-semibold text-base text-offWhite flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gold" />
                    <span>Side-by-Side Impact Analysis</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Baseline */}
                    <div className="p-4 rounded-xl bg-charcoal/40 border border-charcoal space-y-3">
                      <div className="text-xs uppercase tracking-wider text-mauve">Baseline Actuals</div>
                      <div>
                        <div className="text-xs text-mauve">Selling Price:</div>
                        <div className="text-lg font-heading font-bold text-offWhite">₹{whatIfResult.baseline.selling_price_str}</div>
                      </div>
                      <div>
                        <div className="text-xs text-mauve">Cost / Packet:</div>
                        <div className="text-lg font-heading font-bold text-gold">₹{whatIfResult.baseline.cost_per_packet_str}</div>
                      </div>
                      <div>
                        <div className="text-xs text-mauve">Gross Margin:</div>
                        <div className="text-lg font-heading font-bold text-green-400">
                          ₹{whatIfResult.baseline.margin_str} ({whatIfResult.baseline.margin_pct}%)
                        </div>
                      </div>
                    </div>

                    {/* Simulated Scenario */}
                    <div className="p-4 rounded-xl bg-violet/15 border border-violet/40 space-y-3">
                      <div className="text-xs uppercase tracking-wider text-gold font-bold">Simulated Projection</div>
                      <div>
                        <div className="text-xs text-mauve">Simulated Price:</div>
                        <div className="text-lg font-heading font-bold text-offWhite">₹{whatIfResult.simulated.selling_price_str}</div>
                      </div>
                      <div>
                        <div className="text-xs text-mauve">Simulated Cost / Packet:</div>
                        <div className="text-lg font-heading font-bold text-gold">₹{whatIfResult.simulated.cost_per_packet_str}</div>
                      </div>
                      <div>
                        <div className="text-xs text-mauve">Simulated Gross Margin:</div>
                        <div className="text-lg font-heading font-bold text-green-400">
                          ₹{whatIfResult.simulated.margin_str} ({whatIfResult.simulated.margin_pct}%)
                        </div>
                      </div>
                      <div className="pt-2 border-t border-violet/30 text-xs">
                        <span className="text-mauve">Break-even Price: </span>
                        <strong className="text-gold">₹{whatIfResult.simulated.break_even_price_str}</strong>
                      </div>
                      {whatIfResult.simulated.batches_needed_for_demand > 0 && (
                        <div className="text-xs text-violet font-semibold">
                          Batches to fulfill extra demand: {whatIfResult.simulated.batches_needed_for_demand} batch(es)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
