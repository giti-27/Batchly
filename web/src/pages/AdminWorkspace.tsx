import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  Inbox, FileText, Truck, DollarSign, Package, Check, X,
  Pause, Sparkles, AlertTriangle, ArrowRight, Eye, RefreshCw
} from "lucide-react";

export const AdminWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"inbox" | "invoices" | "stock" | "payments">("inbox");
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [stockCheck, setStockCheck] = useState<any | null>(null);
  const [decision, setDecision] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ords, invs, stks] = await Promise.all([
        apiFetch("/orders"),
        apiFetch("/invoices"),
        apiFetch("/stock/summary"),
      ]);
      setOrders(ords);
      setInvoices(invs);
      setStockSummary(stks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (order: any) => {
    setSelectedOrder(order);
    try {
      const chk = await apiFetch(`/orders/${order.id}/stock-check`);
      setStockCheck(chk);
      
      // If shortage, fetch Decision Engine recommendations
      const firstLineProdId = chk.lines[0]?.product_id;
      if (firstLineProdId) {
        const dec = await apiFetch(`/insights/decision?product_id=${firstLineProdId}`);
        setDecision(dec);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const approveOrderAction = async (orderId: number) => {
    try {
      await apiFetch(`/orders/${orderId}/approve`, { method: "POST" });
      setActionMessage(`Order #${orderId} approved and stock reserved.`);
      setSelectedOrder(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const holdOrderAction = async (orderId: number) => {
    try {
      await apiFetch(`/orders/${orderId}/hold`, {
        method: "POST",
        body: JSON.stringify({ note: "Awaiting production run" }),
      });
      setActionMessage(`Order #${orderId} held.`);
      setSelectedOrder(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const generateInvoiceAction = async (orderId: number) => {
    try {
      const res = await apiFetch(`/invoices/from-order/${orderId}`, { method: "POST" });
      setActionMessage(`Invoice ${res.invoice_no} raised successfully!`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const dispatchInvoiceAction = async (invoiceId: number) => {
    try {
      const res = await apiFetch(`/invoices/${invoiceId}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ vehicle_no: "TN-45-BTL-01" }),
      });
      setActionMessage(`Dispatch ${res.dispatch_no} completed using FEFO!`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-4 border-b border-charcoal/80 pb-4 mb-6">
          <button
            onClick={() => setTab("inbox")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-heading font-semibold transition ${
              tab === "inbox" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Order Inbox</span>
          </button>
          <button
            onClick={() => setTab("invoices")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-heading font-semibold transition ${
              tab === "invoices" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>GST Invoices & Dispatch</span>
          </button>
          <button
            onClick={() => setTab("stock")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-heading font-semibold transition ${
              tab === "stock" ? "bg-violet text-white shadow-glow" : "text-mauve hover:text-offWhite"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Stock Availability</span>
          </button>
        </div>

        {actionMessage && (
          <div className="mb-6 p-3 rounded-lg bg-violet/20 border border-violet/40 text-xs text-violet flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-mauve hover:text-offWhite">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 1: Order Inbox */}
        {tab === "inbox" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders List */}
            <div className="lg:col-span-2 glass-panel p-6 border border-charcoal">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg text-offWhite">Submitted Orders</h2>
                <button onClick={loadData} className="text-mauve hover:text-offWhite">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="divide-y divide-charcoal/60">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => handleSelectOrder(o)}
                    className={`py-4 px-3 rounded-lg flex items-center justify-between cursor-pointer transition ${
                      selectedOrder?.id === o.id ? "bg-charcoal/80 border border-violet/40" : "hover:bg-charcoal/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-heading font-bold text-sm text-offWhite">{o.order_no}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                          o.status === "APPROVED" ? "bg-green-900/40 text-green-300 border border-green-500/30" :
                          o.status === "SUBMITTED" ? "bg-yellow-900/40 text-yellow-300 border border-yellow-500/30" :
                          "bg-purple-900/40 text-purple-300 border border-purple-500/30"
                        }`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-xs text-mauve mt-1">{o.customer_name} · {o.total_packets} packets</p>
                      {o.notes && <p className="text-[11px] text-violet mt-0.5">{o.notes}</p>}
                    </div>

                    <div className="text-right">
                      <div className="font-heading font-bold text-gold text-sm">
                        ₹{(o.total_value_paise / 100).toFixed(2)}
                      </div>
                      {o.status === "APPROVED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateInvoiceAction(o.id);
                          }}
                          className="mt-1 px-3 py-1 rounded bg-violet hover:bg-violet/90 text-white text-[11px] font-semibold shadow-glow"
                        >
                          Raise Invoice
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Details & Stock Shortage Check Drawer */}
            <div className="glass-panel p-6 border border-charcoal">
              {selectedOrder ? (
                <div className="space-y-4">
                  <div className="border-b border-charcoal/80 pb-3">
                    <span className="text-xs uppercase tracking-wider text-mauve">Selected Order</span>
                    <h3 className="font-heading text-lg font-bold text-offWhite">{selectedOrder.order_no}</h3>
                    <p className="text-xs text-mauve">{selectedOrder.customer_name}</p>
                  </div>

                  {/* Stock check lines */}
                  {stockCheck && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wider text-mauve">Inventory Check</div>
                      {stockCheck.lines.map((l: any) => (
                        <div key={l.product_id} className="p-3 rounded-lg bg-charcoal/50 border border-charcoal/80 text-xs">
                          <div className="flex justify-between font-semibold">
                            <span>{l.product_name}</span>
                            <span>{l.qty_ordered} pkts ordered</span>
                          </div>
                          <div className="flex justify-between text-mauve mt-1">
                            <span>Available FG: {l.available} pkts</span>
                            {l.shortage > 0 ? (
                              <span className="text-red-400 font-bold">Shortage: {l.shortage} pkts</span>
                            ) : (
                              <span className="text-green-400">Fulfillable</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Decision Engine Recommendation Card */}
                  {decision && decision.shortage > 0 && (
                    <div className="p-4 rounded-xl bg-violet/15 border border-violet/40 space-y-2 text-xs">
                      <div className="flex items-center space-x-1.5 text-gold font-heading font-semibold">
                        <Sparkles className="w-4 h-4" />
                        <span>Production Decision Engine</span>
                      </div>
                      <p className="text-offWhite">{decision.recommendation}</p>
                      <div className="text-[11px] text-mauve">
                        Target Production: {decision.target_production} pkts (Shortage {decision.shortage} + Safety {decision.safety_stock})
                      </div>
                      <div className="text-[11px] text-gold font-bold">
                        Batches Required: {decision.batches_recommended} batch ({decision.expected_yield_per_batch} pkts/batch)
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-charcoal/80 space-y-2">
                    {selectedOrder.status === "SUBMITTED" && (
                      <>
                        <button
                          onClick={() => approveOrderAction(selectedOrder.id)}
                          className="w-full py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>Approve Order</span>
                        </button>
                        <button
                          onClick={() => holdOrderAction(selectedOrder.id)}
                          className="w-full py-2 rounded-lg bg-charcoal hover:bg-charcoal/80 text-offWhite border border-mauve/40 text-xs font-medium flex items-center justify-center gap-1.5"
                        >
                          <Pause className="w-4 h-4 text-gold" />
                          <span>Hold (Awaiting Production)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-mauve text-xs">
                  Select an order from the inbox to review stock availability and approve.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: GST Invoices & Dispatch */}
        {tab === "invoices" && (
          <div className="glass-panel p-6 border border-charcoal">
            <h2 className="font-heading font-bold text-lg text-offWhite mb-4">Posted GST Invoices</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                  <tr>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Supply Type</th>
                    <th className="px-4 py-3">Taxable</th>
                    <th className="px-4 py-3">GST</th>
                    <th className="px-4 py-3">Total Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/40 font-body">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-charcoal/20">
                      <td className="px-4 py-3 font-heading font-bold text-violet">{inv.invoice_no}</td>
                      <td className="px-4 py-3 font-semibold text-offWhite">{inv.customer_name}</td>
                      <td className="px-4 py-3 text-mauve">{inv.supply_type}</td>
                      <td className="px-4 py-3 text-offWhite">₹{inv.total_taxable_rupees}</td>
                      <td className="px-4 py-3 text-mauve">
                        ₹{(parseFloat(inv.total_cgst_rupees || 0) + parseFloat(inv.total_sgst_rupees || 0) + parseFloat(inv.total_igst_rupees || 0)).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold text-gold">₹{inv.total_amount_rupees}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => window.open(`http://localhost:8000/invoices/${inv.id}/pdf`, "_blank")}
                          className="px-2.5 py-1 rounded bg-charcoal hover:bg-charcoal/80 text-offWhite text-[11px] border border-charcoal"
                        >
                          View PDF
                        </button>
                        <button
                          onClick={() => dispatchInvoiceAction(inv.id)}
                          className="px-2.5 py-1 rounded bg-violet hover:bg-violet/90 text-white text-[11px] font-semibold"
                        >
                          Dispatch (FEFO)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Stock Availability */}
        {tab === "stock" && (
          <div className="glass-panel p-6 border border-charcoal">
            <h2 className="font-heading font-bold text-lg text-offWhite mb-4">Real-Time Inventory Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {stockSummary.map((s) => (
                <div key={s.item_id} className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/80">
                  <div className="flex justify-between items-center text-xs text-mauve">
                    <span className="uppercase">{s.type}</span>
                    <span>{s.display_uom}</span>
                  </div>
                  <h3 className="font-heading font-semibold text-base text-offWhite mt-1">{s.item_name}</h3>
                  <div className="mt-3 flex justify-between items-baseline">
                    <div className="text-xl font-heading font-bold text-gold">{s.qty_base}</div>
                    <div className="text-xs text-mauve">Reserved: {s.reserved_qty}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
