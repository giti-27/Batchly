import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setAuthToken, setCurrentUser } from "../lib/api";
import {
  Shield, Sparkles, ArrowRight, UserCheck, Lock, User,
  CheckCircle2, AlertOctagon, X, Factory, ShoppingCart,
  FileCheck, Crown, Eye, EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Persona {
  id: string;
  name: string;
  role: string;
  desc: string;
  icon: React.ReactNode;
}

const PERSONAS: Persona[] = [
  {
    id: "admin",
    name: "Operations Admin",
    role: "ADMIN",
    desc: "Order inbox, stock reserve, GST billing & FEFO dispatch",
    icon: <Shield className="w-4 h-4 text-violet" />,
  },
  {
    id: "salesman_a",
    name: "Field Salesman",
    role: "SALESMAN",
    desc: "Mobile catalogue, +20 cartons, offline sync",
    icon: <ShoppingCart className="w-4 h-4 text-sage" />,
  },
  {
    id: "salesman_b",
    name: "Field Salesman B",
    role: "SALESMAN",
    desc: "Distributor B orders and order-status tracking",
    icon: <ShoppingCart className="w-4 h-4 text-sage" />,
  },
  {
    id: "production",
    name: "Plant Supervisor",
    role: "PRODUCTION",
    desc: "Tablet runs, BOM raw issue, yield & costing",
    icon: <Factory className="w-4 h-4 text-gold" />,
  },
  {
    id: "auditor",
    name: "Statutory Auditor",
    role: "AUDITOR",
    desc: "Strictly read-only, GSTR-1/3B, recall simulator",
    icon: <FileCheck className="w-4 h-4 text-mauve" />,
  },
  {
    id: "owner",
    name: "Executive Owner",
    role: "OWNER",
    desc: "12 KPI widgets, what-if profit simulator",
    icon: <Crown className="w-4 h-4 text-gold" />,
  },
];

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("demo123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>("admin");

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
      setError(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPersona = (p: Persona) => {
    setSelectedPersona(p.id);
    setUsername(p.id);
    setPassword("demo123");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-body selection:bg-violet selection:text-white">
      {/* Background Dimensional Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-sage/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[32rem] h-[32rem] bg-sage/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Quiet mint ripple details: slow, soft and intentionally unobtrusive. */}
      <div aria-hidden="true" className="absolute -top-20 right-[8%] hidden md:block">
        <span className="login-ripple" style={{ "--ripple-size": "19rem" } as React.CSSProperties} />
        <span className="login-ripple login-ripple-delay" style={{ "--ripple-size": "19rem" } as React.CSSProperties} />
      </div>
      <div aria-hidden="true" className="absolute -bottom-24 left-[5%] hidden md:block">
        <span className="login-ripple" style={{ "--ripple-size": "15rem" } as React.CSSProperties} />
        <span className="login-ripple login-ripple-delay" style={{ "--ripple-size": "15rem" } as React.CSSProperties} />
      </div>

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Main Glassmorphic Card */}
        <div className="glass-panel-glow p-6 sm:p-10 relative backdrop-blur-xl border border-sage/80 shadow-2xl">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-sage p-[2px] mb-4 shadow-glow">
              <div className="w-full h-full bg-deepBlack rounded-[14px] flex items-center justify-center">
                <span className="font-heading font-normal text-3xl text-sage">B</span>
              </div>
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-widest text-deepBlack uppercase">
              BATCHLY
            </h1>
            <p className="text-xs sm:text-sm text-mauve mt-2 tracking-wide font-body">
              From Salesman's Order to Auditor's Report
            </p>
          </div>

          {/* Styled Error Alert Toast */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-red-900/30 border border-red-500/40 text-red-200 text-xs flex items-start justify-between gap-3 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-mauve hover:text-offWhite transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-mauve mb-1.5 font-body">
                Operator Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-mauve">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or salesman_a"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-offWhite border border-sage/70 focus:border-violet focus:ring-1 focus:ring-sage focus:outline-none text-deepBlack font-body text-sm transition placeholder:text-mauve/80"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-mauve mb-1.5 font-body">
                Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-mauve">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-charcoal/60 border border-charcoal/90 focus:border-violet focus:ring-1 focus:ring-violet focus:outline-none text-offWhite font-body text-sm transition placeholder:text-mauve/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-mauve hover:text-offWhite transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-sage hover:bg-[#7BE7BD] text-deepBlack font-heading font-semibold text-sm tracking-wider flex items-center justify-center space-x-2 shadow-glow hover:shadow-glow/80 active:scale-[0.99] transition duration-200 disabled:opacity-50"
            >
              <span>{loading ? "Authenticating Persona..." : "Enter Operations Platform"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Test Persona Selector */}
          <div className="mt-8 pt-6 border-t border-sage/60">
            <div className="text-[11px] uppercase tracking-wider text-mauve text-center mb-3 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span>Selectable Demo Personas (Pass: demo123)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {PERSONAS.map((p) => {
                const isSelected = selectedPersona === p.id;
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPersona(p)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectPersona(p);
                      }
                    }}
                    className={`p-3 rounded-xl cursor-pointer border transition flex items-start gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                      isSelected
                        ? "bg-sage/35 border-violet shadow-glow"
                        : "bg-offWhite border-sage/50 hover:bg-sage/15 hover:border-violet/40"
                    }`}
                  >
                    <div className="mt-0.5">{p.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-bold text-deepBlack truncate text-xs">
                          {p.name}
                        </span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-sage/30 text-deepBlack font-mono">
                          {p.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-mauve truncate mt-0.5">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
