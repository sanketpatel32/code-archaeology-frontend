import type { ReactNode } from "react";
import DashboardNav from "@/components/DashboardNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <div className="ambient-grid" aria-hidden="true" />
      <div className="page-shell">
        <DashboardNav />
        {children}
      </div>
    </div>
  );
}
