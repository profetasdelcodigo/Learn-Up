"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ 
  children,
  className = "w-full h-full flex flex-col"
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
