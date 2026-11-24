import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  Inbox, FileText, Truck, Package, Check, X, Pause, Sparkles,
  AlertTriangle, RefreshCw, Users, ShoppingCart, DollarSign,
  Settings, ChevronRight, Eye, Plus, Download, Search,
  TrendingUp, Layers, BarChart2, CreditCard, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TabType =
  | "overview" | "inbox" | "invoices" | "stock" | "payments"
  | "customers" | "products" | "suppliers" | "users" | "reports";

interface KPICardProps { label: string; value: string; sub?: string; accent?: string; icon: React.ReactNode; }
const KPICard: React.FC<KPICardProps> = ({ label, value, sub, accent = "text-gold", icon }) => (
  <div className="glass-panel p-5 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-mauve font-body">{label}</span>
      <span className="text-mauve opacity-70">{icon}</span>
    </div>
    <div className={`font-heading text-2xl font-bold ${accent}`}>{value}</div>
    {sub && <div className="text-xs text-mauve font-body">{sub}</div>}
  </div>
);

export const AdminWorkspace: React.FC = () => {
  const [tab, setTab] = useState<TabType>("overview");
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [stockCheck, setStockCheck] = useState<any | null>(null);
  const [decision, setDecision] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [paymentForm, setPaymentForm] = useState({ invoice_id: "", amount: "", mode: "CASH", ref: "" });
  const [paymentMsg, setPaymentMsg] = useState<string | null>(null);
  const [expandedInv, setExpandedInv] = useState<number | null>(null);
  const [reconcile, setReconcile] = useState<any | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ords, invs, stks, custs, prods, sups] = await Promise.all([
        apiFetch("/orders").catch(() => []),
        apiFetch("/invoices").catch(() => []),
        apiFetch("/stock/summary").catch(() => []),
        apiFetch("/masters/customers").catch(() => []),
        apiFetch("/masters/items?type=FINISHED_GOOD").catch(() => []),
        apiFetch("/masters/suppliers").catch(() => []),
      ]);
      setOrders(Array.isArray(ords) ? ords : []);
      setInvoices(Array.isArray(invs) ? invs : []);
      setStockSummary(Array.isArray(stks) ? stks : []);
      setCustomers(Array.isArray(custs) ? custs : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setSuppliers(Array.isArray(sups) ? sups : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = async () => {
    try {
      const u = await apiFetch("/auth/users").catch(() => []);
      setUsers(Array.isArray(u) ? u : []);
    } catch {}
  };

  const loadOutstanding = async () => {
    try {
      const o = await apiFetch("/payments/outstanding").catch(() => []);
      setOutstanding(Array.isArray(o) ? o : []);
    } catch {}
  };

  const loadAuditLog = async () => {
    try {
      const logs = await apiFetch("/reports/audit-log").catch(() => []);
      setAuditLog(Array.isArray(logs) ? logs : []);
    } catch {}
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "payments") loadOutstanding();
  }, [tab]);

  const handleSelectOrder = async (order: any) => {
    setSelectedOrder(order);
    setStockCheck(null);
    setDecision(null);
    try {
      const chk = await apiFetch(`/orders/${order.id}/stock-check`);
      setStockCheck(chk);
      const firstLineProdId = chk.lines?.[0]?.product_id;
      if (firstLineProdId) {
        const dec = await apiFetch(`/insights/decision?product_id=${firstLineProdId}`).catch(() => null);
        setDecision(dec);
      }
    } catch (err) { console.error(err); }
  };

  const approveOrder = async (orderId: number) => {
    try {
      await apiFetch(`/orders/${orderId}/approve`, { method: "POST" });
      setActionMessage(`✅ Order #${orderId} approved — stock reserved.`);
      setSelectedOrder(null);
      loadData();
    } catch (err: any) { setActionMessage(`❌ ${err.message}`); }
  };

  const holdOrder = async (orderId: number) => {
    try {
      await apiFetch(`/orders/${orderId}/hold`, {
        method: "POST",
        body: JSON.stringify({ note: "Awaiting production run" }),
      });
      setActionMessage(`⏸ Order #${orderId} placed on hold.`);
      setSelectedOrder(null);
      loadData();
    } catch (err: any) { setActionMessage(`❌ ${err.message}`); }
  };

  const rejectOrder = async (orderId: number) => {
    if (!rejectReason.trim()) { alert("Rejection reason required"); return; }
    try {
      await apiFetch(`/orders/${orderId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setActionMessage(`🚫 Order #${orderId} rejected.`);
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedOrder(null);
      loadData();
    } catch (err: any) { setActionMessage(`❌ ${err.message}`); }
  };

  const raiseInvoice = async (orderId: number) => {
    try {
      const res = await apiFetch(`/invoices/from-order/${orderId}`, { method: "POST" });
      setActionMessage(`🧾 Invoice ${res.invoice_no} raised! Total ₹${res.total_amount_rupees}`);
      loadData();
    } catch (err: any) { setActionMessage(`❌ ${err.message}`); }
  };

  const dispatchInvoice = async (invoiceId: number) => {
    try {
      const res = await apiFetch(`/invoices/${invoiceId}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ vehicle_no: "TN-45-BTL-01" }),
      });
      setActionMessage(`🚚 Dispatch ${res.dispatch_no} done — FEFO allocation complete!`);
      loadData();
    } catch (err: any) { setActionMessage(`❌ ${err.message}`); }
  };

  const recordPayment = async () => {
    if (!paymentForm.invoice_id || !paymentForm.amount) {
      setPaymentMsg("Invoice ID and amount are required."); return;
    }
    try {
      const res = await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: parseInt(paymentForm.invoice_id),
          amount_paise: Math.round(parseFloat(paymentForm.amount) * 100),
          mode: paymentForm.mode,
          reference_no: paymentForm.ref || null,
        }),
      });
      setPaymentMsg(`✅ Payment of ₹${paymentForm.amount} recorded. Outstanding: ₹${(res.outstanding_paise / 100).toFixed(2)}`);
      setPaymentForm({ invoice_id: "", amount: "", mode: "CASH", ref: "" });
      loadOutstanding();
    } catch (err: any) { setPaymentMsg(`❌ ${err.message}`); }
  };

  const runReconcile = async () => {
    try {
      const r = await apiFetch("/stock/reconcile");
      setReconcile(r);
    } catch (err: any) { setReconcile({ status: "ERROR", message: err.message }); }
  };

  const filteredOrders = orders.filter(o =>
    o.order_no?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const submittedCount = orders.filter(o => o.status === "SUBMITTED").length;
  const totalOrderValue = orders.reduce((s, o) => s + (o.total_value_paise || 0), 0) / 100;
  const totalInvoicedValue = invoices.reduce((s, i) => s + (parseFloat(i.total_amount_rupees) || 0), 0);

  const statusColor = (s: string) => {
    if (s === "APPROVED" || s === "DISPATCHED") return "bg-green-900/40 text-green-300 border-green-500/30";
    if (s === "SUBMITTED") return "bg-yellow-900/40 text-yellow-300 border-yellow-500/30";
    if (s === "HELD") return "bg-orange-900/40 text-orange-300 border-orange-500/30";
    if (s === "REJECTED") return "bg-red-900/40 text-red-300 border-red-500/30";
    if (s === "INVOICED") return "bg-blue-900/40 text-blue-300 border-blue-500/30";
    return "bg-purple-900/40 text-purple-300 border-purple-500/30";
  };

  const navTabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart2 className="w-4 h-4" /> },
    { key: "inbox", label: "Order Inbox", icon: <Inbox className="w-4 h-4" /> },
    { key: "invoices", label: "Invoices & Dispatch", icon: <FileText className="w-4 h-4" /> },
    { key: "stock", label: "Stock", icon: <Package className="w-4 h-4" /> },
    { key: "payments", label: "Payments", icon: <DollarSign className="w-4 h-4" /> },
    { key: "customers", label: "Customers", icon: <Users className="w-4 h-4" /> },
    { key: "products", label: "Products", icon: <ShoppingCart className="w-4 h-4" /> },
    { key: "suppliers", label: "Suppliers", icon: <Truck className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Settings className="w-4 h-4" /> },
    { key: "reports", label: "Reports", icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 border-b border-charcoal/60 scrollbar-hide">
          {navTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-heading font-semibold whitespace-nowrap transition ${
                tab === t.key ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite hover:bg-charcoal/40"
              }`}
            >
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Action Message Toast */}
        <AnimatePresence>
          {actionMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-lg bg-violet/20 border border-violet/40 text-sm text-offWhite flex items-center justify-between"
            >
              <span>{actionMessage}</span>
              <button onClick={() => setActionMessage(null)}><X className="w-4 h-4 text-mauve hover:text-offWhite" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-2xl font-bold text-offWhite">Operations Overview</h1>
              <button onClick={loadData} className="text-mauve hover:text-offWhite">
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Pending Approvals" value={submittedCount.toString()} sub="orders awaiting action" accent="text-gold" icon={<Inbox className="w-5 h-5" />} />
              <KPICard label="Total Order Value" value={`₹${totalOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="all orders" accent="text-gold" icon={<TrendingUp className="w-5 h-5" />} />
              <KPICard label="Invoiced Value" value={`₹${totalInvoicedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="raised invoices" accent="text-sage" icon={<FileText className="w-5 h-5" />} />
              <KPICard label="Stock Lines" value={stockSummary.length.toString()} sub="items tracked" accent="text-violet" icon={<Package className="w-5 h-5" />} />
            </div>

            {/* Recent Orders */}
            <div className="glass-panel p-5">
              <h2 className="font-heading font-bold text-base text-offWhite mb-4 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-violet" /> Recent Orders
              </h2>
              <div className="space-y-2">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-charcoal/30 hover:bg-charcoal/50 cursor-pointer transition" onClick={() => { setTab("inbox"); handleSelectOrder(o); }}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(o.status)}`}>{o.status}</span>
                      <div>
                        <div className="font-heading text-sm font-bold text-offWhite">{o.order_no}</div>
                        <div className="text-xs text-mauve">{o.customer_name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading font-bold text-gold text-sm">₹{(o.total_value_paise / 100).toFixed(2)}</div>
                      <div className="text-xs text-mauve">{o.total_packets} pkts</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setTab("inbox")} className="mt-4 w-full py-2 text-xs text-violet hover:text-offWhite font-semibold flex items-center justify-center gap-1">
                View All Orders <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stock Health Quick View */}
            <div className="glass-panel p-5">
              <h2 className="font-heading font-bold text-base text-offWhite mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-sage" /> Inventory Snapshot
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {stockSummary.slice(0, 6).map(s => (
                  <div key={s.item_id} className="p-3 rounded-xl bg-charcoal/30 border border-charcoal/60">
                    <div className="text-[10px] text-mauve uppercase tracking-wider">{s.type}</div>
                    <div className="font-heading font-semibold text-sm text-offWhite mt-0.5 truncate">{s.item_name}</div>
                    <div className="font-heading text-lg font-bold text-gold mt-1">{s.qty_base}</div>
                    <div className="text-[11px] text-mauve">Reserved: {s.reserved_qty}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ledger Reconciliation */}
            <div className="glass-panel p-5">
              <h2 className="font-heading font-bold text-base text-offWhite mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-gold" /> Ledger Integrity Check
              </h2>
              <button onClick={runReconcile} className="px-4 py-2 rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/40 text-gold text-xs font-semibold transition">
                Run Reconciliation
              </button>
              {reconcile && (
                <div className={`mt-3 p-4 rounded-lg border text-sm font-body ${
                  reconcile.status === "HEALTHY" ? "bg-green-900/20 border-green-500/40 text-green-300" : "bg-red-900/20 border-red-500/40 text-red-300"
                }`}>
                  <div className="font-bold">{reconcile.status}</div>
                  <div className="text-xs mt-1 opacity-80">
                    Balance: {reconcile.balance_matches ? "✅ Matches" : "❌ Drift detected"} ·
                    Hash chain: {reconcile.hash_chain_valid ? "✅ Valid" : "❌ Broken"} ·
                    Rows checked: {reconcile.total_rows}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ORDER INBOX ═══ */}
        {tab === "inbox" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-xl font-bold">Order Inbox</h1>
              <button onClick={loadData} className="text-mauve hover:text-offWhite">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mauve" />
              <input
                value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                placeholder="Search orders by number or customer..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-charcoal/40 border border-charcoal focus:border-violet focus:outline-none text-sm font-body text-offWhite"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Orders list */}
              <div className="lg:col-span-2 glass-panel p-4 space-y-1 max-h-[70vh] overflow-y-auto">
                {filteredOrders.length === 0 && (
                  <div className="text-center py-16 text-mauve text-sm">No orders found.</div>
                )}
                {filteredOrders.map(o => (
                  <div
                    key={o.id}
                    onClick={() => handleSelectOrder(o)}
                    className={`py-3 px-4 rounded-xl flex items-center justify-between cursor-pointer transition ${
                      selectedOrder?.id === o.id ? "bg-charcoal border border-violet/50" : "hover:bg-charcoal/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-sm text-offWhite">{o.order_no}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(o.status)}`}>{o.status}</span>
                      </div>
                      <p className="text-xs text-mauve mt-0.5">{o.customer_name} · {o.total_packets} packets</p>
                      {o.notes && <p className="text-[11px] text-violet mt-0.5 truncate">{o.notes}</p>}
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="font-heading font-bold text-gold text-sm">₹{(o.total_value_paise / 100).toFixed(2)}</div>
                      {o.status === "APPROVED" && (
                        <button
                          onClick={e => { e.stopPropagation(); raiseInvoice(o.id); }}
                          className="mt-1 px-2.5 py-1 rounded bg-violet hover:bg-violet/90 text-white text-[10px] font-semibold shadow-glow"
                        >Raise Invoice</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Detail panel */}
              <div className="glass-panel p-5 space-y-4">
                {selectedOrder ? (
                  <>
                    <div className="border-b border-charcoal/60 pb-3">
                      <div className="text-xs uppercase tracking-wider text-mauve">Order</div>
                      <h3 className="font-heading text-xl font-bold text-offWhite">{selectedOrder.order_no}</h3>
                      <p className="text-xs text-mauve">{selectedOrder.customer_name}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(selectedOrder.status)}`}>
                        {selectedOrder.status}
                      </span>
                    </div>

                    {/* Stock Check */}
                    {stockCheck && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wider text-mauve">Inventory Check</div>
                        {stockCheck.lines?.map((l: any) => (
                          <div key={l.product_id} className="p-3 rounded-lg bg-charcoal/40 border border-charcoal/60 text-xs">
                            <div className="flex justify-between font-semibold text-offWhite">
                              <span className="truncate mr-2">{l.product_name}</span>
                              <span>{l.qty_ordered} pkts</span>
                            </div>
                            <div className="flex justify-between text-mauve mt-1">
                              <span>Available: {l.available} pkts</span>
                              {l.shortage > 0 ? (
                                <span className="text-red-400 font-bold">Short {l.shortage}</span>
                              ) : (
                                <span className="text-green-400">OK</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Decision Engine */}
                    {decision && decision.shortage > 0 && (
                      <div className="p-4 rounded-xl bg-violet/15 border border-violet/40 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 text-gold font-heading font-semibold">
                          <Sparkles className="w-4 h-4" /><span>Decision Engine</span>
                        </div>
                        <p className="text-offWhite">{decision.recommendation}</p>
                        <div className="text-[11px] text-mauve">
                          Target: {decision.target_production} pkts · Batches: {decision.batches_recommended}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-3 border-t border-charcoal/60 space-y-2">
                      {selectedOrder.status === "SUBMITTED" && (
                        <>
                          <button onClick={() => approveOrder(selectedOrder.id)}
                            className="w-full py-2.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                            <Check className="w-4 h-4" /> Approve Order
                          </button>
                          <button onClick={() => holdOrder(selectedOrder.id)}
                            className="w-full py-2.5 rounded-lg bg-charcoal hover:bg-charcoal/80 text-offWhite border border-mauve/40 text-xs font-medium flex items-center justify-center gap-1.5">
                            <Pause className="w-4 h-4 text-gold" /> Hold (Awaiting Production)
                          </button>
                          <button onClick={() => setShowRejectModal(true)}
                            className="w-full py-2.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 text-xs font-medium flex items-center justify-center gap-1.5">
                            <X className="w-4 h-4" /> Reject Order
                          </button>
                        </>
                      )}
                      {selectedOrder.status === "APPROVED" && (
                        <button onClick={() => raiseInvoice(selectedOrder.id)}
                          className="w-full py-2.5 rounded-lg bg-violet hover:bg-violet/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-glow">
                          <FileText className="w-4 h-4" /> Raise GST Invoice
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-mauve text-xs">
                    <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    Select an order to review
                  </div>
                )}
              </div>
            </div>

            {/* Reject Modal */}
            <AnimatePresence>
              {showRejectModal && (
                <motion.div
                  className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="glass-panel-glow p-6 max-w-sm w-full"
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  >
                    <h3 className="font-heading text-lg font-bold text-offWhite mb-3">Reject Order</h3>
                    <p className="text-xs text-mauve mb-4">Mandatory: provide a reason for rejection.</p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Reason for rejection..."
                      className="w-full px-3 py-2 rounded-lg bg-charcoal/60 border border-charcoal focus:border-red-500 focus:outline-none text-offWhite text-sm font-body resize-none"
                    />
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => rejectOrder(selectedOrder.id)}
                        className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold">
                        Confirm Rejection
                      </button>
                      <button onClick={() => setShowRejectModal(false)}
                        className="flex-1 py-2 rounded-lg bg-charcoal text-mauve text-xs border border-charcoal hover:border-mauve/40">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══ INVOICES ═══ */}
        {tab === "invoices" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">GST Invoices & Dispatch</h1>
            <div className="glass-panel overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/50 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                  <tr>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Taxable</th>
                    <th className="px-4 py-3 text-right">GST</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {invoices.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-mauve">No invoices yet. Approve an order first.</td></tr>
                  )}
                  {invoices.map(inv => (
                    <React.Fragment key={inv.id}>
                      <tr className="hover:bg-charcoal/20 cursor-pointer" onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}>
                        <td className="px-4 py-3 font-heading font-bold text-violet">{inv.invoice_no}</td>
                        <td className="px-4 py-3 font-semibold text-offWhite">{inv.customer_name}</td>
                        <td className="px-4 py-3 text-mauve">{inv.supply_type}</td>
                        <td className="px-4 py-3 text-right text-offWhite">₹{inv.total_taxable_rupees}</td>
                        <td className="px-4 py-3 text-right text-mauve">
                          ₹{(parseFloat(inv.total_cgst_rupees || 0) + parseFloat(inv.total_sgst_rupees || 0) + parseFloat(inv.total_igst_rupees || 0)).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gold">₹{inv.total_amount_rupees}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(inv.status)}`}>{inv.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          <button onClick={e => { e.stopPropagation(); window.open(`http://localhost:8000/invoices/${inv.id}/pdf`, "_blank"); }}
                            className="px-2.5 py-1 rounded bg-charcoal hover:bg-charcoal/80 text-offWhite text-[10px] border border-charcoal/80">
                            PDF
                          </button>
                          {inv.status === "POSTED" && (
                            <button onClick={e => { e.stopPropagation(); dispatchInvoice(inv.id); }}
                              className="px-2.5 py-1 rounded bg-violet hover:bg-violet/90 text-white text-[10px] font-semibold">
                              Dispatch (FEFO)
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedInv === inv.id && (
                        <tr>
                          <td colSpan={8} className="px-6 py-3 bg-charcoal/20">
                            <div className="text-xs text-mauve grid grid-cols-3 gap-4">
                              {inv.supply_type === "INTRA" ? (
                                <>
                                  <div>CGST: <span className="text-offWhite">₹{inv.total_cgst_rupees}</span></div>
                                  <div>SGST: <span className="text-offWhite">₹{inv.total_sgst_rupees}</span></div>
                                </>
                              ) : (
                                <div>IGST: <span className="text-offWhite">₹{inv.total_igst_rupees}</span></div>
                              )}
                              <div>Outstanding: <span className="text-gold">₹{(inv.outstanding_paise / 100).toFixed(2)}</span></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ STOCK ═══ */}
        {tab === "stock" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-xl font-bold">Real-Time Inventory</h1>
              <button onClick={loadData} className="text-mauve hover:text-offWhite"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stockSummary.map(s => {
                const pct = s.reserved_qty > 0 ? Math.min(100, (s.reserved_qty / (s.qty_base || 1)) * 100) : 0;
                return (
                  <div key={s.item_id} className="glass-panel p-4">
                    <div className="flex justify-between items-center text-[10px] text-mauve uppercase tracking-wider mb-1">
                      <span>{s.type}</span><span>{s.display_uom}</span>
                    </div>
                    <h3 className="font-heading font-semibold text-sm text-offWhite truncate">{s.item_name}</h3>
                    <div className="mt-3">
                      <div className="text-2xl font-heading font-bold text-gold">{s.qty_base}</div>
                      <div className="text-[11px] text-mauve mt-1">Reserved: {s.reserved_qty}</div>
                      {s.reserved_qty > 0 && (
                        <div className="mt-2 w-full h-1 rounded bg-charcoal/60">
                          <div className="h-1 rounded bg-gold/60" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ PAYMENTS ═══ */}
        {tab === "payments" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">Payments & Outstanding</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Record Payment */}
              <div className="glass-panel-glow p-6 space-y-4">
                <h2 className="font-heading font-bold text-base text-offWhite">Record Payment</h2>
                <div>
                  <label className="text-xs text-mauve uppercase tracking-wider block mb-1">Invoice ID</label>
                  <input value={paymentForm.invoice_id} onChange={e => setPaymentForm(f => ({ ...f, invoice_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-sm text-offWhite font-body" placeholder="e.g. 1" />
                </div>
                <div>
                  <label className="text-xs text-mauve uppercase tracking-wider block mb-1">Amount (₹)</label>
                  <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-sm text-offWhite font-body" placeholder="e.g. 4000.00" />
                </div>
                <div>
                  <label className="text-xs text-mauve uppercase tracking-wider block mb-1">Payment Mode</label>
                  <select value={paymentForm.mode} onChange={e => setPaymentForm(f => ({ ...f, mode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-sm text-offWhite font-body">
                    <option value="CASH">Cash</option>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-mauve uppercase tracking-wider block mb-1">Reference No (optional)</label>
                  <input value={paymentForm.ref} onChange={e => setPaymentForm(f => ({ ...f, ref: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-sm text-offWhite font-body" placeholder="Cheque/UTR no" />
                </div>
                <button onClick={recordPayment}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-violet to-violet/80 text-white font-heading font-semibold text-sm flex items-center justify-center gap-2 shadow-glow">
                  <CreditCard className="w-4 h-4" /> Record Payment
                </button>
                {paymentMsg && (
                  <div className={`p-3 rounded-lg text-xs ${paymentMsg.startsWith("✅") ? "bg-green-900/30 text-green-300 border border-green-500/30" : "bg-red-900/30 text-red-300 border border-red-500/30"}`}>
                    {paymentMsg}
                  </div>
                )}
              </div>

              {/* Outstanding */}
              <div className="glass-panel p-5 space-y-3">
                <h2 className="font-heading font-bold text-base text-offWhite">Customer Outstanding</h2>
                {outstanding.length === 0 ? (
                  <div className="text-center py-8 text-mauve text-xs">No outstanding balances.</div>
                ) : (
                  <div className="space-y-2">
                    {outstanding.map((o, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-charcoal/30">
                        <div>
                          <div className="font-heading font-semibold text-sm text-offWhite">{o.customer_name}</div>
                          <div className="text-xs text-mauve">{o.invoice_count} invoices</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-heading font-bold text-sm ${parseFloat(o.overdue_amount) > 0 ? "text-red-400" : "text-gold"}`}>
                            ₹{parseFloat(o.total_outstanding).toFixed(2)}
                          </div>
                          {parseFloat(o.overdue_amount) > 0 && (
                            <div className="text-[11px] text-red-400">Overdue ₹{parseFloat(o.overdue_amount).toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ CUSTOMERS ═══ */}
        {tab === "customers" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">Customer Master</h1>
            <div className="glass-panel overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/50 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Credit Days</th>
                    <th className="px-4 py-3">Credit Limit</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-semibold text-offWhite">{c.name}</td>
                      <td className="px-4 py-3 text-mauve font-mono">{c.gstin || "—"}</td>
                      <td className="px-4 py-3 text-mauve">{c.state_code}</td>
                      <td className="px-4 py-3 text-offWhite">{c.credit_days} days</td>
                      <td className="px-4 py-3 text-gold">₹{(c.credit_limit_paise / 100).toFixed(0)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${c.active ? "bg-green-900/40 text-green-300 border-green-500/30" : "bg-red-900/40 text-red-300 border-red-500/30"}`}>
                          {c.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ PRODUCTS ═══ */}
        {tab === "products" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">Finished Goods Catalogue</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(p => (
                <div key={p.id} className="glass-panel p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-base text-offWhite">{p.name}</h3>
                      <p className="text-xs text-mauve mt-0.5">{p.sku}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-sage/20 text-sage border-sage/30">
                      {p.base_uom}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-charcoal/40">
                      <div className="text-mauve">HSN</div>
                      <div className="text-offWhite font-semibold">{p.hsn_code || "—"}</div>
                    </div>
                    <div className="p-2 rounded bg-charcoal/40">
                      <div className="text-mauve">GST Rate</div>
                      <div className="text-offWhite font-semibold">{p.gst_rate}%</div>
                    </div>
                    {p.shelf_life_days && (
                      <div className="p-2 rounded bg-charcoal/40">
                        <div className="text-mauve">Shelf Life</div>
                        <div className="text-offWhite font-semibold">{p.shelf_life_days} days</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SUPPLIERS ═══ */}
        {tab === "suppliers" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">Supplier Master</h1>
            <div className="glass-panel overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/50 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Payment Terms</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-semibold text-offWhite">{s.name}</td>
                      <td className="px-4 py-3 text-mauve font-mono">{s.gstin || "—"}</td>
                      <td className="px-4 py-3 text-mauve">{s.state_code}</td>
                      <td className="px-4 py-3 text-offWhite">{s.payment_terms_days} days</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-green-900/40 text-green-300 border-green-500/30">ACTIVE</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ USERS ═══ */}
        {tab === "users" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">User Management</h1>
            <div className="glass-panel overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/50 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-semibold text-offWhite">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          u.role === "ADMIN" ? "bg-violet/30 text-violet border-violet/40" :
                          u.role === "OWNER" ? "bg-gold/20 text-gold border-gold/40" :
                          "bg-charcoal text-mauve border-charcoal/60"
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${u.active ? "bg-green-900/40 text-green-300 border-green-500/30" : "bg-red-900/40 text-red-300 border-red-500/30"}`}>
                          {u.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ REPORTS ═══ */}
        {tab === "reports" && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-bold">Reports & Exports</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: "Sales Register", desc: "All invoices with GST breakup", url: "/reports/sales-register/csv", icon: <FileText className="w-5 h-5" /> },
                { title: "Stock Summary", desc: "Current inventory across all items", url: "/reports/stock-summary/csv", icon: <Package className="w-5 h-5" /> },
                { title: "GST GSTR-1", desc: "B2B outward supplies register", url: "/reports/gst/gstr1", icon: <TrendingUp className="w-5 h-5" /> },
                { title: "GST GSTR-3B", desc: "Summary of GST liability", url: "/reports/gst/gstr3b", icon: <BarChart2 className="w-5 h-5" /> },
                { title: "Stock Ledger", desc: "Append-only transaction ledger", url: "/stock/ledger", icon: <Layers className="w-5 h-5" /> },
                { title: "Audit Log", desc: "System audit trail of all actions", url: "/reports/audit-log", icon: <AlertTriangle className="w-5 h-5" /> },
              ].map(r => (
                <div key={r.title} className="glass-panel p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-violet">{r.icon}<h3 className="font-heading font-bold text-offWhite">{r.title}</h3></div>
                  <p className="text-xs text-mauve">{r.desc}</p>
                  <a href={`http://localhost:8000${r.url}`} target="_blank" rel="noreferrer"
                    className="mt-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-charcoal hover:bg-charcoal/80 border border-charcoal/60 text-offWhite text-xs font-semibold transition">
                    <Download className="w-3.5 h-3.5 text-gold" /> Download / View
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
