import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  FileText, ShieldCheck, Download, Search, AlertOctagon,
  Lock, CheckCircle2, History, Database, Cpu, RefreshCw,
  Clock, AlertTriangle, Layers, DollarSign, Activity
} from "lucide-react";

export const AuditorWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"sales" | "gst" | "stock" | "ledger" | "production" | "outstanding" | "audit_log" | "recall" | "integrity">("sales");
  const [salesData, setSalesData] = useState<any[]>([]);
  const [gstData, setGstData] = useState<any | null>(null);
  const [stockData, setStockData] = useState<any[]>([]);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const [outstandingData, setOutstandingData] = useState<any[]>([]);
  const [auditLogData, setAuditLogData] = useState<any[]>([]);
  const [recallBatch, setRecallBatch] = useState("OPEN-FLOUR-001");
  const [recallResult, setRecallResult] = useState<any | null>(null);
  const [integrityResult, setIntegrityResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, [tab]);

  const loadReports = async () => {
    setLoading(true);
    try {
      if (tab === "sales") {
        const data = await apiFetch("/reports/sales-register");
        setSalesData(data || []);
      } else if (tab === "gst") {
        const data = await apiFetch("/reports/gst-summary");
        setGstData(data);
      } else if (tab === "stock") {
        const data = await apiFetch("/reports/stock-summary");
        setStockData(data || []);
      } else if (tab === "ledger") {
        const data = await apiFetch("/stock/ledger");
        setLedgerData(data || []);
      } else if (tab === "production") {
        const data = await apiFetch("/reports/production-report");
        setProductionData(data || []);
      } else if (tab === "outstanding") {
        const data = await apiFetch("/payments/outstanding");
        setOutstandingData(data || []);
      } else if (tab === "audit_log") {
        const data = await apiFetch("/reports/audit-log");
        setAuditLogData(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateRecall = async () => {
    if (!recallBatch) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/trace/forward?batch_no=${recallBatch}`);
      setRecallResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/audit/integrity");
      setIntegrityResult(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (endpoint: string, filename: string) => {
    window.open(`http://localhost:8000/reports/${endpoint}?format=csv`, "_blank");
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-charcoal/80 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-wide text-offWhite">
                Auditor & Compliance Hub
              </h1>
              <span className="flex items-center space-x-1 px-3 py-1 rounded-full bg-mauve/20 text-mauve border border-mauve/30 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>STRICTLY READ-ONLY</span>
              </span>
            </div>
            <p className="text-xs text-mauve mt-1 font-body">
              Statutory GST registers, stock balance verification, batch recall simulation, and tamper-evident audit logs.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-charcoal/80 py-4 mb-6 text-xs font-heading font-semibold">
          {[
            { id: "sales", label: "Sales Register" },
            { id: "gst", label: "GST Summary (GSTR-1 & 3B)" },
            { id: "stock", label: "Stock Summary" },
            { id: "ledger", label: "Stock Ledger (I1)" },
            { id: "production", label: "Production Register" },
            { id: "outstanding", label: "Outstanding Ageing" },
            { id: "audit_log", label: "Audit Trail" },
            { id: "recall", label: "Batch Recall Simulator" },
            { id: "integrity", label: "Hash-Chain Integrity" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg transition ${
                tab === t.id ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite hover:bg-charcoal/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Sales Register */}
        {tab === "sales" && (
          <div className="glass-panel p-6 border border-charcoal">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-lg text-offWhite">Statutory Sales Register</h2>
              <button
                onClick={() => downloadCSV("sales-register", "sales_register.csv")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-charcoal hover:bg-charcoal/80 text-offWhite text-xs border border-charcoal"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                  <tr>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3">Taxable</th>
                    <th className="px-4 py-3">CGST</th>
                    <th className="px-4 py-3">SGST</th>
                    <th className="px-4 py-3">IGST</th>
                    <th className="px-4 py-3">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {salesData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-bold text-violet">{s.invoice_no}</td>
                      <td className="px-4 py-3 text-mauve">{s.date}</td>
                      <td className="px-4 py-3 font-semibold text-offWhite">{s.customer_name}</td>
                      <td className="px-4 py-3 text-mauve">{s.gstin}</td>
                      <td className="px-4 py-3">₹{s.taxable_rupees}</td>
                      <td className="px-4 py-3 text-mauve">₹{s.cgst_rupees}</td>
                      <td className="px-4 py-3 text-mauve">₹{s.sgst_rupees}</td>
                      <td className="px-4 py-3 text-mauve">₹{s.igst_rupees}</td>
                      <td className="px-4 py-3 font-bold text-gold">₹{s.total_rupees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: GST Summary */}
        {tab === "gst" && gstData && (
          <div className="space-y-6">
            <div className="glass-panel p-6 border border-charcoal">
              <h2 className="font-heading font-bold text-lg text-offWhite mb-3">GSTR-3B Table 3.1(a) Outward Taxable Supplies</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
                  <div className="text-mauve">Outward Taxable Value</div>
                  <div className="text-gold font-bold text-sm mt-1">₹{gstData.gstr_3b_3_1_a.outward_taxable_rupees}</div>
                </div>
                <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
                  <div className="text-mauve">Central Tax (CGST)</div>
                  <div className="text-offWhite font-bold text-sm mt-1">₹{gstData.gstr_3b_3_1_a.cgst_rupees}</div>
                </div>
                <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
                  <div className="text-mauve">State Tax (SGST)</div>
                  <div className="text-offWhite font-bold text-sm mt-1">₹{gstData.gstr_3b_3_1_a.sgst_rupees}</div>
                </div>
                <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
                  <div className="text-mauve">Integrated Tax (IGST)</div>
                  <div className="text-offWhite font-bold text-sm mt-1">₹{gstData.gstr_3b_3_1_a.igst_rupees}</div>
                </div>
                <div className="p-3 rounded-lg bg-violet/20 border border-violet/40">
                  <div className="text-offWhite font-semibold">Total Tax Amount</div>
                  <div className="text-gold font-bold text-sm mt-1">₹{gstData.gstr_3b_3_1_a.total_tax_rupees}</div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 border border-charcoal">
              <h2 className="font-heading font-bold text-lg text-offWhite mb-3">GSTR-1 HSN Summary</h2>
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">HSN Code</th>
                    <th className="px-4 py-2.5">UQC</th>
                    <th className="px-4 py-2.5">Total Quantity</th>
                    <th className="px-4 py-2.5">Taxable Value</th>
                    <th className="px-4 py-2.5">Total Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {gstData.hsn_summary.map((h: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-heading font-bold text-violet">{h.hsn}</td>
                      <td className="px-4 py-3 text-mauve">{h.uqc}</td>
                      <td className="px-4 py-3">{h.qty} pkts</td>
                      <td className="px-4 py-3">₹{h.taxable_rupees}</td>
                      <td className="px-4 py-3 text-gold font-semibold">₹{h.tax_rupees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Stock Summary */}
        {tab === "stock" && (
          <div className="glass-panel p-6 border border-charcoal">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-offWhite">Perpetual Stock Summary</h2>
                <p className="text-xs text-mauve">Mathematical identity check: Opening + In - Out +/- Adj == Closing</p>
              </div>
              <button
                onClick={() => downloadCSV("stock-summary", "stock_summary.csv")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-charcoal hover:bg-charcoal/80 text-offWhite text-xs border border-charcoal"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Opening</th>
                    <th className="px-4 py-3">Receipts</th>
                    <th className="px-4 py-3">Issues</th>
                    <th className="px-4 py-3">Scrap</th>
                    <th className="px-4 py-3">Production In</th>
                    <th className="px-4 py-3">Dispatch</th>
                    <th className="px-4 py-3">Closing</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3 text-right">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {stockData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-semibold text-offWhite">{item.name}</td>
                      <td className="px-4 py-3 text-mauve">{item.type}</td>
                      <td className="px-4 py-3">{item.opening}</td>
                      <td className="px-4 py-3 text-green-400">+{item.receipts}</td>
                      <td className="px-4 py-3 text-red-300">-{item.issues}</td>
                      <td className="px-4 py-3 text-red-400">-{item.scrap}</td>
                      <td className="px-4 py-3 text-green-400">+{item.production_in}</td>
                      <td className="px-4 py-3 text-red-300">-{item.dispatch}</td>
                      <td className="px-4 py-3 font-bold text-gold">{item.closing} {item.uom}</td>
                      <td className="px-4 py-3 text-offWhite font-medium">₹{item.closing_value_rupees}</td>
                      <td className="px-4 py-3 text-right">
                        {item.identity_check_zero ? (
                          <span className="text-green-400 font-bold">OK (0.00)</span>
                        ) : (
                          <span className="text-red-400 font-bold">DRIFT</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Stock Ledger */}
        {tab === "ledger" && (
          <div className="glass-panel p-6 border border-charcoal">
            <h2 className="font-heading font-bold text-lg text-offWhite mb-2">Append-Only Stock Ledger (Invariant I1)</h2>
            <p className="text-xs text-mauve mb-4">Every movement is immutable. Trigger blocks any UPDATE or DELETE operations.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider font-body">
                  <tr>
                    <th className="px-3 py-2.5">ID</th>
                    <th className="px-3 py-2.5">Item</th>
                    <th className="px-3 py-2.5">Movement</th>
                    <th className="px-3 py-2.5">Qty Delta</th>
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">SHA-256 Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40">
                  {ledgerData.map((l) => (
                    <tr key={l.id} className="hover:bg-charcoal/20">
                      <td className="px-3 py-2 text-violet font-bold font-body">{l.id}</td>
                      <td className="px-3 py-2 text-offWhite font-body">{l.item_name}</td>
                      <td className="px-3 py-2 text-gold font-body">{l.movement_type}</td>
                      <td className={`px-3 py-2 font-bold ${l.qty_delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {l.qty_delta >= 0 ? `+${l.qty_delta}` : l.qty_delta}
                      </td>
                      <td className="px-3 py-2 text-mauve font-body">{l.source_type} #{l.source_id || ""}</td>
                      <td className="px-3 py-2 text-mauve">{l.ts?.substring(0, 19)}</td>
                      <td className="px-3 py-2 text-mauve/70 text-[10px]">{l.hash?.substring(0, 16)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Production Register */}
        {tab === "production" && (
          <div className="glass-panel p-6 border border-charcoal">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-lg text-offWhite">Production Batch Register</h2>
              <button
                onClick={() => downloadCSV("production-report", "production_register.csv")}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-charcoal hover:bg-charcoal/80 text-offWhite text-xs border border-charcoal"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Run No</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Good Output</th>
                    <th className="px-4 py-3">Cost/Packet</th>
                    <th className="px-4 py-3">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {productionData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-bold text-violet">{p.run_no}</td>
                      <td className="px-4 py-3 font-semibold text-offWhite">{p.product_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-500/30 text-[10px]">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{p.actual_good_output} pkts</td>
                      <td className="px-4 py-3 font-bold text-gold">₹{p.cost_per_packet_rupees}</td>
                      <td className="px-4 py-3 text-offWhite">₹{p.total_absorbed_cost_rupees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Outstanding Ageing */}
        {tab === "outstanding" && (
          <div className="glass-panel p-6 border border-charcoal space-y-4">
            <h2 className="font-heading font-bold text-lg text-offWhite">Customer Outstanding & Ageing Analysis</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Invoices</th>
                    <th className="px-4 py-3">0-30 Days</th>
                    <th className="px-4 py-3">31-60 Days</th>
                    <th className="px-4 py-3">61-90 Days</th>
                    <th className="px-4 py-3">90+ Days</th>
                    <th className="px-4 py-3 text-right">Net Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {outstandingData.map((o, idx) => (
                    <tr key={idx} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-semibold text-offWhite">{o.customer_name}</td>
                      <td className="px-4 py-3 text-mauve">{o.invoice_count}</td>
                      <td className="px-4 py-3 text-offWhite">₹{o.ageing?.["0_30"] || "0.00"}</td>
                      <td className="px-4 py-3 text-yellow-300">₹{o.ageing?.["31_60"] || "0.00"}</td>
                      <td className="px-4 py-3 text-orange-400">₹{o.ageing?.["61_90"] || "0.00"}</td>
                      <td className="px-4 py-3 text-red-400 font-bold">₹{o.ageing?.["90_plus"] || "0.00"}</td>
                      <td className="px-4 py-3 text-right font-heading font-bold text-gold">₹{o.total_outstanding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Audit Log */}
        {tab === "audit_log" && (
          <div className="glass-panel p-6 border border-charcoal space-y-4">
            <h2 className="font-heading font-bold text-lg text-offWhite">System Audit Trail & Entity Events</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider font-body">
                  <tr>
                    <th className="px-3 py-2.5">ID</th>
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">Entity</th>
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Reason / Notes</th>
                    <th className="px-3 py-2.5">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40">
                  {auditLogData.map((a) => (
                    <tr key={a.id} className="hover:bg-charcoal/20">
                      <td className="px-3 py-2 text-violet font-bold font-body">{a.id}</td>
                      <td className="px-3 py-2 text-mauve">{a.timestamp?.substring(0, 19)}</td>
                      <td className="px-3 py-2 text-offWhite font-body">{a.entity} #{a.entity_id}</td>
                      <td className="px-3 py-2 text-gold font-body">{a.action}</td>
                      <td className="px-3 py-2 text-offWhite font-body">{a.reason || "—"}</td>
                      <td className="px-3 py-2 text-mauve/70 text-[10px]">{a.hash?.substring(0, 16)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 8: Recall Simulator */}
        {tab === "recall" && (
          <div className="space-y-6">
            <div className="glass-panel p-6 border border-charcoal">
              <h2 className="font-heading font-bold text-lg text-offWhite mb-2">Batch Genealogy & Recall Simulator</h2>
              <p className="text-xs text-mauve mb-4 font-body">
                Enter any raw material lot (e.g. OPEN-FLOUR-001) to trace forward through production runs to affected finished goods batches and customers.
              </p>
              
              <div className="flex gap-3 max-w-lg">
                <input
                  type="text"
                  value={recallBatch}
                  onChange={(e) => setRecallBatch(e.target.value)}
                  placeholder="e.g. OPEN-FLOUR-001"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm font-heading font-semibold"
                />
                <button
                  onClick={handleSimulateRecall}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-lg bg-violet hover:bg-violet/90 text-white font-heading font-semibold text-xs shadow-glow"
                >
                  Simulate Recall
                </button>
              </div>
            </div>

            {recallResult && (
              <div className="glass-panel p-6 border border-red-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-red-400 font-heading font-bold">
                    <AlertOctagon className="w-5 h-5" />
                    <span>Recall Simulation Result for Lot: {recallResult.raw_batch_no}</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-red-900/40 text-red-300 border border-red-500/30 font-semibold">
                    Status: {recallResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-charcoal/40">
                    <div className="text-mauve">Affected Production Runs</div>
                    <div className="text-lg font-bold font-heading text-gold mt-1">{recallResult.affected_runs_count} Run(s)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-charcoal/40">
                    <div className="text-mauve">Total Packets Shipped to Customers</div>
                    <div className="text-lg font-bold font-heading text-red-400 mt-1">{recallResult.total_packets_shipped} Packets</div>
                  </div>
                  <div className="p-3 rounded-lg bg-charcoal/40">
                    <div className="text-mauve">Affected Customers</div>
                    <div className="text-lg font-bold font-heading text-offWhite mt-1">{recallResult.affected_customers.length} Retailer(s)</div>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs uppercase tracking-wider text-mauve mb-2">Affected Invoices & Consignees</h4>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-charcoal/40 text-mauve uppercase">
                      <tr>
                        <th className="px-4 py-2">Customer Name</th>
                        <th className="px-4 py-2">Quantity Shipped</th>
                        <th className="px-4 py-2">Invoice References</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-charcoal/40 font-body">
                      {recallResult.affected_customers.map((c: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-semibold text-offWhite">{c.customer_name}</td>
                          <td className="px-4 py-2.5 text-gold font-bold">{c.packets_shipped} pkts</td>
                          <td className="px-4 py-2.5 text-violet">{c.invoices.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 9: Hash Chain Integrity */}
        {tab === "integrity" && (
          <div className="glass-panel p-6 border border-charcoal space-y-4">
            <h2 className="font-heading font-bold text-lg text-offWhite">Cryptographic Hash-Chain Integrity Verification</h2>
            <p className="text-xs text-mauve font-body">
              Recalculates the SHA-256 hash chain (H_i = SHA256(H_i-1 || canonical_row)) across all stock ledger entries to cryptographically detect tampering or manual row updates.
            </p>

            <button
              onClick={handleVerifyIntegrity}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-gold text-deepBlack font-heading font-bold text-xs shadow-goldGlow transition"
            >
              Verify Cryptographic Chain
            </button>

            {integrityResult && (
              <div className="mt-4 p-4 rounded-xl bg-charcoal/40 border border-charcoal text-xs space-y-2">
                <div className="flex items-center space-x-2 text-green-400 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Integrity Status: {integrityResult.status}</span>
                </div>
                <p className="text-offWhite font-body">
                  Successfully re-computed and verified <strong>{integrityResult.stock_ledger_rows_verified}</strong> append-only stock ledger rows without any broken chain links.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
