"use client";
import dynamic from "next/dynamic";

const DashboardDonut = dynamic(() => import("./DashboardDonut"), { 
  ssr: false,
  loading: () => (
    <div className="w-10 h-10 rounded-full bg-brand-purple/20 animate-pulse border border-brand-purple/30" />
  )
});

export default function DashboardDonutDynamic() {
  return <DashboardDonut />;
}
