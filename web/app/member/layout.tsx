import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "One Hope",
  description: "One Hope Church in Richardson. Sundays at 10:30 a.m.",
  applicationName: "One Hope",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "One Hope", statusBarStyle: "default" },
};

export default function MemberLayout({ children }: { children: ReactNode }) {
  return children;
}
