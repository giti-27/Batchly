import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setAuthToken, setCurrentUser } from "../lib/api";
import { DimensionTorus, DimensionSphere } from "../components/VisualObjects";
import { Shield, Sparkles, ArrowRight, UserCheck } from "lucide-react";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setAuthToken(res.access_token);
      setCurrentUser(res.username, res.role);

      // Route by role
      if (res.role === "SALESMAN") navigate("/salesman");
      else if (res.role === "PRODUCTION") navigate("/production");
      else if (res.role === "AUDITOR") navigate("/auditor");
      else if (res.role === "OWNER") navigate("/owner");
      else navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (roleUser: string) => {
    setUsername(roleUser);
    setPassword("demo123");
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Dimensional Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gold/15 rounded-full blur-[128px] pointer-events-none" />

      {/* Decorative 3D elements in corners */}
      <div className="hidden lg:block absolute top-12 right-20 opacity-70 pointer-events-none">
        <DimensionTorus size={220} glowColor="#8050ED" />
      </div>
      <div className="hidden lg:block absolute bottom-12 left-20 opacity-60 pointer-events-none">
        <DimensionSphere size={160} />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="glass-panel-glow p-8 relative">
          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet to-gold p-[2px] mb-4 shadow-glow">
              <div className="w-full h-full bg-deepBlack rounded-[14px] flex items-center justify-center">
                <span className="font-heading font-black text-2xl text-gold">B</span>
              </div>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-wider text-offWhite">BATCHLY</h1>
            <p className="text-sm text-mauve mt-1 font-body">From Salesman's Order to Auditor's Report</p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-mauve mb-1 font-body">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-offWhite font-body text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-mauve mb-1 font-body">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-charcoal/60 border border-charcoal focus:border-violet focus:outline-none text-offWhite font-body text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-violet to-violet/80 hover:from-violet/90 hover:to-violet text-white font-heading font-semibold text-sm tracking-wider flex items-center justify-center space-x-2 shadow-glow transition"
            >
              <span>{loading ? "Authenticating..." : "Access Operations"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Role Switcher for instant evaluation */}
          <div className="mt-8 pt-6 border-t border-charcoal/60">
            <div className="text-[11px] uppercase tracking-wider text-mauve text-center mb-3 flex items-center justify-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-gold" />
              <span>Quick Test Personas (Pass: demo123)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => quickLogin("admin")}
                className="py-1.5 px-2 rounded bg-charcoal/40 hover:bg-violet/20 hover:border-violet/40 border border-charcoal/60 text-offWhite text-center transition"
              >
                Admin
              </button>
              <button
                onClick={() => quickLogin("salesman_a")}
                className="py-1.5 px-2 rounded bg-charcoal/40 hover:bg-violet/20 hover:border-violet/40 border border-charcoal/60 text-offWhite text-center transition"
              >
                Salesman
              </button>
              <button
                onClick={() => quickLogin("production")}
                className="py-1.5 px-2 rounded bg-charcoal/40 hover:bg-violet/20 hover:border-violet/40 border border-charcoal/60 text-offWhite text-center transition"
              >
                Production
              </button>
              <button
                onClick={() => quickLogin("auditor")}
                className="py-1.5 px-2 rounded bg-charcoal/40 hover:bg-violet/20 hover:border-violet/40 border border-charcoal/60 text-offWhite text-center transition"
              >
                Auditor
              </button>
              <button
                onClick={() => quickLogin("owner")}
                className="py-1.5 px-2 rounded bg-charcoal/40 hover:bg-violet/20 hover:border-violet/40 border border-charcoal/60 text-offWhite text-center transition"
              >
                Owner
              </button>
              <button
                onClick={() => quickLogin("salesman_b")}
                className="py-1.5 px-2 rounded bg-charcoal/40 hover:bg-violet/20 hover:border-violet/40 border border-charcoal/60 text-offWhite text-center transition"
              >
                Salesman B
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
