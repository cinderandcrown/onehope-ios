import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "One Hope",
  description: "Member demo for One Hope Church. Every invented record is labeled Sample.",
  applicationName: "One Hope",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "One Hope", statusBarStyle: "default" },
};

export default function MemberLayout({ children }: { children: ReactNode }) {
  return children;
}
