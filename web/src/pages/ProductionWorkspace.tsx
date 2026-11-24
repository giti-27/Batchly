import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  Factory, Play, CheckCircle2, AlertTriangle, ArrowRight, Plus,
  Layers, Package, Check, RefreshCw, Sparkles
} from "lucide-react";

export const ProductionWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"runs" | "new_run">("runs");
  const [runs, setRuns] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState("1.00");
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [completingRunId, setCompletingRunId] = useState<number | null>(null);
  const [goodOutput, setGoodOutput] = useState("188");
  const [damagedPouches, setDamagedPouches] = useState("6");
  const [usedCartons, setUsedCartons] = useState("9");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rList, pList] = await Promise.all([
        apiFetch("/runs"),
        apiFetch("/products"),
      ]);
      setRuns(rList);
      setProducts(pList);
      if (pList.length > 0) setSelectedProductId(pList[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRun = async () => {
    if (!selectedProductId) return;
    setLoading(true);
    try {
      const run = await apiFetch("/runs", {
        method: "POST",
        body: JSON.stringify({
          product_id: selectedProductId,
          batch_multiplier: parseFloat(multiplier),
          shift: "Day",
        }),
      });
      setMsg(`Planned Run ${run.run_no} created successfully.`);
      setTab("runs");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartIssue = async (runId: number) => {
    try {
      // Auto issue raw materials by FEFO for standard batch
      const res = await apiFetch(`/runs/${runId}/issue`, {
        method: "POST",
        body: JSON.stringify({
          raw_issues: [
            { item_id: 1, issued_qty: 40000.0 }, // 40 kg flour
            { item_id: 2, issued_qty: 10500.0 }, // 10.5 L oil
            { item_id: 3, issued_qty: 1200.0 },  // 1.2 kg spice
          ],
        }),
      });
      setMsg(`Run ${res.run_no} started: Raw materials issued via FEFO.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteRun = async () => {
    if (!completingRunId) return;
    try {
      const res = await apiFetch(`/runs/${completingRunId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          actual_good_output: parseInt(goodOutput),
          pack_consumptions: [
            { item_id: 4, used_qty: parseInt(goodOutput), damaged_qty: parseInt(damagedPouches) }, // pouches
            { item_id: 5, used_qty: parseInt(usedCartons), damaged_qty: 0 }, // cartons
          ],
          overheads: [
            { type: "LABOUR", amount_paise: 120000 },
            { type: "GAS_POWER", amount_paise: 60000 },
          ],
        }),
      });
      setMsg(`Run ${res.run_no} completed! Good Output: ${res.actual_good_output} pkts, Cost/pkt: ₹${(res.cost_per_packet_paise / 100).toFixed(2)}`);
      setCompletingRunId(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between border-b border-charcoal/80 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <Factory className="w-6 h-6 text-violet" />
            <div>
              <h1 className="font-heading text-2xl font-bold text-offWhite">Production Control Floor</h1>
              <p className="text-xs text-mauve">Tablet-friendly operations and FEFO batch execution</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setTab("runs")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "runs" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              Today's Runs
            </button>
            <button
              onClick={() => setTab("new_run")}
              className={`px-4 py-2 rounded-lg text-xs font-heading font-semibold transition ${
                tab === "new_run" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
              }`}
            >
              + Create Planned Run
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-6 p-3 rounded-lg bg-violet/20 border border-violet/40 text-xs text-violet flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg(null)} className="text-mauve hover:text-offWhite">✕</button>
          </div>
        )}

        {/* Tab 1: Today's Runs */}
        {tab === "runs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runs.map((r) => (
              <div key={r.id} className="glass-panel p-5 border border-charcoal flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-sm text-offWhite">{r.run_no}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                      r.status === "COMPLETED" ? "bg-green-900/40 text-green-300 border border-green-500/30" :
                      r.status === "IN_PROGRESS" ? "bg-blue-900/40 text-blue-300 border border-blue-500/30" :
                      "bg-yellow-900/40 text-yellow-300 border border-yellow-500/30"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <h3 className="font-heading text-base font-semibold text-offWhite mt-2">{r.product_name}</h3>
                  <p className="text-xs text-mauve mt-1">
                    Multiplier: {r.batch_multiplier}x · Shift: {r.shift}
                  </p>

                  <div className="mt-4 p-3 rounded-lg bg-charcoal/40 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-mauve">Expected Yield:</span>
                      <span className="text-offWhite font-semibold">{r.expected_output} pkts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mauve">Actual Good Output:</span>
                      <span className="text-gold font-bold">{r.actual_good_output} pkts</span>
                    </div>
                    {r.cost_per_packet_paise && (
                      <div className="flex justify-between pt-1 border-t border-charcoal/60">
                        <span className="text-mauve">Cost / Packet:</span>
                        <span className="text-gold font-bold">₹{(r.cost_per_packet_paise / 100).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-charcoal/60 flex items-center justify-between gap-2">
                  {r.status === "PLANNED" && (
                    <button
                      onClick={() => handleStartIssue(r.id)}
                      className="w-full py-2.5 rounded-lg bg-violet hover:bg-violet/90 text-white text-xs font-heading font-semibold shadow-glow flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start & Issue Raw Materials</span>
                    </button>
                  )}
                  {r.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => setCompletingRunId(r.id)}
                      className="w-full py-2.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-heading font-semibold flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Record Completion</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Create Planned Run */}
        {tab === "new_run" && (
          <div className="max-w-xl mx-auto glass-panel p-6 border border-charcoal space-y-4">
            <h2 className="font-heading font-bold text-lg text-offWhite">Plan New Production Run</h2>
            <div>
              <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Select Product</label>
              <select
                value={selectedProductId || ""}
                onChange={(e) => setSelectedProductId(parseInt(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm focus:border-violet focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pack_size_label} ({p.family_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Batch Multiplier</label>
              <input
                type="number"
                step="0.5"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm focus:border-violet focus:outline-none"
              />
              <p className="text-[11px] text-mauve mt-1">1.0x = 40 kg flour batch = 200 packets</p>
            </div>

            <button
              onClick={handleCreateRun}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-violet hover:bg-violet/90 text-white font-heading font-semibold text-sm shadow-glow transition mt-4"
            >
              {loading ? "Creating..." : "Create Planned Run"}
            </button>
          </div>
        )}

        {/* Modal: Complete Run */}
        {completingRunId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel-glow max-w-md w-full p-6 border border-violet/40 space-y-4">
              <h3 className="font-heading text-lg font-bold text-offWhite">Record Production Run Completion</h3>
              
              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Actual Good Output (Packets)</label>
                <input
                  type="number"
                  value={goodOutput}
                  onChange={(e) => setGoodOutput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm font-heading font-bold"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Damaged Pouches (Absorbed Loss)</label>
                <input
                  type="number"
                  value={damagedPouches}
                  onChange={(e) => setDamagedPouches(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Cartons Used</label>
                <input
                  type="number"
                  value={usedCartons}
                  onChange={(e) => setUsedCartons(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm"
                />
              </div>

              <div className="p-3 rounded-lg bg-charcoal/40 text-xs text-mauve">
                Standard Run Overheads: Labour ₹1,200 + Gas/Power ₹600 = ₹1,800
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setCompletingRunId(null)}
                  className="w-1/2 py-2.5 rounded-lg bg-charcoal hover:bg-charcoal/80 text-offWhite text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteRun}
                  className="w-1/2 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-heading font-semibold"
                >
                  Confirm Completion
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
