import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import {
  ShoppingCart, Clock, TrendingUp, Plus, Minus, Package,
  Check, Sparkles, AlertCircle, RefreshCw, RotateCcw,
  Wifi, WifiOff, Users, ArrowRight, CheckCircle2, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderLinePayload {
  product_id: number;
  qty_ordered: number;
}

export const SalesmanWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"new_order" | "my_orders" | "sales" | "offline">("new_order");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [lastOrder, setLastOrder] = useState<any | null>(null);

  useEffect(() => {
    loadData();
    // Load offline queue from localStorage
    const saved = localStorage.getItem("batchly_offline_orders");
    if (saved) {
      try { setOfflineQueue(JSON.parse(saved)); } catch {}
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadData = async () => {
    try {
      const [custs, prods, ords] = await Promise.all([
        apiFetch("/masters/customers").catch(() => apiFetch("/customers")),
        apiFetch("/masters/items?type=FINISHED_GOOD").catch(() => apiFetch("/products")),
        apiFetch("/orders").catch(() => []),
      ]);
      setCustomers(custs || []);
      setProducts(prods || []);
      setOrders(ords || []);
      if (custs && custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
      }
      if (ords && ords.length > 0) {
        setLastOrder(ords[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load catalogue");
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const addCarton = (productId: number) => {
    updateQuantity(productId, 20); // Quick-add carton adds 20 whole packets
  };

  const repeatLastOrder = () => {
    if (!lastOrder) return;
    setSelectedCustomerId(lastOrder.customer_id);
    const newQty: Record<number, number> = {};
    if (lastOrder.lines) {
      lastOrder.lines.forEach((l: any) => {
        newQty[l.product_id] = l.qty_ordered;
      });
    } else {
      // Default to 20 for first product if lines not fetched
      if (products.length > 0) newQty[products[0].id] = 20;
    }
    setQuantities(newQty);
    setOrderSuccess("Populated items from last order!");
    setTimeout(() => setOrderSuccess(null), 3000);
  };

  const calculateTotals = () => {
    let totalPackets = 0;
    let taxablePaise = 0;
    products.forEach((p) => {
      const qty = quantities[p.id] || 0;
      totalPackets += qty;
      const price = p.price_paise || (p.sale_price_paise || 5000);
      taxablePaise += qty * price;
    });

    const selectedCust = customers.find((c) => c.id === selectedCustomerId);
    const isIntra = selectedCust ? selectedCust.state_code === "33" : true;
    const gstRate = 0.05; // 5%
    const taxPaise = Math.round(taxablePaise * gstRate);
    const totalPaise = taxablePaise + taxPaise;

    return {
      totalPackets,
      taxableRupees: (taxablePaise / 100).toFixed(2),
      taxRupees: (taxPaise / 100).toFixed(2),
      totalRupees: (totalPaise / 100).toFixed(2),
      isIntra,
    };
  };

  const handlePlaceOrder = async () => {
    if (!selectedCustomerId) {
      setError("Please select a customer.");
      return;
    }
    const lines: OrderLinePayload[] = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => ({
        product_id: parseInt(prodId),
        qty_ordered: qty,
      }));

    if (lines.length === 0) {
      setError("Please add at least 1 packet before placing an order.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const client_uuid = `mob-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      client_uuid,
      customer_id: selectedCustomerId,
      lines,
      notes: "Placed via Salesman Mobile PWA",
    };

    if (!isOnline) {
      // Save offline
      const updatedQueue = [...offlineQueue, { ...payload, timestamp: new Date().toISOString() }];
      setOfflineQueue(updatedQueue);
      localStorage.setItem("batchly_offline_orders", JSON.stringify(updatedQueue));
      setOrderSuccess(`Order queued offline! (Queue size: ${updatedQueue.length})`);
      setQuantities({});
      setSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOrderSuccess(`Order ${res.order_no} submitted successfully!`);
      setQuantities({});
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    setSubmitting(true);
    let synced = 0;
    const remaining: any[] = [];

    for (const ord of offlineQueue) {
      try {
        await apiFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            client_uuid: ord.client_uuid,
            customer_id: ord.customer_id,
            lines: ord.lines,
            notes: ord.notes + " (Synced from offline)",
          }),
        });
        synced++;
      } catch (err) {
        remaining.push(ord);
      }
    }

    setOfflineQueue(remaining);
    localStorage.setItem("batchly_offline_orders", JSON.stringify(remaining));
    setOrderSuccess(`Synced ${synced} orders successfully.`);
    setSubmitting(false);
    loadData();
  };

  const totals = calculateTotals();
  const selectedCust = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col pb-24 md:pb-8">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Status & Sync Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-charcoal/40 border border-charcoal/80 text-xs">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <span className="flex items-center space-x-1.5 text-green-400">
                <Wifi className="w-3.5 h-3.5" />
                <span className="font-semibold">Online</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-yellow-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="font-semibold">Offline Mode</span>
              </span>
            )}
            <span className="text-mauve">· Salesman Portal</span>
          </div>

          {offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              disabled={submitting || !isOnline}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-violet/30 hover:bg-violet/40 text-violet text-[11px] font-semibold border border-violet/40"
            >
              <RefreshCw className={`w-3 h-3 ${submitting ? "animate-spin" : ""}`} />
              <span>Pending Sync ({offlineQueue.length})</span>
            </button>
          )}
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-green-900/30 border border-green-500/40 text-green-200 text-xs flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>{orderSuccess}</span>
              </div>
              <button onClick={() => setOrderSuccess(null)} className="text-mauve hover:text-offWhite">✕</button>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-red-900/30 border border-red-500/40 text-red-200 text-xs flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-mauve hover:text-offWhite">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ TAB 1: NEW ORDER ═══ */}
        {tab === "new_order" && (
          <div className="space-y-6">
            {/* Customer Selection & Quick Actions */}
            <div className="glass-panel p-5 border border-charcoal/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-offWhite font-heading font-semibold text-sm">
                  <Users className="w-4 h-4 text-violet" />
                  <span>Select Customer</span>
                </div>
                {lastOrder && (
                  <button
                    onClick={repeatLastOrder}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-charcoal hover:bg-charcoal/80 text-gold text-xs border border-gold/30 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Repeat Last Order</span>
                  </button>
                )}
              </div>

              <select
                value={selectedCustomerId || ""}
                onChange={(e) => setSelectedCustomerId(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-offWhite font-body text-sm"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-deepBlack text-offWhite">
                    {c.name} ({c.state_code === "33" ? "Tamil Nadu" : `State ${c.state_code}`})
                  </option>
                ))}
              </select>

              {selectedCust && (
                <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-charcoal/60">
                  <div>
                    <span className="text-mauve">GSTIN: </span>
                    <span className="text-offWhite font-mono">{selectedCust.gstin || "Unregistered"}</span>
                  </div>
                  <div>
                    <span className="text-mauve">Credit Terms: </span>
                    <span className="text-offWhite">{selectedCust.credit_days} Days (₹{(selectedCust.credit_limit_paise / 100).toLocaleString()})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Product Catalogue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-offWhite">Product Catalogue</h3>
                <span className="text-xs text-mauve">Whole packet increments</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => {
                  const qty = quantities[p.id] || 0;
                  const pricePaise = p.price_paise || (p.sale_price_paise || 5000);
                  const priceRupees = (pricePaise / 100).toFixed(2);

                  return (
                    <div
                      key={p.id}
                      className="glass-panel p-4 border border-charcoal/80 flex flex-col justify-between hover:border-violet/40 transition"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-heading font-bold text-sm text-offWhite">{p.name}</h4>
                            <p className="text-xs text-mauve mt-0.5">{p.sku || "FG-MURUKKU-200G"}</p>
                          </div>
                          <div className="font-heading font-bold text-gold text-sm">
                            ₹{priceRupees}
                            <span className="text-[10px] text-mauve font-normal"> / pkt</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-charcoal/60 flex items-center justify-between">
                        {/* Carton Quick-add (+20 pkts) */}
                        <button
                          onClick={() => addCarton(p.id)}
                          className="px-2.5 py-1.5 rounded bg-violet/20 hover:bg-violet/30 text-violet text-xs font-semibold border border-violet/30 flex items-center space-x-1"
                        >
                          <Package className="w-3 h-3" />
                          <span>+20 (Carton)</span>
                        </button>

                        {/* Stepper */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(p.id, -1)}
                            disabled={qty === 0}
                            className="w-7 h-7 rounded bg-charcoal hover:bg-charcoal/80 flex items-center justify-center text-offWhite disabled:opacity-30"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-heading font-bold text-sm text-offWhite">
                            {qty}
                          </span>
                          <button
                            onClick={() => updateQuantity(p.id, 1)}
                            className="w-7 h-7 rounded bg-violet hover:bg-violet/90 flex items-center justify-center text-white shadow-glow"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Review Sticky Bar / Card */}
            <div className="glass-panel-glow p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-mauve uppercase tracking-wider">
                <span>Order Summary</span>
                <span>{totals.isIntra ? "Intra-State (CGST + SGST)" : "Inter-State (IGST)"}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-charcoal/60">
                <div>
                  <div className="text-xs text-mauve">Packets</div>
                  <div className="font-heading font-bold text-lg text-offWhite">{totals.totalPackets}</div>
                </div>
                <div>
                  <div className="text-xs text-mauve">GST (5%)</div>
                  <div className="font-heading font-bold text-lg text-mauve">₹{totals.taxRupees}</div>
                </div>
                <div>
                  <div className="text-xs text-mauve">Total</div>
                  <div className="font-heading font-bold text-lg text-gold">₹{totals.totalRupees}</div>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={submitting || totals.totalPackets === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet to-violet/80 hover:from-violet/90 text-white font-heading font-semibold text-sm tracking-wider flex items-center justify-center space-x-2 shadow-glow disabled:opacity-40 transition"
              >
                <span>{submitting ? "Transmitting Order..." : "Submit Order (< 60s)"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══ TAB 2: MY ORDERS ═══ */}
        {tab === "my_orders" && (
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-offWhite">My Order History & Timeline</h3>
              <button onClick={loadData} className="text-mauve hover:text-offWhite">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="p-4 rounded-xl bg-charcoal/30 border border-charcoal/80 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-heading font-bold text-sm text-offWhite">{o.order_no}</div>
                      <div className="text-xs text-mauve">{o.customer_name} · {o.total_packets} packets</div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading font-bold text-gold text-sm">
                        ₹{(o.total_value_paise / 100).toFixed(2)}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                        o.status === "APPROVED" ? "bg-green-900/40 text-green-300 border border-green-500/30" :
                        o.status === "DISPATCHED" ? "bg-blue-900/40 text-blue-300 border border-blue-500/30" :
                        o.status === "SUBMITTED" ? "bg-yellow-900/40 text-yellow-300 border border-yellow-500/30" :
                        "bg-purple-900/40 text-purple-300 border border-purple-500/30"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                  </div>

                  {/* Visual Status Timeline */}
                  <div className="flex items-center justify-between text-[10px] text-mauve pt-2 border-t border-charcoal/60">
                    <span className={o.status === "SUBMITTED" || o.status === "APPROVED" || o.status === "INVOICED" || o.status === "DISPATCHED" ? "text-violet font-semibold" : ""}>
                      ● Submitted
                    </span>
                    <span className="text-charcoal">―</span>
                    <span className={o.status === "APPROVED" || o.status === "INVOICED" || o.status === "DISPATCHED" ? "text-violet font-semibold" : ""}>
                      ● Approved
                    </span>
                    <span className="text-charcoal">―</span>
                    <span className={o.status === "INVOICED" || o.status === "DISPATCHED" ? "text-violet font-semibold" : ""}>
                      ● Invoiced
                    </span>
                    <span className="text-charcoal">―</span>
                    <span className={o.status === "DISPATCHED" ? "text-green-400 font-semibold" : ""}>
                      ● Dispatched
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 3: CUSTOMER SALES ═══ */}
        {tab === "sales" && (
          <div className="glass-panel p-5 space-y-4">
            <h3 className="font-heading font-bold text-base text-offWhite">Customer-wise Sales Breakdown</h3>
            <div className="divide-y divide-charcoal/60">
              {customers.map((c) => {
                const custOrders = orders.filter((o) => o.customer_id === c.id);
                const totalValue = custOrders.reduce((sum, o) => sum + (o.total_value_paise || 0), 0) / 100;
                const totalPkts = custOrders.reduce((sum, o) => sum + (o.total_packets || 0), 0);

                return (
                  <div key={c.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-heading font-bold text-sm text-offWhite">{c.name}</div>
                      <div className="text-mauve mt-0.5">{custOrders.length} orders · {totalPkts} packets sold</div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading font-bold text-gold text-sm">₹{totalValue.toFixed(2)}</div>
                      <div className="text-[11px] text-mauve">{c.state_code === "33" ? "Intra-State" : "Inter-State"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-deepBlack/95 backdrop-blur-md border-t border-charcoal/80 flex justify-around p-2 md:hidden">
        <button
          onClick={() => setTab("new_order")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs transition ${
            tab === "new_order" ? "text-violet font-bold" : "text-mauve"
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span>New Order</span>
        </button>

        <button
          onClick={() => setTab("my_orders")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs transition ${
            tab === "my_orders" ? "text-violet font-bold" : "text-mauve"
          }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span>My Orders</span>
        </button>

        <button
          onClick={() => setTab("sales")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs transition ${
            tab === "sales" ? "text-violet font-bold" : "text-mauve"
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span>Sales</span>
        </button>
      </nav>
    </div>
  );
};
