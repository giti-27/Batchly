import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  Factory, Play, CheckCircle2, AlertTriangle, ArrowRight, Plus,
  Layers, Package, Check, RefreshCw, Sparkles, RotateCcw,
  ShoppingBag, Truck, FileText, ChevronRight, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const ProductionWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"runs" | "new_run" | "stock" | "receipts" | "variance">("runs");
  const [runs, setRuns] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState("1.00");
  const [completingRunId, setCompletingRunId] = useState<number | null>(null);
  const [goodOutput, setGoodOutput] = useState("188");
  const [damagedPouches, setDamagedPouches] = useState("6");
  const [usedCartons, setUsedCartons] = useState("9");
  const [labourPaise, setLabourPaise] = useState("120000"); // ₹1,200
  const [powerPaise, setPowerPaise] = useState("60000");   // ₹600
  const [loading, setLoading] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const creatingRunRef = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversingRunId, setReversingRunId] = useState<number | null>(null);

  // New Purchase / Goods Receipt state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [receiptItemId, setReceiptItemId] = useState<number>(1);
  const [receiptQty, setReceiptQty] = useState("50");
  const [receiptRate, setReceiptRate] = useState("45.00");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rList, pList, sList, supList] = await Promise.all([
        apiFetch("/runs").catch(() => []),
        apiFetch("/masters/items?type=FINISHED_GOOD").catch(() => apiFetch("/products")),
        apiFetch("/stock/summary").catch(() => []),
        apiFetch("/masters/suppliers").catch(() => []),
      ]);
      setRuns(rList || []);
      setProducts(pList || []);
      setStockSummary(sList || []);
      setSuppliers(supList || []);
      if (pList && pList.length > 0 && !selectedProductId) {
        setSelectedProductId(pList[0].id);
      }
      if (supList && supList.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supList[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRun = async () => {
    if (!selectedProductId || creatingRunRef.current) return;
    creatingRunRef.current = true;
    setCreatingRun(true);
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
      setMsg(`✅ Planned Run ${run.run_no} created.`);
      setTab("runs");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      creatingRunRef.current = false;
      setCreatingRun(false);
      setLoading(false);
    }
  };

  const handleStartIssue = async (runId: number) => {
    try {
      // FEFO raw material issue for standard batch (40kg flour, 10.5L oil, 1.2kg spice)
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
      setMsg(`🚀 Run ${res.run_no} started! Raw materials issued via FEFO.`);
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
            { item_id: 4, used_qty: parseInt(goodOutput), damaged_qty: parseInt(damagedPouches) },
            { item_id: 5, used_qty: parseInt(usedCartons), damaged_qty: 0 },
          ],
          overheads: [
            { type: "LABOUR", amount_paise: parseInt(labourPaise) },
            { type: "GAS_POWER", amount_paise: parseInt(powerPaise) },
          ],
        }),
      });
      setMsg(`🎉 Run ${res.run_no} completed! Good Output: ${res.actual_good_output} pkts, Cost/pkt: ₹${(res.cost_per_packet_paise / 100).toFixed(2)}`);
      setCompletingRunId(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReverseRun = async () => {
    if (!reversingRunId || !reversalReason.trim()) {
      alert("Please enter a valid reversal reason.");
      return;
    }
    try {
      await apiFetch(`/runs/${reversingRunId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reversalReason }),
      });
      setMsg(`↩️ Run #${reversingRunId} reversed via proper stock correction.`);
      setReversingRunId(null);
      setReversalReason("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const selectedReceiptItem = stockSummary.find((item) => item.item_id === receiptItemId);
  const receiptDisplayUnit = selectedReceiptItem?.display_uom || "kg";
  const receiptUnitFactor = ["kg", "l"].includes(receiptDisplayUnit.toLowerCase()) ? 1000 : 1;

  const handleGoodsReceipt = async () => {
    if (!selectedSupplierId) {
      alert("Please select a supplier.");
      return;
    }
    const displayQty = Number(receiptQty);
    const displayRate = Number(receiptRate);
    if (!Number.isFinite(displayQty) || displayQty <= 0 || !Number.isFinite(displayRate) || displayRate < 0) {
      alert("Enter a valid positive quantity and a non-negative rate.");
      return;
    }
    try {
      const purchaseNo = `PUR-REC-${Date.now().toString().slice(-8)}`;
      const lotNo = `RM-REC-${Date.now().toString().slice(-6)}`;
      // Convert the user-facing kg/L/pcs entry to the backend's canonical
      // base quantity (g/ml/pcs), and ₹ per display unit to paise per base unit.
      const qtyBase = Number((displayQty * receiptUnitFactor).toFixed(3));
      const ratePaisePerBase = Number(((displayRate * 100) / receiptUnitFactor).toFixed(6));

      // Purchases are deliberately two-step: create a draft, then post it.
      // Posting creates the batch, ledger movement, and updates the stock balance.
      const purchase = await apiFetch("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          purchase_no: purchaseNo,
          date: new Date().toISOString().slice(0, 10),
          lines: [{
            item_id: receiptItemId,
            qty: qtyBase,
            rate_paise_per_base: ratePaisePerBase,
            supplier_lot_no: lotNo,
          }],
        }),
      });
      await apiFetch(`/purchases/${purchase.id}/post`, { method: "POST" });
      setMsg(`Goods receipt posted: ${displayQty} ${receiptDisplayUnit} of ${selectedReceiptItem?.item_name || "material"} received.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Unable to post goods receipt.");
    }
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Navigation Tabs - Large Touch Targets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border-b border-charcoal/80 pb-4">
          <button
            onClick={() => setTab("runs")}
            className={`py-3 px-4 rounded-xl text-sm font-heading font-semibold flex items-center justify-center space-x-2 transition ${
              tab === "runs" ? "bg-violet text-white shadow-glow" : "bg-charcoal/40 text-mauve hover:text-offWhite"
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>Today's Runs</span>
          </button>

          <button
            onClick={() => setTab("new_run")}
            className={`py-3 px-4 rounded-xl text-sm font-heading font-semibold flex items-center justify-center space-x-2 transition ${
              tab === "new_run" ? "bg-violet text-white shadow-glow" : "bg-charcoal/40 text-mauve hover:text-offWhite"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Run & BOM</span>
          </button>

          <button
            onClick={() => setTab("stock")}
            className={`py-3 px-4 rounded-xl text-sm font-heading font-semibold flex items-center justify-center space-x-2 transition ${
              tab === "stock" ? "bg-violet text-white shadow-glow" : "bg-charcoal/40 text-mauve hover:text-offWhite"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Material Stock</span>
          </button>

          <button
            onClick={() => setTab("receipts")}
            className={`py-3 px-4 rounded-xl text-sm font-heading font-semibold flex items-center justify-center space-x-2 transition ${
              tab === "receipts" ? "bg-violet text-white shadow-glow" : "bg-charcoal/40 text-mauve hover:text-offWhite"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Goods Receipt</span>
          </button>

          <button
            onClick={() => setTab("variance")}
            className={`py-3 px-4 rounded-xl text-sm font-heading font-semibold flex items-center justify-center space-x-2 transition ${
              tab === "variance" ? "bg-violet text-white shadow-glow" : "bg-charcoal/40 text-mauve hover:text-offWhite"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Yield & Variance</span>
          </button>
        </div>

        {/* Message Banner */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-[#DDF8ED] border border-[#4B9B7E] text-[#164039] shadow-md text-sm font-semibold flex items-center justify-between"
            >
              <span>{msg}</span>
              <button onClick={() => setMsg(null)} className="text-[#31564E] hover:text-[#0B2F28] rounded-md px-2 py-1" aria-label="Dismiss notification">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ TAB 1: RUNS ═══ */}
        {tab === "runs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-xl text-offWhite">Active & Scheduled Runs</h2>
              <button onClick={loadData} className="p-2 rounded-lg bg-charcoal text-mauve hover:text-offWhite">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {runs.map((r) => (
                <div key={r.id} className="glass-panel p-5 border border-charcoal/80 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-heading font-bold text-base text-offWhite">{r.run_no}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                          r.status === "COMPLETED" ? "bg-green-900/40 text-green-300 border border-green-500/30" :
                          r.status === "IN_PROGRESS" ? "bg-violet/30 text-violet border border-violet/40" :
                          "bg-yellow-900/40 text-yellow-300 border border-yellow-500/30"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-mauve mt-1">{r.product_name} · Multiplier {r.batch_multiplier}x</p>
                    </div>

                    {r.actual_good_output > 0 && (
                      <div className="text-right">
                        <div className="font-heading font-bold text-gold text-base">
                          {r.actual_good_output} pkts
                        </div>
                        <div className="text-[11px] text-mauve">
                          ₹{(r.cost_per_packet_paise / 100).toFixed(2)}/pkt
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tablet-friendly Action Buttons */}
                  <div className="pt-2 border-t border-charcoal/60 flex items-center space-x-2">
                    {r.status === "PLANNED" && (
                      <button
                        onClick={() => handleStartIssue(r.id)}
                        className="flex-1 py-3 rounded-xl bg-violet hover:bg-violet/90 text-white font-heading font-semibold text-xs tracking-wider flex items-center justify-center space-x-2 shadow-glow"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start & Issue (FEFO)</span>
                      </button>
                    )}

                    {r.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => setCompletingRunId(r.id)}
                        className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-heading font-semibold text-xs tracking-wider flex items-center justify-center space-x-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Run</span>
                      </button>
                    )}

                    {r.status === "COMPLETED" && (
                      <button
                        onClick={() => setReversingRunId(r.id)}
                        className="py-2 px-3 rounded-lg bg-charcoal hover:bg-charcoal/80 text-mauve hover:text-red-300 text-xs flex items-center space-x-1 border border-charcoal"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reverse Run</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 2: NEW RUN & BOM PREVIEW ═══ */}
        {tab === "new_run" && (
          <div className="glass-panel p-6 border border-charcoal/80 space-y-6">
            <h2 className="font-heading font-bold text-xl text-offWhite">Create Planned Run</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Select Product</label>
                  <select
                    value={selectedProductId || ""}
                    onChange={(e) => setSelectedProductId(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-offWhite font-body text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id} className="bg-deepBlack text-offWhite">
                        {p.name} ({p.sku || "200g Murukku"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Batch Multiplier</label>
                  <input
                    type="number"
                    step="0.25"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-offWhite font-body text-sm"
                  />
                  <span className="text-[11px] text-mauve mt-1 block">Standard batch base = 200 packets</span>
                </div>

                <button
                  onClick={handleCreateRun}
                  disabled={loading || creatingRun}
                  aria-busy={creatingRun}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-violet to-violet/80 hover:from-violet/90 text-white font-heading font-semibold text-sm tracking-wider flex items-center justify-center space-x-2 shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creatingRun ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  <span>{creatingRun ? "Creating Run..." : "Create Planned Run"}</span>
                </button>
              </div>

              {/* BOM Preview Box */}
              <div className="p-5 rounded-xl bg-charcoal/30 border border-charcoal/80 space-y-3">
                <div className="flex items-center space-x-2 text-gold font-heading font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Standard BOM Consumption (1.0x)</span>
                </div>
                <div className="divide-y divide-charcoal/60 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-offWhite">Murukku Flour</span>
                    <span className="text-mauve font-mono">40.000 kg</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-offWhite">Cooking Oil</span>
                    <span className="text-mauve font-mono">10.500 L</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-offWhite">Spice Blend</span>
                    <span className="text-mauve font-mono">1.200 kg</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-offWhite">Printed Pouch 200g</span>
                    <span className="text-mauve font-mono">200 pcs</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-offWhite">Outer Corrugated Box</span>
                    <span className="text-mauve font-mono">10 pcs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: STOCK SNAPSHOT ═══ */}
        {tab === "stock" && (
          <div className="glass-panel p-6 border border-charcoal/80 space-y-4">
            <h2 className="font-heading font-bold text-xl text-offWhite">Shop-Floor Material Inventory</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stockSummary.map((s) => (
                <div key={s.item_id} className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/60 space-y-2">
                  <div className="flex justify-between text-xs text-mauve uppercase tracking-wider">
                    <span>{s.type}</span>
                    <span>{s.display_uom}</span>
                  </div>
                  <h4 className="font-heading font-semibold text-base text-offWhite">{s.item_name}</h4>
                  <div className="text-2xl font-heading font-bold text-gold">
                    {Number(s.qty_display ?? s.qty_base).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 4: GOODS RECEIPT ═══ */}
        {tab === "receipts" && (
          <div className="glass-panel p-6 border border-charcoal/80 space-y-6">
            <h2 className="font-heading font-bold text-xl text-offWhite">Receive Goods from Supplier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Supplier</label>
                <select
                  value={selectedSupplierId || ""}
                  onChange={(e) => setSelectedSupplierId(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} className="bg-deepBlack">
                      {s.name} ({s.state_code === "33" ? "TN" : s.state_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Item</label>
                <select
                  value={receiptItemId}
                  onChange={(e) => {
                    const nextId = parseInt(e.target.value);
                    setReceiptItemId(nextId);
                    // Helpful starting values in the selected item's display units.
                    if (nextId === 1) { setReceiptQty("60"); setReceiptRate("45"); }
                    else if (nextId === 2) { setReceiptQty("1.5"); setReceiptRate("140"); }
                    else if (nextId === 3) { setReceiptQty("1.2"); setReceiptRate("200"); }
                    else if (nextId === 4) { setReceiptQty("100"); setReceiptRate("2.5"); }
                    else if (nextId === 5) { setReceiptQty("10"); setReceiptRate("15"); }
                  }}
                  className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                >
                  {stockSummary.filter((item) => item.type === "RAW" || item.type === "PACK").map((item) => (
                    <option key={item.item_id} value={item.item_id} className="bg-deepBlack">
                      {item.item_name} ({item.display_uom})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">{`Quantity (${receiptDisplayUnit})`}</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={receiptQty}
                  onChange={(e) => setReceiptQty(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-mauve mb-1">{`Rate per ${receiptDisplayUnit} (₹)`}</label>
                <input
                  type="number"
                  step="0.1"
                  value={receiptRate}
                  onChange={(e) => setReceiptRate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleGoodsReceipt}
              className="py-3 px-6 rounded-xl bg-violet hover:bg-violet/90 text-white font-heading font-semibold text-xs tracking-wider shadow-glow"
            >
              Post Goods Receipt
            </button>
          </div>
        )}

        {/* ═══ TAB 5: VARIANCE & YIELD ═══ */}
        {tab === "variance" && (
          <div className="glass-panel p-6 border border-charcoal/80 space-y-4">
            <h2 className="font-heading font-bold text-xl text-offWhite">Batch Variance & Tolerance Analysis</h2>
            <p className="text-xs text-mauve">
              PRD Invariant: Strict inequality (<span className="text-gold font-mono">&gt; 3.00%</span>). Flagged if abs(variance) exceeds tolerance.
            </p>

            <div className="divide-y divide-charcoal/60">
              {runs.filter((r) => r.status === "COMPLETED").map((r) => (
                <div key={r.id} className="py-4 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-heading font-bold text-sm text-offWhite">{r.run_no}</span>
                    <span className="text-mauve ml-2">{r.product_name}</span>
                    <div className="text-[11px] text-mauve mt-1">
                      Expected: 200 pkts · Actual Good: {r.actual_good_output} pkts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-bold text-gold text-sm">
                      ₹{(r.cost_per_packet_paise / 100).toFixed(2)}/pkt
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-500/30 text-[10px]">
                      Cost Absorbed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completion Modal */}
        <AnimatePresence>
          {completingRunId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-deepBlack/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="glass-panel-glow max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-charcoal/60 pb-3">
                  <h3 className="font-heading font-bold text-lg text-offWhite">Complete Production Run</h3>
                  <button onClick={() => setCompletingRunId(null)} className="text-mauve hover:text-offWhite">✕</button>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Good Output (packets)</label>
                  <input
                    type="number"
                    value={goodOutput}
                    onChange={(e) => setGoodOutput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Damaged Pouches</label>
                    <input
                      type="number"
                      value={damagedPouches}
                      onChange={(e) => setDamagedPouches(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Cartons Used</label>
                    <input
                      type="number"
                      value={usedCartons}
                      onChange={(e) => setUsedCartons(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Labour Overhead (₹)</label>
                    <input
                      type="number"
                      value={parseInt(labourPaise) / 100}
                      onChange={(e) => setLabourPaise((parseFloat(e.target.value || "0") * 100).toString())}
                      className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Gas / Power Overhead (₹)</label>
                    <input
                      type="number"
                      value={parseInt(powerPaise) / 100}
                      onChange={(e) => setPowerPaise((parseFloat(e.target.value || "0") * 100).toString())}
                      className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-charcoal/60 flex space-x-2">
                  <button
                    onClick={() => setCompletingRunId(null)}
                    className="flex-1 py-3 rounded-xl bg-charcoal text-mauve hover:text-offWhite text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteRun}
                    className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-heading font-semibold text-xs tracking-wider shadow-glow"
                  >
                    Confirm Completion
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reversal Modal */}
        <AnimatePresence>
          {reversingRunId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-deepBlack/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="glass-panel-glow max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-charcoal/60 pb-3">
                  <h3 className="font-heading font-bold text-lg text-offWhite">Reverse Run #{reversingRunId}</h3>
                  <button onClick={() => setReversingRunId(null)} className="text-mauve hover:text-offWhite">✕</button>
                </div>

                <p className="text-xs text-mauve">
                  Reversing a run will post compensatory ledger movements returning consumed RM and decrementing FG balance.
                </p>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-mauve mb-1">Mandatory Reversal Reason</label>
                  <textarea
                    rows={3}
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    placeholder="e.g., Contaminated batch identified during sensory QC..."
                    className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal text-offWhite font-body text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-charcoal/60 flex space-x-2">
                  <button
                    onClick={() => setReversingRunId(null)}
                    className="flex-1 py-3 rounded-xl bg-charcoal text-mauve hover:text-offWhite text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReverseRun}
                    className="flex-1 py-3 rounded-xl bg-red-800 hover:bg-red-700 text-white font-heading font-semibold text-xs tracking-wider"
                  >
                    Execute Reversal
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
