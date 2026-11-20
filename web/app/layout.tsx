import type { Metadata } from "next";
import type { ReactNode } from "react";

import { churchImages } from "@onehope/server";

import "./globals.css";

export function generateMetadata(): Metadata {
  const og = churchImages(process.env).og;
  return {
    title: "One Hope Command Center",
    description: "Staff tools for One Hope Church in Richardson, Texas.",
    icons: { icon: "/apple-touch-icon.png" },
    openGraph: og ? { images: [og] } : undefined,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
