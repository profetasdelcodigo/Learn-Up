"use client";
import { motion } from "framer-motion";
import React from "react";

export function MotionCard({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(240,200,80,0.12)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}
