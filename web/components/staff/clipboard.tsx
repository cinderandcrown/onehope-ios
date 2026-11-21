"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="button secondary"
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button className="button secondary" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
