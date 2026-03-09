"use client";

import { motion } from "framer-motion";

export const StaggerContainer = ({
  children,
  className = "",
  delayOffset = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayOffset?: number;
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1,
            delayChildren: delayOffset,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const FadeUpItem = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring",
            damping: 25,
            stiffness: 200,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
