"use client";

import { motion } from "framer-motion";
import BackButton from "@/components/BackButton";

interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface PageLayoutProps {
  /** Page icon (ReactNode, e.g. <BookOpen className="w-7 h-7 text-brand-gold" />) */
  icon?: React.ReactNode;
  /** Main heading */
  title: string;
  /** Secondary description below title */
  subtitle?: string;
  /** Slot for action buttons on the right side of the header */
  actions?: React.ReactNode;
  /** Optional tab bar configuration */
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  /** Whether to show the back button */
  showBack?: boolean;
  /** Extra class on outer root */
  className?: string;
  /** Whether to show the decorative background glows */
  glow?: boolean;
  /** Icon color accent: 'gold' (default) or 'blue' */
  accent?: "gold" | "blue";
  children: React.ReactNode;
}

export default function PageLayout({
  icon,
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
  showBack = true,
  className = "",
  glow = true,
  accent = "gold",
  children,
}: PageLayoutProps) {
  return (
    <div className={`page-root relative ${className}`}>
      {/* Decorative background glows */}
      {glow && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
          <motion.div
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-10"
            style={{ background: accent === "gold" ? "#D4AF37" : "#3B82F6" }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.13, 0.08] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-10"
            style={{ background: accent === "gold" ? "#D4AF37" : "#6366F1" }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.11, 0.06] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>
      )}

      {/* Page inner content */}
      <div className="page-inner relative z-10">
        {/* Back button */}
        {showBack && <BackButton className="mb-6" />}

        {/* Page Hero Header */}
        <motion.div
          className="page-head"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="page-head-info">
            {icon && (
              <div className={accent === "blue" ? "page-head-icon-blue" : "page-head-icon"}>
                {icon}
              </div>
            )}
            <div>
              <h1 className="page-head-title">{title}</h1>
              {subtitle && <p className="page-head-subtitle">{subtitle}</p>}
            </div>
          </div>

          {/* Action slot */}
          {actions && (
            <motion.div
              className="flex items-center gap-3 flex-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {actions}
            </motion.div>
          )}
        </motion.div>

        {/* Tab bar */}
        {tabs && tabs.length > 0 && (
          <motion.div
            className="tab-bar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className={activeTab === tab.key ? "tab-item-active" : "tab-item"}
              >
                {tab.icon && <span className="inline-flex mr-2">{tab.icon}</span>}
                {tab.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Page content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
