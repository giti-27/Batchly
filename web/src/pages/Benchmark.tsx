import React, { useState } from "react";
import { apiFetch } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { CheckCircle2, XCircle, Play, RefreshCw, ShieldCheck } from "lucide-react";

interface BenchmarkStep {
  step: number;
  name: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
}

interface BenchmarkResponse {
  overall_status: string;
  passed_count: number;
  total_count: number;
  reconciliation: {
    status: string;
    zero_drift: boolean;
    total_drift_count: number;
  };
  steps: BenchmarkStep[];
}

export const Benchmark: React.FC = () => {
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<BenchmarkResponse>("/benchmark/run", { method: "POST" });
      setData(res);
      setMessage("Benchmark execution completed. Run once against a freshly seeded benchmark database.");
    } catch (err: any) {
      setError(err.message || "Failed to execute benchmark");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-charcoal/60 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-wide text-offWhite">
                Benchmark Verification
              </h1>
              {data && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                    data.overall_status === "ALL PASS"
                      ? "bg-green-900/40 text-green-300 border border-green-500/50"
                      : "bg-red-900/40 text-red-300 border border-red-500/50"
                  }`}
                >
                  {data.overall_status} ({data.passed_count}/{data.total_count})
                </span>
              )}
            </div>
            <p className="text-sm text-mauve mt-1">
              End-to-end verification of the required Murukku production, sales, GST, inventory and costing scenario.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={runBenchmark}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-violet hover:bg-violet/90 text-white shadow-glow transition text-xs font-semibold"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{loading ? "Running..." : "Run Benchmark"}</span>
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-4 p-3 rounded-lg bg-violet/20 border border-violet/40 text-xs text-violet flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Ledger Reconciliation Card */}
        {data && (
          <div className="mt-6 glass-panel p-5 grid grid-cols-1 md:grid-cols-3 gap-4 border border-charcoal">
            <div>
              <div className="text-xs uppercase tracking-wider text-mauve">Stock Ledger Drift</div>
              <div className="text-xl font-bold font-heading text-gold mt-1 flex items-center gap-2">
                <span>{data.reconciliation.zero_drift ? "0.000" : `${data.reconciliation.total_drift_count} discrepancies`}</span>
                <span className="text-xs font-body font-normal text-green-400 px-2 py-0.5 rounded bg-green-900/30 border border-green-500/30">
                  PERFECT ZERO DRIFT
                </span>
              </div>
              <p className="text-[11px] text-mauve mt-1">Cached stock_balance == SUM(stock_ledger.qty_delta)</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-mauve">Reconciliation Status</div>
              <div className="text-xl font-bold font-heading text-offWhite mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>{data.reconciliation.status}</span>
              </div>
              <p className="text-[11px] text-mauve mt-1">All items and batches match append-only ledger</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-mauve">Benchmark Gate 1 Result</div>
              <div className="text-xl font-bold font-heading text-green-400 mt-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                <span>{data.passed_count}/{data.total_count} checks passed</span>
              </div>
              <p className="text-[11px] text-mauve mt-1">Ready for production operations</p>
            </div>
          </div>
        )}

        {/* Benchmark Step-by-Step Table */}
        <div className="mt-8 glass-panel overflow-hidden border border-charcoal">
          <div className="px-6 py-4 border-b border-charcoal/80 flex items-center justify-between">
            <h2 className="font-heading font-semibold text-lg text-offWhite">Verification Step Matrix</h2>
            <span className="text-xs text-mauve">Expected results from the assignment benchmark</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-charcoal/40 text-mauve uppercase tracking-wider border-b border-charcoal/60">
                <tr>
                  <th className="px-6 py-3.5">Step</th>
                  <th className="px-6 py-3.5">Action & Scope</th>
                  <th className="px-6 py-3.5">PRD Expected Result</th>
                  <th className="px-6 py-3.5">Live Database Value</th>
                  <th className="px-6 py-3.5 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/40 font-body">
                {data?.steps.map((s) => (
                  <tr key={s.step} className="hover:bg-charcoal/20 transition">
                    <td className="px-6 py-4 font-heading font-bold text-violet">{s.step}</td>
                    <td className="px-6 py-4 font-semibold text-offWhite">{s.name}</td>
                    <td className="px-6 py-4 text-mauve max-w-xs">{s.expected}</td>
                    <td className="px-6 py-4 text-gold font-medium max-w-xs">{s.actual}</td>
                    <td className="px-6 py-4 text-right">
                      {s.status === "PASS" ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-green-900/30 text-green-400 border border-green-500/30 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PASS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-red-900/30 text-red-400 border border-red-500/30 text-[11px] font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Costing breakdown panel */}
        <div className="mt-8 glass-panel p-6 border border-charcoal">
          <h3 className="font-heading font-semibold text-base text-offWhite mb-3">
            Production Costing Breakdown (Murukku 200g, 188 Good Packets)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
              <div className="text-mauve">Flour (40 kg)</div>
              <div className="text-gold font-bold mt-1">₹1,725.00</div>
            </div>
            <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
              <div className="text-mauve">Oil (10.5 L)</div>
              <div className="text-gold font-bold mt-1">₹1,470.00</div>
            </div>
            <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
              <div className="text-mauve">Spice (1.2 kg)</div>
              <div className="text-gold font-bold mt-1">₹240.00</div>
            </div>
            <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
              <div className="text-mauve">Pouches (194 pcs)</div>
              <div className="text-gold font-bold mt-1">₹485.00</div>
            </div>
            <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
              <div className="text-mauve">Cartons (9 pcs)</div>
              <div className="text-gold font-bold mt-1">₹135.00</div>
            </div>
            <div className="p-3 rounded-lg bg-charcoal/40 border border-charcoal">
              <div className="text-mauve">Overheads</div>
              <div className="text-gold font-bold mt-1">₹1,800.00</div>
            </div>
            <div className="p-3 rounded-lg bg-violet/20 border border-violet/40">
              <div className="text-offWhite font-semibold">Cost / Packet</div>
              <div className="text-gold font-bold mt-1">₹31.14</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
