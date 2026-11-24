import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { ShoppingCart, Clock, TrendingUp, Plus, Minus, Package, Check, Sparkles, AlertCircle } from "lucide-react";

export const SalesmanWorkspace: React.FC = () => {
  const [tab, setTab] = useState<"new_order" | "my_orders" | "sales">("new_order");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [custs, prods, ords] = await Promise.all([
        apiFetch("/customers"),
        apiFetch("/products"),
        apiFetch("/orders"),
      ]);
      setCustomers(custs);
      setProducts(prods);
      setOrders(ords);
      if (custs.length > 0) setSelectedCustomerId(custs[0].id);
    } catch (err: any) {
      setError(err.message);
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
    updateQuantity(productId, 20); // Quick-add carton adds 20 packets
  };

  const calculateTotals = () => {
    let totalPackets = 0;
    let taxablePaise = 0;
    products.forEach((p) => {
      const qty = quantities[p.id] || 0;
      totalPackets += qty;
      taxablePaise += qty * p.price_paise;
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
    if (!selectedCustomerId) return;
    const lines = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => ({
        product_id: parseInt(prodId),
        qty_ordered: qty,
      }));

    if (lines.length === 0) {
      setError("Please add at least 1 packet to order.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Client-generated UUID for idempotency (Invariant I10)
      const client_uuid = `mob-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          client_uuid,
          customer_id: selectedCustomerId,
          lines,
          notes: "Placed via Salesman Mobile PWA",
        }),
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

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col pb-20 md:pb-6">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 text-xs">
            {error}
          </div>
        )}
        {orderSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-500/40 text-green-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{orderSuccess}</span>
          </div>
        )}

        {/* Tab 1: New Order */}
        {tab === "new_order" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold text-offWhite">Order Booking</h2>
                <p className="text-xs text-mauve">Instant order booking with offline queue</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-violet/20 border border-violet/30 text-violet">
                Carton = 20 pkts
              </span>
            </div>

            {/* Customer Picker */}
            <div className="glass-panel p-4 border border-charcoal">
              <label className="block text-xs uppercase tracking-wider text-mauve mb-2">Select Customer</label>
              <select
                value={selectedCustomerId || ""}
                onChange={(e) => setSelectedCustomerId(parseInt(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-charcoal border border-charcoal/80 text-offWhite text-sm focus:border-violet focus:outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.address} ({c.state_code === "33" ? "Tamil Nadu / Intra" : "Inter-State"})
                  </option>
                ))}
              </select>
            </div>

            {/* Product Catalogue Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((p) => {
                const qty = quantities[p.id] || 0;
                return (
                  <div key={p.id} className="glass-panel p-4 border border-charcoal flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-violet">{p.family_id}</span>
                        <span className="text-xs font-bold text-gold">₹{(p.price_paise / 100).toFixed(2)}</span>
                      </div>
                      <h3 className="font-heading text-base font-semibold text-offWhite mt-1">{p.pack_size_label}</h3>
                      <p className="text-xs text-mauve mt-0.5">Whole packets increment</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-charcoal/60 flex items-center justify-between">
                      <button
                        onClick={() => addCarton(p.id)}
                        className="px-2.5 py-1 rounded bg-charcoal hover:bg-violet/30 border border-mauve/30 text-xs text-offWhite transition"
                      >
                        +20 (Carton)
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(p.id, -1)}
                          className="w-8 h-8 rounded-lg bg-charcoal flex items-center justify-center text-offWhite hover:bg-charcoal/80"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-heading font-bold text-offWhite">{qty}</span>
                        <button
                          onClick={() => updateQuantity(p.id, 1)}
                          className="w-8 h-8 rounded-lg bg-violet flex items-center justify-center text-white hover:bg-violet/90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Order Review Summary Bar */}
            <div className="glass-panel-glow p-4 border border-violet/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs text-mauve">
                  {totals.totalPackets} Packets · Taxable: ₹{totals.taxableRupees} · GST (5%): ₹{totals.taxRupees}
                </div>
                <div className="text-lg font-heading font-bold text-gold">
                  Total: ₹{totals.totalRupees}
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={submitting || totals.totalPackets === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-violet hover:bg-violet/90 text-white font-heading font-semibold text-sm shadow-glow transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Order"}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: My Orders */}
        {tab === "my_orders" && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-offWhite">My Booked Orders</h2>
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="glass-panel p-4 border border-charcoal flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-heading font-bold text-sm text-offWhite">{o.order_no}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                        o.status === "DISPATCHED" ? "bg-green-900/40 text-green-300 border border-green-500/30" :
                        o.status === "APPROVED" ? "bg-blue-900/40 text-blue-300 border border-blue-500/30" :
                        o.status === "INVOICED" ? "bg-purple-900/40 text-purple-300 border border-purple-500/30" :
                        "bg-yellow-900/40 text-yellow-300 border border-yellow-500/30"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                    <p className="text-xs text-mauve mt-1">{o.customer_name} · {o.total_packets} packets</p>
                    <p className="text-[11px] text-mauve/70 mt-0.5">{o.created_at}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-bold text-gold text-base">
                      ₹{(o.total_value_paise / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Sales */}
        {tab === "sales" && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-offWhite">Customer-wise Sales</h2>
            <div className="glass-panel p-4 border border-charcoal">
              <p className="text-xs text-mauve mb-4">Invoiced sales for your assigned retailer portfolio</p>
              {customers.map((c) => (
                <div key={c.id} className="py-3 border-b border-charcoal/60 flex items-center justify-between last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-offWhite">{c.name}</div>
                    <div className="text-xs text-mauve">{c.address}</div>
                  </div>
                  <div className="text-xs font-bold text-gold">Active Customer</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-charcoal px-6 py-3 flex justify-around md:hidden z-40">
        <button
          onClick={() => setTab("new_order")}
          className={`flex flex-col items-center space-y-1 text-xs ${tab === "new_order" ? "text-violet font-bold" : "text-mauve"}`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span>New Order</span>
        </button>
        <button
          onClick={() => setTab("my_orders")}
          className={`flex flex-col items-center space-y-1 text-xs ${tab === "my_orders" ? "text-violet font-bold" : "text-mauve"}`}
        >
          <Clock className="w-5 h-5" />
          <span>My Orders</span>
        </button>
        <button
          onClick={() => setTab("sales")}
          className={`flex flex-col items-center space-y-1 text-xs ${tab === "sales" ? "text-violet font-bold" : "text-mauve"}`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Sales</span>
        </button>
      </nav>
    </div>
  );
};
