import { projectCapabilities, type CapabilityView } from "./adapter-registry";

export type Capability = CapabilityView;

/**
 * Generated from the adapter registry. A row is live only when the registry
 * says the code exists and any required tenant credential is connected.
 * Callers that know which providers are connected should use projectCapabilities.
 */
export const CAPABILITIES: readonly Capability[] = projectCapabilities(new Set());

export const PUBLIC_KJV = {
  reference: "John 3:16",
  translation: "KJV",
  publicDomain: true,
  text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
} as const;
