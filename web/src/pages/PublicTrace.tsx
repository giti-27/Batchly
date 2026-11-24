import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { ShieldCheck, CheckCircle2, Factory, Calendar, Award } from "lucide-react";
import { DimensionTorus } from "../components/VisualObjects";

export const PublicTrace: React.FC = () => {
  const { batch_no } = useParams<{ batch_no: string }>();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batch_no) {
      apiFetch(`/t/${batch_no}`)
        .then((res) => setData(res))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [batch_no]);

  return (
    <div className="min-h-screen bg-deepBlack text-offWhite flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gold/15 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        <div className="glass-panel-glow p-8 text-center space-y-6">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-violet to-gold">
            <Award className="w-8 h-8 text-deepBlack" />
          </div>

          <div>
            <h1 className="font-heading text-2xl font-bold tracking-wide text-offWhite">
              Product Authenticity Certificate
            </h1>
            <p className="text-xs text-mauve mt-1 font-body">BATCHLY Tamper-Evident Traceability Verification</p>
          </div>

          {loading ? (
            <div className="py-8 text-mauve text-xs">Verifying batch authenticity...</div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-900/30 border border-red-500/40 text-red-200 text-xs">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-4 text-left">
              <div className="p-4 rounded-xl bg-charcoal/50 border border-charcoal/80 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-charcoal">
                  <span className="text-mauve uppercase tracking-wider">Product</span>
                  <span className="font-heading font-bold text-offWhite text-sm">{data.product_name}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-mauve">Batch Number</span>
                  <span className="font-mono text-gold font-bold">{data.batch_no}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-mauve">Manufacturing Date</span>
                  <span className="text-offWhite">{data.mfg_date}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-mauve">Expiry Date</span>
                  <span className="text-offWhite">{data.expiry_date}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-charcoal">
                  <span className="text-mauve">Factory Location</span>
                  <span className="text-offWhite text-right">{data.factory_location}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-green-900/30 border border-green-500/30 flex items-center justify-center gap-2 text-green-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified Genuine Food Manufacturing Batch</span>
              </div>
            </div>
          ) : null}

          <div className="pt-4 border-t border-charcoal/60 text-[11px] text-mauve/70">
            Certified by BATCHLY Food Manufacturing Intelligence Platform
          </div>
        </div>
      </div>
    </div>
  );
};
