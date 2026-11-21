import { toString as qrToString } from "qrcode";

/** SVG for an otpauth URL. The secret never leaves the signed-in staff session. */
export function qrSvg(text: string): Promise<string> {
  return qrToString(text, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" });
}
