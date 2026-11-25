
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAuth, getCurrentUserRole } from "../lib/api";
import { LogOut, Cpu, Lock } from "lucide-react";

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const role = getCurrentUserRole();
  const username = localStorage.getItem("batchly_username");

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-charcoal/60 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet to-gold flex items-center justify-center p-[2px] shadow-glow">
            <div className="w-full h-full bg-deepBlack rounded-[10px] flex items-center justify-center">
              <span className="font-heading font-black text-xl text-gold tracking-widest">
                B
              </span>
            </div>
          </div>

          <div>
            <h1 className="font-heading font-bold text-lg tracking-wider text-offWhite flex items-center gap-2">
              BATCHLY
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet/20 text-violet font-body border border-violet/30">
                PROD OPS
              </span>
            </h1>
            <p className="text-[11px] text-mauve font-body">
              From Salesman's Order to Auditor's Report
            </p>
          </div>
        </Link>

        {role === "AUDITOR" && (
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-mauve/20 border border-mauve/40 text-mauve text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>STRICTLY READ-ONLY</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {role === "ADMIN" && (
          <Link
            to="/benchmark"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25 transition text-xs font-medium"
          >
            <Cpu className="w-4 h-4" />
            <span className="hidden sm:inline">Benchmark Hub</span>
          </Link>
        )}

        {role && (
          <div className="flex items-center space-x-3 border-l border-charcoal pl-4">
            <div className="text-right">
              <div className="text-xs font-semibold text-offWhite">
                {username}
              </div>
              <div className="text-[10px] text-violet uppercase tracking-wider">
                {role}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-charcoal text-mauve hover:text-offWhite transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
