import React from "react";
import { motion } from "framer-motion";

export const DimensionTorus: React.FC<{ size?: number; glowColor?: string }> = ({ size = 180, glowColor = "#8050ED" }) => {
  return (
    <motion.div
      animate={{
        rotateY: [0, 360],
        rotateX: [15, -15, 15],
        y: [-8, 8, -8],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="relative flex items-center justify-center pointer-events-none"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-40"
        style={{ background: glowColor }}
      />
      <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className="relative z-10 drop-shadow-2xl">
        <defs>
          <radialGradient id="torusGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E7CA65" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#8050ED" stopOpacity="0.85" />
            <stop offset="85%" stopColor="#39333B" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#080808" />
          </radialGradient>
          <linearGradient id="wireGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BFCFC1" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#8050ED" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E7CA65" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* Abstract 3D Torus Wireframe & Surface */}
        <ellipse cx="100" cy="100" rx="75" ry="42" stroke="url(#wireGrad)" strokeWidth="3" fill="url(#torusGrad)" />
        <ellipse cx="100" cy="100" rx="35" ry="18" stroke="url(#wireGrad)" strokeWidth="2.5" fill="#080808" />
        <path d="M 25 100 C 25 70, 175 70, 175 100" stroke="#E7CA65" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
        <path d="M 40 100 C 40 120, 160 120, 160 100" stroke="#8050ED" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
      </svg>
    </motion.div>
  );
};

export const DimensionSphere: React.FC<{ size?: number }> = ({ size = 140 }) => {
  return (
    <motion.div
      animate={{
        rotateZ: [0, 180, 360],
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "linear",
      }}
      className="relative flex items-center justify-center pointer-events-none"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full blur-xl bg-gold opacity-30" />
      <svg width={size} height={size} viewBox="0 0 160 160" fill="none">
        <circle cx="80" cy="80" r="60" stroke="#E7CA65" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
        <ellipse cx="80" cy="80" rx="60" ry="25" stroke="#BFCFC1" strokeWidth="2" opacity="0.7" />
        <ellipse cx="80" cy="80" rx="25" ry="60" stroke="#8050ED" strokeWidth="2" opacity="0.7" />
      </svg>
    </motion.div>
  );
};
